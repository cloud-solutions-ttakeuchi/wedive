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

### 2.1 ポイント・地理
```sql
-- master_points: ポイント基本情報
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
  main_depth_json TEXT,  -- JSON array
  entry_type TEXT,
  coordinates_json TEXT, -- {lat, lng}
  rating REAL,
  review_count INTEGER,
  image_url TEXT,
  status TEXT
);
CREATE INDEX idx_master_points_region ON master_points(region_id);
CREATE INDEX idx_master_points_name ON master_points(name_kana);

-- master_geography: 階層マスタ
CREATE TABLE master_geography (
  area_id TEXT PRIMARY KEY,
  area_name TEXT,
  zone_id TEXT,
  zone_name TEXT,
  region_id TEXT,
  region_name TEXT,
  full_path TEXT
);
```

### 2.2 生物図鑑
```sql
-- master_creatures: 生物マスタ
CREATE TABLE master_creatures (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_kana TEXT,
  scientific_name TEXT,
  category TEXT,
  family TEXT,
  rarity TEXT,
  image_url TEXT,
  description TEXT,
  stats_json TEXT,
  tags_json TEXT,
  search_text TEXT -- 検索用連結文字列
);
CREATE INDEX idx_master_creatures_search ON master_creatures(search_text);

-- master_point_creatures: ポイント別出現生物
CREATE TABLE master_point_creatures (
  id TEXT PRIMARY KEY,
  point_id TEXT,
  creature_id TEXT,
  local_rarity TEXT,
  last_sighted TEXT,
  confidence REAL
);
CREATE INDEX idx_master_pt_cre_point ON master_point_creatures(point_id);
```

### 2.3 統計・フィード
```sql
-- master_point_stats: 集計済み統計
CREATE TABLE master_point_stats (
  point_id TEXT PRIMARY KEY,
  avg_rating REAL,
  avg_visibility REAL,
  radar_json TEXT, -- {encounter, excite, ...}
  monthly_analysis_json TEXT -- 12ヶ月分の解析データ
);

-- master_public_logs: 公開フィード
CREATE TABLE master_public_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  point_id TEXT,
  point_name TEXT,
  date TEXT,
  photos_json TEXT,
  comment TEXT,
  like_count INTEGER
);
```

---

## 3. Internal Personal テーブル定義 (Firestore <-> SQLite)

アプリの実装ロジックで Firestore とリアルタイム同期する。

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
-- (Firestore stats/mastery をそのままキャッシュ)
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
- SQLiteを扱いにくいWeb版では、同じデータをテーブル単位のJSON配列として配信。
- **GCS パス**: `/v1/master/latest.json.gz` (全テーブルを含む巨大JSON、または個別に分割)

---

## 5. ETag による更新フロー
1. アプリ起動時に `HEAD /v1/master/latest.db.gz` を実行。
2. ETagが前回と異なる場合、バックグラウンドでダウンロード。
3. ダウンロード完了後、`master_` テーブルのみを差し替え（`my_` テーブルは維持）。
   - SQLite の `ATTACH DATABASE` 機能を使って、ダウンロードした新DBから既存DBへマスタテーブルだけをインポートする手法も有効。
