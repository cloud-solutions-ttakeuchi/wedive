# Scenario Testing: v2.1.4
## Objective
AIデータクレンジングパイプラインの変数化（環境依存値の排除）およびFeature Flag（デバッグログ制御）の正常動作と、それに伴うデプロイ後の整合性を検証する。

---

## Scenario 1: Feature Flag & AI Diagnostics Verification
このシナリオでは、新しく導入されたデバッグフラグが、本番環境と開発環境で意図通りに機能することを検証する。

### 1-1: デバッグログの有効化テスト
- **前提**: Cloud Functions の環境変数に `ENABLE_CLEANSING_DEBUG: "true"` が設定されている。
- **手順**:
    1. 管理画面より適当なポイントのクレンジングを実行。
    2. Google Cloud Logs (Functions) を確認。
- **期待結果**: AIへの送信プロンプト、およびAIからの生パース結果（Raw JSON）がログに出力されていること。

### 1-2: デバッグログの無効化（セキュリティ）テスト
- **前提**: 環境変数が未設定、あるいは `"false"` が設定されている。
- **手順**: 同様にクレンジングを実行し、ログを確認。
- **期待結果**: デバッグ情報の詳細ログが出力されず、処理結果のサマリのみが記録されていること。

---

## Scenario 2: End-to-End Cleansing Integration
ダッシュボードからの実行コマンドが、新しく整備された環境変数（LOCATION, PROJECT_ID等）を正しく参照して完結することを検証する。

### 2-1: 新規ポイントへの全生物マッピング (Mode: New)
- **手順**: 
    1. 生物紐付けがゼロの新規ポイントを選択。
    2. 「新規 (New)」モードで実行。
- **期待結果**: 
    - AIが Vertex AI (指定された ${AI_AGENT_LOCATION}) を経由して正常に返答する。
    - `point_creatures` コレクションに ID が `pointID_creatureID` の形式で正しく作成される。
    - ステータスが `pending` で保存される。

### 2-2: 広域範囲の特定生物スキャン (Range Selection)
- **手順**: 
    1. 特定の「エリア」または「ゾーン」を選択。
    2. 生物名（例：マンタ）を1つ指定して実行。
- **期待結果**: 
    - 選択された範囲内の全ポイントに対してスキャンが実行される。
    - コスト暴走防止のガードを潜り抜け、正常に全件の判定結果が保存される。

---

## Scenario 3: CD Pipeline & Infrastructure Integrity
GitHub Actions によってデプロイされたリソースが、正しい Artifact Registry を参照しているか検証する。

### 3-1: Artifact Registry 参照テスト
- **手順**: 
    1. GitHub Actions のデプロイログを確認。
    2. `wedive-repo` という名称が正しく使用され、Dockerイメージがプッシュされていることを確認。
- **期待結果**: `name unknown` エラーが発生せず、デプロイが完了している。
