import os
import json
import time
import math
import hashlib
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
# --- 設定 ---
# API Key Handling
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
TARGET_FAMILIES_FILE = os.path.join(CONFIG_DIR, "target_families.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "creatures_seed.json")

BATCH_SIZE = 5
COUNT_PER_GROUP = 5

SCHEMA_PROMPT = """
出力スキーマ(JSON Array):
[
  {
    "name": "生物名(和名)",
    "englishName": "English Name",
    "scientificName": "Scientific Name",
    "description": "50文字程度の解説",
    "imageKeyword": "画像検索用キーワード"
  }
]
"""

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

def _call_gemini_api(target: str, count: int) -> List[Dict]:
    """Gemini APIを叩く"""
    global current_resource_index

    prompt = f"""
    あなたは海洋生物学者です。
    ダイバーに人気の高い「{target}」の仲間を {count} 種類リストアップしてください。

    条件:
    1. ダイビングで見られる種を中心に選定すること。
    2. 学名(scientificName)は正確に記述すること。
    3. JSON以外の文字列は出力しないこと。

    {SCHEMA_PROMPT}
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
            if text.strip().endswith("}"): text += "]"

            data = json.loads(text)
            result = data if isinstance(data, list) else [data]
            if result:
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

    print(f"    💀 All resources failed for {target}")
    return []

def generate_creatures_by_group(target: str, total_count: int) -> List[Dict]:
    """バッチ処理で生成"""
    print(f"Generating {total_count} creatures for group: {target}...")
    combined_data = []
    num_batches = math.ceil(total_count / BATCH_SIZE)

    for i in range(num_batches):
        current_count = min(BATCH_SIZE, total_count - len(combined_data))
        batch_data = _call_gemini_api(target, current_count)

        if batch_data:
            for item in batch_data:
                # ID生成 (学名を優先キーとする)
                seed_str = item.get("scientificName") or item.get("name")
                unique_hash = hashlib.sha256(seed_str.encode()).hexdigest()[:16]
                item["id"] = f"c_{unique_hash}"
                item["image"] = "" # 画像は別途取得

            combined_data.extend(batch_data)
            print(f"    -> Batch {i+1}/{num_batches}: Got {len(batch_data)} items.")
        else:
            print(f"    -> Batch {i+1}/{num_batches}: Failed.")

        time.sleep(2)

    return combined_data

def main():
    if not API_KEYS:
        print("⚠️ API Key missing.")
        return

    # 既存データの読み込み (学名で名寄せ用マップ作成)
    all_creatures = []
    scientific_map = {}

    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                all_creatures = json.load(f)
                for c in all_creatures:
                    if "scientificName" in c:
                        scientific_map[c["scientificName"]] = c
        except:
            pass

    print(f"📂 Loaded {len(all_creatures)} creatures. Starting generation...")

    added_count = 0
    updated_count = 0

    # 生成対象リストの読み込み
    target_groups = []
    if os.path.exists(TARGET_FAMILIES_FILE):
        with open(TARGET_FAMILIES_FILE, 'r', encoding='utf-8') as f:
            target_groups = json.load(f)
        print(f"📖 Loaded {len(target_groups)} target families from file.")
    else:
        print(f"⚠️ Target families file not found: {TARGET_FAMILIES_FILE}")
        return

    for group in target_groups:
        new_items = generate_creatures_by_group(group, COUNT_PER_GROUP)

        for item in new_items:
            s_name = item.get("scientificName")

            if s_name and s_name in scientific_map:
                # 既存あり: 情報更新 (画像は上書きしない)
                existing = scientific_map[s_name]
                # マージロジック (空なら埋めるなど)
                updated_count += 1
            else:
                # 新規追加
                all_creatures.append(item)
                if s_name: scientific_map[s_name] = item
                added_count += 1

    # 保存
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_creatures, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Added: {added_count}, Updated: {updated_count}")

if __name__ == "__main__":
    main()
