# 02 BigQuery & VIEW/SQL 定義書 - Issue 116

## 1. 構成概要
Firestoreから同期されたRAWデータ（JSON文字列を含むテーブル）を、アプリケーションで利用可能な構造へ整形するための定義を行う。

## 2. BigQuery データセット＆テーブル構成

- ロケーション：`asia-northeast1`
- パーティション：`_PARTITIONTIME`
- 有効期限：`365`日

| 項目 | 定義名 | 備考 |
| :--- | :--- | :--- |
| **データセット名** | `wedive_master_data_v1` | バージョニングを考慮。 |
| **RAWテーブル (Point)** | `points_raw_latest` | Firebase Extensionが生成する最新スナップショットテーブル。 |
| **RAWテーブル (Creature)** | `creatures_raw_latest` | 同上。 |
| **RAWテーブル (Region)** | `regions_raw_latest` | 地域情報の参照用。 |
| **RAWテーブル (Zone)** | `zones_raw_latest` | 地域情報の参照用。 |
| **RAWテーブル (Area)** | `areas_raw_latest` | 地域情報の参照用。 |
| **RAWテーブル (PointCreature)** | `point_creatures_raw_latest` | 地域情報の参照用。 |
| **RAWテーブル (Review)** | `reviews_raw_latest` | 地域情報の参照用。 |
| **RAWテーブル (User)** | `users_raw_latest` | 地域情報の参照用。 |
| **RAWテーブル (CreatureProposal)** | `creature_proposals_raw_latest` | 地域情報の参照用。 |
| **RAWテーブル (PointProposal)** | `point_proposals_raw_latest` | 地域情報の参照用。 |
| **RAWテーブル (PointCreatureProposal)** | `point_creature_proposals_raw_latest` | 地域情報の参照用。 |
| **RAWテーブル (Log)** | `logs_raw_latest` | ユーザーログの参照用（サブコレクション同期設定済み想定）。 |
| **RAWテーブル (UserStats)** | `stats_raw_latest` | ユーザー統計（マスタリー等）の参照用。 |
| **VIEWテーブル** | `v_app_geography_master` | 地域・エリア階層マスタ（Region > Zone > Area） |
| **VIEWテーブル** | `v_app_points_master` | ダイビングポイントマスター_VIEW |
| **VIEWテーブル** | `v_app_point_reviews` | ダイビングポイントレビュー_VIEW |
| **VIEWテーブル** | `v_app_point_creatures` | ダイビングポイント生物_VIEW |
| **VIEWテーブル** | `v_app_creatures_master` | ダイビング生物図鑑_VIEW |
| **VIEWテーブル** | `v_app_creature_points` | ダイビング生物ポイント_VIEW |
| **VIEWテーブル** | `v_app_user_logs` | ユーザーログ_VIEW |
| **VIEWテーブル** | `v_app_user_reviews` | ユーザーレビュー_VIEW |
| **VIEWテーブル** | `v_app_user_mastery` | ユーザーポイントマスタリ_VIEW |
| **VIEWテーブル** | `v_app_user_favorites` | ユーザーお気に入り_VIEW |
| **VIEWテーブル** | `v_app_user_bookmark_points` | ユーザーブックマークポイント_VIEW |
| **VIEWテーブル** | `v_app_user_favorite_reviews` | ユーザーお気に入りレビュー_VIEW |
| **VIEWテーブル** | `v_app_user_favorite_creatures` | ユーザーお気に入りの生物_VIEW |
| **VIEWテーブル** | `v_app_user_wanted_creatures` | ユーザー見たい生物_VIEW |



## 3. VIEW 定義： `v_app_points_master`
ダイビングポイント検索用のフラットなレコード定義。

