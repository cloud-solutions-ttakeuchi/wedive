# 02 BigQuery & VIEW/SQL 定義書 - Issue 116

## 1. 構成概要
Firestoreから同期されたRAWデータ（JSON文字列を含むテーブル）を、アプリケーションで利用可能な構造へ整形するための定義を行う。
本アーキテクチャでは、**「全ユーザー共通の公共データ」および「集計統計データ」のみを GCS Mirror の対象**とし、個人情報（プライベートログ、お気に入り等）は対象外とする。

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
| **RAWテーブル (Log)** | `logs_raw_latest` | 公開フィードの参照用。 |
| **VIEWテーブル** | `v_app_geography_master` | 地域・エリア階層マスタ（Region > Zone > Area） |
| **VIEWテーブル** | `v_app_points_master` | ダイビングポイントマスター_VIEW |
| **VIEWテーブル** | `v_app_point_reviews` | ダイビングポイントレビュー_VIEW |
| **VIEWテーブル** | `v_app_point_creatures` | ダイビングポイント生物_VIEW |
| **VIEWテーブル** | `v_app_creatures_master` | ダイビング生物図鑑_VIEW |
| **VIEWテーブル** | `v_app_creature_points` | ダイビング生物ポイント_VIEW |
| **VIEWテーブル** | `v_app_point_stats` | ポイント詳細統計_VIEW |
| **VIEWテーブル** | `v_app_user_public_logs` | 公開ダイビングログ_VIEW（フィード用） |

---

## 3. VIEW 定義： `v_app_points_master`
ダイビングポイント検索・詳細表示用のフルレコード定義。

### 3.1 SQL ロジック概要
```sql
SELECT 
  p.id,
  JSON_VALUE(p.data, '$.name') AS name,
  -- 検索用かな（Remote Function を利用して自動生成）
  `wedive_master_data_v1.fn_to_kana`(JSON_VALUE(p.data, '$.name')) AS name_kana,
  -- 地理階層 ID
  JSON_VALUE(p.data, '$.regionId') AS region_id,
  JSON_VALUE(p.data, '$.zoneId') AS zone_id,
  JSON_VALUE(p.data, '$.areaId') AS area_id,
  -- 地理階層 名称
  JSON_VALUE(p.data, '$.region') AS region_name,
  JSON_VALUE(p.data, '$.zone') AS zone_name,
  JSON_VALUE(p.data, '$.area') AS area_name,
  -- スポット属性
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
  -- カウント
  CAST(JSON_VALUE(p.data, '$.rating') AS FLOAT64) AS rating,
  CAST(JSON_VALUE(p.data, '$.reviewCount') AS INT64) AS review_count,
  CAST(JSON_VALUE(p.data, '$.bookmarkCount') AS INT64) AS bookmark_count,
  -- メタデータ
  JSON_VALUE(p.data, '$.status') AS status,
  JSON_VALUE(p.data, '$.createdAt') AS created_at
FROM `wedive_master_data_v1.points_raw_latest` p
```

---

## 4. VIEW 定義： `v_app_geography_master`
地域・ゾーン・エリアの階層構造（全件保持）。

### 4.1 SQL ロジック概要
```sql
SELECT 
  a.id AS area_id,
  JSON_VALUE(a.data, '$.name') AS area_name,
  JSON_VALUE(a.data, '$.description') AS area_description,
  JSON_VALUE(a.data, '$.status') AS area_status,
  z.id AS zone_id,
  JSON_VALUE(z.data, '$.name') AS zone_name,
  JSON_VALUE(z.data, '$.description') AS zone_description,
  JSON_VALUE(z.data, '$.status') AS zone_status,
  r.id AS region_id,
  JSON_VALUE(r.data, '$.name') AS region_name,
  JSON_VALUE(r.data, '$.description') AS region_description,
  JSON_VALUE(r.data, '$.status') AS region_status,
  CONCAT(JSON_VALUE(r.data, '$.name'), ' > ', JSON_VALUE(z.data, '$.name'), ' > ', JSON_VALUE(a.data, '$.name')) AS full_path
FROM `wedive_master_data_v1.areas_raw_latest` a
LEFT JOIN `wedive_master_data_v1.zones_raw_latest` z ON JSON_VALUE(a.data, '$.zoneId') = z.id
LEFT JOIN `wedive_master_data_v1.regions_raw_latest` r ON JSON_VALUE(z.data, '$.regionId') = r.id
```

