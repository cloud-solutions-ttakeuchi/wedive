
SELECT
  pc.creature_id,
  pc.point_id,
  p.name AS point_name,
  p.region_name,
  p.area_name,
  pc.local_rarity
FROM `wedive_master_data_v1`.v_app_point_creatures pc
JOIN `wedive_master_data_v1`.v_app_points_master p ON pc.point_id = p.id
