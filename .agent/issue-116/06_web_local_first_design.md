# design: Web版 Local-First アーキテクチャとエンジン共通化設計

Issue 116 の Phase 3 として、Web版（Next.js）への Local-First 導入および、App版（Expo）とのロジック共通化に関する詳細設計を定義します。

---

## 1. 概念図：レイヤー構造とロジック共通化

Web と App でリポジトリ、共通のロジック層を共有し、最下層の「ストレージ実装」のみをプラットフォームごとに差し替えるアーキテクチャを採用します。

```mermaid
graph TD
    subgraph "UI Layer (Next.js / Expo)"
        Web_UI[Web Pages/Components]
        App_UI[App Screens/Components]
    end

    subgraph "Domain Layer (Core Logic Shared)"
        Hooks[Custom Hooks: usePoints, useCreatures]
        DataService[Data Services: MasterDataService, UserDataService]
        SyncService[Sync Services: MasterDataSyncService]
    end

    subgraph "Repository Layer (Unified Interface)"
        SQLite_Repo[SQLite Repository Interface]
    end

    subgraph "Infrastructure Layer (Platform Specific)"
        Wasm_SQLite[wedive-web: SQLite Wasm + OPFS]
        Expo_SQLite[wedive-app: expo-sqlite]
    end

    Web_UI -->|npm workspace| Hooks
    App_UI -->|npm workspace| Hooks
    Hooks --> DataService
    DataService --> SyncService
    DataService --> SQLite_Repo
    SyncService --> SQLite_Repo

    SQLite_Repo --> Wasm_SQLite
    SQLite_Repo --> Expo_SQLite
```

### 参照する主要クラス・概念
- **wedive-shared (New Package)**: ドメインロジック (Service) とインターフェース (Repository) を保持する npm ローカルパッケージ。
- **DataService**: アプリケーションロジックの中核。SQLite と Firestore の優先順位（Local-First 戦略）を管理。
- **SQLite_Repo**: SQL クエリの発行を担うインターフェース。Web/App ともに全く同じ SQL クエリを利用。

---

## 2. モノレポ（npm workspaces）構成

ロジックの共有を確実かつクリーンに行うため、以下のディレクトリ構造を採用します。

```text
/Users/minarai/pgm/wedive/
├── package.json            (Root: Workspaces 定義)
├── wedive-shared/          (Core logic: Services, Repositories, Types)
│   ├── package.json        (package name: "wedive-shared")
│   └── src/                (TypeScript sources)
├── wedive-app/             (Expo: mobile app)
└── wedive-web/             (Vite: web app)
```

### 共通化のメリット
- **Single Source of Truth**: `search_text` を使った複雑な SQL クエリや、Firestore との同期ロジックを一箇所で修正すれば、即座に両プラットフォームへ反映されます。
- **型の一貫性**: `Point` や `Creature` などの型定義が Web/App で乖離するのを防ぎます。

---

## 2. データフロー比較：従来 vs Local-First (Phase 3)

### 従来（Legacy-First）
ユーザーが画面を開くたびに Firestore への課金が発生し、通信環境に依存する。
```mermaid
graph LR
    User -->|Open Page| Firestore((Firestore))
    Firestore -->|Read Event| bill($$$)
    bill --> Wallet[User's Wallet]
```

### Local-First (Phase 3)
一度同期すれば、以降の読み出しはすべて「ローカル 0 円」で完済する。
```mermaid
graph LR
    User -->|Open Page| SQLite[(Local SQLite)]
    SQLite -->|Read| UI[Display Data]
    UI -->|Quick Response| Satisfied[User Experience UP]

    Sync[Sync Service] -.->|Check Update| GCS{Firebase Storage}
    GCS -.->|Download .gz| SQLite
    Sync -.->|One-time Backup| Firestore((Firestore))
```

---

## 3. シーケンス図

### 3.1 マスターデータ同期フロー (Web/App 共通)
Firebase Storage のメタデータを活用し、無駄なダウンロードを徹底的に防ぎます。

