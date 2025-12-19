import React, { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Search,
  MapPin,
  Fish,
  Loader2,
  AlertTriangle,
  Database,
  ChevronRight,
  Filter,
  Trash2,
  Check
} from 'lucide-react';
import clsx from 'clsx';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { PointCreature } from '../../../types';

interface DashboardStats {
  total: number;
  approved: number;
  pending: number;
  byPoint: number;
  byCreature: number;
}

export const CleansingDashboard = () => {
  const { points, creatures, pointCreatures } = useApp();
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'all' | 'new' | 'specific' | 'replace'>('new');
  const [targetPointId, setTargetPointId] = useState('');
  const [targetCreatureId, setTargetCreatureId] = useState('');
  const [progress, setProgress] = useState(0);

  const stats = useMemo<DashboardStats>(() => {
    return {
      total: pointCreatures.length,
      approved: pointCreatures.filter(pc => pc.status === 'approved').length,
      pending: pointCreatures.filter(pc => pc.status === 'pending').length,
      byPoint: points.length,
      byCreature: creatures.length
    };
  }, [pointCreatures, points, creatures]);

  const handleRunCleansing = async () => {
    const confirmMsg = mode === 'all'
      ? '【警告】全データを再計算します。既存の紐付けは一度全て削除され、AIによって再生成されます。よろしいですか？'
      : '未紐付けのデータに対してAIクレンジングを実行します。続行しますか？';

    if (!window.confirm(confirmMsg)) return;

    setIsRunning(true);
    setProgress(10);

    try {
      // Get auth token
      const { auth } = await import('../../../lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Unauthenticated");

      // 実際には Cloud Function を呼び出す
      const response = await fetch('/api/cleansing/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            mode,
            pointId: mode === 'specific' ? targetPointId : undefined,
            creatureId: mode === 'specific' ? targetCreatureId : undefined
          }
        })
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      alert('クレンジングジョブがバックグラウンドで開始されました。数分後に結果が反映されます。');
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました。');
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 text-gray-500 mb-2 font-bold text-sm">
            <Database size={18} /> TOTAL MAPPINGS
          </div>
          <div className="text-3xl font-black text-gray-900">{stats.total.toLocaleString()}</div>
          <div className="mt-2 text-xs text-gray-400">Approved: {stats.approved} / Pending: {stats.pending}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 text-ocean-500 mb-2 font-bold text-sm">
            <MapPin size={18} /> POINTS
          </div>
          <div className="text-3xl font-black text-gray-900">{stats.byPoint}</div>
          <div className="mt-2 text-xs text-gray-400">Location Master Data</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 text-indigo-500 mb-2 font-bold text-sm">
            <Fish size={18} /> CREATURES
          </div>
          <div className="text-3xl font-black text-gray-900">{stats.byCreature}</div>
          <div className="mt-2 text-xs text-gray-400">Biological Dictionary</div>
        </div>
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm">
          <div className="flex items-center gap-3 text-amber-600 mb-2 font-bold text-sm">
            <AlertTriangle size={18} /> NEEDS REVIEW
          </div>
          <div className="text-3xl font-black text-amber-700">{stats.pending}</div>
          <div className="mt-2 text-xs text-amber-600 font-bold uppercase tracking-widest animate-pulse">Action Required</div>
        </div>
      </div>

      {/* 2. Controls */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 space-y-2">
            <h3 className="text-xl font-black text-gray-900">クレンジング実行コントロール</h3>
            <p className="text-gray-500 font-medium">
              Vertex AIを使用して、生物とポイントの紐付けを最新化・最適化します。<br />
              地形・水域条件に基づきフィルタリングした後、Google検索で事実確認を行います。
            </p>
          </div>

          <div className="w-full md:w-auto flex flex-col gap-4">
            <div className="flex p-1 bg-gray-100 rounded-2xl">
              {(['new', 'all', 'specific', 'replace'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={clsx(
                    "flex-1 px-4 py-2 rounded-xl text-sm font-black transition-all",
                    mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {m === 'new' ? '新規' : m === 'all' ? 'リセット' : m === 'specific' ? '範囲指定' : '入れ替え'}
                </button>
              ))}
            </div>

            {mode === 'specific' && (
              <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-2xl animate-in slide-in-from-top-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Target Point</label>
                  <select
                    value={targetPointId}
                    onChange={(e) => setTargetPointId(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-ocean-500 outline-none"
                  >
                    <option value="">Select a point...</option>
                    {points.map(p => <option key={p.id} value={p.id}>{p.name} ({p.area})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Target Creature (Optional)</label>
                  <select
                    value={targetCreatureId}
                    onChange={(e) => setTargetCreatureId(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-ocean-500 outline-none"
                  >
                    <option value="">All creatures</option>
                    {creatures.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={handleRunCleansing}
              disabled={isRunning || (mode === 'specific' && !targetPointId)}
              className={clsx(
                "flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black transition-all shadow-xl",
                isRunning || (mode === 'specific' && !targetPointId)
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] shadow-slate-200"
              )}
            >
              {isRunning ? (
                <>
                  <Loader2 className="animate-spin" />
                  CLEANSING IN PROGRESS... {progress}%
                </>
              ) : (
                <>
                  <Play size={20} fill="currentColor" />
                  クレンジング実行開始
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
