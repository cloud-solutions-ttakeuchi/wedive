# 📚 WeDive App Function List

## 🎣 Custom Hooks (`src/hooks/`)

### Core Data Fetching
| Hook Name | Description | Key Features |
| :--- | :--- | :--- |
| **`useHomeData`** | ホーム画面用のデータを統合管理するフック。 | ・最新の承認済みレビュー（`status=='approved'`）をFirestoreから取得<br>・`createdAt` の降順でソート<br>・TanStack Queryによるキャッシュ管理 |
| **`usePoints`** | 全ダイビングポイントのデータを取得・管理するフック。 | ・承認済みポイントの一覧取得<br>・地域・エリア情報の結合<br>・オフラインキャッシュ対応 |
| **`useCreatures`** | 全生物データを取得・管理するフック。 | ・生物図鑑データの取得<br>・カテゴリ/科目の整理 |
| **`useUserReviews`** | ログインユーザー自身のレビュー履歴を取得するフック。 | ・マイページ用<br>・ステータス（承認待ち/承認済み）に関わらず全件取得<br>・リアルタイム更新 |

---

## 🧩 Key Components (`src/components/`, `app/`)

### Search & Selection
| Component | Description | Usage |
| :--- | :--- | :--- |
| **`PointSelectorModal`** | ログ編集画面で使用するポイント検索モーダル。 | ・Firestore複合インデックスを使用した高速な`name`前方一致検索<br>・`limit(20)`による読み込み制限 |
| **`CreatureSelectorModal`** | ログ編集画面で使用する生物検索モーダル。 | ・ポイントセレクターと同様のインデックス検索<br>・生物名および科目名での表示 |
| **`HierarchicalLocationSelector`** | スポット登録時に使用する多段階（地域>エリア>場所）セレクター。 | ・`Region` -> `Zone` -> `Area` の依存関係を解決して選択UIを提供<br>・新規エリアの手入力にも対応 |

### UI Elements
| Component | Description | Usage |
| :--- | :--- | :--- |
| **`ImageWithFallback`** | 画像ロード失敗時に代替画像を表示するラッパー。 | ・`no-image-point.png` / `no-image-creature.png` / `no-image-user.png` への自動フォールバック |
| **`ReviewCard`** (Inline) | ホーム画面等で使用するレビュー表示カード。 | ・ユーザーアイコン、評価（Star）、コメント、日付の表示<br>・タップでスポット詳細への遷移 |

---

## 🔥 Cloud Functions Triggers

| Trigger Name | Description | Impact |
| :--- | :--- | :--- |
| **`onLogCreate/Update`** | ログが作成・更新された時に発火。 | ・ユーザーの統計（本数、MAX深度等）を再計算<br>・ポイントの訪問数（`logCount`, `visitedCount`）をインクリメント<br>・マスタリー（攻略率）の更新 |
| **`onReviewWriteAggregateStats`** | レビューが書き込まれた時に発火。 | ・ポイントの平均評価（Rating）、透明度、水温などの統計情報を再集計して `points` コレクションを更新 |
