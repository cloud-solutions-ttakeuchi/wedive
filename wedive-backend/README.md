# WeDive Backend (GCS Mirror Architecture)

WeDive のマスタデータを BigQuery で集約し、SQLite/JSON 形式で GCS へエクスポートするパイプラインです。

## ディレクトリ構成

- `bigquery/views/`: BigQuery VIEW の SQL 定義
- `functions/exporter/`: マスタデータエクスポート関数 (Cloud Run Functions)
- `functions/kana-converter/`: カナ変換リモート関数 (BigQuery Remote Function)

## デプロイ手順 (予定)

1. BigQuery VIEW のデプロイ
2. Cloud Functions のデプロイ
3. Cloud Scheduler による定期実行設定
