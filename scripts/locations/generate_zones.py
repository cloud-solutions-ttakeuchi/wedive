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
INPUT_FILE = os.path.join(CONFIG_DIR, "target_regions.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "locations_seed.json")
PRODUCED_ZONES_FILE = os.path.join(CONFIG_DIR, "target_zones.json")

SCHEMA_PROMPT = """
出力フォーマットは以下のJSON配列（Array of Objects）のみにしてください。
Markdownのバッククォートは不要です。

Object Schema:
[
  {
    "name": "Region Name (e.g. 日本)",
    "type": "Region",
    "children": [
      {
        "name": "Zone Name (e.g. 沖縄本島)",
        "type": "Zone",
        "description": "Zone description"
      }
    ]
  }
]
"""

def generate_zones(region: str) -> List[Dict]:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')

    prompt = f"""
    あなたはダイビング旅行プランナーです。
    ダイビングエリア「{region}」について、主要なダイビングエリア（Zone）をリストアップしてください。
    Zoneとは、沖縄本島、石垣島、伊豆半島など、大きな地理的区分のことです。

    条件:
    1. {region}の中に、代表的なZoneを3〜5個選定してください。
    2. JSON形式のみ出力してください。

    {SCHEMA_PROMPT}
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
        print(f"Error generating zones for {region}: {e}")
        return []

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Config file not found: {INPUT_FILE}")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        target_regions = json.load(f)

    all_locations = []
    # 既存データのロード（マージ用）
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            try:
                all_locations = json.load(f)
            except:
                pass

    produced_zones_list = []

    print(f"🚀 Generating Zones for {len(target_regions)} regions...")

    for region_name in target_regions:
        print(f"  Processing {region_name}...")

        # 既存Region検索
        existing_region = next((r for r in all_locations if r["name"] == region_name), None)

        new_data = generate_zones(region_name)
        if not new_data: continue

        new_region_data = new_data[0] # Listの先頭

        if existing_region:
            # Merge Zones
            existing_zones = existing_region.get("children", [])
            existing_zone_names = {z["name"] for z in existing_zones}

            for new_z in new_region_data.get("children", []):
                if new_z["name"] not in existing_zone_names:
                    new_z["id"] = f"z_{int(time.time())}_{new_z['name']}" # 簡易ID
                    existing_zones.append(new_z)
                    print(f"    + Added Zone: {new_z['name']}")
                else:
                    print(f"    . Exists: {new_z['name']}")

                # 次のステップ用に記録
                produced_zones_list.append({"region": region_name, "zone": new_z["name"]})

            existing_region["children"] = existing_zones
        else:
            # New Region
            new_region_data["id"] = f"r_{int(time.time())}"
            for i, z in enumerate(new_region_data.get("children", [])):
                z["id"] = f"z_{int(time.time())}_{i}"
                produced_zones_list.append({"region": region_name, "zone": z["name"]})

            all_locations.append(new_region_data)
            print(f"    + Added New Region: {region_name}")

        time.sleep(2)

    # Save Main Data
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_locations, f, indent=2, ensure_ascii=False)

    # Save Target Config for Next Step
    with open(PRODUCED_ZONES_FILE, 'w', encoding='utf-8') as f:
        json.dump(produced_zones_list, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Saved locations to {OUTPUT_FILE}")
    print(f"📝 Generated next step config: {PRODUCED_ZONES_FILE}")

if __name__ == "__main__":
    main()
