SELECT
  l.id,
  JSON_VALUE(l.data, '$.userId') AS user_id,
  JSON_VALUE(l.data, '$.date') AS date,
  CAST(JSON_VALUE(l.data, '$.diveNumber') AS INT64) AS dive_number,
  JSON_QUERY(l.data, '$.location') AS location_json,
  JSON_VALUE(l.data, '$.location.pointId') AS point_id,
  JSON_VALUE(l.data, '$.location.pointName') AS point_name,
  JSON_QUERY(l.data, '$.depth') AS depth_info_json,
  JSON_QUERY(l.data, '$.condition') AS condition_info_json,
  JSON_QUERY(l.data, '$.photos') AS photos_json,
  JSON_VALUE(l.data, '$.comment') AS comment,
  CAST(JSON_VALUE(l.data, '$.likeCount') AS INT64) AS like_count,
  JSON_VALUE(l.data, '$.createdAt') AS created_at
FROM `wedive_master_data_v1.logs_raw_latest` l
WHERE JSON_VALUE(l.data, '$.isPrivate') = 'false'
ORDER BY date DESC, dive_number DESC
LIMIT 100
