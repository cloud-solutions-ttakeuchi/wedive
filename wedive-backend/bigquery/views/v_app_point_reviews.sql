
SELECT
  rv.document_id AS id,
  JSON_VALUE(rv.data, '$.pointId') AS point_id,
  JSON_VALUE(rv.data, '$.areaId') AS area_id,
  JSON_VALUE(rv.data, '$.zoneId') AS zone_id,
  JSON_VALUE(rv.data, '$.regionId') AS region_id,
  JSON_VALUE(rv.data, '$.userId') AS user_id,
  JSON_VALUE(rv.data, '$.logId') AS log_id,
  JSON_VALUE(u.data, '$.displayName') AS user_name,
  JSON_VALUE(u.data, '$.photoURL') AS user_image,
  JSON_VALUE(rv.data, '$.trustLevel') AS trust_level,
  CAST(JSON_VALUE(rv.data, '$.rating') AS FLOAT64) AS rating,
  JSON_QUERY(rv.data, '$.condition') AS condition_json,
  JSON_QUERY(rv.data, '$.metrics') AS metrics_json,
  JSON_QUERY(rv.data, '$.radar') AS radar_json,
  JSON_QUERY(rv.data, '$.tags') AS tags_json,
  JSON_QUERY(rv.data, '$.images') AS images_json,
  CAST(JSON_VALUE(rv.data, '$.helpfulCount') AS INT64) AS helpful_count,
  JSON_VALUE(rv.data, '$.comment') AS comment,
  JSON_VALUE(rv.data, '$.createdAt') AS created_at,
  JSON_VALUE(rv.data, '$.status') AS status
FROM `wedive_master_data_v1.reviews_raw_latest` rv
LEFT JOIN `wedive_master_data_v1.users_raw_latest` u ON JSON_VALUE(rv.data, '$.userId') = u.document_id
ORDER BY created_at DESC
