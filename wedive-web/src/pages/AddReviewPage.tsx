import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Sun, Cloud, CloudRain, Zap, Wind, Waves, Droplets,
  ArrowLeft, ArrowRight, Check, Star, X,
  Camera, Tag, MessageSquare, Info,
  AlertTriangle, Navigation, Anchor, Thermometer, Loader2
} from 'lucide-react';
import clsx from 'clsx';
import type { Review, ReviewRadar } from '../types';

export const AddReviewPage = () => {
  const { pointId } = useParams<{ pointId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const logId = queryParams.get('logId');

  const { points, logs, addReview, isAuthenticated } = useApp();
  const point = points.find(p => p.id === pointId);

  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Review>>({
    pointId,
    logId: logId || undefined,
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
    },
    radar: {
      encounter: 4,
      excite: 4,
      macro: 3,
      comfort: 4,
      visibility: 4,
    },
    tags: [],
    comment: '',
    images: []
  });

  if (!point) return <div className="p-8 text-center">Point not found</div>;
  if (!isAuthenticated) return <div className="p-8 text-center">ログインが必要です</div>;

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
      {/* Dynamic Header */}
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
        <div className="h-1.5 w-full bg-slate-100 italic relative overflow-hidden">
          <div
            className="absolute h-full bg-sky-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {step === 1 && (
          <StepEnvironment
            data={formData.condition!}
            onChange={(c) => setFormData(prev => ({ ...prev, condition: { ...prev.condition!, ...c } }))}
          />
        )}
        {step === 2 && (
          <StepMetrics
            data={formData.metrics!}
            radar={formData.radar!}
            onChange={(m) => setFormData(prev => ({ ...prev, metrics: { ...prev.metrics!, ...m } }))}
            onRadarChange={(r) => setFormData(prev => ({ ...prev, radar: { ...prev.radar!, ...r } }))}
          />
        )}
        {step === 3 && (
          <StepDetails
            data={formData}
            onChange={(d) => setFormData(prev => ({ ...prev, ...d }))}
            onImageUpload={handleImageUpload}
            uploading={uploading}
            fileInputRef={fileInputRef}
          />
        )}

        {/* Navigation Buttons */}
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
            <button
              onClick={handleNext}
              className="flex-[2] h-14 rounded-2xl bg-sky-600 text-white font-black shadow-lg shadow-sky-200 hover:bg-sky-700 transition-all flex items-center justify-center gap-2"
            >
              次へ進む <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex-[2] h-14 rounded-2xl bg-emerald-600 text-white font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 scale-105"
            >
              <Check size={20} /> レビューを投稿する
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

// --- Step 1: Environment Selection ---
const StepEnvironment = ({ data, onChange }: { data: any, onChange: (d: any) => void }) => {
  const weatherOptions = [
    { id: 'sunny', icon: <Sun />, label: '晴天' },
    { id: 'cloudy', icon: <Cloud />, label: '曇り' },
    { id: 'rainy', icon: <CloudRain />, label: '雨' },
    { id: 'stormy', icon: <Zap />, label: '嵐' },
    { id: 'typhoon', icon: <Navigation />, label: '台風' },
    { id: 'spring_bloom', icon: <Droplets />, label: '春濁り' },
  ];

  const waveOptions = [
    { id: 'none', label: 'ベタ凪' },
    { id: 'low', label: 'さざ波' },
    { id: 'high', label: 'うねり/高波' },
  ];

  return (
    <div className="space-y-10 animate-fade-in">
      <section>
        <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center text-sm font-bold">1</span>
          今日の環境は？
        </h2>

        <p className="text-slate-500 font-bold mb-4 px-1">天候</p>
        <div className="grid grid-cols-3 gap-3">
          {weatherOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => onChange({ weather: opt.id })}
              className={clsx(
                "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                data.weather === opt.id
                  ? "bg-sky-50 border-sky-500 text-sky-600 ring-4 ring-sky-500/10"
                  : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
              )}
            >
              {React.cloneElement(opt.icon as React.ReactElement<any>, { size: 24 })}
              <span className="text-xs font-black">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-slate-500 font-bold mb-4 px-1">海況（波・うねり）</p>
        <div className="space-y-2">
          {waveOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => onChange({ wave: opt.id })}
              className={clsx(
                "w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between font-bold",
                data.wave === opt.id
                  ? "bg-sky-50 border-sky-500 text-sky-600"
                  : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
              )}
            >
              <span>{opt.label}</span>
              {data.wave === opt.id && <Check size={18} />}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">気温</label>
          <div className="flex items-center gap-3">
            <Thermometer size={20} className="text-orange-400" />
            <input
              type="number"
              value={data.airTemp}
              onChange={e => onChange({ airTemp: Number(e.target.value) })}
              className="w-full text-2xl font-black text-slate-900 bg-transparent focus:outline-none"
            />
            <span className="text-slate-400 font-black">°C</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">水温</label>
          <div className="flex items-center gap-3">
            <Droplets size={20} className="text-sky-400" />
            <input
              type="number"
              value={data.waterTemp}
              onChange={e => onChange({ waterTemp: Number(e.target.value) })}
              className="w-full text-2xl font-black text-slate-900 bg-transparent focus:outline-none"
            />
            <span className="text-slate-400 font-black">°C</span>
          </div>
        </div>
      </section>
    </div>
  );
};

