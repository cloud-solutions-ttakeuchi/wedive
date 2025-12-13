import React, { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Info, HelpCircle, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { parseCSV, type ParsedLog } from '../utils/logParser';
import { HierarchicalPointSelector } from './HierarchicalPointSelector';
import clsx from 'clsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const LogImportModal = ({ isOpen, onClose, onImportComplete }: Props) => {
  const { points, addLog, logs, currentUser, updateLog } = useApp();
  const [step, setStep] = useState<'upload' | 'preview' | 'saving'>('upload');
  const [parsedLogs, setParsedLogs] = useState<ParsedLog[]>([]);
  const [selectedPointIds, setSelectedPointIds] = useState<Record<number, string>>({});
  const [activeSelectorIndex, setActiveSelectorIndex] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Mode Selection
  const [importMode, setImportMode] = useState<'detailed' | 'simple'>('detailed');

  // Deduplication & Help
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [duplicateHandleMode, setDuplicateHandleMode] = useState<'skip' | 'overwrite' | 'create_new'>('skip');
  const [showSampleImage, setShowSampleImage] = useState(false);

  if (!isOpen) return null;

  const handlePointSelect = (pointId: string) => {
    if (activeSelectorIndex !== null) {
      setSelectedPointIds(prev => ({ ...prev, [activeSelectorIndex]: pointId }));
      if (pointId) setActiveSelectorIndex(null); // Close on selection
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setStep('saving'); // Show loading spinner temporarily while parsing

    try {
      let results: ParsedLog[] = [];
      setDebugLogs([]);

      if (file.name.endsWith('.zip')) {
        // ZIP Parser
        const { parseGarminZip } = await import('../utils/garminParser');
        // Pass skipFit if simple mode
        const { logs: _logs, debugLogs: _debug } = await parseGarminZip(file, { skipFit: importMode === 'simple' });
        results = _logs;
        setDebugLogs(_debug);
      } else {
        // CSV Parser (Legacy)
        const text = await file.text();
        results = await parseCSV(text);
      }

      if (results.length === 0) {
        setError('有効なデータが見つかりませんでした。ファイル形式を確認してください。');
        setStep('upload');
        return;
      }

      setParsedLogs(results);
      // Default select all
      setSelectedIndices(new Set(results.map((_, i) => i)));

      // Check Duplicates (Smart Merge Prep)
      if (results.some(r => !!r.garminActivityId)) {
        const myLogs = logs.filter(l => l.userId === currentUser.id);
        const dups = results.filter(r => r.garminActivityId && myLogs.some(existing => existing.garminActivityId === r.garminActivityId));
        setDuplicateCount(dups.length);
      } else {
        setDuplicateCount(0);
      }

      setStep('preview');
    } catch (err) {
      console.error(err);
      setError('ファイルの解析に失敗しました。');
      setStep('upload');
    }
  };

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const toggleAll = () => {
    if (selectedIndices.size === parsedLogs.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsedLogs.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    setStep('saving');
    try {
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      // Filter by selected indices
      const indicesToImport = Array.from(selectedIndices).sort((a, b) => a - b);
      const myLogs = logs.filter(l => l.userId === currentUser.id);

      for (const i of indicesToImport) {
        const raw = parsedLogs[i];

        // Deduplication Logic
        let existingLog = null;
        if (raw.garminActivityId) {
          existingLog = myLogs.find(l => l.garminActivityId === raw.garminActivityId);
        }

        if (existingLog) {
          if (duplicateHandleMode === 'skip') {
            skippedCount++;
            continue;
          }
          if (duplicateHandleMode === 'overwrite') {
            const logData: any = {
              // Update fields
              date: raw.date,
              time: raw.time,
              depth: raw.depth,
              location: { ...existingLog.location, ...raw.location, pointId: selectedPointIds[i] || existingLog.location.pointId || '' },
              condition: raw.condition,
              gear: raw.gear,
              profile: raw.profile || [],
              garminActivityId: raw.garminActivityId
            };
            // Cleanup undefined
            const cleanData = Object.entries(logData).reduce((a, [k, v]) => (v === undefined ? a : (a[k] = v, a)), {} as any);
            await updateLog(existingLog.id, cleanData);
            updatedCount++;
            continue;
          }
        }

        // Create New
        const pointId = selectedPointIds[i] || ''; // User selected or empty

        const logData: any = {
          date: raw.date!,
          diveNumber: raw.diveNumber || 0,
          location: {
            pointId: pointId,
            pointName: raw.location?.pointName || '',
            region: raw.location?.region || '',
            lat: raw.location?.lat,
            lng: raw.location?.lng
          },
          time: {
            entry: raw.time?.entry,
            exit: raw.time?.exit,
            duration: raw.time?.duration || 0,
            surfaceInterval: raw.time?.surfaceInterval
          },
          depth: {
            max: raw.depth?.max || 0,
            average: raw.depth?.average || 0
          },
          condition: raw.condition,
          gear: raw.gear,
          entryType: 'boat',
          tank: {},
          comment: '',
          photos: [],
          isPrivate: false,
          profile: raw.profile || [],
          garminActivityId: raw.garminActivityId
        };

        await addLog(logData);
        importedCount++;
      }

      alert(`処理完了:\n新規追加: ${importedCount}件\n更新: ${updatedCount}件\nスキップ: ${skippedCount}件`);
      onImportComplete();
      onClose();
      // Reset
      setStep('upload');
      setParsedLogs([]);
      setSelectedPointIds({});
      setSelectedIndices(new Set());
      setActiveSelectorIndex(null);
      setDuplicateCount(0);
    } catch (e) {
      console.error(e);
      setError('保存中にエラーが発生しました。');
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative">

        {/* Overlay for Hierarchical Selector */}
        {activeSelectorIndex !== null && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setActiveSelectorIndex(null)}>
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg space-y-4 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">ダイビングポイントを選択</h3>
                <button onClick={() => setActiveSelectorIndex(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 mb-2">
                <div>元データ: <span className="font-bold">{parsedLogs[activeSelectorIndex].title || '名称なし'}</span></div>
                <div>日付: {parsedLogs[activeSelectorIndex].date}</div>
              </div>
              <HierarchicalPointSelector
                value={selectedPointIds[activeSelectorIndex] || ''}
                onChange={handlePointSelect}
              />
            </div>
          </div>
        )}

        {/* Sample Image Popup */}
        {showSampleImage && (
          <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowSampleImage(false)}>
            <div className="bg-white p-2 rounded-xl max-w-3xl w-full animate-in fade-in zoom-in" onClick={e => e.stopPropagation()}>
              <div className="relative">
                <img src="/garmin_sample_graph.png" alt="Sample" className="w-full h-auto rounded-lg" />
                <button onClick={() => setShowSampleImage(false)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"><X size={20} /></button>
              </div>
              <p className="text-center text-sm text-gray-500 mt-2 p-2">詳細インポートではこのようなグラフが生成されます</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Upload size={24} className="text-blue-500" />
            ログのインポート (Garmin詳細データ / CSV)
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-6">
              {/* Mode Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setImportMode('detailed')}
                  className={clsx(
                    "p-4 rounded-xl border-2 cursor-pointer transition-all relative",
                    importMode === 'detailed' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={clsx("font-bold", importMode === 'detailed' ? 'text-blue-700' : 'text-gray-700')}>詳細インポート</span>
                    {importMode === 'detailed' && <Check size={20} className="text-blue-600" />}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    深度、水温、心拍数などの時系列データを解析し、グラフで表示します。
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] bg-white border border-blue-100 rounded px-2 py-1 text-blue-600 inline-block font-bold">
                      深度プロファイル対応
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowSampleImage(true); }}
                      className="text-blue-400 hover:text-blue-600 transistion-colors"
                      title="イメージを見る"
                    >
                      <HelpCircle size={16} />
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => setImportMode('simple')}
                  className={clsx(
                    "p-4 rounded-xl border-2 cursor-pointer transition-all",
                    importMode === 'simple' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={clsx("font-bold", importMode === 'simple' ? 'text-green-700' : 'text-gray-700')}>簡易インポート</span>
                    {importMode === 'simple' && <Check size={20} className="text-green-600" />}
                  </div>
                  <p className="text-xs text-gray-500">
                    基本情報（日時、場所、最大水深など）のみを取り込みます。<br />
                    ※処理が高速で、通信量も抑えられます。
                  </p>
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-3xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-all group cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv,.zip"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <FileText size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-2">Garminデータ(Zip) または CSVを選択</h3>
                <p className="text-gray-500 text-sm">
                  対応形式: <span className="font-bold">.zip ({importMode === 'detailed' ? '詳細' : '簡易'})</span>, .csv (簡易)<br />
                  <span className="text-xs text-gray-400 mt-2 inline-block">
                    {importMode === 'detailed'
                      ? '※ZIP内のFITファイルを解析し、深度プロファイル等を生成します'
                      : '※ZIP内のJSONメタデータのみを使用し、高速に取り込みます'}
                  </span>
                </p>
                <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-left">
                  <p className="font-bold mb-1">⚠️ プライバシーに関するご注意</p>
                  アップロードされたデータにはGarminが取得したお客様自身の情報が含まれている可能性があります。本サービスではダイビングのログ機能の出力の目的でログ機能の出力に必要な情報のみを取得し、本サービスが管理するデータベース内の、お客様のアカウント専用の保存領域に保存されます。
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Duplicate Handling UI - shown only if duplicates exist */}
              {duplicateCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 mb-2 text-amber-800 font-bold">
                    <AlertTriangle size={20} />
                    <span>{duplicateCount}件の重複データが見つかりました</span>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    GarminのアクティビティIDが一致するログが既に存在します。処理方法を選択してください。
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="dupMode" checked={duplicateHandleMode === 'skip'} onChange={() => setDuplicateHandleMode('skip')} />
                      <span>スキップ (推奨) - 既存ログを維持</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="dupMode" checked={duplicateHandleMode === 'overwrite'} onChange={() => setDuplicateHandleMode('overwrite')} />
                      <span>上書き - 新しいデータで更新</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="dupMode" checked={duplicateHandleMode === 'create_new'} onChange={() => setDuplicateHandleMode('create_new')} />
                      <span>新規として追加 (重複作成)</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <p className="font-bold">
                  {parsedLogs.length}件のデータを読み込みました。<br />
                  <span className="text-xs font-normal text-gray-500">※インポートするデータを選択してください（不要なデータはチェックを外してください）</span>
                </p>
                <div className="flex gap-2">
                  <button onClick={toggleAll} className="text-sm text-blue-600 hover:text-blue-800 underline">
                    {selectedIndices.size === parsedLogs.length ? 'すべて解除' : 'すべて選択'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-2 max-h-[400px] overflow-y-auto">
                {parsedLogs.map((log, index) => (
                  <div key={index} className={clsx("flex items-center gap-3 p-3 border-b last:border-0 hover:bg-white transition-colors rounded-lg", selectedIndices.has(index) ? "bg-white shadow-sm" : "opacity-50")}>
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedIndices.has(index)}
                      onChange={() => toggleSelection(index)}
                    />
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="text-sm">
                        <span className="font-bold text-gray-800 block truncate">{log.title || 'No Title'}</span>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>{log.date}</span>
                          <span>{log.time?.entry}</span>
                          {log.depth?.max && <span>最大深度: {log.depth.max}m</span>}
                          {log.hasProfileData && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">Graph</span>}
                          {duplicateCount > 0 && log.garminActivityId && logs.some(l => l.userId === currentUser.id && l.garminActivityId === log.garminActivityId) && (
                            <span className="text-[10px] bg-amber-100 text-amber-600 px-1 rounded flex items-center gap-1">
                              <Info size={10} /> 既存
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs">
                        <span onClick={() => setActiveSelectorIndex(index)} className="cursor-pointer text-blue-600 hover:underline flex items-center gap-1">
                          {selectedPointIds[index] ? 'ポイント変更' : '+ ポイントを選択'}
                        </span>
                        {selectedPointIds[index] && (
                          <div className="text-gray-700 font-bold mt-1">
                            {points.find(p => p.id === selectedPointIds[index])?.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setStep('upload'); setDuplicateCount(0); }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedIndices.size === 0}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  {selectedIndices.size}件をインポート
                </button>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="font-bold text-gray-800">データを保存中...</p>
              <p className="text-sm text-gray-500">画面を閉じないでください</p>
            </div>
          )}

          {/* Debug Log Area */}
          {error === null && step === 'preview' && parsedLogs.some(l => !l.hasProfileData) && (
            <div className="mb-4">
              <details className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <summary className="cursor-pointer font-bold mb-1 hover:text-gray-700">解析デバッグ情報 (グラフデータが見つからない場合などに確認)</summary>
                <textarea
                  readOnly
                  className="w-full h-32 p-2 mt-2 bg-white border border-gray-200 rounded font-mono text-[10px]"
                  value={debugLogs.join('\n')}
                />
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
