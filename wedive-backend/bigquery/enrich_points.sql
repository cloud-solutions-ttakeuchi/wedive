-- ポイント情報の増分エンリッチメント
MERGE `{PROJECT_ID}.{DATASET_ID}.points_enriched` t
USING (SELECT id, JSON_VALUE(data, '$.name') as name FROM `{PROJECT_ID}.{DATASET_ID}.points_raw_latest`) s
ON t.id = s.id
WHEN MATCHED AND t.name != s.name THEN
  UPDATE SET name = s.name, name_kana = `{PROJECT_ID}.{DATASET_ID}.fn_to_kana`(s.name), updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (id, name, name_kana, updated_at) VALUES (s.id, s.name, `{PROJECT_ID}.{DATASET_ID}.fn_to_kana`(s.name), CURRENT_TIMESTAMP());
