# 03 出力ファイル形式 & GCS 命名規則定義書 - Issue 116

## 1. ファイル形式詳説

### 1.1 App用: SQLite (.db.gz)
モバイルアプリ内での高速検索・オフライン利用を目的とする。

#### 1.1.1 テーブル定義 (DDL例)
```sql
-- points table
CREATE TABLE points (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_kana TEXT,
  region TEXT,
  area TEXT,
  region_id TEXT,
  rating REAL,
  review_count INTEGER,
  image_url TEXT
);
CREATE INDEX idx_points_name ON points(name COLLATE NOCASE);
CREATE INDEX idx_points_region ON points(region_id);

-- creatures table
CREATE TABLE creatures (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  family TEXT,
  image_url TEXT,
  tags TEXT
);
CREATE INDEX idx_creatures_name ON creatures(name COLLATE NOCASE);
```

#### 1.1.2 最適化
- **NOCASE**: アルファベット検索時の大文字小文字を無視するように設定。
- **WALモード**: アプリ内での更新中も読み取りを妨げないよう、WAL (Write-Ahead Logging) の使用を推奨（アプリ側実装）。

### 1.2 Web用: JSON (.json.gz)
ブラウザでの IndexedDB ロード用。初期ロード通信量を削るため、キー名を短縮する。

#### 1.2.1 キー圧縮（短縮名マッピング）
| Full Key | Short Key | 備考 |
| :--- | :--- | :--- |
| `name` | `n` | |
| `name_kana` | `k` | |
| `region` | `r` | |
| `imageUrl` | `i` | |

#### 1.2.2 JSON構造
```json
[
  {"id":"p123","n":"大瀬崎","k":"オオセザキ","r":"静岡","i":"https://..."},
  ...
]
```

---

## 2. GCS ストレージ設計

### 2.1 バケット構成
- **バケット名**: `wedive-app-static-master`
- **リージョン**: `asia-northeast1` (ユーザーに近い東京を想定)
- **ライフサイクル管理**: 
  - 旧バージョンのファイルは30日後に自動削除。

### 2.2 パス構造と命名規則
```text
/v1/
  /points/
    latest.db.gz        -- 常時最新のSQLite
    latest.json.gz      -- 常時最新のJSON
    history/
      20260101_1200.db.gz -- タイムスタンプ付き(アーカイブ)
  /creatures/
    latest.db.gz
    latest.json.gz
```

---

## 3. ETag & バージョン管理

### 3.1 ETag 生成ロジック
GCSが自動付与する `goog-hash` (MD5) を「データの指紋」としてそのまま利用する。

### 3.2 アプリ側の更新チェックフロー
1. アプリ起動時、GCSに対して `HTTP HEAD` リクエストを送信（`latest.db.gz` 宛）。
2. レスポンスヘッダーの `ETag` (または `x-goog-hash`) を取得。
3. ローカルに保存されている `current_master_etag` と比較。
4. **不一致の場合のみ**、`HTTP GET` で `latest.db.gz` をダウンロード開始。

### 3.3 アトミック更新の工夫
ダウンロード中、あるいは解凍中にアプリが強制終了した場合に備え：
- `master_temp.db` に一旦書き込み、成功後に `master_current.db` へリネームする原子的な更新手順を採る。
