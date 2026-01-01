# 04 Cloud Functions & スケジューラー定義書 - Issue 116

## 1. Cloud Run Functions 仕様 (master-data-exporter)

### 1.1 基本構成
- **言語**: Python 3.11+
- **メモリ**: 1GB (大規模なSQLiteバイナリ生成のため余裕を持たせる)
- **タイムアウト**: 540秒 (9分)
- **実行環境**: Cloud Run (Gen2)

### 1.2 内部アルゴリズム（BigQuery → SQLiteバイナリ生成）
SQLiteファイルをメモリ上、あるいはTemp領域に生成し、GCSへストリームする手順。

1. **データ取得**: BigQuery Viewからデータを全件フェッチ（`google-cloud-bigquery`）。
2. **SQLite構築**:
    - `tempfile` モジュールを使用して、一時ディレクトリに `.db` ファイルを作成。
    - `sqlite3` ライブラリを使用して、DDL（テーブル・インデックス作成）を実行。
    - `executemany` を使用して、BigQueryからの結果を一括インサート。
    - `VACUUM` を実行してファイルサイズを最適化。
3. **圧縮**: 生成した `.db` ファイルを `gzip` で圧縮し、バイナリを生成。
4. **アップロード**: GCSクライアントを使用して `bucket.blob('latest.db.gz')` へアップロード。
    - `content_type='application/x-sqlite3'`
    - `content_encoding='gzip'`
    - メタデータに `db_version` (タイムスタンプ) を付与。

### 1.3 再試行ポリシーとべき等性
- **再試行**: Cloud Pub/Sub 経由でトリガーし、Cloud Functions 側の「配信エラー時の再試行」を有効化。
- **べき等性**: `latest.db.gz` を上書き保存する操作自体が副作用を持たないため、複数回実行されても最新状態に収束する（べき等）。

---

## 2. クラウドスケジューラー定義 (Exporter Trigger)

### 2.1 スケジュール設定
- **実行頻度**: `0 * * * *` (1時間ごと)
- **タイムゾーン**: `Asia/Tokyo`

### 2.2 実行設定
- **ターゲット**: Cloud Pub/Sub トピック (例: `master-export-trigger`)
- **ペイロード**: `{"type": "full_export"}`
- **IAM権限**: 
    - `Cloud Scheduler Service Agent` ロールに、Pub/Subへのパブリッシュ権限。
    - Functions実行 service account に `BigQuery Data Viewer` および `Storage Object Admin`。

---

## 3. 運用・監視・セキュリティ

### 3.1 セキュリティ（最小権限の法則）
Functionsのサービスアカウントは、以下の権限のみに制限する。
- 参照: 特定のBigQueryデータセット
- 書き込み: 特定のGCSバケット

### 3.2 監視と Slack 通知
- **監視**: Cloud Logging の「Error Reporting」を使用。
- **通知ロジック**:
    - Log-based Metrics でエクスポートエラーをカウント。
    - Cloud Monitoring で「エラー件数 > 0」のアラートポリシーを作成。
    - 通知先に Slack (Webhook) を指定し、失敗時に即座に開発者へ通知。

### 3.3 死活監視 (Dead-man's Switch)
エクスポートファイルが24時間以上更新されていない場合（ETagが変化していない場合）に、正常終了しているがデータが更新されていない異常を検知するアラートを設定。
