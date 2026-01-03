
SELECT
  document_id AS id,
  JSON_VALUE(data, '$.name') AS name,
  JSON_VALUE(data, '$.organization') AS organization,
  JSON_QUERY(data, '$.ranks') AS ranks_json
FROM `wedive_master_data_v1.certifications_raw_latest`
