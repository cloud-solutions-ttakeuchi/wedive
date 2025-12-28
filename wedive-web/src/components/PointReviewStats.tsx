import React, { useMemo } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import { Star, MessageSquare, ShieldCheck, Zap, Droplets, Wind, Smile, Sun, Navigation } from 'lucide-react';
import clsx from 'clsx';
import type { Point, Review, ReviewRadar } from '../types';

interface PointReviewStatsProps {
  point: Point;
  reviews: Review[];
}

export const PointReviewStats: React.FC<PointReviewStatsProps> = ({ point, reviews }) => {
  const [filter, setFilter] = React.useState<'all' | 'sunny' | 'spring_bloom' | 'winter'>('all');

  // Aggregate Review Data with filtering
  const filteredReviews = useMemo(() => {
    if (filter === 'all') return reviews;
    if (filter === 'spring_bloom') return reviews.filter(r => r.condition.weather === 'spring_bloom');
    if (filter === 'sunny') return reviews.filter(r => r.condition.weather === 'sunny');
    if (filter === 'winter') return reviews.filter(r => {
      const month = new Date(r.createdAt).getMonth() + 1;
      return month === 12 || month === 1 || month === 2;
    });
    return reviews;
  }, [reviews, filter]);

  const stats = useMemo(() => {
    if (filteredReviews.length === 0) return null;

    const avg = (key: keyof ReviewRadar) => filteredReviews.reduce((sum, r) => sum + r.radar[key], 0) / filteredReviews.length;

    return {
      avgRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
      avgVisibility: reviews.reduce((sum, r) => sum + r.metrics.visibility, 0) / reviews.length,
      radar: {
        encounter: avg('encounter'),
        excite: avg('excite'),
        macro: avg('macro'),
        comfort: avg('comfort'),
        visibility: avg('visibility'),
      }
    };
  }, [reviews]);

  // Radar Data Comparison
  const radarData = useMemo(() => {
    const labels: Record<keyof ReviewRadar, string> = {
      encounter: '遭遇度',
      excite: 'エキサイト',
      macro: 'マクロ',
      comfort: '快適度',
      visibility: '透明度'
    };

    const official = point.officialStats?.radar || {
      encounter: 4, excite: 3, macro: 4, comfort: 4, visibility: 3
    };

    return Object.keys(labels).map((key) => ({
      subject: labels[key as keyof ReviewRadar],
      official: official[key as keyof ReviewRadar],
      actual: stats?.radar[key as keyof ReviewRadar] || 0,
      fullMark: 5
    }));
  }, [point, stats]);

  // Monthly stats for "Best Season" analysis
  const monthlyStats = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: `${i + 1}月`,
      visibility: 0,
      encounter: 0,
      count: 0
    }));

    reviews.forEach(r => {
      const m = new Date(r.createdAt).getMonth();
      months[m].visibility += r.metrics.visibility;
      months[m].encounter += r.radar.encounter;
      months[m].count += 1;
    });

    return months.map(m => ({
      ...m,
      visibility: m.count > 0 ? m.visibility / m.count : 0,
      encounter: m.count > 0 ? m.encounter / m.count : 0
    }));
  }, [reviews]);

  return (
    <div className="space-y-12">
      {/* 1. Comparison Gauges */}
      <section className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Zap className="text-amber-500" fill="currentColor" size={24} />
              ポテンシャル・実測比較
            </h2>
            <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Official Specs vs Real-time Reviews</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl h-fit">
            {(['all', 'sunny', 'spring_bloom', 'winter'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                  filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {f === 'all' ? 'All' : f === 'sunny' ? 'Sunny' : f === 'spring_bloom' ? 'Spring' : 'Winter'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Radar Chart Column */}
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 12, fontWeight: 800 }} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                <Radar
                  name="公式ポテンシャル"
                  dataKey="official"
                  stroke="#94A3B8"
                  fill="#94A3B8"
                  fillOpacity={0.1}
                />
                <Radar
                  name="最近の実測"
                  dataKey="actual"
                  stroke="#0EA5E9"
                  fill="#0EA5E9"
                  fillOpacity={0.4}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="text-[10px] font-black text-slate-500 tracking-tighter">公式期待値</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sky-500" />
                <span className="text-[10px] font-black text-sky-500 tracking-tighter">実測（直近）</span>
              </div>
            </div>
          </div>

          {/* Gauges Column */}
          <div className="space-y-8 flex flex-col justify-center">
            <ComparisonBar
              label="透明度 (Transparency)"
              official={point.officialStats?.visibility[1] || 20}
              actual={stats?.avgVisibility || 0}
              unit="m"
              color="sky"
            />
            <ComparisonBar
              label="総合満足度 (Satisfaction)"
              official={5}
              actual={stats?.avgRating || 0}
              unit="pts"
              max={5}
              color="amber"
            />
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 italic">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                <Info size={14} className="inline mr-1 text-slate-400" />
                公式スペックを100%としたとき、現在は
                <span className="text-sky-600 font-black mx-1">
                  {stats ? Math.round((stats.avgVisibility / (point.officialStats?.visibility[1] || 20)) * 100) : '--'}%
                </span>
                の透明度ポテンシャルを発揮しています。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Best Season Graphs (Monthly Stats) */}
      <section className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-sky-900/20 border border-slate-800">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Sun className="text-sky-400" size={24} />
              ベストシーズン・分析
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Monthly Potential Analysis</p>
          </div>
        </div>

        <div className="h-[250px] w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyStats || []}>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#475569', fontSize: 10, fontWeight: 800 }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
              />
              <Bar dataKey="visibility" name="透明度 (m)" radius={[4, 4, 0, 0]}>
                {(monthlyStats || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.visibility > 15 ? '#0ea5e9' : '#334155'} />
                ))}
              </Bar>
              <Bar dataKey="encounter" name="遭遇度" radius={[4, 4, 0, 0]}>
                {(monthlyStats || []).map((entry, index) => (
                  <Cell key={`cell-e-${index}`} fill={entry.encounter > 3.5 ? '#fbbf24' : '#1e293b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase">Avg Transparency</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase">High Encounter</span>
          </div>
        </div>
      </section>

      {/* 3. Review Feed */}
      <section>
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <MessageSquare className="text-emerald-500" size={24} />
            最新のレビュー
          </h2>
          <select className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:outline-none shadow-sm">
            <option>最新順</option>
            <option>評価の高い順</option>
          </select>
        </div>

        <div className="space-y-6">
          {reviews.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-12 text-center border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                <MessageSquare size={32} />
              </div>
              <p className="font-black text-slate-400">まだレビューはありません</p>
            </div>
          ) : (
            reviews.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))
          )}
        </div>
      </section>
    </div>
  );
};