### 3.1 SQL ロジック概要
```sql
SELECT 
  p.id,
  JSON_VALUE(p.data, '$.name') AS name,
  -- 検索用かな（Remote Function [Vertex AI/Cloud Functions] を利用して自動生成）
  `wedive_master_data_v1.fn_to_kana`(JSON_VALUE(p.data, '$.name')) AS name_kana,
  -- 地理階層 ID
  JSON_VALUE(p.data, '$.regionId') AS region_id,
  JSON_VALUE(p.data, '$.zoneId') AS zone_id,
  JSON_VALUE(p.data, '$.areaId') AS area_id,
  -- 地理階層 名称 (Denormalized)
  JSON_VALUE(p.data, '$.region') AS region_name,
  JSON_VALUE(p.data, '$.zone') AS zone_name,
  JSON_VALUE(p.data, '$.area') AS area_name,
  -- スポット基本属性
  JSON_VALUE(p.data, '$.level') AS level,
  CAST(JSON_VALUE(p.data, '$.maxDepth') AS FLOAT64) AS max_depth,
  JSON_QUERY(p.data, '$.mainDepth') AS main_depth,
  JSON_VALUE(p.data, '$.entryType') AS entry_type,
  JSON_VALUE(p.data, '$.current') AS current_condition,
  JSON_QUERY(p.data, '$.topography') AS topography,
  JSON_QUERY(p.data, '$.features') AS features,
  JSON_VALUE(p.data, '$.description') AS description,
  -- 位置情報
  JSON_QUERY(p.data, '$.coordinates') AS coordinates,
  JSON_VALUE(p.data, '$.googlePlaceId') AS google_place_id,
  JSON_VALUE(p.data, '$.formattedAddress') AS formatted_address,
  -- 画像・登録情報
  JSON_VALUE(p.data, '$.imageUrl') AS image_url,
  JSON_QUERY(p.data, '$.images') AS images,
  JSON_VALUE(p.data, '$.imageKeyword') AS image_keyword,
  JSON_VALUE(p.data, '$.submitterId') AS submitter_id,
  -- 統計・カウント
  CAST(JSON_VALUE(p.data, '$.rating') AS FLOAT64) AS rating,
  CAST(JSON_VALUE(p.data, '$.reviewCount') AS INT64) AS review_count,
  CAST(JSON_VALUE(p.data, '$.bookmarkCount') AS INT64) AS bookmark_count,
  JSON_QUERY(p.data, '$.officialStats') AS official_stats,
  JSON_QUERY(p.data, '$.actualStats') AS actual_stats,
  -- メタデータ
  JSON_VALUE(p.data, '$.status') AS status,
  JSON_VALUE(p.data, '$.createdAt') AS created_at
FROM `wedive_master_data_v1.points_raw_latest` p
```

### 3.2 検索特化の加工内容
- **地理情報の正規化**: `v_app_geography_master` と JOIN することで、名称の不整合を排除した階層情報を取得可能にする。
- **Statusフィルタ**: 'approved' のもののみを対象とし、pending/rejected は配信バイナリから除外。

## 4. VIEW 定義： `v_app_geography_master`
地域・ゾーン・エリアの階層構造を1行に集約。セレクター等で使用。

### 4.1 SQL ロジック概要
```sql
SELECT 
  a.id AS area_id,
  JSON_VALUE(a.data, '$.name') AS area_name,
  JSON_VALUE(a.data, '$.description') AS area_description, -- 追加
  z.id AS zone_id,
  JSON_VALUE(z.data, '$.name') AS zone_name,
  JSON_VALUE(z.data, '$.description') AS zone_description, -- 追加
  r.id AS region_id,
  JSON_VALUE(r.data, '$.name') AS region_name,
  JSON_VALUE(r.data, '$.description') AS region_description, -- 追加
  CONCAT(JSON_VALUE(r.data, '$.name'), ' > ', JSON_VALUE(z.data, '$.name'), ' > ', JSON_VALUE(a.data, '$.name')) AS full_path
FROM `wedive_master_data_v1.areas_raw_latest` a
LEFT JOIN `wedive_master_data_v1.zones_raw_latest` z ON JSON_VALUE(a.data, '$.zoneId') = z.id
LEFT JOIN `wedive_master_data_v1.regions_raw_latest` r ON JSON_VALUE(z.data, '$.regionId') = r.id
```

## 5. VIEW 定義： `v_app_creatures_master`
生物図鑑。全属性を網羅し、検索と詳細表示の両方に対応。

