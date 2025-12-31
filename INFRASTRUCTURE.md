# WeDive インフラ構成仕様書

本ドキュメントは、WeDive アプリケーションのシステムアーキテクチャ、クラウドサービス、および計算リソースの連携について説明します。

---

## 1. システム構成・関係図 (Infrastructure Diagram)

WeDive は、Firebase Hosting をエントリポイントとし、Firebase Functions (v2) および Cloud Run Jobs を組み合わせたサーバーレス構成を採用しています。

```mermaid
graph TD
    subgraph "External"
        DNS[Google Domains / DNS]
        GoogleSearch[Google Search API]
    end

    subgraph "Global / User Side"
        User((User / Browser / Mobile))
        FBH[Firebase Hosting]
    end

    subgraph "Google Cloud / Firebase Project (asia-northeast1)"
        subgraph "API / Service Layer (Firebase Functions v2 / Cloud Run based)"
            AuthFunc[basicAuth<br/>基本認証 & SPA配信]
            AI_API[getConciergeResponse<br/>AIコンシェルジュAPI]
            DraftAPI[generateDraftAPI<br/>スポット・生物下書き生成]
            JobTrigger[runDataCleansing<br/>ジョブ実行トリガー]
            ReviewStats[onReviewWriteAggregateStats<br/>レビュー集計トリガー]
            MasteryCalc[onLogWriteCalcMastery<br/>攻略率計算トリガー]
        end

        subgraph "Batch Layer (Cloud Run Jobs)"
            CRJ[cleansing-job<br/>生物紐付けクレンジング]
        end

        subgraph "Data Store"
            Auth[Firebase Authentication]
            Firestore[(Cloud Firestore)]
            Storage[Firebase Storage]
        end

        subgraph "Vertex AI Stack (us-central1 / Grounding)"
            Gemini[[Gemini 2.0 Flash]]
            Cache[(Context Cache)]
            AgentBuilder[[Vertex AI Agent Builder]]
            DataStores[(Data Stores: Points, Creatures, Manuals)]
        end
        
        Artifact[Artifact Registry]
    end

    %% Flows
    User -->|Access / Auth| FBH
    FBH -->|Rewrite /api/*| AuthFunc
    AuthFunc -->|Serve| User
    
    %% API Calls
    User -->|Call: Generate Draft| DraftAPI
    DraftAPI -->|Inference| Gemini
    Gemini -->|Fetch Grounding| AgentBuilder & GoogleSearch
    AgentBuilder -->|Read| DataStores
    DraftAPI -->|Return JSON| User
    
    User -->|Call: Concierge| AI_API
    AI_API -->|Inference| Gemini
    AI_API -->|Return Answer| User

    %% Data Write Flow
    User -->|Call: Run Job| JobTrigger
    User -->|Write Review| Firestore
    User -->|Upload Image| Storage
    User -->|Write Log| Firestore
    
    %% Background Triggers
    Firestore -->|Trigger: reviews/id| ReviewStats
    ReviewStats -->|Update: points/id| Firestore
    
    Firestore -->|Trigger: logs/id| MasteryCalc
    MasteryCalc -->|Update: user/stats| Firestore
    
    %% Batch Process
    JobTrigger -->|Start Job| CRJ
    CRJ -->|Read All Data| Firestore
    CRJ -->|Grounding Check| Gemini
    CRJ -->|Write: point_creatures| Firestore
    
    Gemini -->|Optimization| Cache
    Artifact -->|Deployment Image| CRJ
```

---

## 2. サービス・コンポーネント一覧

### 2.1 API サービス (Firebase Functions v2)
ユーザーのブラウザ（フロントエンド）から、Firebase Hosting のリライト経由で呼び出される関数群です。これらは内部的に Cloud Run 上でマイクロサービスとして稼働しています。

| 関数名 | 役割 | トリガー (Source) | 出力・連携先 (Target) |
| :--- | :--- | :--- | :--- |
| `basicAuth` | SPA配信・認証 | HTTP Request (Firebase Hosting) | Web Client |
| `getConciergeResponse` | AIコンシェルジュ API | Call (Callable) | Vertex AI -> Web Client |
| `generateSpotDraft` | ドラフト自動生成 | Call (Callable) | Vertex AI -> Web Client (JSON) |
| `generateCreatureDraft` | 生物ドラフト自動生成 | Call (Callable) | Vertex AI -> Web Client (JSON) |
| `runDataCleansing` | データクレンジング起動 | Call (Callable) | Cloud Run Jobs -> AI -> `point_creatures` |
| `onPointUpdateTranslate` | 自動翻訳 | **Write**: `points/{id}` | Vertex AI -> **Write**: `points/{id}` |
| `onReviewWriteAggregateStats` | レビュー集計 | **Write**: `reviews/{id}` | **Write**: `points/{id}` (stats) |
| `onLogWriteCalcMastery` | 攻略率計算 | **Write**: `users/{uid}/logs/{lid}` | **Write**: `users/{uid}/stats/mastery` |

### 2.2 バッチ処理 (Cloud Run Jobs)
API タイムアウト（60秒）を超える重い処理や、定期的な一括処理を担当します。

| ジョブ名 | 役割 | トリガー / 実行タイミング |ジョブ実体| 出力・連携先 (Target) |
| :--- | :--- | :--- | :--- |
| `cleansing-job` | 生物紐付け整合性チェック & AI生成 | `runDataCleansing` / Schedule | scripts/cleansing_pipeline.py| Vertex AI -> **Write**: `point_creatures` |

