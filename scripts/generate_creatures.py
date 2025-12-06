import os
import json
import time
import math
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
OUTPUT_FILE = "src/data/creatures_seed.json"

TARGET_AREAS = ["伊豆", "沖縄本島", "石垣島", "慶良間諸島", "伊豆大島", "小笠原諸島", "奄美大島", "串本"]
COUNT_PER_AREA = 50  # 多めに設定してもバッチ処理で安定して取得できます
BATCH_SIZE = 10      # 1回のリクエストで生成する数（これ以上増やすとエラーになりやすい）

# --- データモデル定義 ---
SCHEMA_PROMPT = """
出力フォーマットは以下のJSON配列（Array of Objects）のみにしてください。
Markdownのバッククォートは不要です。

Object Schema:
{
  "id": "c_{uuid}",
  "name": "生物の和名（例: カクレクマノミ）",
  "imageKeyword": "この生物の画像検索に使える英単語1語",
  "category": "カテゴリ（魚類 / ウミウシ / 甲殻類 / 大物 / サンゴ / その他）",
  "tags": ["検索用タグ配列", "色", "模様", "特徴"],
  "description": "100文字程度のダイバー向け解説文。豆知識を含むと良い。",
  "baseRarity": "Common / Rare / Epic / Legendary (ダイバーにとってのレア度)",
  "depthRange": { "min": 最小水深(int), "max": 最大水深(int) },
  "size": "平均サイズ（例: 10cm）",
  "season": ["spring", "summer", "autumn", "winter"],
  "specialAttributes": ["毒", "擬態", "夜行性", "噛みつく", "被写体"],
  "waterTempRange": { "min": 20, "max": 30 },
  "regions": ["生息する広域エリア名"]
}
"""

def _call_gemini_api(area: str, count: int) -> List[Dict]:
    """Gemini APIを実際に叩く内部関数（小分け実行用）"""
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')

    prompt = f"""
    あなたはベテランのダイビングガイドです。
    「{area}」のダイビングスポットで見られる代表的な海洋生物を {count} 種類リストアップし、
    以下のスキーマに従ってJSONデータを作成してください。

    条件:
    1. ダイバーに人気のある生物を中心に選定すること。
    2. 実在する正確なデータに基づき記述すること。
    3. JSON以外の文字列（解説など）は一切出力しないこと。

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

        # 稀に最後の ] が切れている場合の簡易補正（完全ではないが保険として）
        if text.strip().endswith("}"):
             text += "]"

        data = json.loads(text)
        return data

    except Exception as e:
        # エラー詳細を表示（デバッグ用）
        print(f"    ⚠️ API Error or Parse Error: {str(e)[:100]}...")
        return []

def generate_creatures(area: str, total_count: int) -> List[Dict]:
    """指定された数をバッチ分割して生成し、結合して返す"""
    print(f"Generating {total_count} creatures for {area} (in batches of {BATCH_SIZE})...")

    combined_data = []
    num_batches = math.ceil(total_count / BATCH_SIZE)

    for i in range(num_batches):
        # 今回生成する数を計算（最後だけ端数になる可能性があるため）
        current_batch_count = min(BATCH_SIZE, total_count - len(combined_data))

        print(f"  - Batch {i+1}/{num_batches}: Requesting {current_batch_count} items...")

        batch_data = _call_gemini_api(area, current_batch_count)

        if batch_data:
            # ID付与とデータ加工
            for idx, item in enumerate(batch_data):
                # IDを一意にする
                item["id"] = f"c_{area}_{int(time.time())}_{i}_{idx}"
                keyword = item.get("imageKeyword", "underwater").replace(" ", "")
                item["image"] = f"[https://loremflickr.com/400/400/](https://loremflickr.com/400/400/){keyword},underwater"

                if "regions" not in item:
                    item["regions"] = []
                if area not in item["regions"]:
                    item["regions"].append(area)

            combined_data.extend(batch_data)
            print(f"    -> Got {len(batch_data)} items.")
        else:
            print(f"    -> Failed to get batch {i+1}. Retrying once...")
            time.sleep(2)
            # 簡易リトライ
            batch_data = _call_gemini_api(area, current_batch_count)
            if batch_data:
                 combined_data.extend(batch_data)
                 print(f"    -> Retry successful. Got {len(batch_data)} items.")

        time.sleep(2) # レート制限回避

    return combined_data

def main():
    if API_KEY == "YOUR_API_KEY_HERE":
        print("⚠️ エラー: APIキーが設定されていません。")
        return

    # 1. 既存データの読み込みとマッピング作成
    all_creatures = []
    creature_map = {}

    if os.path.exists(OUTPUT_FILE):
        print(f"📂 Loading existing data from {OUTPUT_FILE}...")
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                all_creatures = json.load(f)
                for c in all_creatures:
                    if "name" in c:
                        creature_map[c["name"]] = c
            print(f"   -> Loaded {len(all_creatures)} creatures.")
        except json.JSONDecodeError:
            print("   -> File was empty or invalid JSON. Starting fresh.")
    else:
        print("📂 No existing file found. Starting fresh.")

    print(f"🚀 Generating new data using API Key: {API_KEY[:5]}...")

    added_count = 0
    updated_count = 0

    for area in TARGET_AREAS:
        # ここで指定数（例：50）を呼び出すと、内部で分割実行される
        new_creatures = generate_creatures(area, COUNT_PER_AREA)

        if new_creatures:
            area_added = 0
            area_updated = 0

            for new_c in new_creatures:
                name = new_c.get("name")

                if name in creature_map:
                    # 【既存データの更新】
                    existing_c = creature_map[name]
                    if "regions" not in existing_c:
                        existing_c["regions"] = []

                    if area not in existing_c["regions"]:
                        existing_c["regions"].append(area)
                        area_updated += 1
                        updated_count += 1
                        # 進捗が見えるようにprint（数が多いのでコメントアウトしてもOK）
                        # print(f"    - Updated region for: {name} (+{area})")
                else:
                    # 【新規データの追加】
                    all_creatures.append(new_c)
                    creature_map[name] = new_c
                    area_added += 1
                    added_count += 1

            print(f"  -> {area} Result: Added {area_added} new, Updated {area_updated} existing items.")
        else:
            print(f"  -> Failed to generate items for {area}.")

        print("-" * 30)

    # 3. 変更があった場合のみ保存
    if added_count > 0 or updated_count > 0:
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_creatures, f, indent=2, ensure_ascii=False)

        print(f"\n✅ Done! Added: {added_count}, Updated regions: {updated_count}")
        print(f"Total creatures in file: {len(all_creatures)}")
    else:
        print("\nℹ️ No changes made to the data.")

if __name__ == "__main__":
    main()