### 5.1 SQL ロジック概要
```sql
SELECT 
  c.id,
  JSON_VALUE(c.data, '$.name') AS name,
  -- 検索用かな
  `wedive_master_data_v1.fn_to_kana`(JSON_VALUE(c.data, '$.name')) AS name_kana,
  JSON_VALUE(c.data, '$.scientificName') AS scientific_name,
  JSON_VALUE(c.data, '$.englishName') AS english_name,
  JSON_VALUE(c.data, '$.category') AS category,
  JSON_VALUE(c.data, '$.family') AS family,
  JSON_VALUE(c.data, '$.description') AS description,
  JSON_VALUE(c.data, '$.rarity') AS rarity,
  JSON_VALUE(c.data, '$.imageUrl') AS image_url,
  JSON_QUERY(c.data, '$.gallery') AS gallery,
  -- 特性
  JSON_QUERY(c.data, '$.depthRange') AS depth_range,
  JSON_QUERY(c.data, '$.specialAttributes') AS special_attributes,
  JSON_QUERY(c.data, '$.waterTempRange') AS water_temp_range,
  JSON_VALUE(c.data, '$.size') AS size,
  JSON_QUERY(c.data, '$.season') AS season,
  JSON_QUERY(c.data, '$.tags') AS tags,
  JSON_QUERY(c.data, '$.stats') AS stats,
  JSON_VALUE(c.data, '$.submitterId') AS submitter_id,
  JSON_VALUE(c.data, '$.imageCredit') AS image_credit,
  JSON_VALUE(c.data, '$.imageLicense') AS image_license,
  JSON_VALUE(c.data, '$.imageKeyword') AS image_keyword,
  -- 検索用テキスト（かなを含む）
  CONCAT(
    JSON_VALUE(c.data, '$.name'), ' ', 
    `wedive_master_data_v1.fn_to_kana`(JSON_VALUE(c.data, '$.name')), ' ',
    JSON_VALUE(c.data, '$.family'), ' ', 
    JSON_VALUE(c.data, '$.category')
  ) AS search_text,
  JSON_VALUE(c.data, '$.status') AS status,
  JSON_VALUE(c.data, '$.createdAt') AS created_at
FROM `wedive_master_data_v1.creatures_raw_latest` c
```

## 6. VIEW 定義： `v_app_point_reviews`
最新の承認済みレビュー一覧。

### 6.1 SQL ロジック概要
```sql
SELECT 
  rv.id,
  JSON_VALUE(rv.data, '$.pointId') AS point_id,
  JSON_VALUE(rv.data, '$.areaId') AS area_id,     -- 追加
  JSON_VALUE(rv.data, '$.zoneId') AS zone_id,     -- 追加
  JSON_VALUE(rv.data, '$.regionId') AS region_id, -- 追加
  JSON_VALUE(rv.data, '$.userId') AS user_id,
  JSON_VALUE(rv.data, '$.logId') AS log_id,       -- 追加
  JSON_VALUE(u.data, '$.name') AS user_name,
  JSON_VALUE(u.data, '$.profileImage') AS user_image,
  CAST(JSON_VALUE(rv.data, '$.rating') AS FLOAT64) AS rating,
  JSON_QUERY(rv.data, '$.condition') AS condition_json, 
  JSON_QUERY(rv.data, '$.metrics') AS metrics_json,
  JSON_QUERY(rv.data, '$.radar') AS radar,         -- 追加
  JSON_QUERY(rv.data, '$.tags') AS tags,
  JSON_QUERY(rv.data, '$.images') AS images,
  JSON_QUERY(rv.data, '$.helpfulBy') AS helpful_by,
  JSON_VALUE(rv.data, '$.trustLevel') AS trust_level,
  CAST(JSON_VALUE(rv.data, '$.helpfulCount') AS INT64) AS helpful_count,
  JSON_VALUE(rv.data, '$.comment') AS comment,
  JSON_VALUE(rv.data, '$.createdAt') AS created_at,
  JSON_VALUE(rv.data, '$.status') AS status
FROM `wedive_master_data_v1.reviews_raw_latest` rv
LEFT JOIN `wedive_master_data_v1.users_raw_latest` u ON JSON_VALUE(rv.data, '$.userId') = u.id
ORDER BY created_at DESC
```



## 7. VIEW 定義： `v_app_point_creatures`
ポイントごとの出現生物（レア度付き）。

