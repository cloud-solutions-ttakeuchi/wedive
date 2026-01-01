WITH monthly_metrics AS (
  SELECT
    JSON_VALUE(data, '$.pointId') AS point_id,
    EXTRACT(MONTH FROM CAST(JSON_VALUE(data, '$.createdAt') AS TIMESTAMP)) AS month,
    AVG(CAST(JSON_VALUE(data, '$.metrics.visibility') AS FLOAT64)) AS avg_v,
    AVG(CAST(JSON_VALUE(data, '$.radar.visibility') AS FLOAT64)) AS avg_rv,
    AVG(CAST(JSON_VALUE(data, '$.radar.encounter') AS FLOAT64)) AS avg_e,
    AVG(CAST(JSON_VALUE(data, '$.radar.excite') AS FLOAT64)) AS avg_ex,
    AVG(CAST(JSON_VALUE(data, '$.radar.topography') AS FLOAT64)) AS avg_to,
    AVG(CAST(JSON_VALUE(data, '$.radar.comfort') AS FLOAT64)) AS avg_co,
    AVG(CAST(JSON_VALUE(data, '$.radar.satisfaction') AS FLOAT64)) AS avg_sa,
    COUNT(*) AS count
  FROM `wedive_master_data_v1.reviews_raw_latest`
  WHERE JSON_VALUE(data, '$.status') = 'approved'
  GROUP BY point_id, month
),
monthly_json AS (
  SELECT
    point_id,
    CONCAT('[', ARRAY_TO_STRING(ARRAY_AGG(
      FORMAT('{"month": %d, "visibility": %.2f, "visibility_score": %.2f, "encounter": %.2f, "excite": %.2f, "topography": %.2f, "comfort": %.2f, "satisfaction": %.2f, "count": %d}',
             month, avg_v, avg_rv, avg_e, avg_ex, avg_to, avg_co, avg_sa, count)
      ORDER BY month
    ), ','), ']') AS monthly_stats_json
  FROM monthly_metrics
  GROUP BY point_id
)
SELECT
  r.point_id,
  AVG(CAST(JSON_VALUE(r.data, '$.rating') AS FLOAT64)) AS avg_rating,
  AVG(CAST(JSON_VALUE(r.data, '$.metrics.visibility') AS FLOAT64)) AS avg_visibility,
  COUNT(*) AS total_reviews,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.encounter') AS FLOAT64)) AS radar_encounter,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.excite') AS FLOAT64)) AS radar_excite,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.macro') AS FLOAT64)) AS radar_macro,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.comfort') AS FLOAT64)) AS radar_comfort,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.topography') AS FLOAT64)) AS radar_topography,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.satisfaction') AS FLOAT64)) AS radar_satisfaction,
  AVG(CAST(JSON_VALUE(r.data, '$.radar.visibility') AS FLOAT64)) AS radar_visibility,
  ANY_VALUE(m.monthly_stats_json) AS monthly_analysis,
  CURRENT_TIMESTAMP() AS aggregated_at
FROM `wedive_master_data_v1.reviews_raw_latest` r
LEFT JOIN monthly_json m ON JSON_VALUE(r.data, '$.pointId') = m.point_id
WHERE JSON_VALUE(r.data, '$.status') = 'approved'
GROUP BY r.point_id
