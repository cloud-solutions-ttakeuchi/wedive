# Diving Dex Data Generation Scripts

Diving Dex Appのデータ生成・管理スクリプト群です。
Google Gemini APIを使用して、ダイビングポイントや海洋生物のデータを自動生成します。

## ⚙️ Setup

実行には Google Gemini API Key が必要です。

```bash
export GOOGLE_API_KEY="your_api_key_here"
```

## 📂 Directory Structure

- `scripts/locations/`: ポイントデータ生成（Region/Zone/Area/Point）
- `scripts/creatures/`: 生物データ生成（List/Image/Map）
- `scripts/config/`: 生成設定ファイル（Target Listなど）
- `scripts/v1/`: 旧スクリプトアーカイブ

## 📍 Location Generation Pipeline

ダイビングポイントの生成は、データの精度を高めるために階層ごとにステップが分かれています。

### Step 1: Zones Generation
指定された国・地域（Region）内の主要なZone（地理的区分）を生成します。

- **Script**: `scripts/locations/generate_zones.py`
- **Config**: `scripts/config/target_regions.json`
- **Output**: `src/data/locations_seed.json` / `scripts/config/target_zones.json` (Next Step Config)

```bash
python scripts/locations/generate_zones.py
```

### Step 2: Areas Generation (WIP)
Zoneごとの詳細エリアを生成します。

- **Script**: `scripts/locations/generate_areas.py`
- **Config**: `scripts/config/target_zones.json`

### Step 3: Points Generation (WIP)
Areaごとの具体的なダイビングポイントを生成します。重複チェックを含みます。

- **Script**: `scripts/locations/generate_points.py`
- **Config**: `scripts/config/target_areas.json`


## 🐠 Creature Generation Pipeline

生物データは以下の3ステップで生成・完成させます。

### Step 1: Create Creature List
科目（Family）単位で生物データを生成します。主キーは **学名 (scientificName)** です。

- **Script**: `scripts/creatures/generate_creatures_by_family.py`
- **Config**: `scripts/config/target_families.json`
- **Output**: `src/data/creatures_seed.json`

```bash
python scripts/creatures/generate_creatures_by_family.py
```

### Step 2: Fetch Images
Wikipedia APIを使用して実際の画像を検索・取得します。

- **Script**: `scripts/creatures/fetch_creature_images.py`
- **Output**: `src/data/creatures_seed.json` (Update)

```bash
python scripts/creatures/fetch_creature_images.py
```

### Step 3: Map to Regions
各生物が生息するエリアを判定・マッピングします。

- **Script**: `scripts/creatures/map_creatures_to_regions.py`
- **Output**: `src/data/creatures_seed.json` (Update)

```bash
python scripts/creatures/map_creatures_to_regions.py
```
