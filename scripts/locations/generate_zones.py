import os
import json
import time
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
# API Key Handling　　APIKEY　カンマ区切りで複数指定可
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
INPUT_FILE = os.path.join(CONFIG_DIR, "target_regions.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "locations_seed.json")
PRODUCED_ZONES_FILE = os.path.join(CONFIG_DIR, "target_zones.json")

# Models to cycle through
CANDIDATE_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemma-3-27b-it',
    'gemma-3-12b-it',
    'gemma-3-4b-it',
    'gemma-3-2b-it',
    'gemma-3-1b-it',
]

# Flattened Resource Pool: [(model, key), (model, key)...]
RESOURCE_POOL = [(m, k) for m in CANDIDATE_MODELS for k in API_KEYS]
current_resource_index = 0

def get_current_resource():
    return RESOURCE_POOL[current_resource_index]

def rotate_resource():
    global current_resource_index
    current_resource_index = (current_resource_index + 1) % len(RESOURCE_POOL)
    print(f"    🔄 Switching to Resource #{current_resource_index + 1}/{len(RESOURCE_POOL)}")

def generate_zones(region: str) -> List[Dict]:
    global current_resource_index

    prompt = f"""
    あなたはダイビング旅行プランナーです。
    指定された「国・地域（Region）」にある、ダイビングで有名な「エリア（Zone）」をリストアップしてください。

    対象Region: {region}

    出力フォーマット（JSON）:
    [
      {{
        "name": "Zone名（例: ケアンズ, 慶良間諸島）",
        "description": "ダイビングの特徴を100文字以内で"
      }}
    ]

    注意点:
    - ダイバーに人気のある主要なエリアに絞ってください。
    - 1つのRegionにつき、3〜5個程度のZoneを挙げてください。
    - 決してMarkdownのコードブロック(```json ... ```)を含めないでください。純粋なJSON文字列のみを返してください。
    """

    max_attempts = len(RESOURCE_POOL)
    attempts = 0

    while attempts < max_attempts:
        model_name, api_key = get_current_resource()

        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)

            response = model.generate_content(prompt)
            text = response.text.strip()
            # Remove markdown if present
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]

            result = json.loads(text)
            if result:
                # Success! Keep the current index as is (it's working).
                # Identify which key index this matches for display (just for info)
                key_display_idx = API_KEYS.index(api_key) + 1
                print(f"    ✅ Success with {model_name} (Key #{key_display_idx})")
                return result

        except Exception as e:
            error_str = str(e)
            if "429" in error_str:
                print(f"    ⚠️ Quota exceeded: {model_name} (Key index in pool: {current_resource_index})")
                rotate_resource()
                time.sleep(1)
            elif "404" in error_str or "not found" in error_str.lower():
                print(f"    ℹ️ Model {model_name} not found/supported. Skipping.")
                rotate_resource()
            else:
                print(f"    ❌ Error with {model_name}: {e}")
                rotate_resource()

        attempts += 1

    print(f"    💀 All resources failed for {region}")
    return []

import argparse
import shutil

def main():
    parser = argparse.ArgumentParser(description="Generate Zones data.")
    parser.add_argument("--mode", choices=["append", "overwrite", "clean"], default="append",
                        help="Execution mode: append (skip existing), overwrite (replace existing), clean (start fresh)")
    args = parser.parse_args()

    if not os.path.exists(INPUT_FILE):
        print(f"❌ Config file not found: {INPUT_FILE}")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        target_regions = json.load(f)

    all_locations = []

    # Mode: Clean
    if args.mode == "clean":
        if os.path.exists(OUTPUT_FILE):
            shutil.copy(OUTPUT_FILE, OUTPUT_FILE + ".bak")
            print(f"📦 Backed up existing file to {OUTPUT_FILE}.bak")
        all_locations = []
    # Mode: Append / Overwrite
    elif os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            try:
                all_locations = json.load(f)
            except:
                pass

    produced_zones_list = []

    print(f"🚀 Generating Zones for {len(target_regions)} regions... [Mode: {args.mode.upper()}]")

    for region_name in target_regions:
        print(f"  Processing {region_name}...")

        # 既存Region検索
        existing_region = next((r for r in all_locations if r["name"] == region_name), None)

        # Mode: Append - Skip if exists
        if args.mode == "append" and existing_region:
            print(f"    ⏭️  Skipping {region_name} (Already exists).")
            # Next step用に既存Zoneをリストアップ
            for z in existing_region.get("children", []):
                produced_zones_list.append({"region": region_name, "zone": z["name"]})
            continue

        # Mode: Overwrite - Remove existing if exists to regenerate
        if args.mode == "overwrite" and existing_region:
            print(f"    ♻️  Overwriting {region_name}...")
            # 既存リストから除外して新規作成扱いに（IDなども一新される）
            all_locations = [r for r in all_locations if r["name"] != region_name]
            existing_region = None

        # Generate (Clean, Overwrite, or Append-new)
        new_data = generate_zones(region_name)
        if not new_data: continue

        new_region_data = new_data[0] # Listの先頭

        if existing_region:
            # Merge logic (本来ここに来るのはAppendで部分的マージが必要な場合だが、
            # 現在のRegion単位判定ではここに来にくい。念のため残す)
            existing_zones = existing_region.get("children", [])
            existing_zone_names = {z["name"] for z in existing_zones}

            for new_z in new_region_data.get("children", []):
                if new_z["name"] not in existing_zone_names:
                    new_z["id"] = f"z_{int(time.time())}_{new_z['name']}"
                    new_z["displayOrder"] = 0
                    existing_zones.append(new_z)
                    print(f"    + Added Zone: {new_z['name']}")
                else:
                    print(f"    . Exists: {new_z['name']}")

                produced_zones_list.append({"region": region_name, "zone": new_z["name"]})
            existing_region["children"] = existing_zones
        else:
            # New Region
            new_region_data["id"] = f"r_{int(time.time())}"
            for i, z in enumerate(new_region_data.get("children", [])):
                z["id"] = f"z_{int(time.time())}_{i}"
                z["displayOrder"] = 0
                produced_zones_list.append({"region": region_name, "zone": z["name"]})

            all_locations.append(new_region_data)
            print(f"    + Added New Region: {region_name}")

        # Save Incrementally
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_locations, f, indent=2, ensure_ascii=False)
        print(f"    💾 Progress saved to {OUTPUT_FILE}")

        time.sleep(2)

    # Save Config for Next Step (Final)
    with open(PRODUCED_ZONES_FILE, 'w', encoding='utf-8') as f:
        json.dump(produced_zones_list, f, indent=2, ensure_ascii=False)

    print(f"\n✅ All Done!")
    print(f"📝 Generated next step config: {PRODUCED_ZONES_FILE}")

if __name__ == "__main__":
    main()