```mermaid
sequenceDiagram
    participant App as Web / App Engine
    participant Cache as AsyncStorage / LocalStorage
    participant Storage as Firebase Storage (GCS)
    participant SQLite as Local SQLite (OPFS / expo-sqlite)

    App->>Storage: Get Metadata (latest.db.gz)
    Storage-->>App: Return Updated Timestamp (e.g. 2026-01-03)
    App->>Cache: Get cached_updated_ts
    
    alt Timestamp Matches
        App->>App: Skip Download (Fast Starup)
    else New Version Detected
        App->>Storage: Download latest.db.gz
        Storage-->>App: Gzipped Binary Data
        App->>App: Decompress Gzip
        App->>SQLite: Overwrite master.db
        App->>Cache: Save new updated_ts
    end
```

### 3.2 ユーザーデータ（個人ログ）の同期フロー
Firestore の `onSnapshot` を廃止し、明示的な書き込みと初回同期のみに絞ります。

```mermaid
sequenceDiagram
    participant User as User Action
    participant SQLite as Local SQLite (user.db)
    participant Sync as Sync Service
    participant Firestore as Firestore (Backup)

    Note over User, Firestore: 書き込みフロー (Add/Edit Log)
    User->>SQLite: Save Log (Immediate)
    SQLite-->>User: Refresh UI (Latency 0ms)
    Sync->>Firestore: Async Upload (1-off Write)

    Note over User, Firestore: 読み込みフロー (Open MyPage)
    User->>SQLite: Fetch Logs (Immediate)
    SQLite-->>User: Display (Latency 0ms / Read Cost 0)
    
    Note over User, Firestore: 初回ログイン・機種変更
    alt Local Profile Missing
        Sync->>Firestore: getDocs (One-time Initial Sync)
        Firestore-->>Sync: Return User Data
        Sync->>SQLite: Populate user.db
    end
```

---

## 4. Web vs App の実装差異

共通の `DataService` を支える「ストレージ実装」のみを切り替えます。

| 項目 | Web版 (Phase 3) | App版 (Implemented) |
| :--- | :--- | :--- |
| **Engine** | SQLite Wasm (wa-sqlite) | expo-sqlite |
| **Persistence** | OPFS (Origin Private File System) | Local Filesystems (DocumentDir) |
| **Binary Fetch** | Fetch API + Stream | expo-file-system |
| **Concurrency** | Web Worker (Background) | Native Bridge |
| **Initial Bundle** | Static Asset (optional) | assets/master.db (Bundled) |

---

## 5. ロジック共通化のロードマップ

npm workspaces を活用し、以下のステップでモノレポ環境を構築します。

1.  **Stage 1: Root Workspaces の構築**
    - ルートディレクトリに `package.json` を作成し、`workspaces: ["wedive-*"]` を定義。
    - `wedive-shared` ディレクトリを新設し、共通の `package.json`（name: "wedive-shared"）を配置。
2.  **Stage 2: 型定義と定数の移行**
    - `wedive-app` と `wedive-web` で重複している `types.ts` を `wedive-shared/src/types` へ集約。
    - 両プロジェクトの `package.json` で `"wedive-shared": "*"` を dependency に追加。
3.  **Stage 3: サービス/リポジトリ層の抽出**
    - 今回プロトタイプで作成した `MasterDataService` や `UserDataService` を `wedive-shared` へ移動。
    - プラットフォーム固有の処理（SQLite のオープン等）を `SQLite_Repo` インターフェースで抽象化し、実行時に依存性注入 (DI) する仕組みを完成。

---
**設計のハイライト**:
- **共通化の恩恵**: 検索ロジック（`search_text` ヒット順など）を修正した際、Web と App 両方に一撃で反映されるようになります。
- **コストの徹底排除**: 常時接続を辞め、マスタも個人ログも「必要な時だけ引っ張る」ストロング・オフライン・スタイルを Web でも実現します。
- **爆速化**: OPFS + SQLite Wasm により、数千件のログの集計や検索が、サーバーへの往復なしにミリ秒単位で完了します。
