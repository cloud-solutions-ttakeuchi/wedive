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

## 2. BigQuery リモート関数仕様 (fn_to_kana)

SQL内から呼び出し可能な「かな変換」エンジン。

### 2.1 基本構成
- **用途**: `points.name` や `creatures.name` の漢字をカタカナに変換する。
- **言語**: Python 3.11+
- **使用ライブラリ**: `pykakasi` または `fugashi` (MeCab)
- **エンドポイント形式**: HTTP トリガー (BigQuery Remote Function 専用インターフェース)

### 2.2 内部アルゴリズム
1. BigQuery から `calls` (配列) として複数の文字列を受け取る。
2. 形態素解析を実行し、各文字列の「読み」をカタカナで抽出。
3. `replies` (配列) として変換後のカタカナ文字列を返す。
   - 例: "大瀬崎" -> "オオセザキ"
   - 例: "ミジンベニハゼ" -> "ミジンベニハゼ"

---

## 3. Cloud Run Functions 仕様 (master-data-enricher)
コストのかかる「カナ変換」や「検索用テキスト構築」処理を、差分に対してのみ実行し、永続化テーブルに反映させる。

### 3.1 基本構成
- **言語**: Python 3.11+
- **実行環境**: Cloud Run (Gen2)
- **トリガー**: Cloud Scheduler (Exporter 実行の前に動作)

### 3.2 内部アルゴリズム (差分エンリッチメント)
1. **差分抽出**: 
   - `BQE.points_enriched` に ID が存在しない、または RAW データの `status` が変化したレコードの ID リストを BigQuery から取得。
2. **バッチ変換**:
   - リストに含まれる名称を `fn_to_kana` (または直接内部ロジック) でカナ変換。
   - 名前の和名・英名・学名、および地域名を結合した `search_text` を構築。
3. **MERGE 反映**:
   - 変換結果を BigQuery の一時テーブルにロード。
   - `MERGE INTO points_enriched T USING delta...` を実行し、既存レコードの更新または新規挿入を行う。

---

## 4. クラウドスケジューラー定義 (Pipeline Triggers)

### 4.1 スケジュール設定
1. **Enricher Trigger**: `50 * * * *` (毎時 50分 - Exporter の直前)
2. **Exporter Trigger**: `0 * * * *` (毎時 0分)

### 4.2 実行設定
- **ターゲット**: Cloud Pub/Sub トピック (それぞれのトリガー)
- **IAM権限**: 
    - 各 Function の実行サービスアカウントに `BigQuery Job User`, `BigQuery Data Viewer`, `BigQuery Data Editor`。

---

## 5. 運用・監視・セキュリティ

### 5.1 セキュリティ（最小権限の法則）
Functionsのサービスアカウントは、以下の権限のみに制限する。
- 参照: 特定のBigQueryデータセット
- 書き込み: 特定のGCSバケット

### 4.2 監視と Slack 通知
- **監視**: Cloud Logging の「Error Reporting」を使用。
- **通知ロジック**:
    - Log-based Metrics でエクスポートエラーをカウント。
    - Cloud Monitoring で「エラー件数 > 0」のアラートポリシーを作成。
    - 通知先に Slack (Webhook) を指定し、失敗時に即座に開発者へ通知。

### 4.3 死活監視 (Dead-man's Switch)
エクスポートファイルが24時間以上更新されていない場合（ETagが変化していない場合）に、正常終了しているがデータが更新されていない異常を検知するアラートを設定。
