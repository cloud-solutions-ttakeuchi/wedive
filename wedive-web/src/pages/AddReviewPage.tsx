import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Sun, Cloud, CloudRain, Zap, Droplets,
  ArrowLeft, ArrowRight, Check, Star, X,
  Camera, Tag, MessageSquare,
  Navigation, Thermometer, Loader2, Calendar,
  Anchor, Sparkles,
  Activity, Info, Shield
} from 'lucide-react';
import { CERTIFICATIONS } from '../constants/masterData';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Review } from '../types';

export const AddReviewPage = () => {
  const { pointId } = useParams<{ pointId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const logId = queryParams.get('logId');

  const { points, logs, currentUser, addReview, isAuthenticated, updateUser } = useApp();
  const point = points.find(p => p.id === pointId);

  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Review>>({
    pointId,
    logId: logId || undefined,
    date: new Date().toISOString().split('T')[0],
    rating: 4,
    condition: {
      weather: 'sunny',
      wave: 'none',
      airTemp: 25,
      waterTemp: 22,
    },
    metrics: {
      visibility: 15,
      flow: 'none',
      difficulty: 'normal',
      macroWideRatio: 50,
      terrainIntensity: 50,
      depthMin: 5,
      depthMax: 20,
    } as any,
    radar: {
      visibility: 3,
      satisfaction: 4,
      excite: 3,
      comfort: 4,
      encounter: 4,
      topography: 3,
    },
    tags: [],
    comment: '',
    images: [],
    userOrgId: currentUser?.certification?.orgId || 'padi',
    userRank: currentUser?.certification?.rankId || 'entry',
    userLogsCount: logs.length || 0,
  });

  // Pre-fill from log if available
  useEffect(() => {
    if (logId) {
      const log = logs.find(l => l.id === logId);
      if (log) {
        setFormData(prev => ({
          ...prev,
          date: log.date,
          condition: {
            ...prev.condition!,
            weather: log.condition?.weather || prev.condition!.weather,
            wave: log.condition?.wave || prev.condition!.wave,
            airTemp: log.condition?.airTemp || prev.condition!.airTemp,
            waterTemp: log.condition?.waterTemp?.surface || prev.condition!.waterTemp,
          },
          metrics: {
            ...prev.metrics!,
            visibility: log.condition?.transparency || prev.metrics!.visibility,
            flow: log.condition?.current || prev.metrics!.flow as any,
            depthMin: log.depth?.average || prev.metrics!.depthMin,
            depthMax: log.depth?.max || prev.metrics!.depthMax,
          }
        }));
      }
    }
  }, [logId, logs]);

  if (!point) return <div className="p-8 text-center text-slate-500 font-bold">ポイントが見つかりません</div>;
  if (!isAuthenticated) return <div className="p-8 text-center text-slate-500 font-bold">ログインが必要です</div>;

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newImages = [...(formData.images || [])];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `reviews/${pointId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        newImages.push(url);
      }
      setFormData(prev => ({ ...prev, images: newImages }));
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await addReview(formData as any);

      // Also update user profile with latest certification
      if (currentUser && currentUser.id !== 'guest') {
        await updateUser({
          certification: {
            orgId: formData.userOrgId || 'padi',
            rankId: formData.userRank || 'entry',
            date: currentUser.certification?.date || new Date().toISOString().split('T')[0]
          }
        });
      }

      alert('レビューを投稿しました！');
      navigate(`/point/${pointId}`);
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました');
    }
  };

  const progress = (step / 3) * 100;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
          <div className="text-center">
            <h1 className="font-black text-slate-900 leading-tight">レビュー投稿</h1>
            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest">{point.name}</p>
          </div>
          <div className="w-10" />
        </div>
        <div className="h-1.5 w-full bg-slate-100 relative overflow-hidden">
          <motion.div
            className="absolute h-full bg-sky-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {step === 1 && (
              <Step1Env
                data={formData.condition!}
                date={formData.date!}
                onDateChange={(d: string) => setFormData(prev => ({ ...prev, date: d }))}
                onChange={(c: any) => setFormData(prev => ({ ...prev, condition: { ...prev.condition!, ...c } }))}
              />
            )}
            {step === 2 && (
              <Step2Metrics
                data={formData.metrics!}
                onChange={(m: any) => setFormData(prev => {
                  const newMetrics = { ...prev.metrics!, ...m };
                  const newRadar = { ...prev.radar! };

                  // Sync Radar with Transparency
                  if (m.visibility !== undefined) {
                    newRadar.visibility = m.visibility >= 30 ? 5 : m.visibility >= 20 ? 4 : m.visibility >= 10 ? 3 : m.visibility >= 5 ? 2 : 1;
                  }

                  // Sync Comfort based on flow/difficulty/depthMax
                  if (m.flow !== undefined || m.difficulty !== undefined || m.depthMax !== undefined) {
                    const f = m.flow || newMetrics.flow;
                    const d = m.difficulty || newMetrics.difficulty;
                    const dep = m.depthMax || newMetrics.depthMax;

                    let baseComfort = 5;
                    if (f === 'strong' || f === 'drift') baseComfort -= 2;
                    else if (f === 'weak') baseComfort -= 1;

                    if (d === 'hard') baseComfort -= 2;
                    else if (d === 'normal') baseComfort -= 1;

                    if (dep > 30) baseComfort -= 1;

                    newRadar.comfort = Math.max(1, baseComfort);
                  }

                  return { ...prev, metrics: newMetrics, radar: newRadar };
                })}
              />
            )}
            {step === 3 && (
              <Step3Evaluation
                data={formData as any}
                onChange={(d: any) => setFormData(prev => ({ ...prev, ...d }))}
                onRadarChange={(r: any) => setFormData(prev => ({ ...prev, radar: { ...prev.radar!, ...r } }))}
                onImageUpload={handleImageUpload}
                uploading={uploading}
                fileInputRef={fileInputRef}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-12 flex gap-4">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex-1 h-14 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={18} /> 戻る
            </button>
          )}
          {step < 3 ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              className="flex-[2] h-14 rounded-2xl bg-sky-600 text-white font-black shadow-lg shadow-sky-200 hover:bg-sky-700 transition-all flex items-center justify-center gap-2"
            >
              次へ進む <ArrowRight size={18} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              className="flex-[2] h-14 rounded-2xl bg-emerald-600 text-white font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <Check size={20} /> レビューを投稿する
            </motion.button>
          )}
        </div>
      </main>
    </div>
  );
};

// --- Sub-components ---

const Step1Env = ({ data, date, onDateChange, onChange }: any) => {
  const weatherOptions = [
    { id: 'sunny', icon: <Sun />, label: '晴天' },
    { id: 'cloudy', icon: <Cloud />, label: '曇り' },
    { id: 'rainy', icon: <CloudRain />, label: '雨' },
    { id: 'stormy', icon: <Zap />, label: '嵐' },
    { id: 'typhoon', icon: <Navigation />, label: '台風' },
    { id: 'spring_bloom', icon: <Droplets />, label: '春濁り' },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
        <span className="w-8 h-8 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm">1</span>
        いつ、どんな環境でしたか？
      </h2>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
          <Calendar size={12} /> 潜水日
        </p>
        <div className="relative">
          <input
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            className="w-full h-14 px-6 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-sky-500 font-bold outline-none transition-all text-slate-900"
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">天候</p>
        <div className="grid grid-cols-3 gap-3">
          {weatherOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => onChange({ weather: opt.id })}
              className={clsx(
                "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                data.weather === opt.id ? "bg-sky-50 border-sky-500 text-sky-600 ring-4 ring-sky-500/10" : "bg-white border-slate-100 text-slate-400"
              )}
            >
              {React.cloneElement(opt.icon as React.ReactElement<any>, { size: 24 })}
              <span className="text-[10px] font-black">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-orange-500"><Thermometer size={18} /><span className="text-xs font-black text-slate-700 uppercase">気温</span></div>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{data.airTemp}<span className="text-xs ml-1 text-slate-400 uppercase">°C</span></span>
          </div>
          <input type="range" min="0" max="45" value={data.airTemp} onChange={e => onChange({ airTemp: Number(e.target.value) })} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500" />
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-sky-500"><Droplets size={18} /><span className="text-xs font-black text-slate-700 uppercase">水温</span></div>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{data.waterTemp}<span className="text-xs ml-1 text-slate-400 uppercase">°C</span></span>
          </div>
          <input type="range" min="5" max="35" value={data.waterTemp} onChange={e => onChange({ waterTemp: Number(e.target.value) })} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-sky-500" />
        </div>
      </div>
    </div>
  );
};

const Step2Metrics = ({ data, onChange }: any) => {
  const flowOptions = [
    { id: 'none', label: 'なし' },
    { id: 'weak', label: '弱い' },
    { id: 'strong', label: '強い' },
    { id: 'drift', label: 'ドリフト' }
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
        <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm ring-1 ring-indigo-200">2</span>
        ポイントの特性
      </h2>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-end mb-6">
          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Activity size={12} /> 透明度</p><p className="text-3xl font-black text-slate-900">{data.visibility}<span className="text-lg ml-1 font-normal opacity-50">m</span></p></div>
          <div className="text-right">
            <span className={clsx("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm ring-1 ring-inset",
              data.visibility >= 25 ? "bg-emerald-50 text-emerald-600 ring-emerald-200" :
                data.visibility >= 10 ? "bg-sky-50 text-sky-600 ring-sky-200" :
                  "bg-amber-50 text-amber-600 ring-amber-200")}>
              {data.visibility >= 25 ? '抜けてる！' : data.visibility >= 10 ? '良好' : '濁り気味'}
            </span>
          </div>
        </div>
        <input type="range" min="2" max="50" value={data.visibility} onChange={(e) => onChange({ visibility: Number(e.target.value) })} className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-sky-500" />
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">マクロ狙い</span>
          <p className="text-sm font-black text-slate-900 bg-slate-50 px-4 py-1 rounded-full border border-slate-100 shadow-inner">
            {data.macroWideRatio < 30 ? 'じっくりマクロ' : data.macroWideRatio > 70 ? 'ワイド・景観' : 'バランス型'}
          </p>
          <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">ワイド狙い</span>
        </div>
        <input type="range" min="0" max="100" step="10" value={data.macroWideRatio} onChange={(e) => onChange({ macroWideRatio: Number(e.target.value) })} className="w-full h-3 bg-gradient-to-r from-orange-300 via-slate-100 to-sky-400 rounded-lg appearance-none cursor-pointer accent-slate-600" />
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">標準ポイント</span>
          <p className="text-sm font-black text-slate-900 bg-slate-50 px-4 py-1 rounded-full border border-slate-100 shadow-inner">
            {data.terrainIntensity < 30 ? 'ノーマル' : data.terrainIntensity > 70 ? '極地・洞窟' : '地形で遊ぶ'}
          </p>
          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">地形・沈船</span>
        </div>
        <input type="range" min="0" max="100" step="10" value={data.terrainIntensity || 0} onChange={(e) => onChange({ terrainIntensity: Number(e.target.value) })} className="w-full h-3 bg-gradient-to-r from-slate-200 to-indigo-500 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-indigo-500"><Anchor size={18} /><span className="text-xs font-black text-slate-700 uppercase">潜水水深</span></div>
            <span className="text-xl font-black text-slate-900 tabular-nums">{data.depthMin}-{data.depthMax}<span className="text-[10px] ml-1 font-normal opacity-50 uppercase">m</span></span>
          </div>
          <div className="space-y-4">
            <input type="range" min="0" max="40" value={data.depthMin} onChange={(e) => onChange({ depthMin: Math.min(Number(e.target.value), data.depthMax) })} className="w-full h-1.5 bg-slate-50 rounded-lg appearance-none accent-indigo-400" />
            <input type="range" min="0" max="40" value={data.depthMax} onChange={(e) => onChange({ depthMax: Math.max(Number(e.target.value), data.depthMin) })} className="w-full h-1.5 bg-slate-50 rounded-lg appearance-none accent-indigo-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">流れ</p>
          <div className="grid grid-cols-2 gap-2">
            {flowOptions.map(f => (
              <button key={f.id} onClick={() => onChange({ flow: f.id })} className={clsx("h-10 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-tighter",
                data.flow === f.id ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-white border-slate-50 text-slate-400 hover:border-slate-100")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">体感難易度</p>
        <div className="grid grid-cols-3 gap-3">
          {[{ id: 'easy', label: '余裕', icon: '😊' }, { id: 'normal', label: '普通', icon: '👌' }, { id: 'hard', label: '必死', icon: '😰' }].map(opt => (
            <button key={opt.id} onClick={() => onChange({ difficulty: opt.id })} className={clsx("p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-1",
              data.difficulty === opt.id ? "bg-sky-50 border-sky-500 text-sky-600 ring-4 ring-sky-500/10" : "bg-white border-slate-100 text-slate-500")}>
              <span className="text-xl">{opt.icon}</span><span className="text-[10px] font-black uppercase">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Step3Evaluation = ({ data, onChange, onRadarChange, onImageUpload, uploading, fileInputRef }: any) => {
  const radarData = useMemo(() => [
    { subject: '透明度', A: data.radar.visibility },
    { subject: '生物遭遇', A: data.radar.encounter },
    { subject: '地形満喫', A: data.radar.topography },
    { subject: '興奮度', A: data.radar.excite },
    { subject: '満足度', A: data.radar.satisfaction },
    { subject: '快適さ', A: data.radar.comfort },
  ], [data.radar]);

  const tags = ['ドリフト', '絶景', '魚群', '透明度抜群', '洞窟', 'ドロップオフ', '沈船', 'サンゴ', 'ハゼ', 'ウミウシ'];

  return (
    <div className="space-y-10 animate-fade-in">
      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
        <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm ring-1 ring-emerald-200">3</span>
        今回の感想・評価
      </h2>

      {/* Radar Chart Prototype */}
      <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative border border-slate-800 overflow-hidden group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.2),transparent_70%)] group-hover:bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.25),transparent_70%)] transition-all duration-700" />
        <div className="relative h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 900 }} />
              <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
              <Radar name="Review" dataKey="A" stroke="#818CF8" strokeWidth={3} fill="#818CF8" fillOpacity={0.6} animationDuration={800} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center mt-2 flex items-center justify-center gap-2">
          <Info size={12} className="text-slate-600" />
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Comprehensive Experience Analyzer</span>
        </div>
      </div>

      {/* Details Rating Grid */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10 flex items-center gap-2">
          <Star size={14} className="text-amber-400 fill-amber-400" />
          詳細評価 (1〜5点)
        </h3>
        <div className="space-y-8">
          <RadarRating label="総合的な満足度" value={data.radar.satisfaction} onChange={(v: number) => { onRadarChange({ satisfaction: v }); onChange({ rating: v }); }} color="amber" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10 pt-8 border-t border-slate-50">
            <RadarRating label="生物遭遇率" value={data.radar.encounter} onChange={(v: number) => onRadarChange({ encounter: v })} color="sky" />
            <RadarRating label="地形の満足度" value={data.radar.topography} onChange={(v: number) => onRadarChange({ topography: v })} color="orange" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10 pt-8 border-t border-slate-50">
            <RadarRating label="興奮度 / エキサイト" value={data.radar.excite} onChange={(v: number) => onRadarChange({ excite: v })} color="rose" />
            <RadarRating label="快適さ / 余裕度" value={data.radar.comfort} onChange={(v: number) => onRadarChange({ comfort: v })} color="indigo" />
          </div>

          <div className="pt-8 border-t border-slate-50 relative group">
            <RadarRating label="透明感 (自動計算済み)" value={data.radar.visibility} onChange={(v: number) => onRadarChange({ visibility: v })} color="slate" />
            <p className="mt-2 text-[9px] font-bold text-slate-300 uppercase tracking-tight flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Activity size={10} /> スライダーの値から自動反映されています
            </p>
          </div>
        </div>
      </div>

      {/* Media & Tags */}
      <div className="space-y-6">
        <div>
          <p className="text-slate-500 font-bold mb-4 px-1 flex items-center justify-between"><span className="flex items-center gap-2"><Camera size={16} /> 写真を追加</span><span className="text-[10px] text-slate-300 font-black">MAX 5</span></p>
          <div className="grid grid-cols-3 gap-3">
            {(data.images || []).map((url: string, idx: number) => (
              <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative group border-2 border-slate-100 shadow-sm transition-transform hover:scale-[1.02]"><img src={url} alt="Uploaded" className="w-full h-full object-cover" /></div>
            ))}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 transition-all hover:bg-slate-50 hover:border-sky-500 hover:text-sky-500 text-slate-300 bg-white shadow-sm">
              {uploading ? <Loader2 className="animate-spin text-sky-500" size={24} /> : <Camera size={24} />}
            </button>
          </div>
          <input type="file" ref={fileInputRef} onChange={onImageUpload} className="hidden" accept="image/*" multiple />
        </div>

        <div>
          <p className="text-slate-500 font-bold mb-4 px-1 flex items-center gap-2"><Tag size={16} /> タグを選択</p>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button key={tag} onClick={() => { const isSelected = (data.tags || []).includes(tag); const newTags = isSelected ? data.tags.filter((t: string) => t !== tag) : [...(data.tags || []), tag]; onChange({ tags: newTags }); }} className={clsx("px-4 py-2 rounded-xl text-[10px] font-black transition-all border shadow-sm", (data.tags || []).includes(tag) ? "bg-emerald-500 border-emerald-500 text-white shadow-emerald-100" : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200")}>#{tag}</button>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-slate-500 font-bold mb-4 px-1 flex items-center gap-2"><MessageSquare size={16} /> 自由な感想</p>
          <textarea value={data.comment} onChange={e => onChange({ comment: e.target.value })} placeholder="今日の海はどうでしたか？" className="w-full h-40 p-6 rounded-[2.5rem] border-2 border-slate-100 focus:border-sky-500 outline-none transition-all font-medium text-slate-700 bg-white shadow-inner placeholder-slate-300" />
        </div>
      </div>

      <div className="bg-slate-900/5 p-8 rounded-[3rem] border border-slate-200 border-dashed">
        <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest mb-6 flex items-center gap-2 underline underline-offset-4 decoration-sky-300 decoration-2"><Sparkles size={14} className="text-amber-500" /> レビュアー情報 (自己申告)</h4>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1"><Shield size={10} /> 指導団体</span>
              <select
                value={data.userOrgId}
                onChange={e => onChange({ userOrgId: e.target.value })}
                className="w-full h-8 bg-transparent text-[10px] font-black outline-none appearance-none cursor-pointer"
              >
                {CERTIFICATIONS.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1"><Star size={10} /> 認定ランク</span>
              <select
                value={data.userRank}
                onChange={e => onChange({ userRank: e.target.value })}
                className="w-full h-8 bg-transparent text-[10px] font-black outline-none appearance-none cursor-pointer"
              >
                {CERTIFICATIONS.find(o => o.id === data.userOrgId)?.ranks.map(rank => (
                  <option key={rank.id} value={rank.id}>{rank.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1"><Activity size={10} /> 経験本数</span>
            <div className="flex items-center gap-2">
              <input type="number" value={data.userLogsCount} onChange={e => onChange({ userLogsCount: Number(e.target.value) })} className="w-full h-8 font-black text-lg text-slate-900 bg-transparent outline-none tabular-nums" />
              <span className="text-xs font-bold text-slate-300">Dives</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RadarRating = ({ label, value, onChange, color = 'slate' }: any) => {
  const colorMap: any = {
    amber: 'bg-amber-400 text-slate-900 ring-amber-500/20',
    sky: 'bg-sky-500 text-white ring-sky-500/20',
    orange: 'bg-orange-500 text-white ring-orange-500/20',
    rose: 'bg-rose-500 text-white ring-rose-500/20',
    indigo: 'bg-indigo-500 text-white ring-indigo-500/20',
    slate: 'bg-slate-800 text-white ring-slate-800/20',
  };

  return (
    <div className="flex flex-col gap-4">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter decoration-slate-200">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(v => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={clsx(
              "flex-1 h-10 rounded-xl flex items-center justify-center transition-all text-xs font-black shadow-sm",
              v <= value ? colorMap[color] + " ring-4 scale-105 z-10" : "bg-slate-50 text-slate-200 hover:bg-slate-100"
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
};
