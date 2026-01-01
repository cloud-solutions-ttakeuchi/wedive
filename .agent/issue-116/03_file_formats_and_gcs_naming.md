# 03 出力ファイル形式 & SQLite テーブル定義書 - Issue 116

## 1. SQLite アーキテクチャ (Hybrid Storage)

モバイルアプリ内では、**GCSから配信される「共通マスタ」**と、**Firestoreから取得する「個人データ」**の2種類のテーブルを組み合わせて保持する。

### 1.1 テーブルの分類

| カテゴリ | テーブル接頭辞 | 更新タイミング | 内容 |
| :--- | :--- | :--- | :--- |
| **Global Master** | `master_` | GCSのETag更新時 | 全ユーザー共通の公共データ。BigQueryから事前集計済み。 |
| **Internal Personal** | `my_` | Firestore同期時 | ユーザー自身のログ、お気に入り、進捗等。 |

---

## 2. Global Master テーブル定義 (GCS -> SQLite)

GCSから `latest.db.gz` として配信される。基本的に読み取り専用。
各カラムは `02_bigquery_and_v_master_sql.md` で定義された VIEW の出力列と 1:1 で対応する。

### 2.1 ポイント・地理
```sql
-- master_points (v_app_points_master に対応)
CREATE TABLE master_points (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_kana TEXT,
  region_id TEXT,
  zone_id TEXT,
  area_id TEXT,
  region_name TEXT,
  zone_name TEXT,
  area_name TEXT,
  level TEXT,
  max_depth REAL,
  main_depth_json TEXT,
  entry_type TEXT,
  current_condition TEXT,
  topography_json TEXT,
  features_json TEXT,
  description TEXT,
  coordinates_json TEXT,
  google_place_id TEXT,
  formatted_address TEXT,
  image_url TEXT,
  images_json TEXT,
  image_keyword TEXT,
  submitter_id TEXT,
  rating REAL,
  review_count INTEGER,
  bookmark_count INTEGER,
  official_stats_json TEXT,
  actual_stats_json TEXT,
  status TEXT,
  created_at TEXT
);
CREATE INDEX idx_master_points_region ON master_points(region_id);
CREATE INDEX idx_master_points_name ON master_points(name_kana);

-- master_geography (v_app_geography_master に対応)
CREATE TABLE master_geography (
  area_id TEXT PRIMARY KEY,
  area_name TEXT,
  area_description TEXT,
  area_status TEXT,
  zone_id TEXT,
  zone_name TEXT,
  zone_description TEXT,
  zone_status TEXT,
  region_id TEXT,
  region_name TEXT,
  region_description TEXT,
  region_status TEXT,
  full_path TEXT
);
```

### 2.2 生物図鑑
```sql
-- master_creatures (v_app_creatures_master に対応)
CREATE TABLE master_creatures (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_kana TEXT,
  scientific_name TEXT,
  english_name TEXT,
  category TEXT,
  family TEXT,
  description TEXT,
  rarity TEXT,
  image_url TEXT,
  gallery_json TEXT,
  depth_range_json TEXT,
  special_attributes_json TEXT,
  water_temp_range_json TEXT,
  size TEXT,
  season_json TEXT,
  tags_json TEXT,
  stats_json TEXT,
  submitter_id TEXT,
  image_credit TEXT,
  image_license TEXT,
  image_keyword TEXT,
  search_text TEXT,
  status TEXT,
  created_at TEXT
);
CREATE INDEX idx_master_creatures_search ON master_creatures(search_text);

-- master_point_creatures (v_app_point_creatures に対応)
CREATE TABLE master_point_creatures (
  id TEXT PRIMARY KEY,
  point_id TEXT,
  creature_id TEXT,
  creature_name TEXT,
  creature_image TEXT,
  local_rarity TEXT,
  last_sighted TEXT,
  reasoning TEXT,
  confidence REAL,
  status TEXT
);
CREATE INDEX idx_master_pt_cre_point ON master_point_creatures(point_id);

-- master_creature_points (v_app_creature_points に対応)
CREATE TABLE master_creature_points (
  creature_id TEXT,
  point_id TEXT,
  point_name TEXT,
  region_name TEXT,
  area_name TEXT,
  local_rarity TEXT,
  PRIMARY KEY (creature_id, point_id)
);
CREATE INDEX idx_master_cre_pt_creature ON master_creature_points(creature_id);
```

