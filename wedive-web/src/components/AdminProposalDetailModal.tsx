import React from 'react';
import { X, Check, AlertTriangle, FileText, Calendar, User, AlignLeft, Info } from 'lucide-react';
import { TRUST_RANKS } from '../constants/masterData';

interface AdminProposalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: any;
  type: 'creature' | 'point' | 'rel' | 'review';
  onApprove: (item: any) => void;
  onReject: (id: string) => void;
  processingId: string | null;
}

export const AdminProposalDetailModal: React.FC<AdminProposalDetailModalProps> = ({
  isOpen,
  onClose,
  proposal,
  type,
  onApprove,
  onReject,
  processingId
}) => {
  if (!isOpen || !proposal) return null;

  const isDelete = proposal.proposalType === 'delete' || proposal.isDeletionRequest;
  const isUpdate = proposal.proposalType === 'update';
  const isCreate = !isDelete && !isUpdate;

  const formatDate = (ts: any) => {
    if (!ts) return 'N/A';
    if (typeof ts === 'string') return ts;
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    return String(ts);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-500" />
              提案詳細
              <span className={`text-xs px-2 py-1 rounded-full border ${isDelete ? 'bg-red-50 text-red-700 border-red-200' :
                  isUpdate ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    'bg-green-50 text-green-700 border-green-200'
                }`}>
                {isDelete ? 'DELETE' : isUpdate ? 'UPDATE' : 'CREATE'}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-1 font-mono">ID: {proposal.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><User size={12} /> 申請者</div>
              <div className="font-bold text-sm text-gray-800">{proposal.submitterId || 'Unknown'}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar size={12} /> 申請日時</div>
              <div className="font-bold text-sm text-gray-800">{formatDate(proposal.createdAt)}</div>
            </div>
          </div>

          {/* Reasoning / Comment */}
          {(proposal.reasoning || proposal.reason || proposal.comment || proposal.evidence) && (
            <section>
              <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <AlignLeft size={16} /> 申請理由・コメント
              </h3>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                {proposal.reasoning || proposal.reason || proposal.comment || proposal.evidence}
              </div>
            </section>
          )}

          {/* AI Info (if available) */}
          {proposal.confidence !== undefined && (
            <section>
              <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Info size={16} /> AI解析情報
              </h3>
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-purple-900">
                    <span className="font-bold">信頼度スコア:</span> {(proposal.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="flex-1 h-2 bg-purple-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.min(100, (proposal.confidence || 0) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Raw JSON Dump (Collapsible) */}
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="bg-gray-200 w-4 h-4 rounded flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">+</div>
              開発者用データ表示 (Raw JSON)
            </summary>
            <div className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-xs font-mono shadow-inner">
              <pre>{JSON.stringify(proposal, null, 2)}</pre>
            </div>
          </details>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={() => onReject(proposal.id)}
            disabled={processingId === proposal.id}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <X size={18} /> 却下
          </button>
          <button
            onClick={() => onApprove(proposal)}
            disabled={processingId === proposal.id}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-500 text-white font-bold hover:bg-green-600 shadow-md shadow-green-200 transition-all hover:translate-y-[-1px] disabled:opacity-50 disabled:translate-y-0"
          >
            <Check size={18} /> 承認
          </button>
        </div>
      </div>
    </div>
  );
};
