import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  CartesianGrid
} from 'recharts';
import { Star, MessageSquare, ShieldCheck, Zap, Droplets, Wind, Smile, Sun, Navigation, Anchor, Check, Cloud, CloudRain, Thermometer, Info, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Point, Review, ReviewRadar } from '../types';

const RADAR_LABELS: Record<keyof ReviewRadar, string> = {
  visibility: '透明度',
  satisfaction: '満足度',
  excite: 'エキサイト',
  comfort: '快適度',
  encounter: '遭遇度',
  topography: '地形'
};

interface PointReviewStatsProps {
  point: Point;
  reviews: Review[];
  areaReviews?: Review[];
}

export const PointReviewStats: React.FC<PointReviewStatsProps> = ({ point, reviews, areaReviews = [] }) => {
  const [filter, setFilter] = React.useState<'all' | 'spring' | 'summer' | 'autumn' | 'winter'>('all');
  const [sortBy, setSortBy] = React.useState<'latest' | 'rating'>('latest');

  // Aggregate Review Data with filtering
  const filteredReviews = useMemo(() => {
    if (filter === 'all') return reviews;
    return reviews.filter(r => {
      const month = new Date(r.date || r.createdAt).getMonth() + 1;
      if (filter === 'spring') return month >= 3 && month <= 5;
      if (filter === 'summer') return month >= 6 && month <= 8;
      if (filter === 'autumn') return month >= 9 && month <= 11;
      if (filter === 'winter') return month === 12 || month === 1 || month === 2;
      return true;
    });
  }, [reviews, filter]);

  const filteredAreaReviews = useMemo(() => {
    if (filter === 'all') return areaReviews;
    return areaReviews.filter(r => {
      const month = new Date(r.date || r.createdAt).getMonth() + 1;
      if (filter === 'spring') return month >= 3 && month <= 5;
      if (filter === 'summer') return month >= 6 && month <= 8;
      if (filter === 'autumn') return month >= 9 && month <= 11;
      if (filter === 'winter') return month === 12 || month === 1 || month === 2;
      return true;
    });
  }, [areaReviews, filter]);

  const stats = useMemo(() => {
    const calculateStats = (revs: Review[]) => {
      if (revs.length === 0) return null;
      const avg = (key: keyof ReviewRadar) => revs.reduce((sum, r) => sum + r.radar[key], 0) / revs.length;
      return {
        avgRating: revs.reduce((sum, r) => sum + r.rating, 0) / revs.length,
        avgVisibility: revs.reduce((sum, r) => sum + r.metrics.visibility, 0) / revs.length,
        radar: {
          visibility: avg('visibility'),
          satisfaction: avg('satisfaction'),
          excite: avg('excite'),
          comfort: avg('comfort'),
          encounter: avg('encounter'),
          topography: avg('topography'),
        }
      };
    };

    return {
      current: calculateStats(filteredReviews),
      area: calculateStats(filteredAreaReviews)
    };
  }, [filteredReviews, filteredAreaReviews]);

  // Radar Data Comparison deconstructed for better memoization tracking
  const { current: currentStats, area: areaStats } = stats;
  const radarData = useMemo(() => {
    const official = point.officialStats?.radar || {
      visibility: 3, satisfaction: 4, excite: 3, comfort: 4, encounter: 4, topography: 3
    };

    return (Object.keys(RADAR_LABELS) as Array<keyof ReviewRadar>).map((key) => ({
      subject: RADAR_LABELS[key],
      official: official[key],
      actual: currentStats?.radar[key] || 0,
      area: areaStats?.radar[key] || 0,
      fullMark: 5
    }));
  }, [point.officialStats, currentStats, areaStats]);

  // Monthly stats for "Best Season" analysis
  const monthlyStats = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: `${i + 1}月`,
      visibility: 0,
      encounter: 0,
      count: 0
    }));

    reviews.forEach(r => {
      const m = new Date(r.date || r.createdAt).getMonth();
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

  // Sorted and filtered reviews for the feed
  const sortedReviews = useMemo(() => {
    return [...filteredReviews].sort((a, b) => {
      if (sortBy === 'latest') {
        const timeA = new Date(a.date || a.createdAt).getTime();
        const timeB = new Date(b.date || b.createdAt).getTime();
        return timeB - timeA;
      } else {
        return b.rating - a.rating;
      }
    });
  }, [filteredReviews, sortBy]);

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
            {(['all', 'spring', 'summer', 'autumn', 'winter'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                  filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {f}
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
                <Radar
                  name="エリア平均"
                  dataKey="area"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.1}
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
                <span className="text-[10px] font-black text-sky-500 tracking-tighter">実測（ポイント）</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black text-emerald-500 tracking-tighter">実測（エリア平均）</span>
              </div>
            </div>
          </div>

          {/* Gauges Column */}
          <div className="space-y-8 flex flex-col justify-center">
            <ComparisonBar
              label="透明度 (Transparency)"
              official={point.officialStats?.visibility[1] || 20}
              actual={stats.current?.avgVisibility || 0}
              unit="m"
              color="sky"
            />
            <ComparisonBar
              label="総合満足度 (Satisfaction)"
              official={5}
              actual={stats.current?.avgRating || 0}
              unit="pts"
              color="amber"
            />
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 italic">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                <Info size={14} className="inline mr-1 text-slate-400" />
                公式スペックを100%としたとき、現在は
                <span className="text-sky-600 font-black mx-1">
                  {stats.current ? Math.round((stats.current.avgVisibility / (point.officialStats?.visibility[1] || 20)) * 100) : '--'}%
                </span>
                の透明度ポテンシャルを発揮しています。
                {stats.area && (
                  <span className="block mt-1 text-[10px]">
                    エリア全体の平均 ({stats.area.avgVisibility.toFixed(1)}m) と比較して
                    <span className={clsx("font-extrabold mx-1", (stats.current?.avgVisibility || 0) >= stats.area.avgVisibility ? "text-emerald-600" : "text-rose-500")}>
                      {Math.abs(Math.round(((stats.current?.avgVisibility || 0) / stats.area.avgVisibility - 1) * 100))}%
                      {(stats.current?.avgVisibility || 0) >= stats.area.avgVisibility ? "高い" : "低い"}
                    </span>
                    状態です。
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Best Season Graphs (Monthly Stats) */}
      <section className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Sun className="text-sky-500" size={24} />
              ベストシーズン・分析
            </h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Monthly Potential Analysis</p>
          </div>
        </div>

        <div className="h-[250px] w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyStats || []}>
              <CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="4 4" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 10, fontWeight: 800 }}
                dy={10}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '16px', color: '#1e293b', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
              />
              <Bar dataKey="visibility" name="透明度 (Avg)" radius={[4, 4, 0, 0]} barSize={24}>
                {(monthlyStats || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.visibility > 0 ? (entry.visibility > 15 ? '#0EA5E9' : '#94A3B8') : 'transparent'} />
                ))}
              </Bar>
              <Bar dataKey="encounter" name="遭遇度 (Avg)" radius={[4, 4, 0, 0]} barSize={24}>
                {(monthlyStats || []).map((entry, index) => (
                  <Cell key={`cell-e-${index}`} fill={entry.encounter > 0 ? (entry.encounter > 3.5 ? '#F59E0B' : '#CBD5E1') : 'transparent'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-8 mt-10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-sky-500 shadow-sm" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Avg Transparency</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">High Encounter</span>
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
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'rating')}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:outline-none shadow-sm cursor-pointer hover:border-sky-300 transition-colors"
          >
            <option value="latest">最新順（潜水日）</option>
            <option value="rating">評価の高い順</option>
          </select>
        </div>

        <div className="space-y-6">
          {sortedReviews.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-12 text-center border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                <MessageSquare size={32} />
              </div>
              <p className="font-black text-slate-400">まだレビューはありません</p>
            </div>
          ) : (
            sortedReviews.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))
          )}
        </div>
      </section>
    </div>
  );
};

