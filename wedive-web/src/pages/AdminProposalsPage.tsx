import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Check, X, MapPin, Fish, Database, Award, Star, Eye } from 'lucide-react';
import clsx from 'clsx';
import { seedFirestore } from '../utils/seeder';
import { TRUST_RANKS } from '../constants/masterData';
import { AdminProposalDetailModal } from '../components/AdminProposalDetailModal';

export const AdminProposalsPage = () => {
  const navigate = useNavigate();
  const {
    proposalCreatures,
    proposalPoints,
    proposalPointCreatures,
    proposalReviews,
    approveProposal,
    rejectProposal,
    approveReview,
    rejectReview,
    currentUser,
    allUsers,
    creatures,
    points
  } = useApp();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'creature' | 'point' | 'rel' | 'review'>('creature');
  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);

  // ハンドラを統合
  const handleApproveRel = async (item: any) => {
    const action = item.proposalType === 'delete' ? '削除を承認' : '追加を承認';
    if (!window.confirm(`${action}してもよろしいですか？`)) return;
    setProcessingId(item.id);
    await approveProposal('point-creature', item.id, item);
    setProcessingId(null);
  };

  const handleRejectRel = async (id: string) => {
    if (!window.confirm('却下してもよろしいですか？')) return;
    setProcessingId(id);
    await rejectProposal('point-creature', id);
    setProcessingId(null);
  };


  const handleForceSeed = async () => {
    // Extra safety check
    if (currentUser.role !== 'admin') {
      alert('権限がありません。');
      return;
    }
    if (!window.confirm('【注意】マスタデータを強制更新してもよろしいですか？\n\n・新しい生物やポイントがFirestoreに追加/更新されます。\n・ユーザーデータや提案データには影響しません。\n・この操作は取り消せません。')) return;

    setIsSeeding(true);
    try {
      const success = await seedFirestore(true);
      if (success) {
        alert('マスタデータの更新が完了しました！');
      } else {
        alert('更新中にエラーが発生しました。コンソールを確認してください。');
      }
    } catch (e) {
      console.error(e);
      alert('予期せぬエラーが発生しました。');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleApprove = async (type: 'creature' | 'point', item: any) => {
    const action = item.proposalType === 'delete' ? '削除を承認' : item.proposalType === 'update' ? '変更を承認' : '新規登録を承認';
    if (!window.confirm(`${action}してもよろしいですか？`)) return;
    setProcessingId(item.id);
    await approveProposal(type, item.id, item);
    setProcessingId(null);
  };

  const handleReject = async (type: 'creature' | 'point', id: string) => {
    if (!window.confirm('却下してもよろしいですか？')) return;
    setProcessingId(id);
    await rejectProposal(type, id);
    setProcessingId(null);
  };

  const handleApproveReview = async (id: string) => {
    if (!window.confirm('このレビューを承認しますか？')) return;
    setProcessingId(id);
    await approveReview(id);
    setProcessingId(null);
  }

  const handleRejectReview = async (id: string) => {
    if (!window.confirm('このレビューを却下しますか？')) return;
    setProcessingId(id);
    await rejectReview(id);
    setProcessingId(null);
  }

  const getSubmitterInfo = (submitterId: string) => {
    const user = allUsers.find((u: any) => u.id === submitterId);
    if (!user) return <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-400 break-all">Unknown Submitter (ID: {submitterId})</div>;

    const currentScore = user.trustScore || 0;
    const rank = TRUST_RANKS.slice().reverse().find(r => currentScore >= r.minScore) || TRUST_RANKS[0];

    return (
      <div className="flex items-center gap-2 mt-3 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border border-white shadow-sm">
          {user.profileImage ? (
            <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs">{user.name.charAt(0)}</div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{user.name}</span>
            <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border shadow-sm ${rank.designColor.replace('text', 'border').replace('500', '200')} bg-white`}>
              <Award size={10} className={rank.designColor} />
              {rank.name}
            </span>
            {user.role !== 'user' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {user.role === 'admin' ? 'ADMIN' : 'MOD'}
              </span>
            )}
          </div>
          <div className="text-xs text-indigo-600 font-medium mt-0.5">Trust Score: {currentScore}</div>
        </div>
      </div>
    );
  };

  const renderDiff = (proposal: any, type: 'creature' | 'point') => {
    const list = type === 'creature' ? creatures : points;
    const original = list.find((i: any) => i.id === proposal.targetId);

    if (!original) return <div className="text-red-500 text-sm">Target ID not found: {proposal.targetId}</div>;

    const diff = proposal.diffData || {};

    const isDelete = proposal.proposalType === 'delete' || proposal.diffData?.requestedDeletion || (proposal as any).isDeletionRequest;
    if (isDelete) {
      const original = list.find((i: any) => i.id === proposal.targetId || i.id.replace(/_/g, '') === proposal.targetId?.replace(/_/g, ''));
      return (
        <div className="mt-3 bg-red-50 rounded-lg border border-red-200 p-3 text-sm break-words">
          <div className="font-bold text-red-800 mb-2 flex items-center gap-1">
            🚨 削除申請理由 (対象: {original?.name || proposal.name})
          </div>
          <div className="p-3 bg-white rounded border border-red-100 italic text-gray-700 break-words">
            "{diff.reason || proposal.reason || '理由の入力はありません'}"
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3 bg-yellow-50 rounded-lg border border-yellow-200 p-3 text-sm break-words">
        <div className="font-bold text-yellow-800 mb-2 flex items-center gap-1">
          ⚠️ 変更内容 (対象: {original.name})
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {Object.keys(diff).filter((k: string) => k !== 'reason' && k !== 'requestedDeletion').map((key: string) => {
            const oldValue = (original as any)[key];
            const newValue = diff[key];

            // Format arrays for display
            const displayOld = Array.isArray(oldValue) ? oldValue.join(', ') : String(oldValue);
            const displayNew = Array.isArray(newValue) ? newValue.join(', ') : String(newValue);

            return (
              <div key={key} className="contents">
                <div className="font-bold text-gray-500 text-right">{key}:</div>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div className="text-gray-400 line-through bg-white px-2 py-0.5 rounded border border-gray-100 break-all">{displayOld}</div>
                  <div className="text-gray-400">→</div>
                  <div className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-green-200 break-all">{displayNew}</div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Context Preview (for images) */}
        {diff.imageUrl && (
          <div className="mt-2 flex gap-4">
            <div className="w-16 h-16 opacity-50"><img src={(original as any).imageUrl} className="w-full h-full object-cover rounded" /></div>
            <div className="text-2xl text-gray-400">→</div>
            <div className="w-16 h-16 border-2 border-green-500 rounded"><img src={diff.imageUrl} className="w-full h-full object-cover rounded" /></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-32">
      <div className="flex justify-between items-center max-w-5xl mx-auto mb-6">
        <h1 className="text-2xl font-bold text-gray-800">提案管理ダッシュボード <span className="text-blue-500 text-sm font-mono">[PROPOSAL FIXING ACTIVE]</span></h1>

        {/* Admin Utils */}
        <div className="flex gap-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={handleForceSeed}
              disabled={isSeeding}
              className="flex items-center gap-2 text-xs bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Database size={14} />
              {isSeeding ? '更新中...' : 'マスタデータ強制同期'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          {[
            { id: 'creature', label: '生物', icon: <Fish size={18} />, count: proposalCreatures.length },
            { id: 'point', label: 'ポイント', icon: <MapPin size={18} />, count: proposalPoints.length },
            { id: 'rel', label: 'ポイント_生物', icon: <Database size={18} />, count: proposalPointCreatures.length },
            { id: 'review', label: 'レビュー', icon: <Star size={18} />, count: proposalReviews.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={clsx(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all",
                activeCategory === tab.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105"
                  : "text-gray-500 hover:bg-gray-50 bg-transparent"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className={clsx(
                  "ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-black",
                  activeCategory === tab.id ? "bg-white/20 text-white" : "bg-red-500 text-white"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Creatures */}
        {activeCategory === 'creature' && proposalCreatures.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Fish className="text-blue-500" /> 生物提案 ({proposalCreatures.length})</h2>
            <div className="grid gap-4">
              {proposalCreatures.map((c: any) => {
                const title = (c as any).proposalTitle || '';
                const type = c.proposalType || (c as any).type || '';
                const isDelete = type === 'delete' || c.diffData?.requestedDeletion || !!c.diffData?.reason || !!c.reason || (c as any).isDeletionRequest || title.includes('削除');
                const hasTargetId = !!c.targetId && c.targetId !== '';
                const isUpdate = (type === 'update' || hasTargetId) && !isDelete;

                // Debug log for admins to see raw values in console
                if (import.meta.env.DEV) console.log(`[AdminProposal] Creature ${c.id}: type=${type}, hasTargetId=${hasTargetId}, isDelete=${isDelete}, isUpdate=${isUpdate}`);
                return (
                  <div key={c.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-6">
                    <div className="w-32 h-32 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100">
                      <img src={isUpdate && c.diffData?.imageUrl ? c.diffData.imageUrl : c.imageUrl} className="w-full h-full object-cover" alt={c.name} />
                    </div>
                    <div className="flex-1 py-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-gray-900">
                          {(isUpdate || isDelete) ? (creatures.find((x: any) => x.id === c.targetId)?.name || c.name || 'Unknown') : c.name}
                          {(isUpdate || isDelete) && <span className="text-sm font-normal text-gray-500 ml-2">(ID: {c.targetId})</span>}
                          {(!isUpdate && !isDelete) && <span className="text-sm font-normal text-gray-500 ml-2">({c.scientificName})</span>}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${isDelete ? 'bg-red-100 text-red-800' : isUpdate ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                          {isDelete ? '削除提案' : isUpdate ? '変更提案' : '新規登録'}
                        </span>
                      </div>

                      {(isUpdate || c.proposalType === 'delete') ? (
                        renderDiff(c, 'creature')
                      ) : (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.description}</p>
                      )}

                      {/* Submitter Info Highlight */}
                      {getSubmitterInfo(c.submitterId || '')}

                      {!isUpdate && (
                        <div className="mt-3 flex gap-2 text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">Category: {c.category}</span>
                          <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">Rarity: {c.rarity}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                      <button
                        onClick={() => setSelectedProposal(c)}
                        className="flex items-center justify-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm"
                      >
                        <Eye size={14} /> 詳細
                      </button>
                      <button
                        onClick={() => handleApprove('creature', c)}
                        disabled={processingId === c.id}
                        className="flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <Check size={16} /> 承認 <span className="text-xs opacity-90">(+5 TP)</span>
                      </button>
                      <button
                        onClick={() => handleReject('creature', c.id)}
                        disabled={processingId === c.id}
                        className="flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2.5 rounded-lg font-bold hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <X size={16} /> 却下
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Categories: Point-Creature Relationships */}
        {activeCategory === 'rel' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-600">
              <Database className="text-indigo-500" /> 紐付け提案 ({proposalPointCreatures.length})
            </h2>
            {proposalPointCreatures.length > 0 ? (
              <div className="grid gap-4">
                {proposalPointCreatures.map((req: any) => {
                  const targetPoint = points.find((p: any) => p.id === req.pointId);
                  const targetCreature = creatures.find((c: any) => c.id === req.creatureId);
                  const isDelete = req.proposalType === 'delete';
                  return (
                    <div key={req.id} className={clsx(
                      "bg-white p-6 rounded-xl shadow-sm border flex flex-col md:flex-row gap-6 items-center",
                      isDelete ? "border-red-100" : "border-blue-100"
                    )}>
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100">
                        <img src={targetCreature?.imageUrl} className="w-full h-full object-cover" alt={targetCreature?.name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className="text-lg font-bold text-gray-900">
                            {targetCreature?.name} <span className="text-sm font-normal text-gray-400">at</span> {targetPoint?.name}
                          </h3>
                          <span className={clsx(
                            "text-xs px-2 py-1 rounded-full font-medium",
                            isDelete ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                          )}>
                            {isDelete ? '紐付け解除申請' : '新規紐付け申請'}
                          </span>
                        </div>
                        <div className="mt-1 flex gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded border bg-gray-50 border-gray-200">Rarity: {req.localRarity}</span>
                        </div>
                        {getSubmitterInfo(req.submitterId)}
                      </div>
                      <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                        <button
                          onClick={() => setSelectedProposal(req)}
                          className="flex items-center justify-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm"
                        >
                          <Eye size={14} /> 詳細
                        </button>
                        <button
                          onClick={() => handleApproveRel(req)}
                          disabled={processingId === req.id}
                          className="flex items-center justify-center gap-2 bg-indigo-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-indigo-600 disabled:opacity-50"
                        >
                          <Check size={16} /> 承認
                        </button>
                        <button
                          onClick={() => handleRejectRel(req.id)}
                          disabled={processingId === req.id}
                          className="flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2.5 rounded-lg font-bold hover:bg-red-50 disabled:opacity-50"
                        >
                          <X size={16} /> 却下
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-dashed">
                提案はありません
              </div>
            )}
          </div>
        )}

        {/* Categories: Points */}
        {activeCategory === 'point' && proposalPoints.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin className="text-green-500" /> ポイント提案 ({proposalPoints.length})</h2>
            <div className="grid gap-4">
              {proposalPoints.map((p: any) => {
                const tid = (p as any).targetId || (p.id && !p.id.startsWith('prop') ? p.id : '');
                const hasTargetId = tid !== '';
                const rawType = String(p.proposalType || '').toLowerCase();

                // Priority: Explicit proposalType
                const isDelete = rawType === 'delete' || (p as any).isDeletionRequest === true;
                const isUpdate = (rawType === 'update' || hasTargetId) && !isDelete;
                const isCreate = !hasTargetId && !isDelete;

                const isDuplicate = isCreate && points.some((existing: any) => existing.name === p.name);

                return (
                  <div key={p.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="w-32 h-32 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100">
                        <img src={isUpdate && p.diffData?.imageUrl ? p.diffData.imageUrl : p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                      </div>
                      <div className="flex-1 py-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className="text-lg font-bold text-gray-900">
                            {(isUpdate || isDelete) ? (points.find((x: any) => x.id === tid || x.id.replace(/_/g, '') === tid.replace(/_/g, ''))?.name || p.name || 'Unknown') : p.name}
                            {hasTargetId && <span className="text-xs font-mono text-gray-400 ml-2">[{tid}]</span>}
                            {isCreate && <span className="text-sm font-normal text-gray-500 ml-2">in {p.area}, {p.zone}</span>}
                          </h3>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${isDelete ? 'bg-red-100 text-red-800' : isUpdate ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                            {isDelete ? '削除提案' : isUpdate ? '変更提案' : '新規登録'}
                          </span>
                        </div>

                        {isDuplicate && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-bold flex items-center gap-1">
                            ⚠️ 同名のポイントが既に存在します。重複登録の可能性があります！
                          </div>
                        )}

                        {(isUpdate || isDelete) ? (
                          renderDiff(p, 'point')
                        ) : (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.description}</p>
                        )}

                        {/* Submitter Info Highlight */}
                        {getSubmitterInfo(p.submitterId)}

                        {!isUpdate && (
                          <div className="mt-3 flex gap-2 text-xs text-gray-500">
                            <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">Level: {p.level}</span>
                            <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">Depth: {p.maxDepth}m</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                        <button
                          onClick={() => setSelectedProposal(p)}
                          className="flex items-center justify-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm"
                        >
                          <Eye size={14} /> 詳細
                        </button>
                        <button
                          onClick={() => handleApprove('point', p)}
                          disabled={processingId === p.id}
                          className="flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <Check size={16} /> 承認 <span className="text-xs opacity-90">(+5 TP)</span>
                        </button>
                        <button
                          onClick={() => handleReject('point', p.id)}
                          disabled={processingId === p.id}
                          className="flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2.5 rounded-lg font-bold hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <X size={16} /> 却下
                        </button>
                      </div>
                    </div>

                    {/* DEBUG DATA DISPLAY */}
                    {import.meta.env.DEV && (
                      <details className="mt-4 p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-auto">
                        <summary className="cursor-pointer font-mono hover:text-green-300">Raw Data Debug (Firestore Fields)</summary>
                        <pre className="mt-2">{JSON.stringify({
                          proposalType: (p as any).proposalType,
                          type: (p as any).type,
                          targetId: (p as any).targetId,
                          isDeletionRequest: (p as any).isDeletionRequest,
                          diffData: p.diffData,
                          title: (p as any).proposalTitle
                        }, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Categories: Reviews */}
        {activeCategory === 'review' && (
          <section>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Star className="text-amber-500" /> レビュー提案 ({proposalReviews.length})</h2>
            {proposalReviews.length === 0 ? (
              <div className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                承認待ちのレビューはありません
              </div>
            ) : (
              <div className="grid gap-6">
                {proposalReviews.map((rv: any) => {
                  const targetPoint = points.find((p: any) => p.id === rv.pointId);
                  const submitter = allUsers.find((u: any) => u.id === rv.userId);
                  const displayName = submitter?.name || rv.userName || 'Unknown User';
                  const displayImage = submitter?.profileImage || rv.userProfileImage;

                  return (
                    <div key={rv.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
                            {displayImage ? <img src={displayImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">{displayName.charAt(0)}</div>}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{displayName}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest">{rv.createdAt} ・ {targetPoint?.name}</p>
                          </div>
                        </div>

                        <div className="flex gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star key={star} size={14} className={star <= (rv.rating || 0) ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
                          ))}
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl mb-4 border border-gray-100 italic text-gray-700 text-sm">
                          "{rv.comment || 'コメントなし'}"
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="text-[10px] px-2 py-1 bg-sky-50 text-sky-600 rounded-lg font-bold border border-sky-100">透明度: {rv.metrics?.visibility}m</span>
                          <span className="text-[10px] px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-bold border border-indigo-100">平均水深: {rv.metrics?.depthAvg}m</span>
                          <span className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-bold border border-emerald-100">流れ: {rv.metrics?.flow}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                        <button
                          onClick={() => setSelectedProposal(rv)}
                          className="flex items-center justify-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm"
                        >
                          <Eye size={14} /> 詳細
                        </button>
                        <button
                          onClick={() => handleApproveReview(rv.id)}
                          disabled={processingId === rv.id}
                          className="flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <Check size={16} /> 承認
                        </button>
                        <button
                          onClick={() => navigate(`/edit-review/${rv.id}`)}
                          className="flex items-center justify-center gap-2 bg-sky-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-sky-600 transition-colors shadow-sm text-sm"
                        >
                          <Star size={16} /> 内容修正
                        </button>
                        <button
                          onClick={() => handleRejectReview(rv.id)}
                          disabled={processingId === rv.id}
                          className="flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2.5 rounded-lg font-bold hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <X size={16} /> 却下
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <AdminProposalDetailModal
        isOpen={!!selectedProposal}
        onClose={() => setSelectedProposal(null)}
        proposal={selectedProposal}
        type={activeCategory}
        onApprove={(item) => {
          if (activeCategory === 'review') handleApproveReview(item.id);
          else if (activeCategory === 'rel') handleApproveRel(item);
          else handleApprove(activeCategory as 'creature' | 'point', item);
          setSelectedProposal(null);
        }}
        onReject={(id) => {
          if (activeCategory === 'review') handleRejectReview(id);
          else if (activeCategory === 'rel') handleRejectRel(id);
          else handleReject(activeCategory as 'creature' | 'point', id);
          setSelectedProposal(null);
        }}
        processingId={processingId}
        masterPoints={points}
        masterCreatures={creatures}
      />
    </div>
  );
};
