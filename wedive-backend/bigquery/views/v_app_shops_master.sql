
SELECT
  s.document_id AS id,
  JSON_VALUE(s.data, '$.name') AS name,
  JSON_VALUE(s.data, '$.regionId') AS region_id,
  JSON_VALUE(s.data, '$.areaId') AS area_id,
  JSON_VALUE(s.data, '$.address') AS address,
  JSON_VALUE(s.data, '$.phone') AS phone,
  JSON_VALUE(s.data, '$.url') AS url,
  JSON_VALUE(s.data, '$.status') AS status
FROM `wedive_master_data_v1`.shops_raw_latest s
