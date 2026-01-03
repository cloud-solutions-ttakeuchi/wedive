
SELECT
  document_id AS id,
  JSON_VALUE(data, '$.name') AS name,
  JSON_VALUE(data, '$.iconUrl') AS icon_url,
  JSON_QUERY(data, '$.condition') AS condition_json
FROM `wedive_master_data_v1.badges_raw_latest`