---

## 3. 計算リソースとロケーション

### 3.1 Vertex AI (AI 処理: `us-central1`)
- **Gemini 2.0 Flash / 1.5 Flash**: 最新の生成 AI モデルを使用。
- **Context Caching**: 数千種類の生物情報をキャッシュし、API コストとレスポンス時間を最適化。
- **Google Search Grounding**: AI の回答に実在する検索結果を統合。

### 3.2 Cloud Run インフラ (`asia-northeast1`)
- **計算拠点**: 日本のユーザーに合わせ、すべての演算リソースを東京リージョンに集約。
- **Artifact Registry**: `wedive-repo` にビルド済みのコンテナイメージを格納。

---

## 4. デプロイメント・パイプライン

GitHub Actions を通じて、以下の 3 段階でデプロイが実行されます。

1.  **Frontend Build**: Vite によるビルドと Firebase Hosting へのデプロイ。
2.  **Functions Deploy**: TypeScript コンパイルと Firebase Functions (v2) へのデプロイ。
3.  **Batch Build & Update**: Docker イメージのビルド、Push、および Cloud Run Jobs の定義更新。

---

## 5. インフラ定数 (Infrastructure Constants)

| 項目 | 値 |
| :--- | :--- |
| プロジェクト ID (Prod) | `wedive` |
| プロジェクト ID (Stg) | `dive-dex-app` |
| プロジェクト ID (Dev) | `dive-dex-app-dev` |
| Firestore リージョン | `asia-northeast1` |
| AI プロセッサ ロケーション | `us-central1` |
| Artifact Registry Repo | `wedive-repo` |


### 6. 環境変数 (Environment Variables)

| 環境変数名 | 説明 | 使用目的 |
| :--- | :--- | :--- |
| `GCLOUD_PROJECT` | Google Cloud プロジェクト ID | Firestore、Vertex AI、Cloud Run 等のリソース特定。**必須。** |
| `LOCATION` / `GCP_REGION` | リソースの稼働リージョン | Cloud Run Job、Firebase Functions の実行場所指定。 |
| `AI_AGENT_LOCATION` | Vertex AI (Gen AI) の実行リージョン | Gemini 2.0 Flash 及 Context Caching を利用するため `us-central1` を指定してください。 |
| `LOG_LEVEL` | ログ出力詳細度 | DEBUG, INFO, WARN, ERROR のいずれか。システムのデバッグに使用。 |
| `BASIC_AUTH_USER` | Basic 認証ユーザー名 | ステージング・本番環境へのアクセス制限（未設定時は解除）。 |
| `BASIC_AUTH_PASS` | Basic 認証パスワード | 同上。 |
| `CLEANSING_JOB_NAME` | Cloud Run Jobs 名 | AI クレンジングを実行するジョブの名称指定。 |
| `ENABLE_V2_VERTEX_SEARCH` | Managed RAG 有効化フラグ | `true` で Vertex AI Search を使用。 (旧: `USE_VERTEX_AI_SEARCH`) |
| `ENABLE_V2_AI_CONCIERGE` | AIコンシェルジュ有効化フラグ | 公開範囲の制御に使用。 |
| `VERTEX_AI_CONCIERGE_DATA_STORE_IDS` | コンシェルジュ用データストア ID | カンマ区切りで複数指定可能。 |
| `VERTEX_AI_DRAFT_DATA_STORE_IDS` | ドラフト生成用データストア ID | カンマ区切りで複数指定可能。 |
| `VITE_FIREBASE_API_KEY` | Firebase API キー | フロントエンドからの Firebase 接続認証。 |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API キー | 地図の表示、座標選択、ジオコーディングに使用。 |
| `VITE_FIREBASE_PROJECT_ID` | フロントエンド用プロジェクト ID | フロントエンドが接続する Firebase プロジェクトの指定。 |
| `VITE_VERTEX_AI_LOCATION` | Vertex AI リージョン | Vertex AI Search などの API 呼び出し先。 |

---

## 7. セキュリティとデータ整合性

### 7.1 Firestore セキュリティルール (`firestore.rules`)
原則として「最小権限」を適用しますが、WeDive では以下のルールで公開性とセキュリティを両立しています。
- **マスターデータ (Points/Creatures)**: 全員 `read` 可。認証済みユーザーのみ `write` 可（要審査）。
- **ユーザーデータ (Logs)**: `isPrivate` が false のもののみ全員 `read` 可。本人のみ `write` 可。
- **レビュー (Reviews)**: `status == "approved"` または投稿者本人のレビューのみ `read` 可。認証済みユーザーのみ `create` 可。

### 7.2 複合インデックス (Composite Indexes)
以下のユースケースに対応するため、Firestore コンソールでのインデックス作成が必須です。
- **レビュー一覧**: `userId` (ASC) + `date` (DESC) - 本人の最新レビュー取得用。
- **承認済みレビュー**: `status` (ASC) + `date` (DESC) - 全体公開フィード用。
- **提案一覧**: `submitterId` (ASC) + `status` (ASC) - プロフィール画面での申請状況確認用。
- **公認ログ検索**: `isPrivate` (ASC) + `date` (DESC) - コレクショングループクエリ用。
