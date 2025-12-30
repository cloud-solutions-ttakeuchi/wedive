import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { storage, db as firestore } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ja } from 'date-fns/locale/ja';
import {
  Sun, Cloud, CloudRain, Zap, Droplets,
  ArrowLeft, ArrowRight, Check, Star, X,
  Camera, Tag, MessageSquare,
  Navigation, Thermometer, Loader2, Calendar,
  Anchor, Sparkles,
  Activity, Info, Shield,
  Search, Map, Wind
} from 'lucide-react';

registerLocale('ja', ja);
import { CERTIFICATIONS } from '../constants/masterData';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Review } from '../types';

export const AddReviewPage = () => {
  const { pointId, reviewId } = useParams<{ pointId?: string, reviewId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const logId = queryParams.get('logId');

  const { points, logs, currentUser, addReview, updateReview, isAuthenticated, updateUser, reviews, proposalReviews } = useApp();
  const isEdit = !!reviewId;
  const existingReview = isEdit ? (reviews.find(r => r.id === reviewId) || proposalReviews.find(r => r.id === reviewId)) : null;

  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [loadingReview, setLoadingReview] = useState(isEdit);
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
      wind: '',
    },
    metrics: {
      visibility: 15,
      flow: 'none',
      difficulty: 'normal',
      macroWideRatio: 50,
      terrainIntensity: 50,
      depthAvg: 10,
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
    userOrgId: (currentUser?.certification?.orgId || 'padi').toLowerCase(),
    userRank: (currentUser?.certification?.rankId || 'entry').toLowerCase(),
    userLogsCount: logs.length || 0,
  });

  // Derive point from available data (URL params or loaded review data)
  const point = useMemo(() => {
    const pid = isEdit ? (existingReview?.pointId || formData.pointId) : pointId;
    if (!pid) return null;
    return points.find(p => p.id === pid);
  }, [isEdit, existingReview?.pointId, formData.pointId, pointId, points]);

  // Ensure existingReview is loaded (including direct fetch if not in context) & Merge Log Data
  useEffect(() => {
    let active = true;

    const mergeLogData = (baseData: Partial<Review>) => {
      if (!logId || logs.length === 0) return baseData;
      const log = logs.find(l => l.id === logId);
      if (!log) return baseData;

      console.log("Merging latest log data into review form");
      return {
        ...baseData,
        date: log.date,
        condition: {
          ...baseData.condition!,
          weather: log.condition?.weather || baseData.condition!.weather,
          wave: log.condition?.wave || baseData.condition!.wave,
          airTemp: log.condition?.airTemp || baseData.condition!.airTemp,
          waterTemp: log.condition?.waterTemp?.surface || baseData.condition!.waterTemp,
        },
        metrics: {
          ...baseData.metrics!,
          visibility: log.condition?.transparency || baseData.metrics!.visibility,
          flow: log.condition?.current || baseData.metrics!.flow as any,
          depthAvg: log.depth?.average || baseData.metrics!.depthAvg,
          depthMax: log.depth?.max || baseData.metrics!.depthMax,
        }
      };
    };

    if (isEdit && reviewId && !isDataLoaded) {
      const found = reviews.find(r => r.id === reviewId) || proposalReviews.find(r => r.id === reviewId);
      if (found) {
        setFormData(mergeLogData({ ...found, pointId: found.pointId }));
        setIsDataLoaded(true);
        setLoadingReview(false);
      } else {
        // Fallback: Fetch directly from Firestore
        const fetchReview = async () => {
          setLoadingReview(true);
          try {
            const docRef = doc(firestore, 'reviews', reviewId);
            const docSnap = await getDoc(docRef);
            if (active && docSnap.exists()) {
              const data = { ...docSnap.data(), id: docSnap.id } as Review;
              setFormData(mergeLogData({ ...data, pointId: data.pointId }));
              setIsDataLoaded(true);
            }
          } catch (e) {
            console.error("Failed to fetch review directly:", e);
          } finally {
            if (active) setLoadingReview(false);
          }
        };
        fetchReview();
      }
    } else if (!isEdit && logId && !loadingReview) {
      // [New] Check if a review already exists for this log (Recovery for broken links)
      // Only run if not already loading and not in edit mode
      const checkExisting = async () => {
        try {
          // Check local state first
          const localFound = reviews.find(r => r.logId === logId);
          if (localFound) {
            console.log("Found existing review locally for log, redirecting:", localFound.id);
            navigate(`/add-review/${pointId || localFound.pointId}/${localFound.id}?logId=${logId}`, { replace: true });
            return;
          }

          // Check Firestore
          const q = query(collection(firestore, 'reviews'), where('logId', '==', logId));
          const snap = await getDocs(q);
          if (active && !snap.empty) {
            const foundId = snap.docs[0].id;
            console.log("Found existing review in Firestore for log, redirecting:", foundId);
            navigate(`/add-review/${pointId || snap.docs[0].data().pointId}/${foundId}?logId=${logId}`, { replace: true });
            return;
          }

          // If really new, merge log data to initial form
          if (active) {
            setFormData(prev => mergeLogData(prev));
          }
        } catch (e) {
          console.error("Failed to check existing review:", e);
        }
      }
      checkExisting();
    }
    return () => { active = false; };
  }, [isEdit, reviewId, reviews, proposalReviews, isDataLoaded, logId, navigate, pointId, loadingReview, logs]);

  if (isEdit && loadingReview) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-sky-500" size={32} />
      <p className="text-slate-400 font-bold">データを読み込み中...</p>
    </div>
  );
  if (isEdit && !formData.id) return <div className="p-8 text-center text-slate-500 font-bold">レビューが見つかりません</div>;
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
      if (isEdit && reviewId) {
        await updateReview(reviewId, formData);
      } else {
        await addReview(formData as any);
      }

      // Also update user profile with latest certification
      if (currentUser && currentUser.id !== 'guest') {
        const orgId = formData.userOrgId || 'padi';
        const rankId = formData.userRank || 'entry';

        await updateUser({
          certification: {
            orgId: orgId.toLowerCase(),
            rankId: rankId.toLowerCase(),
            date: currentUser.certification?.date || new Date().toISOString().split('T')[0]
          }
        });
      }

      alert(isEdit ? 'レビューを更新しました！' : 'レビューを投稿しました！');
      navigate(`/point/${point?.id || pointId}`);
    } catch (error) {
      console.error('Submit failed:', error);
      alert('投稿に失敗しました');
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
        {isEdit && existingReview && (
          <div className="mb-8 p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <MessageSquare size={48} />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                <Shield size={12} /> Editing Original Data
              </span>
              <p className="font-bold text-slate-100 italic leading-relaxed">
                「{formData.comment || '（コメントなし）'}」
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-[9px] font-black bg-slate-800 text-slate-400 px-2 py-1 rounded-lg uppercase tracking-tight border border-slate-700">BY {existingReview.userName}</span>
                <span className="text-[9px] font-black bg-slate-800 text-slate-400 px-2 py-1 rounded-lg uppercase tracking-tight border border-slate-700">{existingReview.date}</span>
              </div>
            </div>
          </div>
        )}

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

                  // Sync Topography Radar with Terrain Intensity
                  if (m.terrainIntensity !== undefined) {
                    newRadar.topography = Math.min(5, Math.floor(m.terrainIntensity / 20) + 1);
                  }

                  return { ...prev, metrics: newMetrics, radar: newRadar };
                })}
              />
            )}
            {step === 3 && (
              <Step3Evaluation
                data={formData}
                onChange={(d: any) => setFormData(prev => ({ ...prev, ...d }))}
                onRadarChange={(d: any) => setFormData(prev => ({ ...prev, radar: { ...prev.radar!, ...d } }))}
                onImageUpload={handleImageUpload}
                uploading={uploading}
                fileInputRef={fileInputRef}
                isAdmin={currentUser.role === 'admin' || currentUser.role === 'moderator'}
                isEdit={isEdit}
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
              <Check size={20} /> {isEdit ? '内容を更新する' : 'レビューを投稿する'}
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

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:shadow-md relative">
        <div className="flex justify-between items-center mb-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={12} /> 潜水日
          </p>
          <div className="flex gap-2">
            {[
              { label: '今日', offset: 0, color: 'text-sky-600 bg-sky-50' },
              { label: '昨日', offset: 1, color: 'text-amber-600 bg-amber-50' },
              {
                label: '先週末',
                getOffset: () => {
                  const d = new Date();
                  const day = d.getDay();
                  return day === 0 ? 1 : day === 6 ? 0 : day + 1;
                },
                color: 'text-indigo-600 bg-indigo-50'
              }
            ].map(chip => {
              const d = new Date();
              const offset = ('offset' in chip) ? (chip.offset as number) : (chip as any).getOffset();
              d.setDate(d.getDate() - offset);
              const chipIso = d.toISOString().split('T')[0];
              const isActive = date === chipIso;

              return (
                <button
                  key={chip.label}
                  onClick={() => onDateChange(chipIso)}
                  className={clsx(
                    "px-3 py-1 rounded-full text-[10px] font-black transition-all hover:scale-105 active:scale-95 shadow-sm ring-1 ring-inset",
                    isActive ? `${chip.color} ring-current` : "bg-white text-slate-400 ring-slate-200"
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative group/datepicker">
          <ReactDatePicker
            selected={date ? new Date(date) : null}
            onChange={(d: Date | null) => onDateChange(d ? d.toISOString().split('T')[0] : '')}
            dateFormat="yyyy年 MM月 dd日"
            locale="ja"
            className="w-full h-16 px-8 bg-slate-50 rounded-3xl border-2 border-transparent focus:border-sky-500 font-black outline-none transition-all text-slate-900 cursor-pointer text-xl shadow-inner text-center"
            placeholderText="日付を選択してください"
            wrapperClassName="w-full"
            maxDate={new Date()}
            showMonthDropdown={false}
            showYearDropdown={false}
            inline={false}
            autoFocus={false}
            portalId="root"
          />
          <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover/datepicker:text-sky-500 transition-colors">
            <Sparkles size={18} />
          </div>
        </div>

        {date && (
          <p className="mt-4 text-center text-[10px] font-bold text-sky-500 animate-in fade-in slide-in-from-top-1">
            素晴らしいダイビングの日ですね！
          </p>
        )}
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

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">波の状況</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'none', label: '穏やか', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
            { id: 'low', label: '低波', color: 'bg-sky-50 text-sky-600 border-sky-200' },
            { id: 'high', label: '高波', color: 'bg-rose-50 text-rose-600 border-rose-200' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => onChange({ wave: opt.id })}
              className={clsx(
                "py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                data.wave === opt.id ? opt.color + " ring-4 ring-current/10" : "bg-white border-slate-100 text-slate-400"
              )}
            >
              <span className="text-xs font-black">{opt.label}</span>
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

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">風の状況</p>
        <div className="flex gap-2">
          <Wind size={16} className="text-slate-400" />
          <input
            type="text"
            value={data.wind || ''}
            onChange={e => onChange({ wind: e.target.value })}
            placeholder="北東 3mなど"
            className="flex-1 bg-transparent border-b border-slate-200 focus:border-sky-500 outline-none text-sm font-bold pb-1"
          />
        </div>
      </div>
    </div>
  );
};

const Step2Metrics = ({ data, onChange }: any) => {

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
        <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm ring-1 ring-indigo-200">2</span>
        ポイントの特性
      </h2>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Activity size={48} className={clsx(
            data.visibility >= 25 ? "text-amber-500" :
              data.visibility >= 15 ? "text-emerald-500" : "text-sky-500"
          )} />
        </div>
        <div className="flex justify-between items-end mb-6 relative z-10">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Activity size={12} /> 透明度</p>
            <p className={clsx("text-4xl font-black tabular-nums transition-colors",
              data.visibility >= 25 ? "text-amber-500" :
                data.visibility >= 15 ? "text-emerald-500" : "text-slate-900"
            )}>
              {data.visibility}<span className="text-lg ml-1 font-normal opacity-50">m</span>
            </p>
          </div>
          <div className="text-right">
            <span className={clsx("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight shadow-md ring-1 ring-inset transition-all",
              data.visibility >= 25 ? "bg-amber-50 text-amber-600 ring-amber-200 animate-pulse" :
                data.visibility >= 15 ? "bg-emerald-50 text-emerald-600 ring-emerald-200" :
                  data.visibility >= 8 ? "bg-sky-50 text-sky-600 ring-sky-200" :
                    "bg-amber-50 text-amber-600 ring-amber-200")}>
              {data.visibility >= 25 ? '神の領域 (Godly)' :
                data.visibility >= 15 ? '抜群！ (Fantastic)' :
                  data.visibility >= 8 ? '良好 (Clear)' : '濁り気味 (Misty)'}
            </span>
          </div>
        </div>
        <div className="relative h-4 mt-8">
          <div className="absolute inset-0 bg-slate-100 rounded-full" />
          <motion.div
            className={clsx("absolute inset-y-0 left-0 rounded-full transition-colors duration-500",
              data.visibility >= 25 ? "bg-amber-400" :
                data.visibility >= 15 ? "bg-emerald-400" : "bg-sky-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${Math.pow(data.visibility / 50, 0.6) * 100}%` }}
          />
          <input
            type="range"
            min="2"
            max="50"
            value={data.visibility}
            onChange={(e) => onChange({ visibility: Number(e.target.value) })}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
        </div>
        <div className="flex justify-between mt-4 px-1 text-[10px] font-black text-slate-300">
          <span>0m</span>
          <span className={clsx(data.visibility >= 15 && "text-emerald-500 font-black")}>15m</span>
          <span className={clsx(data.visibility >= 25 && "text-amber-500 font-black")}>30m</span>
          <span>50m+</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Search size={48} className="text-orange-500" />
        </div>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-orange-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">マクロ・ワイド比率</span>
          </div>
          <p className="text-sm font-black text-slate-900 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100 shadow-sm ring-1 ring-slate-200/50">
            {data.macroWideRatio < 30 ? 'じっくりマクロ' : data.macroWideRatio > 70 ? 'ワイド・景観' : 'バランス型'}
          </p>
        </div>
        <div className="flex justify-between text-[10px] font-black mb-4 px-1">
          <span className="text-orange-500 uppercase">Macro Focus</span>
          <span className="text-sky-500 uppercase">Wide Field</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={data.macroWideRatio}
          onChange={(e) => onChange({ macroWideRatio: Number(e.target.value) })}
          className="w-full h-3 bg-gradient-to-r from-orange-200 via-slate-50 to-sky-200 rounded-full appearance-none cursor-pointer accent-slate-800 transition-all hover:h-4 focus:ring-4 focus:ring-slate-100"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Wind size={16} className="text-sky-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">潮流の強さ</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'none', label: 'なし' },
              { id: 'weak', label: '弱い' },
              { id: 'strong', label: '強い' },
              { id: 'drift', label: 'ドリフト' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => onChange({ flow: opt.id })}
                className={clsx(
                  "flex-1 py-3 px-2 rounded-xl text-[10px] font-black border transition-all",
                  data.flow === opt.id ? "bg-sky-500 border-sky-500 text-white shadow-lg" : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-amber-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">難易度</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'easy', label: '余裕' },
              { id: 'normal', label: '普通' },
              { id: 'hard', label: '必死' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => onChange({ difficulty: opt.id })}
                className={clsx(
                  "flex-1 py-3 px-2 rounded-xl text-[10px] font-black border transition-all",
                  data.difficulty === opt.id ? "bg-amber-500 border-amber-500 text-white shadow-lg" : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Map size={48} className="text-indigo-500" />
        </div>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Map size={16} className="text-indigo-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">地形・環境の激しさ</span>
          </div>
          <p className="text-sm font-black text-indigo-600 bg-indigo-50/50 px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm ring-1 ring-indigo-200/50">
            {data.terrainIntensity < 30 ? '標準的な構成' : data.terrainIntensity > 70 ? '極地・洞窟' : '地形で遊ぶ'}
          </p>
        </div>
        <div className="flex justify-between text-[10px] font-black mb-4 px-1">
          <span className="text-slate-400 uppercase">Standard</span>
          <span className="text-indigo-500 uppercase">Extreme Terrain</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={data.terrainIntensity || 0}
          onChange={(e) => onChange({ terrainIntensity: Number(e.target.value) })}
          className="w-full h-3 bg-gradient-to-r from-slate-50 to-indigo-100 rounded-full appearance-none cursor-pointer accent-indigo-600 transition-all hover:h-4 focus:ring-4 focus:ring-indigo-50"
        />
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
          <Anchor size={64} className="text-indigo-500" />
        </div>
        <div className="flex justify-between items-center mb-10 relative z-10">
          <div className="flex items-center gap-3">
            <Anchor size={24} className="text-indigo-500" />
            <h3 className="text-lg font-black text-slate-900 tracking-tight">潜水プロファイル (Depth)</h3>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-slate-900 tabular-nums">
              {data.depthAvg}
              <span className="text-lg mx-2 text-slate-300">/</span>
              {data.depthMax}
              <span className="text-sm ml-1 font-bold text-slate-400 uppercase">m</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">平均水深 (Average)</span>
              <span className="text-sm font-black text-indigo-600 tabular-nums bg-indigo-50 px-3 py-1 rounded-lg">{data.depthAvg}m</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="0.5"
              value={data.depthAvg}
              onChange={(e) => onChange({ depthAvg: Math.min(Number(e.target.value), data.depthMax) })}
              className="w-full h-4 bg-gradient-to-r from-indigo-50 via-indigo-100 to-indigo-50 rounded-full appearance-none cursor-pointer accent-indigo-500 transition-all hover:h-6 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">最大水深 (Maximum)</span>
              <span className="text-sm font-black text-rose-600 tabular-nums bg-rose-50 px-3 py-1 rounded-lg">{data.depthMax}m</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={data.depthMax}
              onChange={(e) => onChange({ depthMax: Math.max(Number(e.target.value), data.depthAvg) })}
              className="w-full h-4 bg-gradient-to-r from-rose-50 via-rose-100 to-rose-50 rounded-full appearance-none cursor-pointer accent-rose-500 transition-all hover:h-6 focus:ring-4 focus:ring-rose-100"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
          <Wind size={64} className="text-sky-500" />
        </div>
        <div className="flex items-center gap-3 mb-10 relative z-10">
          <Wind size={24} className="text-sky-500" />
          <h3 className="text-lg font-black text-slate-900 tracking-tight">水の流れ (Currents)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {[
            { id: 'none', label: 'なし (None)', icon: '〰', desc: '穏やかで静かな海' },
            { id: 'weak', label: '弱い (Weak)', icon: '🌬️', desc: '心地よい適度な流れ' },
            { id: 'strong', label: '強い (Strong)', icon: '🌪️', desc: '注意が必要な強い流れ' },
            { id: 'drift', label: '流す (Drift)', icon: '🚤', desc: '爽快なドリフト！' }
          ].map(f => (
            <motion.button
              key={f.id}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange({ flow: f.id })}
              className={clsx(
                "p-6 rounded-[2rem] border-2 transition-all text-left flex flex-col gap-4 relative overflow-hidden group/btn",
                data.flow === f.id
                  ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                  : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50 shadow-sm"
              )}
            >
              <div className={clsx(
                "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-transform group-hover/btn:scale-110",
                data.flow === f.id ? "bg-white/10" : "bg-slate-50"
              )}>
                {f.icon}
              </div>
              <div>
                <p className={clsx("font-black text-sm uppercase tracking-tight", data.flow === f.id ? "text-white" : "text-slate-900")}>{f.label}</p>
                <p className={clsx("text-[10px] font-bold mt-0.5", data.flow === f.id ? "text-slate-400" : "text-slate-400")}>{f.desc}</p>
              </div>
              {data.flow === f.id && (
                <div className="absolute top-1 right-1">
                  <div className="bg-sky-500 w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                    <Check size={14} className="text-white" />
                  </div>
                </div>
              )}
            </motion.button>
          ))}
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

const Step3Evaluation = ({ data, onChange, onRadarChange, onImageUpload, uploading, fileInputRef, isAdmin, isEdit }: any) => {
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
                onChange={e => {
                  const orgId = e.target.value.toLowerCase();
                  const firstRank = CERTIFICATIONS.find(o => o.id === orgId)?.ranks[0]?.id || '';
                  onChange({ userOrgId: orgId, userRank: firstRank });
                }}
                className="w-full h-8 bg-transparent text-[10px] font-black outline-none cursor-pointer"
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
                className="w-full h-8 bg-transparent text-[10px] font-black outline-none cursor-pointer"
              >
                {CERTIFICATIONS.find(o => o.id.toLowerCase() === (data.userOrgId || '').toLowerCase())?.ranks.map(rank => (
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

      {isAdmin && (
        <div className="bg-rose-50 p-8 rounded-[3rem] border border-rose-100 shadow-xl shadow-rose-100/20">
          <h4 className="font-black text-rose-900 uppercase text-[10px] tracking-widest mb-6 flex items-center gap-2">
            <Shield size={14} className="text-rose-500" /> 管理者専用設定
          </h4>
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm flex flex-col gap-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">公開ステータス</span>
              <div className="flex gap-2">
                {[
                  { id: 'pending', label: '保留', color: 'bg-amber-500 text-white' },
                  { id: 'approved', label: '承認', color: 'bg-emerald-500 text-white' },
                  { id: 'rejected', label: '却下/非公開', color: 'bg-rose-500 text-white' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => onChange({ status: opt.id })}
                    className={clsx(
                      "flex-1 py-3 rounded-xl text-xs font-black transition-all",
                      data.status === opt.id ? opt.color : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-rose-400 font-bold px-4 italic">
              ※ 管理者はコメント欄のショップ名や不適切な単語を直接伏せ字にするなど、編集が可能です。
            </p>
          </div>
        </div>
      )}
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
