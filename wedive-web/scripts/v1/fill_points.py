import os
import json
import time
import argparse
import google.generativeai as genai

# --- 設定 ---
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
INPUT_FILE = "src/data/locations_structure.json" # 骨組み（マスタ）
OUTPUT_FILE = "src/data/locations_seed.json"     # 作業結果（ポイント入り）

# ポイント生成の定義
POINT_SCHEMA = """
Output JSON Array of Objects:
[
  {
    "name": "Point Name",
    "level": "Beginner / Intermediate / Advanced",
    "maxDepth": int,
    "entryType": "boat / beach",
    "current": "none / weak / strong / drift",
    "topography": ["cave", "dropoff", "sand", "rock"],
    "features": ["manta", "shark", "macro", "wreck"],
    "description": "Short description about 100 chars.",
    "imageKeyword": "english keyword"
  }
]
"""

def generate_points_for_area(region: str, zone: str, area: str, count: int) -> list:
    """特定エリア内のポイントリストを生成する"""
    print(f"  generating {count} points for: {area} ({region}/{zone})...", end="", flush=True)

    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')

    prompt = f"""
    ダイビングエリア: {region} > {zone} > {area}
    このエリア（{area}）にある人気のダイビングポイントを【 {count}箇所 】リストアップしてください。

    条件:
    1. 実在するポイント名を使用すること。
    2. 水深やレベルはリアルなデータを入れること。
    3. JSON配列のみを出力すること。

    {POINT_SCHEMA}
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"): text = text[7:]
        if text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]
        if text.strip().endswith("}"): text += "]"

        points = json.loads(text)
        print(f" ✅ Got {len(points)} points.")
        return points
    except Exception as e:
        print(f" ❌ Error: {e}")
        return []

def deep_merge_regions(existing_data: list, structure_data: list) -> list:
    """
    既存データ(existing_data)に対して、構造データ(structure_data)をマージする。
    Region -> Zone -> Area の階層を下りながら、新しい要素があれば追加する。
    既存のポイントデータなどは保持する。
    """
    merged_map = {r["id"]: r for r in existing_data if "id" in r}

    for struct_region in structure_data:
        r_id = struct_region.get("id")

        if r_id not in merged_map:
            # 新しいRegionならそのまま追加
            print(f"  -> New region detected: {struct_region.get('name')}")
            merged_map[r_id] = struct_region
            continue

        # 既存Regionがある場合、Zoneレベルでマージ
        existing_region = merged_map[r_id]
        existing_zones = existing_region.get("children", [])
        struct_zones = struct_region.get("children", [])

        # Zone ID map
        existing_zone_map = {z["id"]: z for z in existing_zones if "id" in z}

        for struct_zone in struct_zones:
            z_id = struct_zone.get("id")

            if z_id not in existing_zone_map:
                # 新しいZoneなら追加
                print(f"    -> New zone detected: {struct_zone.get('name')}")
                existing_zones.append(struct_zone)
                existing_zone_map[z_id] = struct_zone # Update map for subsequent lookups if needed
                continue

            # 既存Zoneがある場合、Areaレベルでマージ
            existing_zone = existing_zone_map[z_id]
            existing_areas = existing_zone.get("children", [])
            struct_areas = struct_zone.get("children", [])

            # Area ID map
            existing_area_map = {a["id"]: a for a in existing_areas if "id" in a}

            for struct_area in struct_areas:
                a_id = struct_area.get("id")

                if a_id not in existing_area_map:
                    # 新しいAreaなら追加
                    print(f"      -> New area detected: {struct_area.get('name')}")
                    existing_areas.append(struct_area)
                    existing_area_map[a_id] = struct_area
                else:
                    # Areaも既に存在するなら何もしない（ポイントデータは既存を優先）
                    pass

            existing_zone["children"] = existing_areas

        existing_region["children"] = existing_zones
        merged_map[r_id] = existing_region

    return list(merged_map.values())

def load_and_sync_data():
    """
    Structure(骨組み)とSeed(既存データ)を同期ロードする重要な関数
    新しいRegion/Zone/AreaがStructureに追加されていたら、Seedにも取り込む
    """
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Input file {INPUT_FILE} not found. Run generate_structure.py first.")
        return []

    # 1. 骨組み（最新の全エリア構造）
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        structure_data = json.load(f)

    # 2. 既存データ（ポイント取得済みデータ）がない場合は骨組みをそのまま返す
    if not os.path.exists(OUTPUT_FILE):
        return structure_data

    # 3. 既存データがある場合はマージ処理
    print(f"📂 Syncing structure from {INPUT_FILE} into {OUTPUT_FILE}...")
    try:
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
    except json.JSONDecodeError:
        # 既存データが壊れている場合は骨組みを正とする
        return structure_data

    # Deep Mergeを実行
    merged_data = deep_merge_regions(existing_data, structure_data)

    return merged_data

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", type=str, help="Target Area ID")
    parser.add_argument("--count", type=int, default=5, help="Number of points")
    args = parser.parse_args()

    target_area_id = args.id
    target_count = args.count

    # ★ここで同期ロードを実行
    final_data = load_and_sync_data()
    if not final_data:
        return

    processed_areas = 0
    target_found = False

    print(f"🚀 Starting point generation... (Target ID: {target_area_id if target_area_id else 'ALL'})")

    # Region Loop
    for region in final_data:
        region_name = region.get("name")

        if "children" in region:
            for zone in region["children"]:
                zone_name = zone.get("name")

                if "children" in zone:
                    for area in zone["children"]:
                        area_name = area.get("name")
                        area_id = area.get("id")

                        # フィルタリング
                        if target_area_id and area_id != target_area_id:
                            continue

                        target_found = True

                        # 全自動モードかつデータ取得済みならスキップ
                        existing_points = area.get("children", [])
                        if not target_area_id:
                            if existing_points and len(existing_points) > 0 and existing_points[0].get("type") == "Point":
                                continue

                        # 生成実行
                        points_data = generate_points_for_area(region_name, zone_name, area_name, target_count)

                        if points_data:
                            formatted_points = []
                            base_id = area_id if area_id else f"tmp_{time.time()}"

                            for p_i, p in enumerate(points_data):
                                p["id"] = f"p_{base_id}_{p_i}"
                                p["type"] = "Point"
                                keyword = p.get("imageKeyword", "diving").replace(" ", "")
                                p["image"] = f"[https://loremflickr.com/400/300/](https://loremflickr.com/400/300/){keyword},underwater"
                                formatted_points.append(p)

                            area["children"] = formatted_points
                            processed_areas += 1

                            # 保存
                            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                                json.dump(final_data, f, indent=2, ensure_ascii=False)
                            print("  💾 Saved.")

                        if target_area_id:
                            print(f"\n✨ Target area '{area_name}' processed.")
                            return

                        time.sleep(2)

    if target_area_id and not target_found:
        print(f"\n⚠️ Warning: Area ID '{target_area_id}' not found.")
    else:
        print(f"\n✨ Done! Processed {processed_areas} areas.")

if __name__ == "__main__":
    main()