// --- Step 2: Metrics & Radar ---
const StepMetrics = ({ data, radar, onChange, onRadarChange }: { data: any, radar: any, onChange: (d: any) => void, onRadarChange: (r: any) => void }) => {
  return (
    <div className="space-y-10 animate-fade-in">
      <section>
        <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
          海のポテンシャル計測
        </h2>

        <div className="space-y-12">
          {/* Transparency Slider */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">透明度</p>
                <p className="text-3xl font-black text-slate-900">{data.visibility}<span className="text-lg ml-1">m</span></p>
              </div>
              <div className="text-right">
                <span className={clsx(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                  data.visibility > 20 ? "bg-emerald-100 text-emerald-600" :
                    data.visibility > 10 ? "bg-sky-100 text-sky-600" : "bg-amber-100 text-amber-600"
                )}>
                  {data.visibility > 20 ? '抜けてる！' : data.visibility > 10 ? '良好' : '普通'}
                </span>
              </div>
            </div>
            <input
              type="range" min="0" max="50" step="1"
              value={data.visibility}
              onChange={(e) => onChange({ visibility: Number(e.target.value) })}
              className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          {/* Macro Wide Slider */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black text-slate-400">マクロ</span>
              <span className="text-sm font-black text-slate-900">
                {data.macroWideRatio < 40 ? 'じっくり観察' : data.macroWideRatio > 60 ? 'ワイド・景観' : 'バランス型'}
              </span>
              <span className="text-xs font-black text-slate-400">ワイド</span>
            </div>
            <input
              type="range" min="0" max="100" step="10"
              value={data.macroWideRatio}
              onChange={(e) => onChange({ macroWideRatio: Number(e.target.value) })}
              className="w-full h-3 bg-gradient-to-r from-orange-300 via-slate-200 to-sky-400 rounded-lg appearance-none cursor-pointer accent-slate-600"
            />
          </div>

          {/* Difficulty Buttons */}
          <section>
            <p className="text-slate-500 font-bold mb-4 px-1">体感難易度</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'easy', label: '余裕', icon: '😊' },
                { id: 'normal', label: '普通', icon: '👌' },
                { id: 'hard', label: '必死', icon: '😰' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => onChange({ difficulty: opt.id })}
                  className={clsx(
                    "p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-1",
                    data.difficulty === opt.id
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-white border-slate-100 text-slate-500"
                  )}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-xs font-black">{opt.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>

      {/* Radar Metrics Helper (Simple Selectors for now) */}
      <section className="bg-slate-900 p-8 rounded-[3rem] text-white">
        <h3 className="text-lg font-black mb-6 flex items-center gap-2">
          <Star size={20} className="text-amber-400 fill-amber-400" />
          5象限評価スコア
        </h3>
        <div className="space-y-6">
          <RadarRating label="生物遭遇度" value={radar.encounter} onChange={(v) => onRadarChange({ encounter: v })} />
          <RadarRating label="ワイド/エキサイト" value={radar.excite} onChange={(v) => onRadarChange({ excite: v })} />
          <RadarRating label="マクロ/じっくり" value={radar.macro} onChange={(v) => onRadarChange({ macro: v })} />
          <RadarRating label="快適度" value={radar.comfort} onChange={(v) => onRadarChange({ comfort: v })} />
          <RadarRating label="透明度スコア" value={radar.visibility} onChange={(v) => onRadarChange({ visibility: v })} />
        </div>
      </section>
    </div>
  );
};

const RadarRating = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs font-bold text-white/60">{label}</span>
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onChange(star)}
          className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            star <= value ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white/30 hover:bg-white/20"
          )}
        >
          <span className="text-xs font-black">{star}</span>
        </button>
      ))}
    </div>
  </div>
);

