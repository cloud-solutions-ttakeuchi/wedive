SELECT
  document_id AS id,
  JSON_VALUE(data, '$.name') AS name,
  JSON_VALUE(data, '$.website') AS website,
  JSON_VALUE(data, '$.logoUrl') AS logo_url,
  JSON_QUERY(data, '$.ranks') AS ranks_json,
  JSON_VALUE(data, '$.createdAt') AS created_at
FROM `${PROJECT_ID}.${DATASET}`.agencies_raw_latest
