# 02 BigQuery & VIEW/SQL 定義書 - Issue 116

## 1. 構成概要
Firestoreから同期されたRAWデータ（JSON文字列を含むテーブル）を、アプリケーションで利用可能な構造へ整形するための定義を行う。

## 2. BigQuery データセット構成

| 項目 | 定義名 | 備考 |
| :--- | :--- | :--- |
| **データセット名** | `master_data_v1` | バージョニングを考慮。 |
| **RAWテーブル (Point)** | `points_raw_latest` | Firebase Extensionが生成する最新スナップショットテーブル。 |
| **RAWテーブル (Creature)** | `creatures_raw_latest` | 同上。 |
| **マスターテーブル (Area)** | `areas_raw_latest` | 地域情報の参照用。 |

## 3. VIEW 定義： `v_app_points_master`
ダイビングポイント検索用のフラットなレコード定義。

### 3.1 SQL ロジック概要
```sql
SELECT 
  p.id,
  JSON_VALUE(p.data, '$.name') AS name,
  JSON_VALUE(p.data, '$.nameKana') AS name_kana, -- カナ検索用
  JSON_VALUE(p.data, '$.region') AS region,    -- 非正規化済み名称
  JSON_VALUE(p.data, '$.area') AS area,        -- 非正規化済み名称
  JSON_VALUE(p.data, '$.regionId') AS region_id,
  CAST(JSON_VALUE(p.data, '$.rating') AS FLOAT64) AS rating,
  CAST(JSON_VALUE(p.data, '$.reviewCount') AS INT64) AS review_count,
  JSON_VALUE(p.data, '$.imageUrl') AS image_url
FROM `master_data_v1.points_raw_latest` p
WHERE JSON_VALUE(p.data, '$.status') = 'approved'
```

### 3.2 検索特化の加工内容
- **カナ生成 (name_kana)**: Firestore上で既に保持されていることを想定。不足している場合はBigQuery MLの翻訳関数や辞書を用いた生成も検討するが、基本はSourceに準拠。
- **Statusフィルタ**: 'approved' のもののみを対象とし、pending/rejected は配信バイナリから除外してセキュリティとサイズを最適化。

## 4. VIEW 定義： `v_app_creatures_master`
生物図鑑検索用のフラットなレコード定義。

### 4.1 SQL ロジック概要
```sql
SELECT 
  c.id,
  JSON_VALUE(c.data, '$.name') AS name,
  JSON_VALUE(c.data, '$.scientificName') AS sci_name,
  JSON_VALUE(c.data, '$.category') AS category,
  JSON_VALUE(c.data, '$.family') AS family,
  JSON_VALUE(c.data, '$.imageUrl') AS image_url,
  -- 検索利便性のためのタグ
  ARRAY_TO_STRING([
    JSON_VALUE(c.data, '$.category'),
    JSON_VALUE(c.data, '$.family')
  ], ' ') AS tags
FROM `master_data_v1.creatures_raw_latest` c
WHERE JSON_VALUE(c.data, '$.status') = 'approved'
```

## 5. パフォーマンス最適化（パーティショニング・クラスタリング）
- **同期テーブル**: 差分更新の利便性のため、`_PARTITIONTIME` でパーティショニング。
- **クラスタリング**: 
  - `points` テーブルは `region_id`, `name` でクラスタリング。
  - `creatures` テーブルは `category`, `name` でクラスタリング。
これにより、エクスポート実行時のクエリスキャンコストを削減する。

## 6. 公開ステータスとデータ整合性
- **削除済みデータの扱い**: Firebase Extensionの論理削除フラグ (`operation = 'DELETE'`) を考慮し、最新のスナップショットのみを取得する `latest` テーブルをソースとする。
- **機密情報の除外**: ユーザーのプライベートなメタデータや、管理者専用メモなどはSELECT句に含まず、バイナリファイルには出力しない。