### 7.1 SQL ロジック概要
```sql
SELECT 
  pc.id,
  JSON_VALUE(pc.data, '$.pointId') AS point_id,
  JSON_VALUE(pc.data, '$.creatureId') AS creature_id,
  c.name AS creature_name,
  c.image_url AS creature_image,
  JSON_VALUE(pc.data, '$.localRarity') AS local_rarity,
  JSON_VALUE(pc.data, '$.lastSighted') AS last_sighted, -- 追加
  JSON_VALUE(pc.data, '$.reasoning') AS reasoning,       -- 追加
  CAST(JSON_VALUE(pc.data, '$.confidence') AS FLOAT64) AS confidence,
  JSON_VALUE(pc.data, '$.status') AS status              -- 追加
FROM `wedive_master_data_v1.point_creatures_raw_latest` pc
JOIN `v_app_creatures_master` c ON JSON_VALUE(pc.data, '$.creatureId') = c.id
```

## 8. VIEW 定義： `v_app_creature_points`
特定の生物が見られるポイント一覧。

### 8.1 SQL ロジック概要
```sql
SELECT 
  pc.creature_id,
  pc.point_id,
  p.name AS point_name,
  p.region,
  p.area,
  pc.local_rarity
FROM `v_app_point_creatures` pc
JOIN `v_app_points_master` p ON pc.point_id = p.id
```

## 9. VIEW 定義： `v_app_point_stats`
ポイントの詳細統計（レーダーチャート等）。

### 9.1 SQL ロジック概要
```sql
SELECT 
  p.id AS point_id,
  CAST(JSON_VALUE(p.data, '$.actualStats.avgVisibility') AS FLOAT64) AS avg_visibility,
  JSON_VALUE(p.data, '$.actualStats.seasonalRadar') AS seasonal_radar, -- JSON型のまま保持してアプリ側でパース
  -- 5角形レーダー用平均値
  CAST(JSON_VALUE(p.data, '$.officialStats.radar.encounter') AS FLOAT64) AS radar_encounter,
  CAST(JSON_VALUE(p.data, '$.officialStats.radar.excite') AS FLOAT64) AS radar_excite,
  CAST(JSON_VALUE(p.data, '$.officialStats.radar.macro') AS FLOAT64) AS radar_macro,
  CAST(JSON_VALUE(p.data, '$.officialStats.radar.comfort') AS FLOAT64) AS radar_comfort,
  CAST(JSON_VALUE(p.data, '$.officialStats.radar.visibility') AS FLOAT64) AS radar_visibility
FROM `wedive_master_data_v1.points_raw_latest` p
```

## 10. VIEW 定義： `v_app_user_logs`
ユーザーごとのダイビングログ詳細。マイページおよびログ詳細画面用。

### 10.1 SQL ロジック概要
```sql
SELECT 
  l.id,
  JSON_VALUE(l.data, '$.userId') AS user_id,
  JSON_VALUE(l.data, '$.date') AS date,
  CAST(JSON_VALUE(l.data, '$.diveNumber') AS INT64) AS dive_number,
  -- 場所情報
  JSON_QUERY(l.data, '$.location') AS location,
  JSON_VALUE(l.data, '$.location.pointId') AS point_id,
  JSON_VALUE(l.data, '$.location.pointName') AS point_name,
  -- 潜水データ
  JSON_QUERY(l.data, '$.time') AS time_info,
  JSON_QUERY(l.data, '$.depth') AS depth_info,
  JSON_QUERY(l.data, '$.condition') AS condition_info,
  -- 器材・チーム
  JSON_QUERY(l.data, '$.gear') AS gear_info,
  JSON_QUERY(l.data, '$.team') AS team_info,
  JSON_VALUE(l.data, '$.entryType') AS entry_type,
  -- 生物・写真
  JSON_VALUE(l.data, '$.creatureId') AS main_creature_id,
  JSON_QUERY(l.data, '$.sightedCreatures') AS sighted_creatures,
  JSON_QUERY(l.data, '$.photos') AS photos,
  -- 感想・設定
  JSON_VALUE(l.data, '$.comment') AS comment,
  JSON_VALUE(l.data, '$.isPrivate') = 'true' AS is_private,
  CAST(JSON_VALUE(l.data, '$.likeCount') AS INT64) AS like_count,
  JSON_QUERY(l.data, '$.likedBy') AS liked_by,
  -- 外部連携・プロファイル
  JSON_VALUE(l.data, '$.garminActivityId') AS garmin_activity_id,
  JSON_VALUE(l.data, '$.reviewId') AS review_id,
  JSON_QUERY(l.data, '$.profile') AS profile_data,
  JSON_VALUE(l.data, '$.createdAt') AS created_at
FROM `wedive_master_data_v1.logs_raw_latest` l
ORDER BY date DESC, dive_number DESC
```