// --- Step 3: Details & Logs ---
const StepDetails = ({
  data,
  onChange,
  onImageUpload,
  uploading,
  fileInputRef
}: {
  data: any,
  onChange: (d: any) => void,
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
  uploading: boolean,
  fileInputRef: React.RefObject<HTMLInputElement | null>
}) => {
  const { logs } = useApp();

  const tags = [
    'サメ', 'エイ', 'ウミガメ', '地形', '洞窟', 'ドロップオフ', '沈船', 'サンゴ', '群れ', 'ハゼ', 'ウミウシ'
  ];

  return (
    <div className="space-y-10 animate-fade-in">
      <section>
        <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-sm font-bold">3</span>
          最後の一押し
        </h2>

        <div className="space-y-8">
          {/* Photo Upload */}
          <div>
            <p className="text-slate-500 font-bold mb-4 px-1 flex items-center justify-between">
              <span className="flex items-center gap-2"><Camera size={16} /> 写真を追加</span>
              <span className="text-[10px] text-slate-400">最大5枚</span>
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(data.images || []).map((url: string, idx: number) => (
                <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative group border-2 border-slate-100 shadow-sm">
                  <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      const newImgs = data.images.filter((_: any, i: number) => i !== idx);
                      onChange({ images: newImgs });
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-slate-900/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {(!data.images || data.images.length < 5) && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-sky-500 hover:text-sky-500 transition-all bg-white"
                >
                  {uploading ? (
                    <Loader2 size={24} className="animate-spin text-sky-500" />
                  ) : (
                    <>
                      <Camera size={24} />
                      <span className="text-[10px] font-black uppercase tracking-tighter">追加</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImageUpload}
              className="hidden"
              accept="image/*"
              multiple
            />
          </div>

          {/* Tag Selection */}
          <div>
            <p className="text-slate-500 font-bold mb-4 px-1 flex items-center gap-2">
              <Tag size={16} /> 特徴的な遭遇
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const isSelected = data.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const newTags = isSelected
                        ? data.tags.filter((t: string) => t !== tag)
                        : [...data.tags, tag];
                      onChange({ tags: newTags });
                    }}
                    className={clsx(
                      "px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                      isSelected
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200"
                        : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                    )}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div>
            <p className="text-slate-500 font-bold mb-4 px-1 flex items-center gap-2">
              <MessageSquare size={16} /> 自由な感想
            </p>
            <textarea
              value={data.comment}
              onChange={e => onChange({ comment: e.target.value })}
              placeholder="今日のポイントはどうでしたか？（見どころ、混雑状況など）"
              className="w-full h-40 p-6 rounded-3xl border-2 border-slate-100 focus:border-sky-500 focus:outline-none transition-all font-medium text-slate-700 placeholder-slate-300 bg-white"
            />
          </div>

          {/* Satisfy */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">総合満足度</p>
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => onChange({ rating: star })}
                  className="transition-transform active:scale-90"
                >
                  <Star
                    size={40}
                    className={clsx(
                      "transition-all duration-300",
                      star <= data.rating ? "text-amber-400 fill-amber-400 drop-shadow-lg" : "text-slate-100"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Log Link */}
          <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200 border-dashed">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center">
                <Check size={16} />
              </div>
              <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">既存のログと連携</h4>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-medium">ログと紐付けることで「Verified Log（潜水証明あり）」バッジが付与され、データの説得力が向上します。</p>
            <select
              value={data.logId || ''}
              onChange={e => onChange({ logId: e.target.value })}
              className="w-full h-12 px-4 rounded-xl bg-white border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">（選択しない）</option>
              {logs.filter(l => l.location.pointId === data.pointId).map(l => (
                <option key={l.id} value={l.id}>{l.date} #{l.diveNumber}のログ</option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </div>
  );
};
