
-- TODO: Phase 2 - バッジマスタ (将来実装予定: 管理画面からの登録・編集機能の追加に合わせて有効化)
-- 現状はダミーのクエリを返してスキーマのみ定義
SELECT
  CAST(NULL AS STRING) as id,
  CAST(NULL AS STRING) as name,
  CAST(NULL AS STRING) as icon_url,
  CAST(NULL AS STRING) as condition_json
LIMIT 0
/*
SELECT
  id,
  JSON_VALUE(data, '$.name') AS name,
  JSON_VALUE(data, '$.iconUrl') AS icon_url,
  JSON_QUERY(data, '$.condition') AS condition_json
FROM `${PROJECT_ID}.${DATASET}`.badges_raw_latest
*/
