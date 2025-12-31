# データ整合性とプロポーザル・ライフサイクル統合設計書 (Revision 2)

## 1. 目的
Web版およびApp版において、一般ユーザーによるマスタコレクションへの直接書き込みを完全に排除し、不適切なデータ混入を防ぐ。
管理者操作とユーザー操作を明示的に分けることで、コードの可読性と安全性を高める。

## 2. アーキテクチャ原則

### 2.1 責務の完全分離 (Method Separation)
「一つの関数内でロール判定をしてステータスを変える」ことを禁止する。
関数名が「マスタへの確定操作」か「申請（プロポーザル）」かを1対1で表すように再定義する。

### 2.2 ステータスの自動割り当て
呼び出し側のUIコードで `status: 'pending'` などを手動指定させない。
各関数は自身の目的に応じて `status` を固定値で付与する。

| 操作 | 管理者用 (Master直接) | ステータス | ユーザー用 (Proposal申請) | ステータス |
| :--- | :--- | :--- | :--- | :--- |
| スポット登録 | `addPoint` | `approved` | `addPointProposal` | `pending` |
| 生物登録 | `addCreature` | `approved` | `addCreatureProposal` | `pending` |
| 生物発見報告 | `addPointCreature` | `approved` | `addPointCreatureProposal` | `pending` |
| 生物紐付け削除 | `removePointCreature` | (物理削除) | `removePointCreatureProposal` | `pending` (delete) |

## 3. データベース設計

### 3.1 PointCreatureProposal (新設)
`point_creature_proposals` コレクションに保存される型。

```typescript
export interface PointCreatureProposal {
  id: string;              // proposalId
  targetId: string;        // ID of reference (pointId_creatureId)
  pointId: string;
  creatureId: string;
  localRarity: Rarity;
  proposalType: 'create' | 'delete';
  submitterId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;    // 管理者処理日時
}
```

## 4. 実装フロー

### Phase 1: Web版 (wedive-web) の再構成
1.  `types.ts`: `PointCreatureProposal` の定義と共通メタデータの整備。
2.  `AppContext.tsx`: 
    *   `addPointCreature` 等を管理者専用（直接書き込み）として純粋化。
    *   `addPointCreatureProposal` 等の提案専用関数を新設。
    *   `removePointCreatureProposal` を新設。
3.  `PointDetailPage.tsx` / `CreatureDetailPage.tsx`: 
    *   ボタンクリック時のロール判定に基づき、上記関数を呼び分ける。

### Phase 2: App版 (wedive-app) の構築
1.  `types.ts`: Web版と同一のプロポーザル型を導入。
2.  `ProposalService.ts`: 
    *   管理者用（`addCreature`, `addPoint`, `addPointCreature`）の実装。
    *   ユーザー用（`addCreatureProposal`, `addPointProposal`, `addPointCreatureProposal`）の実装。
3.  `app/details/*`: 
    *   `setDoc` による直接書き込みを排除し、`ProposalService` への呼び分けに移行。

## 5. 整合性の保証
Web版とApp版で関数名と処理ロジックを完全に一致させることで、プラットフォームを跨いだデータの汚染を完全に防止する。