### 2.3 統計・フィード・レビュー
```sql
-- master_point_stats (v_app_point_stats に対応)
CREATE TABLE master_point_stats (
  point_id TEXT PRIMARY KEY,
  avg_rating REAL,
  avg_visibility REAL,
  total_reviews INTEGER,
  radar_encounter REAL,
  radar_excite REAL,
  radar_macro REAL,
  radar_comfort REAL,
  radar_visibility REAL,
  monthly_analysis_json TEXT,
  aggregated_at TEXT
);

-- master_point_reviews (v_app_point_reviews に対応)
CREATE TABLE master_point_reviews (
  id TEXT PRIMARY KEY,
  point_id TEXT,
  area_id TEXT,
  zone_id TEXT,
  region_id TEXT,
  user_id TEXT,
  log_id TEXT,
  user_name TEXT,
  user_image TEXT,
  trust_level TEXT,
  rating REAL,
  condition_json TEXT,
  metrics_json TEXT,
  radar_json TEXT,
  tags_json TEXT,
  images_json TEXT,
  helpful_count INTEGER,
  comment TEXT,
  created_at TEXT,
  status TEXT
);
CREATE INDEX idx_master_reviews_point ON master_point_reviews(point_id);

-- master_public_logs (v_app_user_public_logs に対応)
CREATE TABLE master_public_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  date TEXT,
  dive_number INTEGER,
  location_json TEXT,
  point_id TEXT,
  point_name TEXT,
  depth_info_json TEXT,
  condition_info_json TEXT,
  photos_json TEXT,
  comment TEXT,
  like_count INTEGER,
  created_at TEXT
);
CREATE INDEX idx_master_logs_point ON master_public_logs(point_id);
```

---

## 3. Internal Personal テーブル定義 (Firestore <-> SQLite)

アプリの実装ロジックで Firestore と同期（下り同期は制限あり）。

### 3.1 ユーザー活動
```sql
-- my_logs: 自分のダイビングログ (Local First)
-- SQLite が正本であり、Firestore は非同期バックアップとして利用。
-- Firestore からの下り同期（リストア）は有料プラン限定。
CREATE TABLE my_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  point_id TEXT,
  point_name TEXT,
  dive_number INTEGER,
  depth_max REAL,
  time_in TEXT,
  comment TEXT,
  is_private INTEGER, -- 0 or 1
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- my_mastery: 自分のポイント攻略状況
CREATE TABLE my_mastery (
  point_id TEXT PRIMARY KEY,
  point_name TEXT,
  dive_count INTEGER,
  discovered_creatures_count INTEGER,
  last_visit_date TEXT
);
```

### 3.2 お気に入り・ブックマーク
```sql
-- my_bookmarks: ブックマークしたポイント
CREATE TABLE my_bookmarks (
  point_id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- my_favorites: お気に入り生物
CREATE TABLE my_favorites (
  creature_id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. ファイル形式 & GCS 運用

### 4.1 App用: SQLite (.db.gz)
- **WALモード**: アプリ側での書き込み中も読み取りを妨げない `PRAGMA journal_mode=WAL` を使用。
- **GCS パス**: `/v1/master/latest.db.gz`

### 4.2 Web用: JSON (.json.gz)
- 各テーブルに対応したJSON配列を配信。

---

## 5. ETag による更新フロー
1. アプリ起動時に `HEAD /v1/master/latest.db.gz` を実行。
2. ETagが前回と異なる場合、バックグラウンドでダウンロード。
3. ダウンロード完了後、`master_` テーブルのみを差し替え（`my_` テーブルは維持）。
