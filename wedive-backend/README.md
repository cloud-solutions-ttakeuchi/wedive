# WeDive Backend Pipeline

## アーキテクチャ概要

本バックエンドは、Firestore に蓄積された RAW データを BigQuery で集計し、アプリで利用可能な SQLite および JSON 形式に変換して GCS から配信するためのパイプラインです。

コストとパフォーマンスを最適化するため、以下の 3 つのコンポーネントに分離されています。

1.  **kana-converter**: 文字列を一括でカタカナに変換する API。
2.  **master-data-enricher**: BigQuery の差分を検出し、`kana-converter` を呼び出して `name_kana` や `search_text` を永続テーブルに保存する非同期ジョブ。
3.  **master-data-exporter**: エンリッチされたデータを含む最新の投影（VIEW）を SQLite/JSON に書き出し、GCS へアップロードする配信ジョブ。

## セットアップ手順

### 1. Firestore to Bigquery Stream(同期設定)

```
cd wedive-backend
# ログイン（必要に応じて）
firebase login --reauth
# 対象プロジェクトの選択
firebase use [PROJECT_ID]
# 拡張機能の一括デプロイ
firebase deploy --only extensions
```



### 2. デプロイ
`deploy.sh` を実行して各リソースをデプロイします。

```bash
./deploy.sh [YOUR_GCP_PROJECT_ID]
```

### 3. スケジュール設定
デプロイ後、Google Cloud Console から以下のスケジュールジョブを設定してください。

-   **Enricher ジョブ**:
    -   頻度: 1時間に1回程度 (例: `0 * * * *`)
    -   ターゲット: `master-data-enricher` の HTTP URL
-   **Exporter ジョブ**:
    -   頻度: Enricher の完了後のタイミング (例: `10 * * * *`)
    -   ターゲット: `master-data-exporter` の HTTP URL

## 開発ルール

-   **責務の分離**: エクスポートロジックに計算や変換を含めないでください。
-   **コスト最適化**: BigQuery Remote Function ではなく、Enricher による一括バッチ呼び出しを利用してください。


## 開発手順

### ステップ1. Workload Identity Pool の作成

```
# プロジェクトIDと変数の設定
export PROJECT_ID="dive-dex-app-dev"
export REPO_NAME="cloud-solutions-ttakeuchi/wedive"
export PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
# 既存のサービスアカウント（例: github-actions-deployer 等）を使用します
export SERVICE_ACCOUNT_NAME="dive-dex-app-dev-fb-gh@dive-dex-app-dev.iam.gserviceaccount.com" # 実際の名称に書き換えてください


# 1. Workload Identity Pool の作成
gcloud iam workload-identity-pools create "github-pool" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --display-name="GitHub Actions Pool"
# 2. GitHub 用の Provider を作成
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="github-pool" \
    --display-name="GitHub Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository == '${REPO_NAME}'" \
    --issuer-uri="https://token.actions.githubusercontent.com"
# 3. サービスアカウントに GitHub からの「なりすまし」権限を与える
#gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT_NAME}" \
    --project="${PROJECT_ID}" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/${REPO_NAME}"
```

### ステップ2：GitHub Actions ワークフローの修正案

```
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    # Workload Identity Federation を使用
    workload_identity_provider: 'projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/github-pool/providers/github-provider'
    service_account: 'firebase-adminsdk-xxxxx@cloud-solutions-app.iam.gserviceaccount.com'

- name: Run Deploy Script
  # ... 以降は同じ
```

# Storage バケットにCORS設定を適用

```
gcloud storage buckets update gs://wedive-app-static-master-dev --cors-file=cors.json
gcloud storage buckets update gs://wedive-app-static-master-prod --cors-file=cors.json
```

# cloud run 実行

```
gcloud functions call master-data-enricher --region asia-northeast1 --project YOUR_GCP_PROJECT_ID
gcloud functions call master-data-exporter --region asia-northeast1 --project YOUR_GCP_PROJECT_ID
```
