
SELECT
  p.document_id AS id,
  JSON_VALUE(p.data, '$.name') AS name,
  -- エンリッチ済みテーブルからカナを取得
  e.name_kana,
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
  JSON_QUERY(p.data, '$.mainDepth') AS main_depth_json,
  JSON_VALUE(p.data, '$.entryType') AS entry_type,
  JSON_VALUE(p.data, '$.current') AS current_condition,
  JSON_QUERY(p.data, '$.topography') AS topography_json,
  JSON_QUERY(p.data, '$.features') AS features_json,
  JSON_VALUE(p.data, '$.description') AS description,
  -- 位置情報
  JSON_QUERY(p.data, '$.coordinates') AS coordinates_json,
  JSON_VALUE(p.data, '$.googlePlaceId') AS google_place_id,
  JSON_VALUE(p.data, '$.formattedAddress') AS formatted_address,
  CAST(JSON_VALUE(p.data, '$.coordinates.lat') AS FLOAT64) AS latitude,
  CAST(JSON_VALUE(p.data, '$.coordinates.lng') AS FLOAT64) AS longitude,
  -- 画像・登録情報
  JSON_VALUE(p.data, '$.imageUrl') AS image_url,
  JSON_QUERY(p.data, '$.images') AS images_json,
  JSON_VALUE(p.data, '$.imageKeyword') AS image_keyword,
  JSON_VALUE(p.data, '$.submitterId') AS submitter_id,
  -- カウント
  CAST(JSON_VALUE(p.data, '$.rating') AS FLOAT64) AS rating,
  CAST(JSON_VALUE(p.data, '$.reviewCount') AS INT64) AS review_count,
  CAST(JSON_VALUE(p.data, '$.bookmarkCount') AS INT64) AS bookmark_count,
  -- 統計
  JSON_QUERY(p.data, '$.officialStats') AS official_stats_json,
  JSON_QUERY(p.data, '$.actualStats') AS actual_stats_json,
  -- メタデータ
  e.search_text AS search_text,
  JSON_VALUE(p.data, '$.status') AS status,
  JSON_VALUE(p.data, '$.createdAt') AS created_at
FROM `${PROJECT_ID}.${DATASET}`.points_raw_latest p
LEFT JOIN `${PROJECT_ID}.${DATASET}`.points_enriched e ON p.document_id = e.id
