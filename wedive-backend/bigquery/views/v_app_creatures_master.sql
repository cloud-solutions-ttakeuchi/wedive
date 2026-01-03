
SELECT
  c.document_id AS id,
  JSON_VALUE(c.data, '$.name') AS name,
  e.name_kana,
  JSON_VALUE(c.data, '$.scientificName') AS scientific_name,
  JSON_VALUE(c.data, '$.englishName') AS english_name,
  JSON_VALUE(c.data, '$.category') AS category,
  JSON_VALUE(c.data, '$.family') AS family,
  JSON_VALUE(c.data, '$.description') AS description,
  JSON_VALUE(c.data, '$.rarity') AS rarity,
  JSON_VALUE(c.data, '$.imageUrl') AS image_url,
  JSON_QUERY(c.data, '$.gallery') AS gallery_json,
  JSON_QUERY(c.data, '$.depthRange') AS depth_range_json,
  JSON_QUERY(c.data, '$.specialAttributes') AS special_attributes_json,
  JSON_QUERY(c.data, '$.waterTempRange') AS water_temp_range_json,
  JSON_VALUE(c.data, '$.size') AS size,
  JSON_QUERY(c.data, '$.season') AS season_json,
  JSON_QUERY(c.data, '$.tags') AS tags_json,
  JSON_QUERY(c.data, '$.stats') AS stats_json,
  JSON_VALUE(c.data, '$.submitterId') AS submitter_id,
  JSON_VALUE(c.data, '$.imageCredit') AS image_credit,
  JSON_VALUE(c.data, '$.imageLicense') AS image_license,
  JSON_VALUE(c.data, '$.imageKeyword') AS image_keyword,
  e.search_text,
  JSON_VALUE(c.data, '$.status') AS status,
  JSON_VALUE(c.data, '$.createdAt') AS created_at
FROM `${PROJECT_ID}.${DATASET}`.creatures_raw_latest c
LEFT JOIN `${PROJECT_ID}.${DATASET}`.creatures_enriched e ON c.document_id = e.id