---

## 5. VIEW 定義： `v_app_creatures_master`
生物図鑑。全属性を網羅。

### 5.1 SQL ロジック概要
```sql
SELECT 
  c.id,
  JSON_VALUE(c.data, '$.name') AS name,
  `wedive_master_data_v1.fn_to_kana`(JSON_VALUE(c.data, '$.name')) AS name_kana,
  JSON_VALUE(c.data, '$.scientificName') AS scientific_name,
  JSON_VALUE(c.data, '$.englishName') AS english_name,
  JSON_VALUE(c.data, '$.category') AS category,
  JSON_VALUE(c.data, '$.family') AS family,
  JSON_VALUE(c.data, '$.description') AS description,
  JSON_VALUE(c.data, '$.rarity') AS rarity,
  JSON_VALUE(c.data, '$.imageUrl') AS image_url,
  JSON_QUERY(c.data, '$.gallery') AS gallery,
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
  JSON_VALUE(c.data, '$.status') AS status,
  JSON_VALUE(c.data, '$.createdAt') AS created_at
FROM `wedive_master_data_v1.creatures_raw_latest` c
```

---

## 6. VIEW 定義： `v_app_point_reviews`
最新のレビュー一覧（全ステータス含む、Pii 配慮）。

### 6.1 SQL ロジック概要
```sql
SELECT 
  rv.id,
  JSON_VALUE(rv.data, '$.pointId') AS point_id,
  JSON_VALUE(rv.data, '$.userId') AS user_id,
  JSON_VALUE(u.data, '$.name') AS user_name,
  JSON_VALUE(u.data, '$.profileImage') AS user_image,
  CAST(JSON_VALUE(rv.data, '$.rating') AS FLOAT64) AS rating,
  JSON_QUERY(rv.data, '$.condition') AS condition_json, 
  JSON_QUERY(rv.data, '$.metrics') AS metrics_json,
  JSON_QUERY(rv.data, '$.radar') AS radar,
  JSON_QUERY(rv.data, '$.tags') AS tags,
  JSON_QUERY(rv.data, '$.images') AS images,
  CAST(JSON_VALUE(rv.data, '$.helpfulCount') AS INT64) AS helpful_count,
  JSON_VALUE(rv.data, '$.comment') AS comment,
  JSON_VALUE(rv.data, '$.createdAt') AS created_at,
  JSON_VALUE(rv.data, '$.status') AS status
FROM `wedive_master_data_v1.reviews_raw_latest` rv
LEFT JOIN `wedive_master_data_v1.users_raw_latest` u ON JSON_VALUE(rv.data, '$.userId') = u.id
ORDER BY created_at DESC
```

---

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
  JSON_VALUE(pc.data, '$.lastSighted') AS last_sighted,
  JSON_VALUE(pc.data, '$.reasoning') AS reasoning,
  CAST(JSON_VALUE(pc.data, '$.confidence') AS FLOAT64) AS confidence,
  JSON_VALUE(pc.data, '$.status') AS status
FROM `wedive_master_data_v1.point_creatures_raw_latest` pc
JOIN `v_app_creatures_master` c ON JSON_VALUE(pc.data, '$.creatureId') = c.id
```

---

## 8. VIEW 定義： `v_app_creature_points`
特定の生物が見られるポイント一覧。

### 8.1 SQL ロジック概要
```sql
SELECT 
  pc.creature_id,
  pc.point_id,
  p.name AS point_name,
  p.region_name,
  p.area_name,
  pc.local_rarity
