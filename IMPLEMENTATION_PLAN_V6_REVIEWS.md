# ユーザーレビュー機能実装計画 (v6.0.0)

## 1. 目的
ダイビングポイントの「公式スペック」と、ユーザーからの「ライブな実測値」を比較可能にし、ダイバーが「今の海のポテンシャル」を直感的に把握できるレビューエコシステムを構築する。

## 2. 実装フェーズ

### フェーズ 1: データベース拡張とデータモデル定義
- **内容**: 
  - `reviews` コレクションの定義。
  - `points` ドキュメントへの公式ポテンシャル（ベースライン）データの追加。
  - レビュー集計結果（平均透明度、満足度、レーダーチャート用スコア等）を保持するフィールドの追加。
- **ドキュメント更新**: `DATABASE_DESIGN.md`

### フェーズ 2: ストレスフリーなレビュー投稿フォーム (Web & App)
- **内容**: 
  - 3ステップ構成のUI実装。
  - スライダー入力、アイコン選択チップ、タグ選択。
  - 既存ログとの紐付け機能。
- **技術要素**: 
  - Web: Tailwind UI, Lucide Icons, Custom Sliders.
  - App: React Native View, Lucide React Native, Animated Sliders.

### フェーズ 3: ポイント詳細ページの高度化（データの可視化）
- **内容**: 
  - 公式ポテンシャル vs 実測値の比較ゲージ。
  - 5象限レーダーチャートの実装。
  - 季節・天候別フィルタリングロジック。
  - ベストシーズン積み上げ棒グラフ。

### フェーズ 4: 検索結果ページのモダン化
- **内容**: 
  - デルタ表示（ポテンシャル乖離率）バッジ。
  - 経験本数に応じたパーソナライズ警告バッジ。
  - ライブ感のあるアイキャッチ画像（最新レビュー画像）の連携。

### フェーズ 5: 集計ロジック (Cloud Functions)
- **内容**: 
  - レビュー投稿時に `points` ドキュメントの集計値を自動更新するトリガー。
  - 季節・条件別の平均値算出バッチ。

---

## 3. 詳細仕様：レビューデータ構造

### `reviews` (or `points/{pid}/reviews`)
| フィールド | 型 | 説明 |
| :--- | :--- | :--- |
| `pointId` | string | 対象ポイントID |
| `userId` | string | 投稿者ID |
| `logId` | string | 紐付けログID (Option) |
| `rating` | number | 総合満足度 (1-5) |
| `visibility` | number | 透明度 (m) |
| `temp` | map | `{air: number, water: number}` |
| `flow` | string | 流れ (none, weak, strong, drift) |
| `difficulty` | string | 体感難易度 (easy, normal, hard) |
| `style` | number | マクロ(0) 〜 ワイド(100) の比率 |
| `stats` | map | `{encounter, excite, macro, comfort}` (Radar Chart用) |
| `condition` | map | `{weather, wind, wave}` |
| `tags` | array | 遭遇生物、地形タグなど |
| `comment` | string | 感想テキスト |
| `images` | array | アップロード画像URL |
| `isTrusted` | boolean | 信頼性バッジフラグ (ログ連携/経験本数等から算出) |

---

## 4. 完了定義 (Definition of Done)
- [ ] `DATABASE_DESIGN.md` にレビュー関連のスキーマが追記されている。
- [ ] 3ステップ投稿フォームが Web/App 両方で動作する。
- [ ] ポイント詳細ページでレーダーチャートとポテンシャル比較が表示される。
- [ ] 検索結果ページにデルタ表示とパーソナライズ警告が表示される。
- [ ] テストデータを入れた状態で、集計ロジックが正常に動作することを確認。
