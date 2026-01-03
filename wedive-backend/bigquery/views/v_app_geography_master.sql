
SELECT
  a.document_id AS area_id,
  JSON_VALUE(a.data, '$.name') AS area_name,
  JSON_VALUE(a.data, '$.description') AS area_description,
  JSON_VALUE(a.data, '$.status') AS area_status,
  z.document_id AS zone_id,
  JSON_VALUE(z.data, '$.name') AS zone_name,
  JSON_VALUE(z.data, '$.description') AS zone_description,
  JSON_VALUE(z.data, '$.status') AS zone_status,
  r.document_id AS region_id,
  JSON_VALUE(r.data, '$.name') AS region_name,
  JSON_VALUE(r.data, '$.description') AS region_description,
  JSON_VALUE(r.data, '$.status') AS region_status,
  CONCAT(JSON_VALUE(r.data, '$.name'), ' > ', JSON_VALUE(z.data, '$.name'), ' > ', JSON_VALUE(a.data, '$.name')) AS full_path
FROM `wedive_master_data_v1`.areas_raw_latest a
LEFT JOIN `wedive_master_data_v1`.zones_raw_latest z ON JSON_VALUE(a.data, '$.zoneId') = z.document_id
LEFT JOIN `wedive_master_data_v1`.regions_raw_latest r ON JSON_VALUE(z.data, '$.regionId') = r.document_id
