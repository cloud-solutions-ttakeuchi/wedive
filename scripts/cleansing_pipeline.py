# Immediate startup log (bypassing logging config to ensure it's seen)
print("🚀 Starting Cleansing Pipeline Script...", flush=True)

import json
import os
import argparse
import time
import logging
from typing import List, Dict, Any
from datetime import datetime, timezone
from google import genai
from google.genai import types
import firebase_admin
from firebase_admin import credentials, firestore
import sys

# --- Logging Configuration ---
log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# --- Configuration ---
PROJECT_ID = (
    os.environ.get("GOOGLE_CLOUD_PROJECT") or
    os.environ.get("GCLOUD_PROJECT") or
    os.environ.get("VITE_FIREBASE_PROJECT_ID")
)
LOCATION = os.environ.get("LOCATION") or os.environ.get("AI_AGENT_LOCATION")

if not PROJECT_ID:
    print("❌ FATAL: PROJECT_ID is not set. Checked: GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT, VITE_FIREBASE_PROJECT_ID", flush=True)
    sys.exit(1)

if not LOCATION:
    print("❌ FATAL: LOCATION is not set. Checked: LOCATION, AI_AGENT_LOCATION", flush=True)
    sys.exit(1)

print(f"ℹ️ Configured with PROJECT_ID={PROJECT_ID}, LOCATION={LOCATION}, LOG_LEVEL={log_level}", flush=True)

