import json
import os
import argparse
import time
import shutil
from typing import List, Dict, Any
from vertexai.generative_models import GenerativeModel, Tool, GoogleSearchRetrieval
from vertexai.preview import generative_models as preview_generative_models
from vertexai.preview.generative_models import caching
import datetime

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "src/data")
CREATURES_FILE = os.path.join(DATA_DIR, "creatures_seed.json")
LOCATIONS_FILE = os.path.join(DATA_DIR, "locations_seed.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "point_creatures_seed.json")

PROJECT_ID = "dive-dex-app-dev" # or read from env
LOCATION = "us-central1"

vertexai.init(project=PROJECT_ID, location=LOCATION)

class CleansingPipeline:
    def __init__(self):
        self.model_name = "gemini-1.5-flash-002"
        self.flash_model = GenerativeModel(self.model_name)
        self.tools = [
            Tool.from_google_search_retrieval(
                google_search_retrieval=GoogleSearchRetrieval()
            )
        ]
        self.grounded_model = GenerativeModel(self.model_name, tools=self.tools)
        self.cache = None

    def create_context_cache(self):
        """
        Explicit Context Caching (Issue #49 - Improvements)
        Caches the creature dictionary and system rules to reduce input token costs.
        """
        print("💾 Creating Context Cache for Biological Dictionary...")
        system_instruction = (
            "あなたは海洋生物学者です。提供された生物リストの生態に基づき、"
            "特定のダイビングポイントに生息可能か判断します。出力は必ずJSON形式で。"
        )

        # Compile creature dictionary for caching
        creatures_context = "\n".join([
            f"ID:{c['id']} - {c['name']}: {c['description']} (水深:{json.dumps(c.get('depthRange'))})"
            for c in self.creatures
        ])

        # Create CachedContent
        self.cache = caching.CachedContent.create(
            model_name=self.model_name,
            system_instruction=system_instruction,
            contents=[creatures_context],
            ttl=datetime.timedelta(minutes=60),
        )
        print(f"✅ Context Cache created: {self.cache.name}")

    def load_data(self):
        with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
            self.creatures = json.load(f)
        with open(LOCATIONS_FILE, 'r', encoding='utf-8') as f:
            self.locations = json.load(f)

        self.points = []
        self._extract_points(self.locations)
        print(f"📊 Loaded {len(self.creatures)} creatures and {len(self.points)} points.")

    def _extract_points(self, hierarchy, region="", zone="", area=""):
        for item in hierarchy:
            name = item.get("name", "")
            if item.get("type") == "Point":
                self.points.append({
                    "id": item.get("id"),
                    "name": name,
                    "region": region,
                    "zone": zone,
                    "area": area,
                    "maxDepth": item.get("maxDepth", 40),
                    "topography": item.get("topography", [])
                })
            elif "children" in item:
                if not region: r, z, a = name, zone, area
                elif not zone: r, z, a = region, name, area
                else: r, z, a = region, zone, name
                self._extract_points(item["children"], r, z, a)

    def run_stage1_batch(self, point) -> List[Dict[str, Any]]:
        """Stage 1: Batch physical constraint filtering (Using Context Cache)."""
        prompt = f"""
        ダイビングポイント「{point['name']}」の条件に基づき、生息可能な生物をキャッシュ内の辞書から抽出してください。
        ポイント水深: {point['maxDepth']}m
        地形: {json.dumps(point['topography'])}

        出力は以下のJSON配列形式のみで行ってください。
        [
            {{ "creature_id": "string", "is_possible": boolean, "rarity": "string", "confidence": float }}
        ]
        """

        model = GenerativeModel(self.model_name)
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"},
            cached_content=self.cache.name if self.cache else None
        )

        try:
            return json.loads(response.text)
        except:
            return []

    def run_stage2_grounding(self, point, creature) -> Dict[str, Any]:
        """Stage 2: Factual verification via Google Search."""
        prompt = f"""
        「{point['name']}」({point['region']})での「{creature['name']}」の目撃実績を調査してください。
        回答は「actual_existence」(bool), 「evidence」(str), 「rarity」を含むJSONで。
        """
        response = self.grounded_model.generate_content(prompt)
        text = response.text
        try:
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            return json.loads(text)
        except:
            return {"actual_existence": True, "evidence": text[:200], "rarity": "Rare"}

    def process(self, mode="new", limit=10):
        self.load_data()
        self.create_context_cache()

        point_creatures = []
        if os.path.exists(OUTPUT_FILE) and mode != "all":
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                point_creatures = json.load(f)

        existing_keys = {f"{pc['pointId']}_{pc['creatureId']}" for pc in point_creatures}

        count = 0
        for p in self.points:
            if count >= limit: break

            print(f"🔍 Point Checking: {p['name']}...")
            s1_results = self.run_stage1_batch(p)

            for res in s1_results:
                if count >= limit: break
                creature_id = res.get("creature_id")
                if not res.get("is_possible") or not creature_id: continue

                key = f"{p['id']}_{creature_id}"
                if mode == "new" and key in existing_keys: continue

                creature = next((c for c in self.creatures if c['id'] == creature_id), None)
                if not creature: continue

                print(f"  🌐 Grounding: {creature['name']}...")
                s2 = self.run_stage2_grounding(p, creature)

                if s2.get("actual_existence"):
                    new_entry = {
                        "id": key,
                        "pointId": p['id'],
                        "creatureId": creature['id'],
                        "localRarity": s2.get("rarity", res.get("rarity", "Rare")),
                        "status": "pending",
                        "reasoning": s2.get("evidence", ""),
                        "confidence": (res.get("confidence", 0.5) + 0.3) / 1.3
                    }
                    # Update or append
                    point_creatures = [pc for pc in point_creatures if pc["id"] != key]
                    point_creatures.append(new_entry)
                    count += 1

            time.sleep(1)

        # Backup & Save
        if os.path.exists(OUTPUT_FILE):
            backup_file = f"{OUTPUT_FILE}.bak"
            shutil.copy2(OUTPUT_FILE, backup_file)
            print(f"📁 Backup created: {backup_file}")

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(point_creatures, f, indent=2, ensure_ascii=False)
        print(f"🚀 Saved {count} new entries. Total: {len(point_creatures)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["all", "new"], default="new")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    pipeline = CleansingPipeline()
    pipeline.process(mode=args.mode, limit=args.limit)
