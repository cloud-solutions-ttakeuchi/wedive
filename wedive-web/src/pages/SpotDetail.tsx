import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { MapPin, CheckCircle, Star, ChevronLeft, Eye, Thermometer, Wind, Waves, Compass, MessageSquare, Shield, Award, Clock } from 'lucide-react';

export const SpotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { points, areas, creatures, pointCreatures, logs, reviews, isAuthenticated } = useApp();
  const { t } = useLanguage();
  const point = points.find(p => p.id === id);

  if (!point) return <div className="text-center mt-20 text-gray-500 font-medium">{t('spot.not_found')}</div>;

  const area = areas.find(a => a.id === point.areaId);
  const pointReviews = reviews.filter(r => r.pointId === id && r.status === 'approved');

  // Filter pointCreatures from context
  const inhabitants = pointCreatures
    .filter(pc => pc.pointId === id)
    .map(pc => {
      const creature = creatures.find(c => c.id === pc.creatureId);
      if (!creature) return null;
      return { ...creature, rarity: pc.localRarity };
    })
    .filter(Boolean);
  const userLogs = isAuthenticated ? logs.filter(l => l.spotId === point.id) : [];

  const getTrustBadge = (level: string) => {
    switch (level) {
      case 'official': return <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-blue-200"><Shield size={10} /> Official</div>;
      case 'professional': return <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-indigo-200"><Compass size={10} /> Pro</div>;
      case 'verified': return <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-green-200"><CheckCircle size={10} /> Verified</div>;
      case 'expert': return <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-amber-200"><Award size={10} /> Expert</div>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Large image like Pokemon Zukan */}
      <div className="bg-white">
        <div className="max-w-5xl mx-auto">
          {/* Navigation back */}
          <div className="px-6 py-4 border-b border-gray-200">
            <Link to="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <ChevronLeft size={18} className="mr-1" />
              {t('nav.home')}
            </Link>
          </div>

          {/* Hero Image */}
          <div className="relative aspect-[21/9] bg-gray-100 overflow-hidden">
            <img
              src={point.imageUrl}
              alt={point.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Title Section */}
          <div className="px-8 py-8 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <MapPin size={16} />
                  <span>{area?.name}</span>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  {point.name}
                </h1>
                <div className="flex flex-wrap gap-2">
                  {point.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Difficulty Badge */}
              <div className="flex-shrink-0">
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${point.level === 'Beginner' ? 'bg-green-100 text-green-700' :
                  point.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                  {point.level}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* Stats & Current Condition */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Average Stats Card */}
          <div className="md:col-span-2 bg-gradient-to-br from-white to-blue-50/30 rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Clock size={20} className="text-blue-600" />
                現在の実測ポテンシャル
              </h2>
              {point.actualStats?.reviewCount && (
                <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm font-medium">
                  直近 {point.actualStats.reviewCount} 件の集計
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {/* Rating Pot */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-600 uppercase tracking-tight">総合満足度</span>
                  <div className="flex items-center gap-1">
                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-2xl font-black text-gray-900 leading-none">
                      {point.actualStats?.avgRating?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full shadow-sm transition-all duration-1000"
                    style={{ width: `${(point.actualStats?.avgRating || 0) * 20}%` }}
                  />
                </div>
              </div>

              {/* Visibility Pot */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-600 uppercase tracking-tight">平均透明度</span>
                  <div className="flex items-center gap-1 text-blue-600">
                    <Eye size={16} />
                    <span className="text-2xl font-black text-gray-900 leading-none">
                      {point.actualStats?.avgVisibility?.toFixed(1) || '0.0'}
                    </span>
                    <span className="text-xs font-bold mt-2">m</span>
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full shadow-sm transition-all duration-1000"
                    style={{ width: `${Math.min(100, (point.actualStats?.avgVisibility || 0) * 4)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Comparison Badge */}
            <div className="mt-10 flex items-center gap-3 p-4 bg-white/60 rounded-xl border border-blue-100 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 border border-blue-200">
                <Waves size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">公式スペックとの比較</p>
                <div className="text-sm text-gray-900 font-medium">
                  {point.actualStats?.avgVisibility && point.officialStats?.visibility ? (
                    point.actualStats.avgVisibility > point.officialStats.visibility[1]
                      ? <span className="text-green-600 font-bold">「通常よりかなり透明度が高い状態です」</span>
                      : point.actualStats.avgVisibility < point.officialStats.visibility[0]
                        ? <span className="text-red-500 font-bold">「通常より濁りが入っている可能性があります」</span>
                        : <span className="text-blue-600 font-bold">「安定した静穏な海況が続いています」</span>
                  ) : <span className="text-gray-400 italic">比較データ収集中...</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info / Condition */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-bl-full border-b border-l border-gray-100 -mr-8 -mt-8 group-hover:bg-blue-50 transition-colors" />

            <div className="relative">
              <h2 className="text-xl font-bold text-gray-900 mb-6 font-display">スペック詳細</h2>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-gray-100 rounded-xl text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    <Compass size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">潮流レベル</p>
                    <p className="text-sm font-bold text-gray-900">{point.current === 'none' ? 'なし' : point.current === 'weak' ? '穏やか' : point.current === 'strong' ? '強い' : 'ドリフト'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-gray-100 rounded-xl text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    <Thermometer size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">水温帯 (想定)</p>
                    <p className="text-sm font-bold text-gray-900">14°C - 28°C</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-gray-100 rounded-xl text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    <Wind size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">主な風向き</p>
                    <p className="text-sm font-bold text-gray-900">{point.topography.includes('dropoff') ? '北東 / 北' : '南 / 南西'}</p>
                  </div>
                </div>
              </div>
            </div>

            <Link
              to={`/add-review?pointId=${point.id}`}
              className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gray-200"
            >
              <MessageSquare size={18} />
              今の海況を報告
            </Link>
          </div>
        </div>

        {/* Description Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-12 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6 font-display">ポイント解説</h2>
          <p className="text-gray-700 leading-relaxed text-lg">
            {point.description}
          </p>
        </div>

        {/* Field Guide */}
        <div className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              {t('spot.field_guide')}
            </h2>
            <span className="text-sm text-gray-600">
              {inhabitants.length} {t('spot.species')}
            </span>
          </div>

          {/* Creatures Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {inhabitants.map((creature) => {
              const isDiscovered = userLogs.some(l => l.creatureId === creature!.id || l.sightedCreatures?.includes(creature!.id));

              return (
                <Link
                  key={creature!.id}
                  to={`/creature/${creature!.id}`}
                  className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-primary-500 hover:shadow-md transition-all"
                >
                  <div className="aspect-square relative bg-gray-50">
                    <img
                      src={creature!.imageUrl}
                      alt={creature!.name}
                      className="w-full h-full object-cover"
                    />

                    {isDiscovered && (
                      <div className="absolute top-2 right-2 bg-success text-white p-1 rounded-full">
                        <CheckCircle size={16} strokeWidth={2.5} />
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">
                      {creature!.name}
                    </h3>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 4 }).map((_, i) => {
                        const rarityLevel = creature!.rarity === 'Legendary' ? 4 :
                          creature!.rarity === 'Epic' ? 3 :
                            creature!.rarity === 'Rare' ? 2 : 1;
                        const isActive = i < rarityLevel;
                        return (
                          <Star
                            key={i}
                            size={12}
                            className={isActive ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
                          />
                        );
                      })}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Latest Reviews (NEW for v6.2.0) */}
        <div className="mt-20">
          <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-6">
            <h2 className="text-2xl font-black text-gray-900 font-display">最新のレビュー</h2>
            <Link
              to={`/add-review?pointId=${point.id}`}
              className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-4 py-2 rounded-lg"
            >
              すべての評価を見る
            </Link>
          </div>

          {pointReviews.length > 0 ? (
            <div className="space-y-6">
              {pointReviews.slice(0, 5).map((review) => (
                <div key={review.id} className="bg-white rounded-2xl border border-gray-200 p-8 transition-all hover:border-gray-300 shadow-sm">
                  <div className="flex flex-col md:flex-row gap-8">
                    {/* User Info (Left) */}
                    <div className="md:w-56 shrink-0 text-center md:text-left">
                      <div className="flex flex-col items-center md:items-start gap-4">
                        <img
                          src={review.userProfileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName)}&background=random`}
                          alt={review.userName}
                          className="w-16 h-16 rounded-2xl object-cover ring-4 ring-gray-50 shadow-sm"
                        />
                        <div>
                          <p className="font-black text-gray-900 text-lg mb-1 leading-tight">{review.userName}</p>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">{review.userLogsCount} Dives</p>
                          <div className="flex justify-center md:justify-start">
                            {getTrustBadge(review.trustLevel)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Review Content (Right) */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-4 mb-6">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={20}
                              className={i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                          {review.date}
                        </span>
                      </div>

                      <p className="text-gray-800 text-lg leading-relaxed mb-6 font-medium whitespace-pre-wrap">
                        {review.comment}
                      </p>

                      {/* Photo Gallery (if any) */}
                      {review.images && review.images.length > 0 && (
                        <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                          {review.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-xl ring-2 ring-gray-50 hover:ring-blue-100 transition-all shrink-0 cursor-zoom-in shadow-sm"
                              alt={`Review image ${idx + 1}`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Metrics Icons */}
                      <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-xs font-black text-gray-600 border border-gray-100 shadow-sm">
                          <Eye size={14} className="text-blue-500" />
                          {review.metrics.visibility}m
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-xs font-black text-gray-600 border border-gray-100 shadow-sm">
                          <Waves size={14} className="text-cyan-500" />
                          潮流 {review.metrics.flow === 'none' ? 'なし' : review.metrics.flow === 'weak' ? '穏やか' : review.metrics.flow === 'strong' ? '強い' : 'ドリフト'}
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-xs font-black text-gray-600 border border-gray-100 shadow-sm">
                          <Compass size={14} className="text-purple-500" />
                          難易度 {review.metrics.difficulty === 'easy' ? '初級' : review.metrics.difficulty === 'normal' ? '中級' : '上級'}
                        </div>
                        {review.condition.waterTemp && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-xs font-black text-gray-600 border border-gray-100 shadow-sm">
                            <Thermometer size={14} className="text-red-400" />
                            {review.condition.waterTemp}°C
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center shadow-inner">
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-6" />
              <p className="text-gray-500 font-bold text-lg mb-2">まだレビューがありません</p>
              <p className="text-gray-400 text-sm mb-8">このポイントの最初の発見者になりましょう！</p>
              <Link
                to={`/add-review?pointId=${point.id}`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 border-2 border-gray-200 rounded-2xl font-black hover:border-gray-900 transition-all shadow-sm active:scale-95"
              >
                レビューを初投稿する
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
