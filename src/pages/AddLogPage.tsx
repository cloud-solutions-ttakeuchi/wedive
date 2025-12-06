import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ChevronLeft, Calendar, Clock, ArrowDown, Sun, Fish, Camera, Users, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DiveLog } from '../types';
import { compressImage } from '../utils/imageUtils';

export const AddLogPage = () => {
  const navigate = useNavigate();
  // Refactor: use points, creatures from context
  const { addLog, points, creatures, isAuthenticated } = useApp();

  // Note: points and creatures should be loaded in AppContext

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-2">ログインが必要です</h2>
          <p className="text-gray-500 mb-6">ログを登録するにはログインしてください。</p>
          <Link to="/" className="block w-full py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors">
            トップページへ戻る
          </Link>
        </div>
      </div>
    );
  }

  // Form State
  const [formData, setFormData] = useState({
    // Basic
    date: new Date().toISOString().split('T')[0],
    diveNumber: '',

    // Location
    pointId: points[0]?.id || '',
    shopName: '',
    region: '西伊豆', // Mock default

    // Team
    buddy: '',
    guide: '',
    members: '',

    // Dive Data
    entryTime: '10:00',
    exitTime: '10:45',
    maxDepth: '18',
    avgDepth: '12',

    // Conditions
    weather: 'sunny',
    airTemp: '25',
    waterTempSurface: '24',
    waterTempBottom: '22',
    transparency: '15',
    wave: 'none',
    current: 'none',
    surge: 'none',

    // Gear
    suitType: 'wet',
    suitThickness: '5',
    weight: '4',
    tankMaterial: 'steel',
    tankCapacity: '10',
    pressureStart: '200',
    pressureEnd: '50',

    // Style
    entryType: 'boat',

    // Content
    creatureId: '',
    sightedCreatures: [] as string[],
    comment: '',
    isPrivate: false,
    photos: [] as string[],
  });

  const handleSightedCreatureToggle = (creatureId: string) => {
    setFormData(prev => {
      const newSighted = prev.sightedCreatures.includes(creatureId)
        ? prev.sightedCreatures.filter(id => id !== creatureId)
        : [...prev.sightedCreatures, creatureId];
      return { ...prev, sightedCreatures: newSighted };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const selectedPoint = points.find(p => p.id === formData.pointId);
      const membersArray = formData.members.split(',').map(m => m.trim()).filter(Boolean);

      // Construct the DiveLog object
      const logData: Omit<DiveLog, 'id' | 'userId'> = {
        date: formData.date,
        diveNumber: Number(formData.diveNumber),
        location: {
          pointId: formData.pointId,
          pointName: selectedPoint?.name || 'Unknown',
          region: formData.region,
          shopName: formData.shopName,
        },
        team: {
          buddy: formData.buddy,
          guide: formData.guide,
          members: membersArray,
        },
        time: {
          entry: formData.entryTime,
          exit: formData.exitTime,
          duration: 45, // Should calculate diff
        },
        depth: {
          max: Number(formData.maxDepth),
          average: Number(formData.avgDepth),
        },
        condition: {
          weather: formData.weather as any,
          airTemp: Number(formData.airTemp),
          waterTemp: {
            surface: Number(formData.waterTempSurface),
            bottom: Number(formData.waterTempBottom),
          },
          transparency: Number(formData.transparency),
          wave: formData.wave as any,
          current: formData.current as any,
          surge: formData.surge as any,
        },
        gear: {
          suitType: formData.suitType as any,
          suitThickness: Number(formData.suitThickness),
          weight: Number(formData.weight),
          tank: {
            material: formData.tankMaterial as any,
            capacity: Number(formData.tankCapacity),
            pressureStart: Number(formData.pressureStart),
            pressureEnd: Number(formData.pressureEnd),
          }
        },
        entryType: formData.entryType as any,
        creatureId: formData.creatureId || undefined,
        sightedCreatures: formData.sightedCreatures,
        comment: formData.comment,
        isPrivate: formData.isPrivate,
        photos: formData.photos,
        spotId: formData.pointId, // Legacy compatibility
        likeCount: 0,
        likedBy: [],
      };

      addLog(logData);
      alert('ログが正常に保存されました！');
      navigate('/mypage');
    } catch (error) {
      console.error('Log registration failed:', error);
      alert('ログの保存に失敗しました。入力内容を確認してください。');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    try {
      const compressedImages = await Promise.all(
        files.map(file => compressImage(file))
      );

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...compressedImages]
      }));
    } catch (error) {
      console.error('Image compression failed:', error);
      alert('画像の処理に失敗しました。');
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  // Accordion State
  const [openSections, setOpenSections] = useState({
    basic: true,
    location: true,
    data: true,
    conditions: false,
    gear: false,
    content: true
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">ログ登録 (詳細)</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Basic Info */}
          <AccordionSection
            title="基本情報"
            icon={Calendar}
            colorClass="text-blue-500"
            isOpen={openSections.basic}
            onToggle={() => toggleSection('basic')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                <input
                  type="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">本数 (Dive No.)</label>
                <input
                  type="number"
                  name="diveNumber"
                  value={formData.diveNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                  placeholder="例: 100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">エントリータイプ</label>
                <select
                  name="entryType"
                  value={formData.entryType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                >
                  <option value="boat">ボート</option>
                  <option value="beach">ビーチ</option>
                </select>
              </div>
            </div>
          </AccordionSection>

          {/* Location & Team */}
          <AccordionSection
            title="場所・チーム"
            icon={Users}
            colorClass="text-purple-500"
            isOpen={openSections.location}
            onToggle={() => toggleSection('location')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ポイント</label>
                <select
                  name="pointId"
                  required
                  value={formData.pointId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                >
                  {points.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ショップ名</label>
                <input
                  type="text"
                  name="shopName"
                  value={formData.shopName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ガイド</label>
                <input
                  type="text"
                  name="guide"
                  value={formData.guide}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">バディ</label>
                <input
                  type="text"
                  name="buddy"
                  value={formData.buddy}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">その他のメンバー</label>
                <input
                  type="text"
                  name="members"
                  value={formData.members}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                  placeholder="カンマ区切り (例: Aさん, Bさん)"
                />
              </div>
            </div>
          </AccordionSection>

          {/* Dive Data */}
          <AccordionSection
            title="ダイブデータ"
            icon={Clock}
            colorClass="text-green-500"
            isOpen={openSections.data}
            onToggle={() => toggleSection('data')}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IN</label>
                <input
                  type="time"
                  name="entryTime"
                  value={formData.entryTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OUT</label>
                <input
                  type="time"
                  name="exitTime"
                  value={formData.exitTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">平均水深 (m)</label>
                <input
                  type="number"
                  name="avgDepth"
                  value={formData.avgDepth}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
            </div>
          </AccordionSection>

          {/* Conditions */}
          <AccordionSection
            title="コンディション"
            icon={Sun}
            colorClass="text-orange-500"
            isOpen={openSections.conditions}
            onToggle={() => toggleSection('conditions')}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">天気</label>
                <select
                  name="weather"
                  value={formData.weather}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                >
                  <option value="sunny">晴れ</option>
                  <option value="cloudy">曇り</option>
                  <option value="rainy">雨</option>
                  <option value="stormy">嵐</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">気温 (℃)</label>
                <input
                  type="number"
                  name="airTemp"
                  value={formData.airTemp}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">水温 (水面)</label>
                <input
                  type="number"
                  name="waterTempSurface"
                  value={formData.waterTempSurface}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">水温 (水底)</label>
                <input
                  type="number"
                  name="waterTempBottom"
                  value={formData.waterTempBottom}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">透明度 (m)</label>
                <input
                  type="number"
                  name="transparency"
                  value={formData.transparency}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">波</label>
                <select name="wave" value={formData.wave} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="none">なし</option>
                  <option value="low">低い</option>
                  <option value="high">高い</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">流れ</label>
                <select name="current" value={formData.current} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="none">なし</option>
                  <option value="weak">弱い</option>
                  <option value="strong">強い</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">うねり</label>
                <select name="surge" value={formData.surge} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="none">なし</option>
                  <option value="weak">弱い</option>
                  <option value="strong">強い</option>
                </select>
              </div>
            </div>
          </AccordionSection>

          {/* Gear */}
          <AccordionSection
            title="器材・タンク"
            icon={Settings}
            colorClass="text-gray-500"
            isOpen={openSections.gear}
            onToggle={() => toggleSection('gear')}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">スーツ</label>
                <select name="suitType" value={formData.suitType} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="wet">ウェット</option>
                  <option value="dry">ドライ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">厚さ (mm)</label>
                <input
                  type="number"
                  name="suitThickness"
                  value={formData.suitThickness}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ウェイト (kg)</label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タンク</label>
                <select name="tankMaterial" value={formData.tankMaterial} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="steel">スチール</option>
                  <option value="aluminum">アルミ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タンク容量 (L)</label>
                <input
                  type="number"
                  name="tankCapacity"
                  value={formData.tankCapacity}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始圧 (bar)</label>
                <input
                  type="number"
                  name="pressureStart"
                  value={formData.pressureStart}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了圧 (bar)</label>
                <input
                  type="number"
                  name="pressureEnd"
                  value={formData.pressureEnd}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
            </div>
          </AccordionSection>

          {/* Content */}
          <AccordionSection
            title="生物・コメント"
            icon={Fish}
            colorClass="text-red-500"
            isOpen={openSections.content}
            onToggle={() => toggleSection('content')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メインの生物</label>
                <select
                  name="creatureId"
                  value={formData.creatureId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                >
                  <option value="">選択なし</option>
                  {creatures.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">他に見た生物</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {creatures.map(c => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.sightedCreatures.includes(c.id)}
                        onChange={() => handleSightedCreatureToggle(c.id)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
                <textarea
                  name="comment"
                  rows={3}
                  value={formData.comment}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none resize-none"
                  placeholder="ログの感想やメモ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">写真</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Upload Button */}
                  <div
                    className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('log-photos-upload')?.click()}
                  >
                    <Camera size={24} className="mb-1" />
                    <span className="text-xs">写真を追加</span>
                    <input
                      type="file"
                      id="log-photos-upload"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                  {/* Photo Previews */}
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="aspect-square rounded-xl overflow-hidden relative group">
                      <img src={photo} alt={`Log photo ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ArrowDown size={12} className="rotate-45" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isPrivate"
                  checked={formData.isPrivate}
                  onChange={handleChange}
                  id="isPrivate"
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="isPrivate" className="text-sm text-gray-700">非公開にする</label>
              </div>
            </div>
          </AccordionSection>

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4">
            <Link to="/" className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              className="px-8 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5"
            >
              ログを保存
            </button>
          </div>

        </form>
      </main>
    </div>
  );
};

const AccordionSection = ({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  colorClass = "text-gray-500"
}: {
  title: string;
  icon: any;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  colorClass?: string;
}) => (
  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon size={20} className={colorClass} />
        <span className="text-lg font-bold text-gray-900">{title}</span>
      </div>
      <ChevronLeft size={20} className={`text-gray-400 transition-transform duration-200 ${isOpen ? '-rotate-90' : ''}`} />
    </button>

    <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="p-6 border-t border-gray-100">
        {children}
      </div>
    </div>
  </section>
);