## 11. VIEW 定義： `v_app_user_bookmark_points`
ユーザーがブックマークしたポイント。

### 11.1 SQL ロジック概要
```sql
SELECT 
  u.id AS user_id,
  b_id AS point_id,
  p.name AS point_name,
  p.image_url
FROM `wedive_master_data_v1.users_raw_latest` u,
UNNEST(JSON_VALUE_ARRAY(u.data, '$.bookmarkedPointIds')) AS b_id
JOIN `v_app_points_master` p ON b_id = p.id
```

## 12. VIEW 定義： `v_app_user_favorite_creatures`
ユーザーがお気に入り登録した生物。

### 12.1 SQL ロジック概要
```sql
SELECT 
  u.id AS user_id,
  f_id AS creature_id,
  c.name AS creature_name,
  c.image_url
FROM `wedive_master_data_v1.users_raw_latest` u,
UNNEST(JSON_VALUE_ARRAY(u.data, '$.favoriteCreatureIds')) AS f_id
JOIN `v_app_creatures_master` c ON f_id = c.id
```

## 13. VIEW 定義： `v_app_user_mastery`
ユーザーのポイント攻略状況（Firebase Cloud Functions で計算済みの mastery ドキュメントを使用）。

### 13.1 SQL ロジック概要
```sql
SELECT 
  -- ドキュメントパスからUIDを抽出
  REGEXP_EXTRACT(document_name, r'users/([^/]+)/stats/mastery') AS user_id,
  JSON_VALUE(p, '$.pointId') AS point_id,
  JSON_VALUE(p, '$.pointName') AS point_name,
  CAST(JSON_VALUE(p, '$.diveCount') AS INT64) AS dive_count,
  CAST(JSON_VALUE(p, '$.masteryRate') AS FLOAT64) AS mastery_rate,
  CAST(JSON_VALUE(p, '$.creaturesAtPoint.discoveredCount') AS INT64) AS discovered_creatures_count,
  JSON_VALUE(data, '$.calculatedAt') AS calculated_at
FROM `wedive_master_data_v1.stats_raw_latest`,
UNNEST(JSON_QUERY_ARRAY(data, '$.points')) AS p
WHERE document_id = 'mastery'
```

## 14. VIEW 定義： `v_app_user_wanted_creatures`
ユーザーが見たい生物（WANTED）。

### 14.1 SQL ロジック概要
```sql
SELECT 
  u.id AS user_id,
  w_id AS creature_id,
  c.name AS creature_name,
  c.image_url
FROM `wedive_master_data_v1.users_raw_latest` u,
UNNEST(JSON_VALUE_ARRAY(u.data, '$.wanted')) AS w_id
JOIN `v_app_creatures_master` c ON w_id = c.id
```

## 15. VIEW 定義： `v_app_user_reviews`
ユーザーごとのレビュー履歴。

### 15.1 SQL ロジック概要
```sql
SELECT 
  *
FROM `v_app_point_reviews`
ORDER BY created_at DESC
```

## 16. VIEW 定義： `v_app_user_favorite_reviews`
ユーザーが「役に立った」としたレビュー一覧。

### 16.1 SQL ロジック概要
```sql
SELECT 
  u_id AS user_id,
  rv.id AS review_id,
  rv.point_id,
  rv.comment
FROM `wedive_master_data_v1.reviews_raw_latest` rv,
UNNEST(JSON_VALUE_ARRAY(rv.data, '$.helpfulBy')) AS u_id
```

## 17. パフォーマンス最適化（パーティショニング・クラスタリング）
- **同期テーブル**: 差分更新の利便性のため、`_PARTITIONTIME` でパーティショニング。
- **クラスタリング**: 
  - `points` テーブルは `region_id`, `name` でクラスタリング。
  - `creatures` テーブルは `category`, `name` でクラスタリング。
これにより、エクスポート実行時のクエリスキャンコストを削減する。

## 18. 公開ステータスとデータ整合性
- **削除済みデータの扱い**: Firebase Extensionの論理削除フラグ (`operation = 'DELETE'`) を考慮し、最新のスナップショットのみを取得する `latest` テーブルをソースとする。
- **機密情報の除外**: ユーザーのプライベートなメタデータや、管理者専用メモなどはSELECT句に含まず、バイナリファイルには出力しない。
