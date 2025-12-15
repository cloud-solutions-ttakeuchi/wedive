import os
import json
import time
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
# --- 設定 ---
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
# プロジェクトルートからの絶対パスに修正
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_FILE = os.path.join(BASE_DIR, "src/data/locations_structure.json")

# 生成対象のRegion
# TARGET_REGIONS = ["日本", "パラオ", "モルディブ","バリ", "メキシコ", "オーストラリア", "フレンチポリネシア"]
TARGET_REGIONS = ["日本"]

# エリアまでの構造のみ定義
SCHEMA_PROMPT = """
Output JSON format:
[
  {
    "name": "Region Name (e.g. 日本)",
    "description": "Region description",
    "children": [
      {
        "name": "Zone Name (e.g. 沖縄本島)",
        "description": "Zone description",
        "children": [
          {
            "name": "Area Name (e.g. 恩納村)",
            "description": "Area description (port or district)"
          }
        ]
      }
    ]
  }
]
"""

def generate_structure(region: str) -> List[Dict]:
    print(f"🏗️ Generating structure for {region}...")
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')

    prompt = f"""
    ダイビングエリア「{region}」の階層構造を作成してください。
    「ポイント（具体的なダイビングスポット）」は含めず、「エリア（港や地区）」までを作成してください。

    階層: Region ({region}) > Zone (島・地方) > Area (港・地区)

    条件:
    1. {region}の主要なZoneを【 10個前後 】選定。
    2. 各Zoneの中に、ダイビング船が出る主要なAreaを【 10個前後 】選定。
    3. JSONのみ出力。ポイント情報は不要。

    {SCHEMA_PROMPT}
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"): text = text[7:]
        if text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]

        data = json.loads(text)
        if isinstance(data, dict): data = [data]

        # ID付与 (Region > Zone > Area)
        base_time = int(time.time())
        for r_i, reg in enumerate(data):
            if "id" not in reg: reg["id"] = f"r_{base_time}_{r_i}"
            reg["type"] = "Region"
            if "children" in reg:
                for z_i, zone in enumerate(reg["children"]):
                    if "id" not in zone: zone["id"] = f"z_{base_time}_{r_i}_{z_i}"
                    zone["type"] = "Zone"
                    if "children" in zone:
                        for a_i, area in enumerate(zone["children"]):
                            if "id" not in area: area["id"] = f"a_{base_time}_{r_i}_{z_i}_{a_i}"
                            area["type"] = "Area"
                            # ポイント用の空配列を用意しておく
                            if "children" not in area: area["children"] = []
        return data

    except Exception as e:
        print(f"Error: {e}")
        return []

def main():
    if API_KEY == "YOUR_API_KEY_HERE":
        print("⚠️ API Key missing.")
        return

    all_data = []
    # 既存の中間ファイルがあれば読み込む（追記用）
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            all_data = json.load(f)

    for region in TARGET_REGIONS:
        # Check if region exists
        existing_region_index = next((i for i, r in enumerate(all_data) if r["name"] == region), -1)

        if existing_region_index != -1:
            print(f"  -> Merging into existing {region} (Updates logic)...")
            new_data_list = generate_structure(region)
            if not new_data_list: continue

            # Merge Logic
            existing_region = all_data[existing_region_index]
            new_region = new_data_list[0] # Assuming one region per generation

            existing_zones = existing_region.get("children", [])
            new_zones = new_region.get("children", [])

            # Zone Merge
            for new_z in new_zones:
                # Find matching zone by name
                existing_z = next((z for z in existing_zones if z["name"] == new_z["name"]), None)
                if existing_z:
                    # Zone exists, merge areas
                    existing_areas = existing_z.get("children", [])
                    new_areas = new_z.get("children", [])

                    for new_a in new_areas:
                        if not any(a["name"] == new_a["name"] for a in existing_areas):
                            print(f"    + Adding Area: {new_a['name']} to Zone: {new_z['name']}")
                            existing_areas.append(new_a)
                    existing_z["children"] = existing_areas
                else:
                    # Zone does not exist, add it
                    print(f"    + Adding Zone: {new_z['name']}")
                    existing_zones.append(new_z)

            existing_region["children"] = existing_zones
            all_data[existing_region_index] = existing_region
            time.sleep(2)
            continue

        data = generate_structure(region)
        if data:
            all_data.extend(data)
            time.sleep(2)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Structure saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
