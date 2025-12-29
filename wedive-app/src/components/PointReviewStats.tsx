import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Polygon, Line, G, Text as SvgText, Circle } from 'react-native-svg';
import { Info, Sparkles, TrendingUp, Filter } from 'lucide-react-native';
import { Point, Review, ReviewRadar } from '../types';

const { width } = Dimensions.get('window');

interface PointReviewStatsProps {
  point: Point;
  reviews: Review[];
  areaReviews: Review[];
}

const CATEGORIES = [
  { key: 'visibility', label: '透明度' },
  { key: 'encounter', label: '生物' },
  { key: 'excite', label: '興奮度' },
  { key: 'topography', label: '地形' },
  { key: 'comfort', label: '快適度' },
];

export const PointReviewStats: React.FC<PointReviewStatsProps> = ({ point, reviews, areaReviews }) => {
  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>('all');

  const filteredReviews = useMemo(() => {
    if (selectedSeason === 'all') return reviews;
    return reviews.filter(r => {
      if (!r.date) return false;
      const month = new Date(r.date.replace(/\//g, '-')).getMonth() + 1;
      const seasons: Record<number, number[]> = {
        1: [3, 4, 5], 2: [6, 7, 8], 3: [9, 10, 11], 4: [12, 1, 2]
      };
      return seasons[selectedSeason as number]?.includes(month);
    });
  }, [reviews, selectedSeason]);

  const stats = useMemo(() => {
    const calcAvg = (revs: Review[]) => {
      if (revs.length === 0) return null;
      const sums: ReviewRadar = { visibility: 0, encounter: 0, excite: 0, topography: 0, comfort: 0, satisfaction: 0 };
      let visSum = 0;
      revs.forEach(r => {
        Object.keys(sums).forEach(k => {
          sums[k as keyof ReviewRadar] += r.radar[k as keyof ReviewRadar] || 0;
        });
        visSum += r.metrics.visibility || 0;
      });
      return {
        radar: Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / revs.length])) as unknown as ReviewRadar,
        avgVisibility: visSum / revs.length,
        count: revs.length
      };
    };

    return {
      current: calcAvg(filteredReviews),
      area: calcAvg(areaReviews.filter(r => r.pointId !== point.id))
    };
  }, [filteredReviews, areaReviews, point.id]);

  // Radar Chart Logic
  const RADIUS = 80;
  const CENTER = 100;
  const ANGLE_STEP = (Math.PI * 2) / 5;

  const getCoordinates = (value: number, angle: number) => {
    const r = (value / 5) * RADIUS;
    return {
      x: CENTER + r * Math.cos(angle - Math.PI / 2),
      y: CENTER + r * Math.sin(angle - Math.PI / 2)
    };
  };

  const getPath = (radar: ReviewRadar | null) => {
    if (!radar) return "";
    return CATEGORIES.map((cat, i) => {
      const coord = getCoordinates(radar[cat.key as keyof ReviewRadar] || 0, i * ANGLE_STEP);
      return `${coord.x},${coord.y}`;
    }).join(" ");
  };

  return (
    <View style={styles.container}>
      {/* Season Filter */}
      <View style={styles.filterHeader}>
        <TrendingUp size={16} color="#0ea5e9" />
        <Text style={styles.filterTitle}>実測コンディション</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonScroll}>
          {['All', '春', '夏', '秋', '冬'].map((s, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedSeason(i === 0 ? 'all' : i)}
              style={[styles.seasonTab, (selectedSeason === (i === 0 ? 'all' : i)) && styles.seasonTabActive]}
            >
              <Text style={[styles.seasonText, (selectedSeason === (i === 0 ? 'all' : i)) && styles.seasonTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.mainContent}>
        {/* Radar Chart */}
        <View style={styles.chartWrapper}>
          <Svg height="200" width="200" viewBox="0 0 200 200">
            {/* Background Nets */}
            {[1, 2, 3, 4, 5].map(step => (
              <Polygon
                key={step}
                points={CATEGORIES.map((_, i) => {
                  const coord = getCoordinates(step, i * ANGLE_STEP);
                  return `${coord.x},${coord.y}`;
                }).join(" ")}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="1"
              />
            ))}
            {/* Axis Lines */}
            {CATEGORIES.map((_, i) => {
              const coord = getCoordinates(5, i * ANGLE_STEP);
              return <Line key={i} x1={CENTER} y1={CENTER} x2={coord.x} y2={coord.y} stroke="#f1f5f9" strokeWidth="1" />;
            })}

            {/* Area Average Layer */}
            {stats.area && (
              <Polygon
                points={getPath(stats.area.radar)}
                fill="rgba(148, 163, 184, 0.1)"
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="4,2"
              />
            )}

            {/* Point Layer */}
            {stats.current && (
              <Polygon
                points={getPath(stats.current.radar)}
                fill="rgba(14, 165, 233, 0.2)"
                stroke="#0ea5e9"
                strokeWidth="2"
              />
            )}

            {/* Labels */}
            {CATEGORIES.map((cat, i) => {
              const coord = getCoordinates(6.2, i * ANGLE_STEP);
              return (
                <SvgText
                  key={i}
                  x={coord.x}
                  y={coord.y}
                  fontSize="10"
                  fill="#64748b"
                  fontWeight="bold"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {cat.label}
                </SvgText>
              );
            })}
          </Svg>
        </View>

        {/* Metrics List */}
        <View style={styles.metricsList}>
          <View style={styles.visBox}>
            <Text style={styles.visLabel}>平均透明度</Text>
            <View style={styles.visValueRow}>
              <Text style={styles.visValue}>{stats.current?.avgVisibility.toFixed(1) || '--'}<Text style={styles.unit}>m</Text></Text>
              {stats.area && (
                <View style={styles.areaCompare}>
                  <Text style={styles.areaCompareText}>エリア平均: {stats.area.avgVisibility.toFixed(1)}m</Text>
                </View>
              )}
            </View>
            <View style={styles.barContainer}>
              <View style={[styles.barBase, { backgroundColor: '#f1f5f9' }]}>
                {stats.area && <View style={[styles.barFill, { width: `${Math.min(100, (stats.area.avgVisibility / 30) * 100)}%`, backgroundColor: '#cbd5e1', position: 'absolute' }]} />}
                {stats.current && <View style={[styles.barFill, { width: `${Math.min(100, (stats.current.avgVisibility / 30) * 100)}%`, backgroundColor: '#0ea5e9' }]} />}
              </View>
            </View>
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#0ea5e9' }]} />
              <Text style={styles.legendText}>このポイント</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#94a3b8', borderRadius: 0 }]} />
              <Text style={styles.legendText}>エリア平均 ({point.area})</Text>
            </View>
          </View>
        </View>
      </View>

      {(!stats.current || stats.current.count === 0) && (
        <View style={styles.emptyNotice}>
          <Info size={14} color="#94a3b8" />
          <Text style={styles.emptyNoticeText}>このシーズンのレビューがまだありません</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  filterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  seasonScroll: {
    marginLeft: 8,
  },
  seasonTab: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: '#f8fafc',
  },
  seasonTabActive: {
    backgroundColor: '#0ea5e9',
  },
  seasonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  seasonTextActive: {
    color: '#fff',
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsList: {
    flex: 1,
    paddingLeft: 20,
  },
  visBox: {
    marginBottom: 20,
  },
  visLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  visValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  visValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
  },
  unit: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 2,
  },
  areaCompare: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  areaCompareText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
  },
  barContainer: {
    marginTop: 8,
  },
  barBase: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  legend: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  emptyNoticeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});