const ComparisonBar = ({ label, official, actual, unit, color }: { label: string, official: number, actual: number, unit: string, color: string }) => {

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
  const { currentUser, deleteReview, isAuthenticated } = useApp();
  const navigate = useNavigate();

  const isAdmin = isAuthenticated && (currentUser.role === 'admin' || currentUser.role === 'moderator');
  const isOwner = isAuthenticated && currentUser.id && review.userId && currentUser.id !== 'guest' && review.userId === currentUser.id;
  const canModify = isAdmin || isOwner;

  const handleEdit = () => {
    navigate(`/edit-review/${review.id}`);
  };

  const handleDelete = async () => {
    await deleteReview(review.id);
  };

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
              {(() => {
                const getBadge = (level?: string) => {
                  switch (level) {
                    case 'official': return { label: 'Official', icon: <ShieldCheck size={14} className="shrink-0" />, color: 'bg-indigo-600' };
                    case 'professional': return { label: 'Professional', icon: <Anchor size={14} className="shrink-0" />, color: 'bg-rose-600' };
                    case 'verified': return { label: 'Verified Log', icon: <Check size={14} className="shrink-0" />, color: 'bg-sky-500' };
                    case 'expert': return { label: 'Expert', icon: <Star size={14} className="shrink-0" />, color: 'bg-amber-500' };
                    default: return null;
                  }
                };
                const badge = getBadge(review.trustLevel);
                if (!badge) return null;

                return (
                  <div className={`absolute -bottom-2 -right-2 ${badge.color} text-white pl-1.5 pr-2 py-1 rounded-xl shadow-lg border-4 border-white flex items-center gap-1`}>
                    {badge.icon}
                    <span className="text-[8px] font-black uppercase whitespace-nowrap">{badge.label}</span>
                  </div>
                );
              })()}
            </div>
            <div>
              <div className="flex items-center md:justify-center gap-1.5 mb-1">
                <p className="font-black text-slate-900 text-sm">{review.userName}</p>
                {review.userRank && (
                  <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ring-1 ring-slate-200">
                    {review.userRank}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logged {review.userLogsCount} dives</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 hidden md:block">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="text-[8px] font-black text-slate-500 uppercase mb-2 tracking-wider">Dive Settings</div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-700 flex items-center gap-2">
                  {review.condition.weather === 'sunny' && <Sun size={12} className="text-amber-500" />}
                  {review.condition.weather === 'cloudy' && <Cloud size={12} className="text-slate-400" />}
                  {review.condition.weather === 'rainy' && <CloudRain size={12} className="text-sky-400" />}
                  {review.condition.weather === 'typhoon' && <Navigation size={12} className="text-rose-500" />}
                  {review.condition.weather === 'spring_bloom' && <Droplets size={12} className="text-emerald-500" />}
                  <span className="text-slate-500 font-bold uppercase text-[9px]">Weather</span>
                </p>
                <div className="h-px bg-slate-200 w-full" />
                <p className="text-[10px] font-black text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Thermometer size={12} className="text-sky-500" />
                    {review.condition.waterTemp}<span className="text-[8px] text-slate-500">°C</span>
                  </span>
                  <span className="mx-1 text-slate-200">|</span>
                  <span className="flex items-center gap-1.5">
                    <Anchor size={12} className="text-indigo-500" />
                    {review.metrics.depthMax || '--'}<span className="text-[8px] text-slate-500">m</span>
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Content */}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    size={16}
                    className={clsx(star <= review.rating ? "text-amber-400 fill-amber-400" : "text-slate-100")}
                  />
                ))}
              </div>
              {review.status === 'pending' && (
                <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 w-fit">
                  <AlertCircle size={10} />
                  <span className="text-[9px] font-black uppercase tracking-wider">Approval Pending</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canModify && (
                <div className="flex gap-1">
                  <button
                    onClick={handleEdit}
                    className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-xl transition-all"
                    title="Edit Review"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                    title="Delete Review"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              <span className="text-[10px] font-black text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full uppercase tracking-widest ring-1 ring-sky-100">
                Dived on {review.date || new Date(review.createdAt).toLocaleDateString()}
              </span>
            </div>
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
            <MetricBadge icon={<Droplets />} value={`${review.metrics.visibility}m`} />
            <MetricBadge icon={<Wind />} value={review.metrics.flow} />
            <MetricBadge icon={<Star />} value={review.metrics.difficulty} />
            <MetricBadge icon={<Smile />} value={review.metrics.macroWideRatio > 50 ? 'ワイド' : 'マクロ'} />
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

const MetricBadge = ({ icon, value }: { icon: React.ReactNode, value: string }) => (
  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
    <div className="text-slate-400 mb-1">{React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}</div>
    <div className="text-[10px] font-black text-slate-900 capitalize tracking-tighter">
      {value === 'none' ? 'なし' : value === 'weak' ? '弱い' : value === 'strong' ? '強い' : value === 'drift' ? 'ドリフト' : value === 'easy' ? '余裕' : value === 'normal' ? '普通' : value === 'hard' ? '必死' : value}
    </div>
  </div>
);
