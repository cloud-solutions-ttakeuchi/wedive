import os
import json
import time
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
INPUT_FILE = os.path.join(CONFIG_DIR, "target_zones.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "locations_seed.json")
PRODUCED_AREAS_FILE = os.path.join(CONFIG_DIR, "target_areas.json")

SCHEMA_PROMPT = """
出力フォーマットは以下のJSON配列（Array of Objects）のみにしてください。
Markdownのバッククォートは不要です。

Object Schema:
[
  {
    "name": "Area Name (e.g. 恩納村)",
    "type": "Area",
    "description": "Area description (e.g. Major diving hub in Okinawa)"
  }
]
"""

def generate_areas(region: str, zone: str) -> List[Dict]:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')

    prompt = f"""
    あなたはベテランのダイビングガイドです。
    ダイビングエリア「{region}」の「{zone}」にある、主要なダイビングエリア（Area/地区/港）をリストアップしてください。

    例:
    Region: 日本, Zone: 沖縄本島 -> Area: [恩納村, 北谷, 本部, 糸満]
    Region: 日本, Zone: 伊豆半島 -> Area: [伊豆海洋公園, 富戸, 大瀬崎, 神子元]

    条件:
    1. {zone}の中に、代表的なAreaを2〜4個選定してください。
    2. JSON形式のみ出力してください。

    {SCHEMA_PROMPT}

    Context: {region} > {zone}
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"): text = text[7:]
        if text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]
        if text.strip().endswith("}"): text += "]"

        return json.loads(text)
    except Exception as e:
        print(f"Error generating areas for {zone}: {e}")
        return []

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Config file not found: {INPUT_FILE}")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        target_zones = json.load(f)

    all_locations = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            try:
                all_locations = json.load(f)
            except:
                pass

    produced_areas_list = []

    print(f"🚀 Generating Areas for {len(target_zones)} zones...")

    for target in target_zones:
        region_name = target["region"]
        zone_name = target["zone"]

        print(f"  Processing {region_name} > {zone_name}...")

        # Region検索
        region_node = next((r for r in all_locations if r["name"] == region_name), None)
        if not region_node:
            print(f"    ⚠️ Region {region_name} not found in seed. Skipping.")
            continue

        # Zone検索
        zone_node = next((z for z in region_node.get("children", []) if z["name"] == zone_name), None)
        if not zone_node:
            print(f"    ⚠️ Zone {zone_name} not found in seed. Skipping.")
            continue

        new_areas = generate_areas(region_name, zone_name)

        existing_areas = zone_node.get("children", [])
        existing_area_names = {a["name"] for a in existing_areas}

        for new_a in new_areas:
            if new_a["name"] not in existing_area_names:
                new_a["id"] = f"a_{int(time.time())}_{new_a['name']}"
                existing_areas.append(new_a)
                print(f"    + Added Area: {new_a['name']}")
                produced_areas_list.append({"region": region_name, "zone": zone_name, "area": new_a["name"]})
            else:
                print(f"    . Exists: {new_a['name']}")
                produced_areas_list.append({"region": region_name, "zone": zone_name, "area": new_a["name"]})

        zone_node["children"] = existing_areas
        time.sleep(2)

    # Save
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_locations, f, indent=2, ensure_ascii=False)

    with open(PRODUCED_AREAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(produced_areas_list, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Saved locations to {OUTPUT_FILE}")
    print(f"📝 Generated next step config: {PRODUCED_AREAS_FILE}")

if __name__ == "__main__":
    main()
