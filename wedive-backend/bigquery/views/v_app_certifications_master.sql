
-- TODO: Phase 2 - 認定資格マスタ (将来実装予定: 管理画面からの登録・編集機能の追加に合わせて有効化)
-- 現状はダミーのクエリを返してスキーマのみ定義
SELECT
  CAST(NULL AS STRING) as id,
  CAST(NULL AS STRING) as name,
  CAST(NULL AS STRING) as organization,
  CAST(NULL AS STRING) as ranks_json
LIMIT 0
/*
SELECT
  id,
  JSON_VALUE(data, '$.name') AS name,
  JSON_VALUE(data, '$.organization') AS organization,
  JSON_QUERY(data, '$.ranks') AS ranks_json
FROM `${PROJECT_ID}.${DATASET}`.certifications_raw_latest
*/
