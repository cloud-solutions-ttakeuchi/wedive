
SELECT
  l.document_id AS id,
  JSON_VALUE(l.data, '$.userId') AS user_id,
  JSON_VALUE(l.data, '$.date') AS date,
  CAST(JSON_VALUE(l.data, '$.diveNumber') AS INT64) AS dive_number,
  JSON_QUERY(l.data, '$.location') AS location_json,
  JSON_VALUE(l.data, '$.location.pointId') AS point_id,
  JSON_VALUE(l.data, '$.location.pointName') AS point_name,
  JSON_QUERY(l.data, '$.team') AS team_json,
  JSON_QUERY(l.data, '$.time') AS time_json,
  JSON_QUERY(l.data, '$.depth') AS depth_info_json,
  JSON_QUERY(l.data, '$.condition') AS condition_info_json,
  JSON_QUERY(l.data, '$.gear') AS gear_json,
  JSON_VALUE(l.data, '$.entryType') AS entry_type,
  JSON_VALUE(l.data, '$.creatureId') AS creature_id,
  JSON_QUERY(l.data, '$.sightedCreatures') AS sighted_creatures_json,
  JSON_QUERY(l.data, '$.photos') AS photos_json,
  JSON_VALUE(l.data, '$.comment') AS comment,
  CAST(JSON_VALUE(l.data, '$.likeCount') AS INT64) AS like_count,
  JSON_QUERY(l.data, '$.likedBy') AS liked_by_json,
  JSON_VALUE(l.data, '$.garminActivityId') AS garmin_activity_id,
  JSON_VALUE(l.data, '$.reviewId') AS review_id,
  JSON_QUERY(l.data, '$.profile') AS profile_json,
  CONCAT(JSON_VALUE(l.data, '$.location.pointName'), ' ', IFNULL(JSON_VALUE(l.data, '$.comment'), '')) AS search_text,
  JSON_VALUE(l.data, '$.createdAt') AS created_at
FROM `${PROJECT_ID}.${DATASET}`.logs_raw_latest l
WHERE JSON_VALUE(l.data, '$.isPrivate') = 'false'
ORDER BY date DESC, dive_number DESC
LIMIT 100
