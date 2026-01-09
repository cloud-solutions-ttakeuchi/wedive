
SELECT
  pc.document_id AS id,
  JSON_VALUE(pc.data, '$.pointId') AS point_id,
  JSON_VALUE(pc.data, '$.creatureId') AS creature_id,
  c.name AS creature_name,
  c.image_url AS creature_image,
  JSON_VALUE(pc.data, '$.localRarity') AS local_rarity,
  JSON_VALUE(pc.data, '$.lastSighted') AS last_sighted,
  JSON_VALUE(pc.data, '$.reasoning') AS reasoning,
  CAST(JSON_VALUE(pc.data, '$.confidence') AS FLOAT64) AS confidence,
  JSON_VALUE(pc.data, '$.status') AS status,
  JSON_VALUE(pc.data, '$.updatedAt') AS updated_at
FROM `${PROJECT_ID}.${DATASET}`.point_creatures_raw_latest pc
JOIN `${PROJECT_ID}.${DATASET}`.v_app_creatures_master c ON JSON_VALUE(pc.data, '$.creatureId') = c.id
