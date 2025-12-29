# Release Plan (リリース計画)

## Overview
Diving Dex App のリリーススケジュールとロードマップです。

## Roadmap

### v1.0.0 (MVP Launch) - Completed
- 基本的なダイビングログ記録機能
- 生物図鑑（Creature Dex）
- ポイントマップ情報
- ユーザー認証（Google Auth）

### v1.1.0 (Admin & Data Cleanliness) - Completed
**目的: データの整合性確保と管理機能の強化**

- [x] **管理画面の実装 (Admin Area Cleansing)**
- [x] **データクレンジング機能** (Merge/Duplicate)
- [x] **不具合修正** (Data Reset fix)

### v1.2.0 (UX & Expansion) - In Progress
**目的: ユーザー体験の向上とソーシャル要素**

- [ ] **バルク編集機能 (Bulk Edit)**: 複数のログを一括で編集・場所設定する機能
- [x] **インポート機能の強化 (Garmin Import V1)**: ZIPファイル解析・詳細メタデータ抽出
- [x] **利用規約（同意書）の作成**: Issue #12

### v2.1.x (AI Powered Ecosystem) - Current Focus
**目的: AIによる自動化と高度なユーザーサポート**

- [x] **AI Auto-fill (Spot & Creature)**: 登録時の説明文自動生成とGoogle検索グラウンディング
- [x] **Auto-Translation**: マルチランゲージ対応（日・英・韓・中）
- [x] **AI Concierge (Beta)**: 対話型スポット提案機能の実装
- [x] **AI Combined Management (Issue #49)**: 高精度生物マッピングの実装
    - **Dual-Track Ops**: 画面からの即時更新 (Cloud Functions) と 全件バッチ (Cloud Run Jobs) の併用。
    - **Gemini 2.0 Integration**: **Gemini 2.0 Flash** への移行と `google-genai` SDK の導入による高度なグラウンディングと構造化出力の実現。
    - **Cost Engineering**: Context Caching によるトークンコストの大幅削減。
    - **CI/CD Integration**: GitHub Actions によるパイプライン Docker イメージの自動デプロイ（Staging & Production）。のリポジトリ構成の変数化完了。
    - **v2.1.4: Infrastructure Stabilization**: 環境依存値の完全外部化と、標準ロガーレベル（`LOG_LEVEL`）によるAI診断制御の実装。
    - **v2.1.4: Infrastructure Stabilization**: 環境依存値の完全外部化と、標準ロガーレベル（`LOG_LEVEL`）によるAI診断制御の実装。

### v6.0.0 (Reliable Review System) - Released
**目的: 信頼性の高いレビューエコシステムの構築 (Trust & Safety)**

- [x] **Review Trust System**:
    - **Trust Levels**: `Official`, `Professional`, `Verified`, `Expert`, `Standard` の5段階評価を導入。
    - **Approval Flow**: `Official` 以外は「承認待ち (Pending)」として扱い、不適切な投稿によるレピュテーションリスクを排除。
    - **Verification**: ログ紐づけ (`logId`) による「Verified Log」バッジの表示。
- [x] **Review UI**: 投稿時の信頼性判定ロジックと、閲覧時のバッジ表示機能。
- [x] **Infrastructure**: ログ攻略率再計算トリガー (`onLogWriteCalcMastery`) によるユーザーランクのリアルタイム更新。

### v1.3.0 (Community Features) - Planning
**目的: コミュニティ形成とリアルタイム交流**

- [ ] **インスタンスパーティ機能 (Dive Party)**
    - **コンセプト**: 「同じ海・時間を共有するメンバー」のための短期的なログ共有グループ。
    - **概要**:
        - 1日〜数日間のダイビング日程（旅程）単位でパーティを結成。
        - リーダーが既に決まっているメンバーを招待する。
        - **パーティボード**: ダイビングの基本情報を共有し、メンバー全員がそこにログを書き込む。
    - **メリット**:
        - **ログ連携**: ボードに書いたログは個人のログとして保存される。
        - **ログコピー**: 他のメンバーのログを参照・コピーして、ログ付けの手間を大幅に削減（体験の共有）。
        - **重要**: マッチング（募集）機能ではなく、既存の仲間内での利用を想定。

- [ ] **サークル機能 (Diving Circle)**
    - **コンセプト**: インスタンスパーティの拡張版。永続的なコミュニティ（ショップやサークル）の運営ツール。
    - **概要**:
        - **コミュニティ管理**: サークルを作成し、メンバーを募ることができる（集客機能）。
        - **ダイビングプラン**: 今後の予定（プラン）を作成し、参加メンバーを募集する。
        - **実行**: プラン当日には「インスタンスパーティ」と同様のログ共有機能を提供する。
    - **開発規模**: 大規模（メンバー権限管理、プラン管理、募集フローの実装が必要）。

- [ ] **ソーシャル機能**:
    - ログへのコメント機能（パーティ内チャット含む）
    - ユーザーフォロー/フォロワー機能

---

### 4. Feature Toggles Inventory
現在管理されているフィーチャートグルの一覧です。Web・アプリそれぞれの `features.ts` または環境変数で管理されます。

| Key (Parameter Name) | Platform | Default | Description | Status |
|---|---|---|---|---|
| `ENABLE_V2_AI_CONCIERGE` | Common | `false` | AIコンシェルジュ機能の段階的リリース。<br>true:全体公開, false:管理者(admin)のみアクセス可能とし、グラウンディング化の検証を行う。 | **Beta** |
| `ENABLE_V2_AI_AUTO_FILL` | Web | `false` | スポット・生物登録時のAI自動入力機能。 | **Ready** |
| `ENABLE_V6_REVIEWS` | Common | `false` | ユーザーレビュー機能 (v6.0.0)。信頼性スコア (`trustLevel`)、承認制フロー、ポテンシャル比較表示。 | **Released** |
| `ENABLE_V2_VERTEX_SEARCH` | Functions | `false` | Managed RAG (Vertex AI Search) の有効化。 | **Ready** |
| `LOG_LEVEL` | Env Var | `info` | アプリ全体のログ出力レベル制御。<br>`debug`:詳細ログ出力, `info`:通常ログ。 | **Ready** |

## Project Management & Release Workflow

本プロジェクトでは**Trunk-Based Development**を採用し、**フィーチャートグル (Feature Toggle)** を活用して「デプロイ」と「リリース」を分離します。

### 1. Document Management
- `RELEASE_PLAN.md`: ロードマップと機能要件の定義。
- `CHANGELOG.md`: リリース（トグルON）された機能の履歴。

### 2. Environment & Deployment Workflow
各環境へのデプロイメントパイプライン(`ci/cd`)と役割定義です。

| 環境 | 役割 | デプロイ契機 (CD) | アクセス制限 |
|---|---|---|---|
| **Local** | 機能開発・単体テスト | 手動 (`npm run dev`) | なし |
| **Develop** (Ex-Preview) | PRレビュー・動作確認 | Pull Request 作成/更新時に自動デプロイ | 一時URL (有効期限7日) |
| **Staging** | 結合テスト・QA検証・AI動作確認 | `main` branch への push 時に自動デプロイ | Basic認証 (`BASIC_AUTH_USER`) |
| **Production** | 本番サービス提供 | `main` branch への push 時に自動デプロイ | 一般公開 (機能はToggleで制御) |

> **Note:** StagingとProductionは同時にデプロイされます。未完成の機能がProductionユーザーに露出しないよう、必ず **Feature Toggle** で保護してください。

### 3. Git Branching Strategy
長期間生存するブランチは `main` のみとします。リリース専用ブランチは作成しません。

| ブランチ名 | 役割 |
|---|---|
| **main** | 唯一の永続ブランチ。常にデプロイ可能な状態を維持する (Single Source of Truth)。 |
| **feature/xxx** | 機能追加・修正用ブランチ。**原則としてフィーチャートグルでラップされた状態**で実装する。短期間で `main` にマージされる。 |
| **fix/xxx** | バグ修正用ブランチ。 |

### 4. Feature Toggle Workflow
機能の公開はコードのデプロイではなく、トグルの有効化によって制御します。

#### Phase 1: Implementation (実装)
1. **Branch**: `main` から `feature/xxx` を作成。
2. **Code**: 新機能は必ず **Feature Toggle (デフォルトOFF)** で囲って実装する。
    - 既存機能への影響をゼロにする。
3. **Merge**: テスト通過後、機能が完成していなくてもトグルOFFの状態で `main` へマージする。
4. **Deploy**: CI/CDにより、`main` の変更は自動的に本番環境へデプロイされる（この時点ではユーザーには見えない）。

#### Phase 2: Verification (本番検証)
1. **Toggle ON (Targeted)**: 管理画面または設定変更により、開発者・QAチームのみトグルをONにする。
2. **Verify**: 本番環境で実際のデータを用いて動作確認を行う。

#### Phase 3: Release (リリース)
1. **Toggle ON (Public)**: ロードマップのスケジュールに従い、トグルを全ユーザー向けにONにする。
2. **Announce**: ユーザーへ新機能の公開を通知する。

#### Phase 4: Cleanup (後片付け)
1. 機能が安定稼働した後、コード内のトグル分岐（`if feature_enabled...`）と古いロジックを削除するPRを作成し、`main` へマージする。
