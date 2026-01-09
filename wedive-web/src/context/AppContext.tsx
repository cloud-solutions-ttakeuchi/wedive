import React, { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { usePoints } from '../hooks/usePoints';
import { useCreatures } from '../hooks/useCreatures';
import { usePointCreatures } from '../hooks/usePointCreatures';
import { useQuery } from '@tanstack/react-query';
import { userDataService } from '../services/UserDataService';

import { useZones } from '../hooks/useZones';
import { useAreas } from '../hooks/useAreas';
import { useAgencies } from '../hooks/useAgencies';
import { useRegions } from '../hooks/useRegions';
import { db as firestore } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAdminActions } from '../hooks/useAdminActions';

/**
 * AppContextは非推奨となりました。
 * 新規コードでは useAuth, usePoints, useCreatures などを直接使用してください。
 * このコンテキストは移行期間中の後方互換性のために維持されています。
 */

interface AppContextType {
  currentUser: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  updateUser: (data: any) => void;

  // マスタデータ
  points: any[];
  creatures: any[];
  pointCreatures: any[];
  regions: any[];
  zones: any[];
  areas: any[];
  agencies: any[];

  // ログ・レビュー
  logs: any[];
  recentLogs: any[];
  proposalReviews: any[];

  // アクション
  deleteLogs: (ids: string[]) => Promise<void>;
  updateLogs: (ids: string[], data: any) => Promise<void>;
  toggleLikeLog: (logId: string) => Promise<void>;
  toggleFavorite: (creatureId: string) => Promise<void>;
  toggleWanted: (creatureId: string) => Promise<void>;
  toggleBookmarkPoint: (pointId: string) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;

  // 管理者アクション
  approveProposal: (type: 'creature' | 'point' | 'point-creature', id: string, item: any) => Promise<void>;
  rejectProposal: (type: 'creature' | 'point' | 'point-creature', id: string) => Promise<void>;
  approveReview: (id: string) => Promise<void>;
  rejectReview: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const points = usePoints();
  const creatures = useCreatures();
  const pointCreatures = usePointCreatures();
  const zones = useZones();
  const areas = useAreas();
  const agencies = useAgencies();
  const regions = useRegions();

  // 1. 最近のパブリックログを取得（Home画面用）
  const recentLogsQuery = useQuery({
    queryKey: ['recentLogs'],
    queryFn: async () => {
      const q = query(collection(firestore, 'public_logs'), orderBy('date', 'desc'), limit(20));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    staleTime: 1000 * 60 * 10,
  });

  // 2. 自分のログを取得
  const logsQuery = useQuery({
    queryKey: ['logs', auth.currentUser.id],
    queryFn: () => userDataService.getLogs(),
    enabled: auth.isAuthenticated && auth.currentUser.id !== 'guest'
  });

  // 3. アクションの実装
  const adminActions = useAdminActions();

  const deleteLogs = async (ids: string[]) => {
    if (!auth.isAuthenticated) return;
    for (const id of ids) {
      await userDataService.deleteLog(auth.currentUser.id, id);
    }
    logsQuery.refetch();
  };

  const updateLogs = async (ids: string[], data: any) => {
    const batch = writeBatch(firestore);
    for (const id of ids) {
      const logRef = doc(firestore, 'users', auth.currentUser.id, 'logs', id);
      batch.update(logRef, data);
      // ローカルSQLiteは初回同期や再フック等で対応
    }
    await batch.commit();
    logsQuery.refetch();
  };

  const toggleFavorite = async (id: string) => {
    const isFav = auth.currentUser.favoriteCreatureIds?.includes(id);
    await auth.updateUser({
      favoriteCreatureIds: isFav ? arrayRemove(id) : arrayUnion(id) as any
    });
  };

  const toggleWanted = async (id: string) => {
    const isWanted = auth.currentUser.wanted?.includes(id);
    await auth.updateUser({
      wanted: isWanted ? arrayRemove(id) : arrayUnion(id) as any
    });
  };

  const toggleBookmarkPoint = async (id: string) => {
    const isBookmarked = auth.currentUser.bookmarkedPointIds?.includes(id);
    await auth.updateUser({
      bookmarkedPointIds: isBookmarked ? arrayRemove(id) : arrayUnion(id) as any
    });
  };

  const value = useMemo(() => ({
    ...auth,
    ...adminActions,
    points: points.data || [],
    creatures: creatures.data || [],
    pointCreatures: pointCreatures.data || [],
    regions: regions.data || [],
    zones: zones.data || [],
    areas: areas.data || [],
    agencies: agencies.data || [],
    logs: logsQuery.data || [],
    recentLogs: recentLogsQuery.data || [],
    proposalReviews: [], // TODO: 汎用フック化
    deleteLogs,
    updateLogs,
    toggleFavorite,
    toggleWanted,
    toggleBookmarkPoint,
    toggleLikeLog: async () => { }, // TODO
    deleteReview: async () => { }, // TODO
    isLoading: auth.isLoading || points.isLoading || creatures.isLoading || zones.isLoading || areas.isLoading || agencies.isLoading || regions.isLoading || logsQuery.isLoading || recentLogsQuery.isLoading
  }), [auth, adminActions, points.data, creatures.data, pointCreatures.data, regions.data, zones.data, areas.data, agencies.data, logsQuery.data, recentLogsQuery.data]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