const ComparisonBar = ({ label, official, actual, unit, max = 30, color }: { label: string, official: number, actual: number, unit: string, max?: number, color: string }) => {
  const percent = Math.min((actual / official) * 100, 150); // limit to 150% visual

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <span className="text-xs font-black text-slate-500 tracking-tight">{label}</span>
        <div className="text-right">
          <span className="text-lg font-black text-slate-900">{actual.toFixed(1)}</span>
          <span className="text-[10px] font-black text-slate-400 ml-1">{unit}</span>
        </div>
      </div>
      <div className="h-4 w-full bg-slate-100 rounded-full relative overflow-hidden ring-1 ring-slate-200">
        {/* Official Target Mark */}
        <div className="absolute top-0 bottom-0 border-r-2 border-slate-400/50 z-10" style={{ left: '66%' }} />

        {/* Progress Bar */}
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-1000 ease-out shadow-sm",
            color === 'sky' ? "bg-gradient-to-r from-sky-400 to-sky-600" : "bg-gradient-to-r from-amber-400 to-amber-600"
          )}
          style={{ width: `${(actual / (official * 1.5)) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">
        <span>0</span>
        <span className="text-slate-500">Official Spec ({official}{unit})</span>
        <span>+50%</span>
      </div>
    </div>
  );
};

const ReviewCard = ({ review }: { review: Review }) => {
  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-md border border-slate-100 hover:shadow-xl transition-all duration-300 group">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: User Info */}
        <div className="md:w-48 shrink-0">
          <div className="flex items-center md:flex-col md:text-center gap-4">
            <div className="relative">
              <img
                src={review.userProfileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.userId}`}
                alt={review.userName}
                className="w-16 h-16 rounded-2xl object-cover ring-4 ring-slate-50 shadow-lg"
              />
              {review.isTrusted && (
                <div className="absolute -bottom-2 -right-2 bg-sky-500 text-white p-1.5 rounded-xl shadow-lg border-4 border-white">
                  <ShieldCheck size={14} />
                </div>
              )}
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">{review.userName}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Logged {review.userLogsCount} dives</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 hidden md:block">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Status</div>
              <p className="text-[10px] font-black text-slate-700 flex items-center gap-2">
                {review.condition.weather === 'sunny' && <Sun size={12} className="text-amber-500" />}
                {review.condition.weather === 'cloudy' && <Cloud size={12} className="text-slate-400" />}
                {review.condition.weather === 'rainy' && <CloudRain size={12} className="text-sky-400" />}
                {review.condition.weather === 'typhoon' && <Navigation size={12} className="text-rose-500" />}
                {review.condition.waterTemp}°C / {review.metrics.visibility}m
              </p>
            </div>
          </div>
        </div>

        {/* Right: Content */}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  size={16}
                  className={clsx(star <= review.rating ? "text-amber-400 fill-amber-400" : "text-slate-100")}
                />
              ))}
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>

          <h4 className="text-lg md:text-xl font-bold text-slate-800 leading-relaxed italic border-l-4 border-sky-100 pl-4">
            「{review.comment || '最高でした！'}」
          </h4>

          <div className="flex flex-wrap gap-2">
            {review.tags.map(tag => (
              <span key={tag} className="bg-sky-50 text-sky-600 px-3 py-1 rounded-lg text-xs font-black border border-sky-100">
                #{tag}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricBadge icon={<Droplets />} label="透明度" value={`${review.metrics.visibility}m`} />
            <MetricBadge icon={<Wind />} label="流れ" value={review.metrics.flow} />
            <MetricBadge icon={<Star />} label="難易度" value={review.metrics.difficulty} />
            <MetricBadge icon={<Smile />} label="スタイル" value={review.metrics.macroWideRatio > 50 ? 'ワイド' : 'マクロ'} />
          </div>

          {review.images && review.images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {review.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  className="w-24 h-24 rounded-2xl object-cover shadow-md hover:scale-105 transition-transform"
                  alt="Review"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricBadge = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
    <div className="text-slate-400 mb-1">{React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}</div>
    <div className="text-[10px] font-black text-slate-900 capitalize tracking-tighter">
      {value === 'none' ? 'なし' : value === 'weak' ? '弱い' : value === 'strong' ? '強い' : value === 'drift' ? 'ドリフト' : value === 'easy' ? '余裕' : value === 'normal' ? '普通' : value === 'hard' ? '必死' : value}
    </div>
  </div>
);

const Info = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const Cloud = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.3-1.7-4.2-3.9-4.5C17.4 6.7 14.3 4 10.5 4 6.8 4 3.7 6.6 3.1 10.1c-1.8.4-3.1 2-3.1 4C0 16.7 2.2 19 5 19h12.5z" />
  </svg>
);

const CloudRain = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 13v8" />
    <path d="M8 13v8" />
    <path d="M12 15v8" />
    <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 10.25a4.5 4.5 0 0 0 .5 8.75" />
  </svg>
);
