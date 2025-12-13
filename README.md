# Diving Dex App

ダイビングログと生物図鑑を統合した「Diving Dex App」のソースコードリポジトリです。
React (Vite) + Firebase を用いたモダンなシングルページアプリケーション (SPA) として構築されています。

## Architecture & Tech Stack

本プロジェクトのアーキテクチャと採用技術、および主要なライブラリのバージョンは以下の通りです。
（※2025年12月現在）

### Core Framework
- **Runtime**: Node.js (v20推奨)
- **Framework**: [React](https://react.dev/) `v19.2.3` (Security Patched)
- **Build Tool**: [Vite](https://vitejs.dev/) `v7.2.4`
- **Language**: [TypeScript](https://www.typescriptlang.org/) `v5.9.3`

### Backend / Infrastructure (Serverless)
- **Platform**: [Firebase](https://firebase.google.com/) `v12.6.0`
  - **Hosting**: 静的サイトホスティング
  - **Authentication**: Google認証
  - **Firestore**: NoSQLデータベース (v2 Data Model)
  - **Storage**: 写真画像ストレージ
  - **Remote Config**: 機能フラグ管理 (Feature Toggles)

### Libraries & Tools
- **UI/Styling**:
  - [Tailwind CSS](https://tailwindcss.com/) `v4.1.17`
  - [Lucide React](https://lucide.dev/) (Icons) `v0.555.0`
  - [Framer Motion](https://www.framer.com/motion/) (Animations) `v12.23.24`
- **Charts / Visualization**:
  - [Recharts](https://recharts.org/) `v3.5.1` (Depth Profile)
- **Data Processing**:
  - [JSZip](https://stuk.github.io/jszip/) (Garmin ZIP handling)
  - [fit-file-parser](https://github.com/jimmykane/fit-file-parser) (Garmin FIT handling)
  - [PapaParse](https://www.papaparse.com/) (CSV Import)
- **Routing**: [React Router](https://reactrouter.com/) `v7.9.6`

## Development

### Prerequisites
- Node.js v20+
- npm or yarn

### Setup
```bash
# Install dependencies
npm install
```

### Run Locally
```bash
# Start dev server
npm run dev
```

### Build
```bash
# Type check & Build
npm run build
```

## Security & Vulnerability Management
React等のコアライブラリに脆弱性が発見された場合、速やかに `package.json` のバージョンを更新し、検証を行ってください。
現在の構成は **React v19** ベースです。
