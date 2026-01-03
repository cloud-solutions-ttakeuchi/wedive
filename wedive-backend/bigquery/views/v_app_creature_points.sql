
SELECT
  pc.creature_id,
  pc.point_id,
  p.name AS point_name,
  p.region_name,
  p.area_name,
  pc.local_rarity
FROM `${PROJECT_ID}.${DATASET}`.v_app_point_creatures pc
JOIN `${PROJECT_ID}.${DATASET}`.v_app_points_master p ON pc.point_id = p.id
