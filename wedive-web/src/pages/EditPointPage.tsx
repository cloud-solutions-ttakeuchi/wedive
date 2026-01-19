import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ChevronLeft, MapPin, Camera, Info, Anchor, Mountain, Sparkles, Loader2 } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { MapPickerModal } from '../components/MapPickerModal';
import { HierarchicalAreaSelector } from '../components/HierarchicalAreaSelector';
import { auth } from '../lib/firebase';
import { FEATURE_FLAGS } from '../config/features';

export const EditPointPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { points, updatePoint, isAuthenticated, currentUser, addPointProposal, regions, zones, areas } = useApp();

  const existingPoint = points.find((p: any) => p.id === id);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    zone: '',
    area: '',
    regionId: '',
    zoneId: '',
    areaId: '',
    level: 'Beginner',
    maxDepth: '',
    entryType: 'boat',
    current: 'none',
    topography: [] as string[],
    description: '',
    features: '',
    lat: '',
    lng: '',
    googlePlaceId: undefined as string | undefined,
    formattedAddress: undefined as string | undefined,
    images: [] as string[],
  });

  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isVerifiedAI, setIsVerifiedAI] = useState(false);
  const [groundingSources, setGroundingSources] = useState<string[]>([]);

  useEffect(() => {
    if (existingPoint) {
      // eslint-disable-next-line
      setFormData({
        name: existingPoint.name,
        region: existingPoint.region,
        zone: existingPoint.zone,
        area: existingPoint.area,
        regionId: existingPoint.regionId || '',
        zoneId: existingPoint.zoneId || '',
        areaId: existingPoint.areaId || '',
        level: existingPoint.level,
        maxDepth: existingPoint.maxDepth.toString(),
        entryType: existingPoint.entryType,
        current: existingPoint.current,
        topography: existingPoint.topography,
        description: existingPoint.description,
        features: existingPoint.features.join(', '),
        lat: existingPoint.coordinates?.lat.toString() || '',
        lng: existingPoint.coordinates?.lng.toString() || '',
        googlePlaceId: existingPoint.googlePlaceId,
        formattedAddress: existingPoint.formattedAddress,
        images: existingPoint.images || [],
      });
    }
  }, [existingPoint]);

  if (!isAuthenticated) {
    return <div className="p-8 text-center bg-gray-50 min-h-screen">Please login to edit points.</div>;
  }

  if (!existingPoint) {
    return <div className="p-8 text-center bg-gray-50 min-h-screen">Loading...</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleTopographyChange = (type: string) => {
    setFormData((prev: any) => {
      const newTopography = prev.topography.includes(type)
        ? prev.topography.filter((t: string) => t !== type)
        : [...prev.topography, type];
      return { ...prev, topography: newTopography };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    try {
      const compressedImages = await Promise.all(
        files.map((file: File) => compressImage(file))
      );
      setFormData((prev: any) => ({
        ...prev,
        images: [...prev.images, ...compressedImages]
      }));
    } catch (error) {
      console.error('Image compression failed:', error);
      alert('画像の処理に失敗しました。');
    }
  };

  const removePhoto = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      images: prev.images.filter((_: any, i: number) => i !== index)
    }));
  };

  const getDiff = (current: any, original: any): any => {
    const diff: any = {};
    const keys = Object.keys(current);
    for (const key of keys) {
      if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
        diff[key] = current[key];
      }
    }
    return diff;
  };

  const handleAIAutoFill = async () => {
    if (!formData.name.trim()) return;
    setIsLoadingAI(true);
    setIsVerifiedAI(false);
    setGroundingSources([]);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Unauthenticated");

      const response = await fetch('/api/spot-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ data: { spotName: formData.name } })
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const result = await response.json();
      const aiResult = result.result;

      if (!aiResult) throw new Error("No data returned from AI");

      // Resolve IDs
      let rId = formData.regionId;
      let zId = formData.zoneId;
      let aId = formData.areaId;
      let rName = formData.region;
      let zName = formData.zone;
      let aName = formData.area;

      const regionObj = regions.find((r: any) => r.name === aiResult.region);
      if (regionObj) {
        rId = regionObj.id;
        rName = regionObj.name;
        const zoneObj = zones.find((z: any) => z.name === aiResult.zone && z.regionId === rId);
        if (zoneObj) {
          zId = zoneObj.id;
          zName = zoneObj.name;
          const areaObj = areas.find((a: any) => a.name === aiResult.area && a.zoneId === zId);
          if (areaObj) {
            aId = areaObj.id;
            aName = areaObj.name;
          }
        }
      }

      setFormData((prev: any) => ({
        ...prev,
        level: aiResult.level === '初級' ? 'Beginner' : aiResult.level === '中級' ? 'Intermediate' : 'Advanced',
        maxDepth: String(aiResult.max_depth || prev.maxDepth),
        entryType: aiResult.entry === 'ビーチ' ? 'beach' : aiResult.entry === 'ボート' ? 'boat' : 'entry_easy',
        current: aiResult.flow === 'なし' ? 'none' : aiResult.flow === '弱' ? 'weak' : aiResult.flow === '強' ? 'strong' : 'drift',
        topography: aiResult.terrain || prev.topography,
        lat: aiResult.latitude ? String(aiResult.latitude) : prev.lat,
        lng: aiResult.longitude ? String(aiResult.longitude) : prev.lng,
        description: aiResult.description || prev.description,
        features: (aiResult.tags || []).join(', '),
        // Location
        regionId: rId, zoneId: zId, areaId: aId,
        region: rName, zone: zName, area: aName
      }));

      // Verification
      if (aiResult.is_verified) {
        setIsVerifiedAI(true);
        setGroundingSources(aiResult.sources || []);
      }

    } catch (error) {
      console.error("AI Auto-fill failed:", error);
      alert("AIによる自動入力に失敗しました。");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const VerifiedBadge = () => (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-[10px] font-bold text-green-700 border border-green-200 animate-fade-in">
      <Sparkles size={10} className="text-green-600" />
      Google Search 検証済み
    </div>
  );

  const GroundingSources = () => (
    <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100 animate-fade-in">
      <div className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
        <Info size={10} /> 引用元ソース
      </div>
      <ul className="space-y-0.5">
        {groundingSources.map((source, i) => (
          <li key={i} className="text-[10px] text-blue-600 truncate hover:underline cursor-pointer">
            <a href={source} target="_blank" rel="noopener noreferrer">{source}</a>
          </li>
        ))}
      </ul>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      const fullUpdateState: any = {
        name: formData.name,
        region: formData.region,
        zone: formData.zone,
        area: formData.area,
        regionId: formData.regionId,
        zoneId: formData.zoneId,
        areaId: formData.areaId,
        level: formData.level as any,
        maxDepth: Number(formData.maxDepth),
        entryType: formData.entryType as any,
        current: formData.current as any,
        topography: formData.topography,
        description: formData.description,
        features: formData.features.split(',').map((f: string) => f.trim()).filter(Boolean),
        coordinates: (formData.lat && formData.lng) ? {
          lat: Number(formData.lat),
          lng: Number(formData.lng)
        } : undefined,
        googlePlaceId: formData.googlePlaceId,
        formattedAddress: formData.formattedAddress,
        images: formData.images,
        imageUrl: formData.images.length > 0 ? formData.images[0] : (existingPoint.imageUrl || '/images/seascape.png'), // Fallback updated
      };

      // Remove undefined fields to prevent Firestore errors
      Object.keys(fullUpdateState).forEach(key =>
        fullUpdateState[key] === undefined && delete fullUpdateState[key]
      );

      if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        await updatePoint(id, fullUpdateState);
        alert('ポイント情報を更新しました！');
        navigate(`/point/${id}`);
      } else {
        // Proposal
        const diff = getDiff(fullUpdateState, existingPoint);
        // Clean undefined
        Object.keys(diff).forEach((key: string) => diff[key] === undefined && delete (diff as any)[key]);

        if (Object.keys(diff).length === 0) {
          alert('変更点がありません。');
          return;
        }

        await addPointProposal({
          targetId: id,
          proposalType: 'update',
          diffData: diff,
          name: existingPoint.name,
          imageUrl: existingPoint.imageUrl,
        } as any);

        alert('編集提案を送信しました！管理者の承認をお待ちください。');
        navigate(`/point/${id}`);
      }
    } catch (error) {
      console.error('Point update failed:', error);
      alert('処理に失敗しました。入力内容を確認してください。');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {isMapOpen && (
        <MapPickerModal
          initialLat={formData.lat}
          initialLng={formData.lng}
          initialSearchQuery={formData.name || existingPoint.name} // Use point name as initial query
          onConfirm={(lat, lng, placeId, address) => {
            setFormData((prev: any) => ({
              ...prev,
              lat,
              lng,
              googlePlaceId: placeId,
              formattedAddress: address
            }));
            setIsMapOpen(false);
          }}
          onClose={() => setIsMapOpen(false)}
        />
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/point/${id}`} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">ポイント編集</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Basic Info */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <MapPin size={20} className="text-blue-500" /> 基本情報
              {isVerifiedAI && <VerifiedBadge />}
            </h2>
            {isVerifiedAI && groundingSources.length > 0 && <GroundingSources />}

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-gray-700">ポイント名</label>
                {(FEATURE_FLAGS.ENABLE_V2_AI_AUTO_FILL || currentUser?.role === 'admin') && (
                  <button
                    type="button"
                    onClick={handleAIAutoFill}
                    disabled={!formData.name.trim() || isLoadingAI}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-900 transition-all bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 active:scale-95"
                  >
                    {isLoadingAI ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    AIで自動入力
                  </button>
                )}
              </div>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 秘密のビーチ"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <HierarchicalAreaSelector
                regionId={formData.regionId}
                zoneId={formData.zoneId}
                areaId={formData.areaId}
                onRegionChange={(id) => {
                  const r = regions.find((x: any) => x.id === id);
                  setFormData((prev: any) => ({ ...prev, regionId: id, region: r?.name || '', zoneId: '', zone: '', areaId: '', area: '' }));
                }}
                onZoneChange={(id) => {
                  const z = zones.find((x: any) => x.id === id);
                  setFormData((prev: any) => ({ ...prev, zoneId: id, zone: z?.name || '', areaId: '', area: '' }));
                }}
                onAreaChange={(id) => {
                  const a = areas.find((x: any) => x.id === id);
                  setFormData((prev: any) => ({ ...prev, areaId: id, area: a?.name || '' }));
                }}
                className="mb-4"
              />
            </div>

            {/* Location Picker */}
            <div className="pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">正確な位置 (Google Maps)</label>
              {formData.lat && formData.lng ? (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-3 flex items-start gap-3">
                  <div className="bg-white p-2 rounded-full text-blue-500 shadow-sm shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm mb-1">位置情報が設定されています</div>
                    <div className="text-xs text-gray-500 font-mono mb-1">{formData.lat}, {formData.lng}</div>
                    {formData.formattedAddress && (
                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        {formData.formattedAddress}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-3 text-center text-sm text-gray-500">
                  位置情報が未設定です
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsMapOpen(true)}
                className="w-full py-3 bg-white border-2 border-dashed border-blue-300 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                <MapPin size={18} />
                地図から位置を編集する
              </button>
            </div>
          </section>

          {/* Attributes */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Info size={20} className="text-purple-500" /> 特徴・レベル
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">レベル</label>
                <select name="level" value={formData.level} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="Beginner">初級</option>
                  <option value="Intermediate">中級</option>
                  <option value="Advanced">上級</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最大水深 (m)</label>
                <input
                  type="number"
                  name="maxDepth"
                  value={formData.maxDepth}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">エントリー</label>
                <select name="entryType" value={formData.entryType} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="beach">ビーチ</option>
                  <option value="boat">ボート</option>
                  <option value="entry_easy">エントリー容易</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">流れ</label>
                <select name="current" value={formData.current} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="none">なし</option>
                  <option value="weak">弱</option>
                  <option value="strong">強</option>
                  <option value="drift">ドリフト必須</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">地形 (複数選択可)</label>
              <div className="flex flex-wrap gap-2">
                {['sand', 'rock', 'dropoff', 'cave', 'muck', 'coral'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTopographyChange(type)}
                    className={`px-3 py-1 rounded-full text-sm border ${formData.topography.includes(type)
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-600'
                      }`}
                  >
                    {type === 'sand' ? '砂地' : type === 'rock' ? '岩場' : type === 'dropoff' ? 'ドロップオフ' : type === 'cave' ? '洞窟' : type === 'muck' ? '泥地' : 'サンゴ'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Details */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Mountain size={20} className="text-green-500" /> 詳細情報
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none resize-none"
                placeholder="ポイントの魅力や特徴を入力してください..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">特徴タグ (カンマ区切り)</label>
              <input
                type="text"
                name="features"
                value={formData.features}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                placeholder="例: カメが見れる, 光が綺麗, マクロ派向け"
              />
            </div>
          </section>

          {/* Photos */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Camera size={20} className="text-gray-500" /> 写真
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('point-photos-upload')?.click()}
              >
                <Camera size={24} className="mb-1" />
                <span className="text-xs">写真を追加</span>
                <input
                  type="file"
                  id="point-photos-upload"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
              {formData.images.map((photo: string, index: number) => (
                <div key={index} className="aspect-square rounded-xl overflow-hidden relative group">
                  <img src={photo} alt={`Point photo ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Anchor size={12} className="rotate-45" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-4 pt-4">
            <Link to={`/point/${id}`} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              className="px-8 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5"
            >
              {(currentUser.role === 'admin' || currentUser.role === 'moderator') ? '更新する' : '変更を提案する'}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
};
