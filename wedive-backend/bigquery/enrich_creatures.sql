-- 生物情報の増分エンリッチメント
MERGE `{PROJECT_ID}.{DATASET_ID}.creatures_enriched` t
USING (
  SELECT
    id,
    JSON_VALUE(data, '$.name') as name,
    JSON_VALUE(data, '$.scientificName') as s_name,
    JSON_VALUE(data, '$.englishName') as e_name,
    JSON_VALUE(data, '$.family') as family,
    JSON_VALUE(data, '$.category') as cat
  FROM `{PROJECT_ID}.{DATASET_ID}.creatures_raw_latest`
) s
ON t.id = s.id
WHEN MATCHED AND t.name != s.name THEN
  UPDATE SET
    name = s.name,
    name_kana = `{PROJECT_ID}.{DATASET_ID}.fn_to_kana`(s.name),
    search_text = CONCAT(s.name, ' ', `{PROJECT_ID}.{DATASET_ID}.fn_to_kana`(s.name), ' ', s.s_name, ' ', s.e_name, ' ', s.family, ' ', s.cat),
    updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (id, name, name_kana, search_text, updated_at)
  VALUES (
    s.id, s.name, `{PROJECT_ID}.{DATASET_ID}.fn_to_kana`(s.name),
    CONCAT(s.name, ' ', `{PROJECT_ID}.{DATASET_ID}.fn_to_kana`(s.name), ' ', s.s_name, ' ', s.e_name, ' ', s.family, ' ', s.cat),
    CURRENT_TIMESTAMP()
  );
