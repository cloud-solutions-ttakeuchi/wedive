
SELECT
  l.document_id AS id,
  JSON_VALUE(l.data, '$.userId') AS user_id,
  JSON_VALUE(l.data, '$.pointId') AS point_id,
  JSON_VALUE(l.data, '$.title') AS title,
  JSON_VALUE(l.data, '$.date') AS date,
  JSON_VALUE(l.data, '$.notes') AS notes,
  JSON_VALUE(l.data, '$.imageUrl') AS image_url,
  JSON_VALUE(l.data, '$.rating') AS rating,
  JSON_VALUE(l.data, '$.status') AS status
FROM `wedive_master_data_v1.logs_raw_latest` l
WHERE JSON_VALUE(l.data, '$.isPublic') = 'true'
  AND JSON_VALUE(l.data, '$.status') = 'published'
