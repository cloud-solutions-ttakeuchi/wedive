import os
import json
import time
import google.generativeai as genai
from typing import List, Dict, Set
import difflib

# --- 設定 ---
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_FILE = os.path.join(BASE_DIR, "src/data/locations_seed.json")

# 生成対象のRegion
TARGET_REGIONS = ["日本", "パラオ", "フィリピン", "モルディブ", "バリ", "フレンチポリネシア", "メキシコ", "カナダ", "アメリカ", "オーストラリア"]

# 重複判定の閾値 (0.0 - 1.0)
SIMILARITY_THRESHOLD = 0.85

SCHEMA_PROMPT = """
出力フォーマットは以下のJSON配列（Array of Objects）のみにしてください。
Markdownのバッククォートは不要です。

Object Schema (Recursive):
[
  {
    "id": "r_{region_name}",
    "name": "Region Name (e.g. 日本)",
    "type": "Region",
    "description": "Region description",
    "children": [
      {
        "id": "z_{zone_name}",
        "name": "Zone Name (e.g. 沖縄本島)",
        "type": "Zone",
        "description": "Zone description",
        "children": [
          {
            "id": "a_{area_name}",
            "name": "Area Name (e.g. 恩納村)",
            "type": "Area",
            "children": [
              {
                "id": "p_{point_name}",
                "name": "Point Name (e.g. 青の洞窟)",
                "type": "Point",
                "level": "Beginner / Intermediate / Advanced",
                "maxDepth": int (meter),
                "entryType": "boat / beach",
                "current": "none / weak / strong / drift",
                "topography": ["cave", "dropoff", "sand", "rock" ...],
                "features": ["特徴タグ1", "特徴タグ2"],
                "latitude": float (e.g. 26.4),
                "longitude": float (e.g. 127.8),
                "description": "ポイントの魅力や特徴を100文字程度で。",
                "imageKeyword": "画像検索用英単語 (e.g. blue cave okinawa)"
              }
            ]
          }
        ]
      }
    ]
  }
]
"""

def get_existing_point_names(data: List[Dict]) -> Set[str]:
    """既存の全Point名を抽出する"""
    names = set()
    for region in data:
        for zone in region.get("children", []):
            for area in zone.get("children", []):
                for point in area.get("children", []):
                    names.add(point["name"])
    return names

def is_similar(name1: str, name2: str) -> bool:
    """文字列の類似度判定 (Levenshtein-like)"""
    matcher = difflib.SequenceMatcher(None, name1, name2)
    return matcher.ratio() >= SIMILARITY_THRESHOLD

def check_duplicate(new_point_name: str, existing_names: Set[str]) -> str:
    """
    重複または類似する名前が既存リストにあるかチェック
    戻り値: 類似する既存の名前 (なければ None)
    """
    if new_point_name in existing_names:
        return new_point_name # 完全一致

    for existing in existing_names:
        if is_similar(new_point_name, existing):
            return existing
    return None

