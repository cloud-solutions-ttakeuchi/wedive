# Changelog

すべての変更は本ファイルに記録されます。

## [2.3.0] - 2025-12-23

### Added
- **Initial Feature Set**:
    - **Tab Navigation**: `Home`, `Search` (探す), `AI` (AI相談), `MyPage` (マイページ) の4タブ構成を実装。
    - **Home Screen**:
        - **Header**: WeDiveロゴとブランドカラー (`#0ea5e9`) を適用したヘッダーデザイン。検索バーを含む。
        - **Hero Section**: AIコンシェルジュ機能を訴求するヒーローエリアと「AIに相談する」ボタン。
        - **Featured Spots**: 注目スポットのカードリスト表示。
        - **Popular Creatures**: 人気生物の横スクロールリスト表示（レアリティ計算ロジック統合）。
        - **FAB (Floating Action Button)**: ログ登録画面へのクイックアクセスボタン。
- **UI/UX Refinements**:
    - **Header Tuning**: ロゴ画像サイズ (`50px`)、テキストサイズ (`32px`)、および余白 (`gap: 2px`, `paddingHorizontal: 12`) の微調整による視認性向上。
    - **Card Design**: 影（Shadow）と角丸（Border Radius）を活用したモダンなカードデザイン。

### Fixed
- **Layout**: ヘッダーの左寄せ配置調整。

## [0.1.0] - 2025-12-21

### Added
- **Project Initialization**: Expo (React Native) プロジェクトのセットアップ。
- **Basic Routing**: `expo-router` を用いたファイルベースルーティングの構築。