class CleansingPipeline:
    def __init__(self):
        self.model_name = "gemini-2.0-flash-001"
        # Use us-central1 as default for AI if not specified,
        # as gemini-2.0-flash and caching are more likely to be available there.
        self.ai_location = os.environ.get("AI_LOCATION") or "us-central1"
        self.project_id = PROJECT_ID

        logger.info(f"🤖 Initializing GenAI Client (AI_LOCATION={self.ai_location})")
        self.client = genai.Client(
            vertexai=True,
            project=self.project_id,
            location=self.ai_location
        )
        self.cache = None

        # Initialize Firestore
        if not firebase_admin._apps:
            firebase_admin.initialize_app(options={'projectId': PROJECT_ID})
        self.db = firestore.client()

    def load_data(self, filters: Dict[str, Any]):
        """Fetch points and creatures from Firestore based on filters."""
        logger.info("📡 Fetching data from Firestore...")

        # 1. Load Creatures (All for context cache)
        creatures_ref = self.db.collection('creatures')
        self.creatures = [doc.to_dict() | {"id": doc.id} for doc in creatures_ref.stream()]

        # 2. Load Points with filters
        points_ref = self.db.collection('points')
        query = points_ref

        if filters.get('pointId'):
            self.points = [points_ref.document(filters['pointId']).get().to_dict() | {"id": filters['pointId']}]
        else:
            if filters.get('region'): query = query.where('region', '==', filters['region'])
            if filters.get('zone'): query = query.where('zone', '==', filters['zone'])
            if filters.get('area'): query = query.where('area', '==', filters['area'])
            self.points = [doc.to_dict() | {"id": doc.id} for doc in query.stream()]

        logger.info(f"📊 Loaded {len(self.creatures)} creatures and {len(self.points)} target points.")

    def create_context_cache(self):
        """Creates a context cache for biological data to save token costs."""
        logger.info("💾 Creating Context Cache for Biological Dictionary...")
        system_instruction = (
            "あなたは海洋生物学者です。提供された生物リストの生態に基づき、"
            "特定のダイビングポイントに生息しているか判定します。出力は必ずJSON形式で。"
        )

        creatures_context = "\n".join([
            f"ID:{c['id']} - {c['name']}: {c.get('description', '')} (水深:{json.dumps(c.get('depthRange'))})"
            for c in self.creatures
        ])

        try:
            self.cache = self.client.caches.create(
                model=self.model_name,
                config=types.CreateCachedContentConfig(
                    display_name=f"bio_cache_{datetime.now(timezone.utc).strftime('%Y%m%d%H')}",
                    system_instruction=system_instruction,
                    contents=[creatures_context],
                    ttl="3600s",
                )
            )
            logger.info(f"✅ Context Cache created: {self.cache.name}")
        except Exception as e:
            logger.warning(f"⚠️ Context Caching not available or failed: {e}. Proceeding without cache (higher token cost).")
            self.cache = None

    def _safe_json_parse(self, text: str):
        """Clean and parse JSON from AI response."""
        try:
            # Remove Markdown code blocks if present
            clean_text = text.strip()
            if clean_text.startswith("```"):
                lines = clean_text.splitlines()
                if lines[0].startswith("```json"):
                    clean_text = "\n".join(lines[1:-1])
                else:
                    clean_text = "\n".join(lines[1:-1])

            return json.loads(clean_text)
        except Exception as e:
            logger.error(f"Failed to parse JSON: {e}\nRaw Text: {text}")
            return None

    def run_stage1_batch(self, point) -> List[Dict[str, Any]]:
        """Stage 1: Batch physical constraint filtering via Cache."""
        response_schema = {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "creature_id": {"type": "STRING"},
                    "is_possible": {"type": "BOOLEAN"},
                    "rarity": {"type": "STRING"},
                    "confidence": {"type": "NUMBER"},
                    "reasoning": {"type": "STRING"}
                },
                "required": ["creature_id", "is_possible", "rarity", "confidence", "reasoning"]
            }
        }

        # Incorporate filters into instructions to focus the AI
        filter_instr = ""
        if point.get('specific_creature_name'):
             filter_instr = f"- 特に「{point['specific_creature_name']}」に注目して重点的に判定してください。"

        prompt = f"""
        ダイビングポイント「{point['name']}」の条件に基づき、生息可能な生物をキャッシュ内の辞書から抽出してください。
        ポイント水深: {point.get('maxDepth', 40)}m
        地形: {json.dumps(point.get('topography', []))}

        【指示】
        - 生息の可能性がある生物（is_possible=true）を抽出してください。
        {filter_instr}
        - 期待される希少度(rarity)、確信度(confidence: 0.0-1.0)、理由(reasoning)を含めてください。
        - 出力形式は純粋なJSON配列のみとし、説明文などは一切含めないでください。
        """

        logger.debug(f"Stage 1 Prompt for {point['name']}: {prompt}")
        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
            )
            # Use cache only if available
            if self.cache:
                config.cached_content = self.cache.name

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config
            )
            text = getattr(response, 'text', '') or response.candidates[0].content.parts[0].text
            result = self._safe_json_parse(text)
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.warning(f"⚠️ Stage 1 Error for {point['name']}: {e}")
            return []

    def run_stage2_grounding(self, point, creature) -> Dict[str, Any]:
        """Stage 2: Factual verification via Google Search Tool."""
        response_schema = {
            "type": "OBJECT",
            "properties": {
                "actual_existence": {"type": "BOOLEAN"},
                "evidence": {"type": "STRING"},
                "rarity": {"type": "STRING"}
            },
            "required": ["actual_existence", "evidence", "rarity"]
        }

        prompt = f"""
        「{point['name']}」（{point.get('region','')}, {point.get('area','')}）において、
        生物「{creature['name']}」の目撃実績や生息情報をGoogle検索で精査してください。
        回答は必ず指定されたJSON形式で。
        """

        logger.debug(f"Stage 2 Prompt for {creature['name']}: {prompt}")
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    response_mime_type="application/json",
                    response_schema=response_schema,
                )
            )
            text = getattr(response, 'text', '') or response.candidates[0].content.parts[0].text
            result = self._safe_json_parse(text)
            return result if isinstance(result, dict) else {"actual_existence": False, "evidence": "Parse Error", "rarity": "Unknown"}
        except Exception as e:
            logger.warning(f"⚠️ Stage 2 Error for {creature['name']}: {e}")
            return {"actual_existence": False, "evidence": str(e), "rarity": "Unknown"}

    def process(self, mode: str, filters: Dict[str, Any], limit: int):
        self.load_data(filters)
        self.create_context_cache()

        processed_count = 0
        for p in self.points:
            if processed_count >= limit: break
            logger.info(f"🔎 Processing Point: {p['name']} ({p['id']})")

            # Add target creature name to point info for Stage 1 focus
            p['specific_creature_name'] = None
            if filters.get('creatureId'):
                creature = next((c for c in self.creatures if c['id'] == filters['creatureId']), None)
                if creature:
                    p['specific_creature_name'] = creature['name']

            s1_results = self.run_stage1_batch(p)

            for res in s1_results:
                if processed_count >= limit: break
                creature_id = res.get("creature_id")
                if not res.get("is_possible") or not creature_id: continue

                # Optional: pinpoint creature filter
                if filters.get('creatureId') and creature_id != filters['creatureId']:
                    continue

                key = f"{p['id']}_{creature_id}"

                # Check existence in Firestore if mode is 'new'
                if mode == "new":
                    existing = self.db.collection('point_creatures').document(key).get()
                    if existing.exists:
                        logger.debug(f"  ⏭️ Skipping existing: {creature_id}")
                        continue

                creature = next((c for c in self.creatures if c['id'] == creature_id), None)
                if not creature: continue

                logger.info(f"  🌐 Grounding: {creature['name']}...")
                s2 = self.run_stage2_grounding(p, creature)

                # Save result to Firestore
                status = "pending" if s2.get("actual_existence") else "rejected"

                # Final check: if rejected but high confidence in S1, maybe it's just 'Rare'
                if status == "rejected" and res.get("confidence", 0) > 0.8:
                    logger.info(f"  💡 High confidence S1 result kept as 'pending' despite no web evidence.")
                    status = "pending"

                new_entry = {
                    "pointId": p['id'],
                    "creatureId": creature['id'],
                    "localRarity": s2.get("rarity") or res.get("rarity") or "Rare",
                    "status": status,
                    "reasoning": s2.get("evidence") or res.get("reasoning"),
                    "confidence": (res.get("confidence", 0.5) + (0.3 if s2.get("actual_existence") else 0)) / 1.3,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                    "method": "python-batch-v1"
                }

                self.db.collection('point_creatures').document(key).set(new_entry)
                logger.info(f"  🚀 Saved: {creature['name']} -> {status}")
                processed_count += 1

                # Small sleep to be nice to API quotas (adjust as needed)
                time.sleep(0.5)

        logger.info(f"🏁 Finished. Processed {processed_count} mappings.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WeDive AI Cleansing Pipeline (Bulk / Specific)")
    parser.add_argument("--mode", choices=["all", "new", "specific", "replace"], default="new", help="all: full scan, new: skip existing, specific: targeted scan, replace: overwrite specific")
    parser.add_argument("--limit", type=int, default=100000, help="Maximum number of mappings to process")
    parser.add_argument("--pointId", help="Target a specific point")
    parser.add_argument("--creatureId", help="Target a specific creature")
    parser.add_argument("--region", help="Filter points by region")
    parser.add_argument("--zone", help="Filter points by zone")
    parser.add_argument("--area", help="Filter points by area")

    args = parser.parse_args()

    filters = {
        "pointId": args.pointId,
        "creatureId": args.creatureId,
        "region": args.region,
        "zone": args.zone,
        "area": args.area
    }

    pipeline = CleansingPipeline()
    pipeline.process(mode=args.mode, filters=filters, limit=args.limit)