def generate_locations(region: str) -> List[Dict]:
    """Geminiを使って特定Region配下の階層データを一括生成する"""
    print(f"Generating location hierarchy for {region}...")

    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')

    prompt = f"""
    あなたはベテランのダイビング旅行プランナーです。
    ダイビングエリア「{region}」について、代表的なダイビングスポットを階層構造で整理してください。
    表記揺れ（同じ場所、名前は違うが地理的には重複している場所）を避けるようにしてください。

    階層ルール:
    Region ({region}) > Zone (主要な島や地方) > Area (港や地区) > Point (具体的なポイント名)

    条件:
    1. {region}の中に、代表的なZoneを2〜3個選定してください。
    2. 各Zoneの中に、代表的なAreaを2〜3個選定してください。
    3. 各Areaの中に、有名なPointを2〜3個選定してください。
    4. 各Pointには、リアルな水深やレベル、地形情報を入れてください。
    5. 各Pointの緯度経度（latitude, longitude）も推測値で良いので必ず入れてください。
    6. JSON形式のみ出力してください。

    {SCHEMA_PROMPT}
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        if text.strip().endswith("}"):
             text += "]"

        data = json.loads(text)
        if isinstance(data, dict):
            data = [data]

        # ID生成
        base_time = int(time.time())
        for r_idx, reg in enumerate(data):
            if "id" not in reg: reg["id"] = f"r_{base_time}_{r_idx}"
            if "children" in reg:
                for z_idx, zone in enumerate(reg["children"]):
                    if "id" not in zone: zone["id"] = f"z_{base_time}_{r_idx}_{z_idx}"
                    if "children" in zone:
                        for a_idx, area in enumerate(zone["children"]):
                            if "id" not in area: area["id"] = f"a_{base_time}_{r_idx}_{z_idx}_{a_idx}"
                            if "children" in area:
                                for p_idx, point in enumerate(area["children"]):
                                    if "id" not in point: point["id"] = f"p_{base_time}_{r_idx}_{z_idx}_{a_idx}_{p_idx}"
                                    point["image"] = "" # 画像は別途
        return data

    except Exception as e:
        print(f"Error generating data for {region}: {e}")
        return []

def main():
    if API_KEY == "YOUR_API_KEY_HERE":
        print("⚠️ エラー: APIキーが設定されていません。")
        return

    all_locations = []

    # 既存データの読み込み
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                all_locations = json.load(f)
                print(f"📂 Loaded {len(all_locations)} existing regions.")
        except json.JSONDecodeError:
            pass

    # 全既存ポイント名の抽出（重複チェック用）
    existing_point_names = get_existing_point_names(all_locations)
    print(f"ℹ️  Checking against {len(existing_point_names)} existing unique points.")

    print(f"🚀 Generating data using API Key: {API_KEY[:5]}...")

    for region in TARGET_REGIONS:
        # 既存Regionの検索
        existing_region_index = next((i for i, r in enumerate(all_locations) if r["name"] == region), -1)

        new_data_list = generate_locations(region)
        if not new_data_list:
            time.sleep(2)
            continue

        new_region = new_data_list[0] # Regionは1つのはず

        if existing_region_index != -1:
             print(f"  -> Merging into existing {region} (Update mode)...")
             existing_region = all_locations[existing_region_index]

             existing_zones = existing_region.get("children", [])
             new_zones = new_region.get("children", [])

             for new_z in new_zones:
                 existing_z = next((z for z in existing_zones if z["name"] == new_z["name"]), None)

                 if existing_z:
                     # Zone exists
                     existing_areas = existing_z.get("children", [])
                     new_areas = new_z.get("children", [])

                     for new_a in new_areas:
                         existing_a = next((a for a in existing_areas if a["name"] == new_a["name"]), None)

                         if existing_a:
                             # Area exists - Point Level Merge (Deduplication Check)
                             existing_points = existing_a.get("children", [])
                             new_points = new_a.get("children", [])

                             for new_p in new_points:
                                 sim_name = check_duplicate(new_p["name"], existing_point_names)

                                 if sim_name:
                                     print(f"    ⚠️ SKIPPING Point: '{new_p['name']}' (Similar to existing: '{sim_name}')")
                                 else:
                                     print(f"    + Adding Point: {new_p['name']} to Area: {new_a['name']}")
                                     existing_points.append(new_p)
                                     existing_point_names.add(new_p["name"]) # 追加した名前も即座にチェック対象へ

                             existing_a["children"] = existing_points
                         else:
                             # Area does not exist, add it
                             # Note: Area内のPointも重複チェックすべきだが、Areaごと新規なら確率は低い＆複雑になるので今回はArea内丸ごと追加
                             # ただし、厳密にはここでもPoint全チェックする方が良い
                             print(f"    + Adding Area: {new_a['name']} to Zone: {new_z['name']}")

                             # Area追加前に内部Pointの重複チェック (簡易)
                             valid_points = []
                             for p in new_a.get("children", []):
                                sim_name = check_duplicate(p["name"], existing_point_names)
                                if sim_name:
                                    print(f"      ⚠️ SKIPPING Point in new area: '{p['name']}' (Similar: '{sim_name}')")
                                else:
                                    valid_points.append(p)
                                    existing_point_names.add(p["name"])

                             new_a["children"] = valid_points
                             existing_areas.append(new_a)

                     existing_z["children"] = existing_areas
                 else:
                     # Zone does not exist, add it
                     print(f"    + Adding Zone: {new_z['name']}")
                     existing_zones.append(new_z)
                     # (Loop for children points to add to existing_point_names... simplified here)

             existing_region["children"] = existing_zones
             all_locations[existing_region_index] = existing_region
        else:
            # Regionごと新規
            print(f"  -> Generated hierarchy for {region}.")
            all_locations.extend(new_data_list)
            # Add all names to tracking (for subsequent iterations)
            existing_point_names.update(get_existing_point_names(new_data_list))

        time.sleep(5)

    # 保存
    if all_locations:
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_locations, f, indent=2, ensure_ascii=False)
        print(f"\n✅ Successfully generated location data in '{OUTPUT_FILE}'")
    else:
        print("\n❌ No data generated.")

if __name__ == "__main__":
    main()
