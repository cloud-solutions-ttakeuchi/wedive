
-- 生物情報の増分エンリッチメント
MERGE `${PROJECT_ID}.${DATASET}.creatures_enriched` t
USING (
  SELECT
    document_id AS id,
    JSON_VALUE(data, '$.name') AS name,
    JSON_VALUE(data, '$.scientificName') AS s_name,
    JSON_VALUE(data, '$.englishName') AS e_name,
    JSON_VALUE(data, '$.family') AS family,
    JSON_VALUE(data, '$.category') AS cat
  FROM `${PROJECT_ID}.${DATASET}.creatures_raw_latest`
) s
ON t.id = s.id
WHEN MATCHED THEN
  UPDATE SET
    name = s.name,
    name_kana = `${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name),
    search_text = CONCAT(
      s.name, ' ',
      `${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name), ' ',
      -- 濁点抜き（正規化）名を追加して「サメ」で「ザメ」にヒットさせる
      REGEXP_REPLACE(`${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name), r'[がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ]',
        (CASE
          WHEN REGEXP_CONTAINS(s.name, r'[がぎぐげご]') THEN 'かきくけこ'
          WHEN REGEXP_CONTAINS(s.name, r'[ざじずぜぞ]') THEN 'さしすせそ'
          WHEN REGEXP_CONTAINS(s.name, r'[だぢづでど]') THEN 'たちつてと'
          WHEN REGEXP_CONTAINS(s.name, r'[ばびぶべぼぱぴぷぺぽ]') THEN 'はひふへほ'
          ELSE '' END)), ' ',
      IFNULL(s.s_name, ''), ' ',
      IFNULL(s.e_name, ''), ' ',
      IFNULL(s.family, ''), ' ',
      IFNULL(s.cat, ''), ' ',
      (SELECT STRING_AGG(tag, ' ') FROM UNNEST(JSON_VALUE_ARRAY(s.data, '$.tags')) AS tag), ' ',
      (SELECT STRING_AGG(attr, ' ') FROM UNNEST(JSON_VALUE_ARRAY(s.data, '$.specialAttributes')) AS attr)
    ),
    updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (id, name, name_kana, search_text, updated_at)
  VALUES (
    s.id,
    s.name,
    `${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name),
    CONCAT(
      s.name, ' ',
      `${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name), ' ',
      -- 正規化名の追加
      REGEXP_REPLACE(`${PROJECT_ID}.${DATASET}.fn_to_kana`(s.name), r'[がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ]', ' '), ' ',
      IFNULL(s.s_name, ''), ' ',
      IFNULL(s.e_name, ''), ' ',
      IFNULL(s.family, ''), ' ',
      IFNULL(s.cat, ''), ' ',
      (SELECT STRING_AGG(tag, ' ') FROM UNNEST(JSON_VALUE_ARRAY(s.data, '$.tags')) AS tag), ' ',
      (SELECT STRING_AGG(attr, ' ') FROM UNNEST(JSON_VALUE_ARRAY(s.data, '$.specialAttributes')) AS attr)
    ),
    CURRENT_TIMESTAMP()
  );
