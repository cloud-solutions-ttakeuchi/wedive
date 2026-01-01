
SELECT
  cp.id,
  cp.point_id,
  cp.creature_id,
  cp.creature_name,
  cp.creature_image,
  cp.local_rarity,
  cp.last_sighted,
  cp.reasoning,
  cp.confidence,
  cp.status
FROM `wedive_master_data_v1.v_app_point_creatures` cp
