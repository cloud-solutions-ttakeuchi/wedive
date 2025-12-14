import json
import os
import time
import math
import google.generativeai as genai
from typing import List, Dict

# 設定
# 設定
# API Key Handling
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
CREATURES_FILE = os.path.join(DATA_DIR, "creatures_seed.json")
TARGET_REGIONS_FILE = os.path.join(CONFIG_DIR, "target_regions.json")
BATCH_SIZE = 10

def get_target_regions() -> List[str]:
    if not os.path.exists(TARGET_REGIONS_FILE):
        return ["沖縄", "パラオ", "フィリピン", "インドネシア", "モルディブ", "伊豆", "小笠原"]
    with open(TARGET_REGIONS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

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

def map_regions_batch(creatures: List[Dict], region_list: List[str]) -> List[Dict]:
    """Geminiにバッチで生息域を判定させる"""
    global current_resource_index

    names = [c["name"] for c in creatures]

    prompt = f"""
    生物リスト: {json.dumps(names, ensure_ascii=False)}

    上記の各海洋生物について、以下のエリアリストのうち「実際にダイビングで見られる・生息しているエリア」を選んでください。

    エリア候補: {json.dumps(region_list, ensure_ascii=False)}

    条件:
    1. 出力は以下のJSON形式 (Array of Objects) のみにしてください。
    2. 生息しているかわからない場合は空配列にしてください。

    Example Output:
    [
      {{"name": "カクレクマノミ", "regions": ["沖縄", "フィリピン", "バリ", "パラオ"]}},
      {{"name": "ダンゴウオ", "regions": ["伊豆", "東北"]}}
    ]
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
            if text.startswith("```json"): text = text[7:]
            if text.startswith("```"): text = text[3:]
            if text.endswith("```"): text = text[:-3]

            result = json.loads(text)
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

    print(f"    💀 All resources failed for this batch")
    return []

def main():
    if not os.path.exists(CREATURES_FILE):
        print("❌ Creatures file not found.")
        return

    print("Loading data...")
    with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
        creatures = json.load(f)

    target_regions = get_target_regions()
    print(f"Target Regions: {target_regions[:10]}...")

    print(f"Mapping regions for {len(creatures)} creatures...")

    updated_count = 0
    num_batches = math.ceil(len(creatures) / BATCH_SIZE)

    for i in range(num_batches):
        batch_slice = creatures[i*BATCH_SIZE : (i+1)*BATCH_SIZE]

        # 既にregionsが十分入っている場合はスキップするなどの判定を入れることも可能だが、
        # 今回は補完目的なので全チェック、あるいは「無いものだけ」などが良い
        # ここでは「regionsが空 または 少ない」場合に実行するロジックにする
        targets = [c for c in batch_slice if not c.get("regions")]

        if not targets:
            print(f"Skipping batch {i+1} (All have regions).")
            continue

        print(f"Processing Batch {i+1}/{num_batches} ({len(targets)} items)...")
        results = map_regions_batch(targets, target_regions)

        # 結果のマージ
        result_map = {r["name"]: r["regions"] for r in results}

        for c in targets:
            if c["name"] in result_map:
                c["regions"] = result_map[c["name"]]
                updated_count += 1

        time.sleep(2)

    # 保存
    with open(CREATURES_FILE, 'w', encoding='utf-8') as f:
        json.dump(creatures, f, indent=2, ensure_ascii=False)

    print(f"✅ Done! Updated regions for {updated_count} creatures.")

if __name__ == "__main__":
    main()
