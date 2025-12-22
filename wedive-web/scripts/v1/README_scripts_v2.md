# Diving Dex Data Generation Scripts

Diving Dex Appのためのデータ生成・管理スクリプト群です。
Google Gemini APIを使用して、ダイビングポイントや海洋生物のデータを自動生成します。

## ⚙️ Setup

実行には Google Gemini API Key が必要です。

```bash
export GOOGLE_API_KEY="your_api_key_here"
```

## 📂 Scripts Overview

### 1. ダイビングポイント生成 (Point Generation)

指定された国・地域（Region）内のダイビングスポットを階層構造（Region > Zone > Area > Point）で生成します。
既存データがある場合はマージし、**Levenshtein距離による名称重複チェック**を行って重複登録を防ぎます。

- **Script**: `generate_locations.py`
- **Output**: `src/data/locations_seed.json`

```bash
python scripts/generate_locations.py
```

### 2. 海洋生物データの生成パイプライン (Creature Pipeline)

生物データは以下の3ステップで生成・完成させます。

#### Step 1: 生物リストの生成
科目（Family）単位（例: サメ、クマノミ、ウミウシ）で生物データを生成します。
地域単位ではなく分類単位で行うことで、網羅性を高め、地域間の重複生成を防ぎます。
主キーには **学名 (scientificName)** が使用されます。

- **Script**: `generate_creatures_by_family.py`
- **Config**: `scripts/target_families.json` (生成する対象の科目・カテゴリリストをここで設定します)
- **Output**: `src/data/creatures_seed.json`

```bash
python scripts/generate_creatures_by_family.py
```

#### Step 2: 画像の取得
生成された生物リストに対し、Wikipedia APIを使用して実際の画像を検索・取得します。
生成AIによる画像のハルシネーション（リンク切れ）を防ぐため、生成とは別工程で実行します。

- **Script**: `fetch_creature_images.py`
- **Target**: `src/data/creatures_seed.json` (Update in-place)

```bash
python scripts/fetch_creature_images.py
```

#### Step 3: 生息域のマッピング
各生物が「どのエリア（日本、パラオ、沖縄など）」に生息しているかをGeminiに判定させます。
`src/data/locations_seed.json` に存在するエリア名候補から選択されます。

- **Script**: `map_creatures_to_regions.py`
- **Target**: `src/data/creatures_seed.json` (Update in-place)

```bash
python scripts/map_creatures_to_regions.py
```

## ⚠️ Notes
- `src/data/` 以下のJSONファイルは直接編集せず、原則としてこれらのスクリプト経由や管理画面（今後実装予定）で更新することを推奨します。
- `scripts/v1/` には旧バージョンのスクリプトがアーカイブされています。
