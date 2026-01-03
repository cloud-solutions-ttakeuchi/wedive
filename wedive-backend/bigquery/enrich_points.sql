
-- ポイント情報の増分エンリッチメント
MERGE `${PROJECT_ID}.${DATASET}.points_enriched` t
USING (
  SELECT
    document_id AS id,
    JSON_VALUE(data, '$.name') AS name,
    JSON_VALUE(data, '$.area') AS area_name
  FROM `${PROJECT_ID}.${DATASET}.points_raw_latest`
) s
ON t.id = s.id
WHEN MATCHED AND (t.name != s.name OR t.search_text IS NULL) THEN
  UPDATE SET
    name = s.name,
    name_kana = `${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name),
    search_text = CONCAT(s.name, ' ', `${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name), ' ', IFNULL(s.area_name, '')),
    updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (id, name, name_kana, search_text, updated_at)
  VALUES (
    s.id,
    s.name,
    `${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name),
    CONCAT(s.name, ' ', `${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name), ' ', IFNULL(s.area_name, '')),
    CURRENT_TIMESTAMP()
  );
