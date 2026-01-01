# Issue: Firestore 読み取りコストの最適化と高速なマスタデータ配信基盤の構築

## 1. 現状の課題 (Current Issues)
### 1.1 Firestore Read コストの増大リスク
現在のモバイルアプリ（wedive-app）の一部の実装において、マスタデータ（ポイント一覧、生物一覧）を Firestore から全件同期（Snapshot受信）しようとするロジックが存在する。
- **リスク**: データ件数が数千件を超え、ユーザー数が増加した場合、1ユーザーのアクセスごとに膨大な Read クエリが発生し、インフラ費用が指数関数的に増大する（破産リスク）。

### 1.2 アプリケーションのパフォーマンス劣化（無限ローディング）
全件取得が完了するまで画面表示をブロックする実装により、ネットワーク環境やデータ量に応じて「読み込みが終わらない」現象が発生している。

## 2. 解決案 (Proposed Solutions)
### 2.1 【短期】案1: オンデマンド取得への切り替え (On-demand Fetching)
### 2.2 【中期】案2: GCS Mirror Architecture via BigQuery Data Factory

## 3. ロードマップ (Roadmap)
1. **Phase 1 (即時)**: `EditLogScreen` の全件ロード処理を撤廃し、オンデマンド取得へリファクタリング。
2. **Phase 2 (設計)**: GCP Cloud Functions / Workflows を用いた Firestore → GCS → BigQuery のエクスポートパイプラインの構築。
3. **Phase 3 (移行)**: アプリの各マスタデータフェッチを GCS 経由に切り替え。

## 4. 完了定義 (Definition of Done)
- [x] アプリの初期表示からマスタデータの全件待ちを排除する。
- [x] 検索時の Read 回数が `limit` 値以下であることを確認する。
- [x] パイプライン（インフラ構成）設計書 [01_infrastructure_pipeline.md]
- [x] Bigquery / VIEW / SQL 定義書 [02_bigquery_and_v_master_sql.md]
- [x] 出力ファイル形式（JSON / SQLite）定義書 [03_file_formats_and_gcs_naming.md]
- [x] Cloud Functions / スケージャー / 監視定義書 [04_cloud_functions_and_scheduler.md]
- [ ] GCS 経由でのマスタ配信パスを確立する。
