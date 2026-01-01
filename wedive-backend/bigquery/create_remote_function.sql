-- BigQuery Remote Function を登録するための SQL
-- ※ [ENDPOINT_URL] は Cloud Functions のデプロイ後に取得できる URL に置き換えてください。
-- ※ [CONNECTION_ID] は作成した External Connection ID に置き換えてください。

CREATE OR REPLACE FUNCTION `wedive_master_data_v1.fn_to_kana`(text STRING) RETURNS STRING
REMOTE WITH CONNECTION `[CONNECTION_ID]`
OPTIONS (
  endpoint = '[ENDPOINT_URL]'
);
