# 03 出力ファイル形式 & SQLite テーブル定義書 - Issue 116

## 1. Firestore コレクション・SQLite テーブル対応一覧

| Firestore コレクション | FS カラム数 | Master SQLite Table | Master カラム数 | Personal SQLite Table (my_) | Personal カラム数 |
| :--- | :---: | :--- | :---: | :--- | :---: |
| `regions` / `zones` / `areas` | 3 / 4 / 5 | `master_geography` | 13 | － | － |
| `points` | 28 | `master_points` | 34 | `my_bookmarks` / `my_mastery` | 2 / 5 |
| `creatures` | 23 | `master_creatures` | 25 | `my_favorites` | 2 |
| `point_creatures` | 8 | `master_point_creatures` | 10 | － | － |
| `reviews` | 19 | `master_point_reviews` | 21 | `my_reviews` | 12 |
| `users` | 16 | － | － | `my_settings` | 2 |
| `users/{uid}/logs` | 21 | `master_public_logs` | 24 | `my_logs` | 24 |
| `shops` | 8 | `master_shops` | 8 | － | － |
| `certifications` | 4 | `master_certifications` | 4 | － | － |
| `badges` | 4 | `master_badges` | 4 | － | － |
| `*_proposals` | 8 | － | － | `my_proposals` | 6 |

### **カラム数に差異がある主な理由 (Rationale)**

Firestore (FS) のスキーマと SQLite テーブルでカラム数が異なるのは、モバイルアプリでの「オフライン検索」と「描画パフォーマンス」を最適化するための意図的な設計です。

1. **ネスト構造のフラット化 (Flattening)**:
   - FS の `map` 型（`coordinates`, `depth` 等）を SQLite では単一カラム（`latitude`, `longitude` 等）に分解。これにより SQL でのインデックス検索を可能にしています。
2. **高速検索エンジンの構築 (Pellucid Search)**:
   - BigQuery 側で生成した `search_text`（多言語・カナ結合済み）を追加。アプリ側での文字列結合を排除し、ミリ秒単位の検索を実現しています。
3. **JOIN 排除の非正規化 (Denormalization)**:
   - リスト表示に必要な名称（`point_name`, `region_name` 等）を重複保持。テーブル結合なしで画面描写を完結させます。
4. **互換性維持のカプセル化 (Compatibility)**:
   - `data_json` に生ドキュメントを保持。将来の Pii 以外のフィールド追加時に、SQLite のスキーマ変更（マイグレーション）を不要にします。
5. **管理プロパティの付与 (Metadata)**:
   - 同期管理用の `synced_at` や、ローカル生成順を保証する `created_at` を SQLite 独自に保持しています。

---

## 2. SQLite アーキテクチャ (Hybrid Storage)

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
  latitude REAL,
  longitude REAL,
  image_url TEXT,
  images_json TEXT,
  image_keyword TEXT,
  submitter_id TEXT,
  rating REAL,
  review_count INTEGER,
  bookmark_count INTEGER,
  official_stats_json TEXT,
  actual_stats_json TEXT,
  search_text TEXT,
  status TEXT,
  created_at TEXT
);
CREATE INDEX idx_master_points_region ON master_points(region_id);
CREATE INDEX idx_master_points_search ON master_points(search_text);
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
  helpful_by_json TEXT, -- string[] (User IDs)
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
  location_json TEXT, -- {pointId, pointName, region, shopName, lat, lng}
  point_id TEXT,
  point_name TEXT,
  team_json TEXT,     -- {buddy, guide, members}
  time_json TEXT,     -- {entry, exit, duration, surfaceInterval}
  depth_info_json TEXT, -- {max, average}
  condition_info_json TEXT, -- {weather, airTemp, waterTemp, transparency, ...}
  gear_json TEXT,      -- {suitType, suitThickness, weight, tank}
  entry_type TEXT,    -- beach, boat
  creature_id TEXT,   -- Main creature ID
  sighted_creatures_json TEXT, -- string[] (Creature IDs)
  photos_json TEXT,   -- string[] (URLs)
  comment TEXT,
  like_count INTEGER,
  liked_by_json TEXT, -- string[] (User IDs)
  garmin_activity_id TEXT,
  review_id TEXT,
  profile_json TEXT,  -- array(map) [{depth, temp, hr, time}]
  search_text TEXT,
  created_at TEXT
);
CREATE INDEX idx_master_logs_point ON master_public_logs(point_id);

-- master_certifications (認定資格マスタ)
CREATE TABLE master_certifications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT,
  ranks_json TEXT -- CertificationRank[]
);

-- master_badges (バッジマスタ)
CREATE TABLE master_badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon_url TEXT,
  condition_json TEXT
);

-- master_shops (ダイビングショップマスタ)
CREATE TABLE master_shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region_id TEXT,
  area_id TEXT,
  address TEXT,
  phone TEXT,
  url TEXT,
  status TEXT
);
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
  user_id TEXT,
  date TEXT,
  dive_number INTEGER,
  location_json TEXT, -- {pointId, pointName, region, shopName, lat, lng}
  point_id TEXT,
  point_name TEXT,
  team_json TEXT,     -- {buddy, guide, members}
  time_json TEXT,     -- {entry, exit, duration, surfaceInterval}
  depth_info_json TEXT, -- {max, average}
  condition_info_json TEXT, -- {weather, airTemp, waterTemp, transparency, ...}
  gear_json TEXT,      -- {suitType, suitThickness, weight, tank}
  entry_type TEXT,    -- beach, boat
  creature_id TEXT,   -- Main creature ID
  sighted_creatures_json TEXT, -- string[] (Creature IDs)
  photos_json TEXT,   -- string[] (URLs)
  comment TEXT,
  is_private INTEGER, -- 0 or 1
  garmin_activity_id TEXT,
  review_id TEXT,
  profile_json TEXT,  -- array(map) [{depth, temp, hr, time}]
  data_json TEXT,     -- Full DiveLog object (fallback)
  search_text TEXT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- my_reviews: 自分のレビュー
CREATE TABLE my_reviews (
  id TEXT PRIMARY KEY,
  point_id TEXT,
  rating REAL,
  comment TEXT,
  images_json TEXT,
  condition_json TEXT,
  metrics_json TEXT,
  radar_json TEXT,
  tags_json TEXT,
  status TEXT, -- pending, approved, rejected
  created_at TEXT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- my_proposals: 自分の申請（マスタ修正提案など）
CREATE TABLE my_proposals (
  id TEXT PRIMARY KEY,
  target_id TEXT,
  proposal_type TEXT, -- create, update, delete
  status TEXT, -- pending, approved, rejected
  data_json TEXT,
  created_at TEXT
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

-- my_settings: プロフィール・アプリ設定
CREATE TABLE my_settings (
  key TEXT PRIMARY KEY,
  value TEXT
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
2. ETag が前回と異なる場合、バックグラウンドでダウンロード。
3. ダウンロード完了後、`master_` テーブルのみを差し替え（`my_` テーブルは維持）。
4. **マスタ反映済みプロポーザルの自動クリーンアップ**:
   - 新しく取得した `master_points` や `master_creatures` の ID リストと、ローカルの `my_proposals` を照合。
   - すでにマスタ側に反映（承認・登録）されている ID を持つプロポーザルを削除する。
   - これにより、管理者の直接更新および一般ユーザーの承認済み申請が、最新マスタ配信のタイミングで自動的に履歴から整理される。
