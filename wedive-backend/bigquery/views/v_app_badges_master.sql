
-- TODO: Phase 2 - バッジマスタ (将来実装予定: 管理画面からの登録・編集機能の追加に合わせて有効化)
/*
SELECT
  id,
  JSON_VALUE(data, '$.name') AS name,
  JSON_VALUE(data, '$.iconUrl') AS icon_url,
  JSON_QUERY(data, '$.condition') AS condition_json
FROM `wedive_master_data_v1`.badges_raw_latest
*/
