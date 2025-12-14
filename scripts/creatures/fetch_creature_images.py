import json
import os
import requests
import time

# 設定
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INPUT_FILE = os.path.join(BASE_DIR, "src/data/creatures_seed.json")
SAVE_INTERVAL = 10

def fetch_wiki_image(query, lang='en'):
    """Wikipedia APIから画像を取得"""
    base_url = f"https://{lang}.wikipedia.org/w/api.php"
    headers = { "User-Agent": "DiveDexBot/1.0 (contact@example.com)" }
    params = {
        "action": "query", "format": "json", "prop": "pageimages|pageterms",
        "piprop": "original", "titles": query, "pithumbsize": 500, "redirects": 1
    }
    try:
        response = requests.get(base_url, params=params, headers=headers, timeout=10)
        if response.status_code != 200: return None
        data = response.json()
        pages = data.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1" or "original" not in page: continue
            return {
                "url": page["original"]["source"],
                "credit": f"Wikipedia ({lang})",
                "license": "CC BY-SA"
            }
    except Exception:
        pass
    return None

def save_data(data):
    """保存処理"""
    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(" 💾 Saved progress.")

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ File not found: {INPUT_FILE}")
        return

    print(f"📂 Loading data from {INPUT_FILE}...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        creatures = json.load(f)

    print(f"Checking images for {len(creatures)} creatures...")

    updated_count = 0
    skipped_count = 0

    for i, creature in enumerate(creatures):
        name = creature.get("name", "Unknown")
        current_image = creature.get("image", "")

        # 既に有効な画像URL（httpで始まり、loremflickr等ダミーでない）があればスキップ
        if current_image and current_image.startswith("http") and "loremflickr" not in current_image:
             skipped_count += 1
             continue

        # 検索優先順位
        scientific_name = creature.get("scientificName")
        english_name = creature.get("englishName")
        keyword = creature.get("imageKeyword")

        print(f"[{i+1}/{len(creatures)}] 🔍 Searching: {name} ({scientific_name})...", end="", flush=True)

        image_data = None

        # 1. 学名 (最優先・英語Wiki)
        if scientific_name:
            image_data = fetch_wiki_image(scientific_name, 'en')

        # 2. 英名 (英語Wiki)
        if not image_data and english_name:
             image_data = fetch_wiki_image(english_name, 'en')

        # 3. 和名 (日本語Wiki)
        if not image_data:
            image_data = fetch_wiki_image(name, 'ja')

        # 4. キーワード
        if not image_data and keyword:
             image_data = fetch_wiki_image(keyword, 'en')

        if image_data:
            creature["image"] = image_data["url"]
            creature["imageCredit"] = image_data["credit"]
            creature["imageLicense"] = image_data["license"]
            print(" ✅ Found!")
            updated_count += 1
        else:
            print(" ❌ Not found")

        # レート制限 & 保存
        if updated_count > 0 and updated_count % SAVE_INTERVAL == 0:
            save_data(creatures)

        time.sleep(1.0) # Politeness delay

    save_data(creatures)

    print(f"\n✨ Done!")
    print(f"   - Total checked: {len(creatures)}")
    print(f"   - Newly Fetched: {updated_count}")
    print(f"   - Skipped: {skipped_count}")

if __name__ == "__main__":
    main()
