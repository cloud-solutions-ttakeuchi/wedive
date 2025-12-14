# Test Scenarios v1.4.0: Data Generation Optimization

v1.4.0で実装されたデータ生成スクリプト群（Point重複対策、生物データ構造化）の動作検証を行うためのテストシナリオです。

## 🧪 Pre-conditions (Reset Data)

テストを正確に行うため、既存のSeedデータをバックアップ（または削除）し、クリーンな状態から開始します。
※ 本番環境や手動で重要データを追加している場合はバックアップ必須。

```bash
# Backup existing data
mv src/data/locations_seed.json src/data/locations_seed.bak.json
mv src/data/creatures_seed.json src/data/creatures_seed.bak.json
```

---

## 📍 Scenario 1: Location Generation Pipeline

階層ごとの生成と、最終的な重複チェック機能を確認します。

### Step 1: Zones Generation
- **Action**: `python scripts/locations/generate_zones.py`
- **Expected Result**:
  - `src/data/locations_seed.json` が作成される。
  - 日本、パラオ等のRegionとその配下のZone（沖縄本島など）が含まれている。
  - `scripts/config/target_zones.json` が生成され、Zoneリストが記載されている。

### Step 2: Areas Generation
- **Action**: `python scripts/locations/generate_areas.py`
- **Expected Result**:
  - `src/data/locations_seed.json` が更新され、Zoneの下にArea（恩納村など）が追加されている。
  - `scripts/config/target_areas.json` が生成され、Areaリストが記載されている。

### Step 3: Points Generation (Deduplication Check)
- **Action**: `python scripts/locations/generate_points.py`
- **Expected Result**:
  - `src/data/locations_seed.json` が更新され、Areaの下にPoint（青の洞窟など）が追加されている。
  - **Check**: 各Pointに `latitude`, `longitude` が含まれていること。
  - **Deduplication Test**:
    1. もう一度 `python scripts/locations/generate_points.py` を実行する。
    2. ログに `⚠️ SKIPPING: 'xxx' (Similar to 'xxx')` と表示され、同じポイントが二重登録されないことを確認する。

---

## 🐠 Scenario 2: Creature Generation Pipeline

生物分類に基づく生成と、画像・生息域のマッピングを確認します。

### Step 1: Creature List Generation
- **Action**: `python scripts/creatures/generate_creatures_by_family.py`
- **Expected Result**:
  - `src/data/creatures_seed.json` が作成される。
  - `scripts/config/target_families.json` で定義された科目の生物が含まれている。
  - `scientificName` が埋まっている。
  - `image` は空文字（またはnull）である。

### Step 2: Image Fetching
- **Action**: `python scripts/creatures/fetch_creature_images.py`
- **Expected Result**:
  - `src/data/creatures_seed.json` が更新される。
  - `image` フィールドにWikipediaのURL（`https://upload.wikimedia.org/...`）が入る。
  - ログに `✅ Found!` が表示される。

### Step 3: Region Mapping
- **Action**: `python scripts/creatures/map_creatures_to_regions.py`
- **Expected Result**:
  - `src/data/creatures_seed.json` が更新される。
  - `regions` フィールドに、`Scenario 1` で生成されたエリア名（日本、沖縄など）が含まれる。

---

## ✅ Cleanup (Optional)
テスト完了後、データを採用する場合はそのままでOK。
やり直す場合は `src/data/*.json` を削除して再度実行。