FROM `v_app_point_creatures` pc
JOIN `v_app_points_master` p ON pc.point_id = p.id
```

---

## 9. VIEW 定義： `v_app_point_stats`
ポイントの詳細統計（レビューデータからの動的集計）。

### 9.1 SQL ロジック概要
```sql
WITH monthly_metrics AS (
  SELECT 
    JSON_VALUE(data, '$.pointId') AS point_id,
    EXTRACT(MONTH FROM CAST(JSON_VALUE(data, '$.createdAt') AS TIMESTAMP)) AS month,
    AVG(CAST(JSON_VALUE(data, '$.metrics.visibility') AS FLOAT64)) AS avg_v,
    AVG(CAST(JSON_VALUE(data, '$.radar.encounter') AS FLOAT64)) AS avg_e,
    COUNT(*) AS count
  FROM `wedive_master_data_v1.reviews_raw_latest`
  WHERE JSON_VALUE(data, '$.status') = 'approved'
  GROUP BY point_id, month
),
monthly_json AS (
  SELECT 
    point_id,
    CONCAT('[', ARRAY_TO_STRING(ARRAY_AGG(
      FORMAT('{"month": %d, "visibility": %.2f, "encounter": %.2f, "count": %d}', month, avg_v, avg_e, count)
      ORDER BY month
    ), ','), ']') AS monthly_stats_json
  FROM monthly_metrics
  GROUP BY point_id
)
SELECT 
  r.point_id,
  AVG(CAST(JSON_VALUE(r.data, '$.rating') AS FLOAT64)) AS avg_rating,
  AVG(CAST(JSON_VALUE(r.data, '$.metrics.visibility') AS FLOAT64)) AS avg_visibility,
  COUNT(*) AS total_reviews,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.encounter') AS FLOAT64)) AS radar_encounter,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.excite') AS FLOAT64)) AS radar_excite,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.macro') AS FLOAT64)) AS radar_macro,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.comfort') AS FLOAT64)) AS radar_comfort,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.visibility') AS FLOAT64)) AS radar_visibility,
  ANY_VALUE(m.monthly_stats_json) AS monthly_analysis,
  CURRENT_TIMESTAMP() AS aggregated_at
FROM `wedive_master_data_v1.reviews_raw_latest` r
LEFT JOIN monthly_json m ON JSON_VALUE(r.data, '$.pointId') = m.point_id
WHERE JSON_VALUE(r.data, '$.status') = 'approved'
GROUP BY r.point_id
```

---

## 10. VIEW 定義： `v_app_user_public_logs`
公開フィード用のログ（isPrivate = false のみ）。

### 10.1 SQL ロジック概要
```sql
SELECT 
  l.id,
  JSON_VALUE(l.data, '$.userId') AS user_id,
  JSON_VALUE(l.data, '$.date') AS date,
  CAST(JSON_VALUE(l.data, '$.diveNumber') AS INT64) AS dive_number,
  JSON_QUERY(l.data, '$.location') AS location,
  JSON_VALUE(l.data, '$.location.pointId') AS point_id,
  JSON_VALUE(l.data, '$.location.pointName') AS point_name,
  JSON_QUERY(l.data, '$.depth') AS depth_info,
  JSON_QUERY(l.data, '$.condition') AS condition_info,
  JSON_QUERY(l.data, '$.photos') AS photos,
  JSON_VALUE(l.data, '$.comment') AS comment,
  CAST(JSON_VALUE(l.data, '$.likeCount') AS INT64) AS like_count,
  JSON_VALUE(l.data, '$.createdAt') AS created_at
FROM `wedive_master_data_v1.logs_raw_latest` l
WHERE JSON_VALUE(l.data, '$.isPrivate') = 'false'
ORDER BY date DESC, dive_number DESC
LIMIT 100
```

---

## 11. 運用上の注意点
- **個人データの保護**: 自分のログ・お気に入り等は Firestore から直接取得する既存ロジックを維持。
- **データサイズ**: 公開データに絞ったことで GCS 配信ファイルのサイズが最適化される。
- **マスターデータの信頼性**: BigQuery 側で集計した最新の `v_app_point_stats` を配信することで、アプリ側での重い集計処理を排除。
