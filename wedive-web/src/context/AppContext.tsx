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
import { masterDataService } from '../services/MasterDataService';
import { useEffect } from 'react';

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


  // アクション
  deleteLogs: (ids: string[]) => Promise<void>;
  updateLogs: (ids: string[], data: any) => Promise<void>;
  toggleLikeLog: (logOrId: any) => Promise<void>;
  toggleFavorite: (creatureId: string) => Promise<void>;
  toggleWanted: (creatureId: string) => Promise<void>;
  toggleBookmarkPoint: (pointId: string) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;

  // ログ操作
  addLog: (log: any) => Promise<any>;
  updateLog: (id: string, data: any) => Promise<any>;
  deleteLog: (id: string) => Promise<void>;

  // レビュー・申請
  reviews: any[];
  addReview: (review: any) => Promise<any>;
  updateReview: (id: string, data: any) => Promise<any>;
  addCreature: (creature: any) => Promise<void>;
  addCreatureProposal: (proposal: any) => Promise<void>;
  addPoint: (point: any) => Promise<void>;
  addPointProposal: (proposal: any) => Promise<void>;
  addPointCreature: (rel: any) => Promise<void>;
  addPointCreatureProposal: (proposal: any) => Promise<void>;
  proposalPointCreatures: any[];
  proposalCreatures: any[];
  proposalPoints: any[];
  proposalReviews: any[];
  deleteAccount: () => Promise<void>;

  // 管理者アクション
  allUsers: any[];
  updateUserRole: (userId: string, role: string) => Promise<void>;
  updateCreature: (id: string, data: any) => Promise<void>;
  updatePoint: (id: string, data: any) => Promise<void>;
  removePointCreature: (id: string) => Promise<void>;
  removePointCreatureProposal: (id: string) => Promise<void>;
  approveProposal: (type: 'creature' | 'point' | 'point-creature', id: string, item: any) => Promise<void>;
  rejectProposal: (type: 'creature' | 'point' | 'point-creature', id: string) => Promise<void>;
  approveReview: (id: string) => Promise<void>;
  rejectReview: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    // 起動時にマスターデータの初期化（テーブル作成）と同期を行う
    const initMasterData = async () => {
      try {
        const available = await masterDataService.initialize();
        if (available) {
          console.log('[App] MasterDataService initialized.');
          await masterDataService.syncMasterData();
          // 同期完了後にクエリを再取得
          points.refetch();
          creatures.refetch();
          pointCreatures.refetch();
          zones.refetch();
          areas.refetch();
          agencies.refetch();
          regions.refetch();
        }
      } catch (error) {
        console.error('[App] MasterData init/sync failed:', error);
      }
    };
    initMasterData();
  }, []);

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
      return snap.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
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

  // 4. その他のデータの取得 (互換性のための暫定実装)
  const reviewsQuery = useQuery({
    queryKey: ['reviews', auth.currentUser.id],
    queryFn: () => userDataService.getReviews(),
    enabled: auth.isAuthenticated && auth.currentUser.id !== 'guest'
  });

  const proposalPointCreaturesQuery = useQuery({
    queryKey: ['proposalPointCreatures'],
    queryFn: () => userDataService.getAdminProposals('point-creature'),
    enabled: auth.isAuthenticated && (auth.currentUser.role === 'admin' || auth.currentUser.role === 'moderator')
  });

  const proposalCreaturesQuery = useQuery({
    queryKey: ['proposalCreatures'],
    queryFn: () => userDataService.getAdminProposals('creature'),
    enabled: auth.isAuthenticated && (auth.currentUser.role === 'admin' || auth.currentUser.role === 'moderator')
  });

  const proposalPointsQuery = useQuery({
    queryKey: ['proposalPoints'],
    queryFn: () => userDataService.getAdminProposals('point'),
    enabled: auth.isAuthenticated && (auth.currentUser.role === 'admin' || auth.currentUser.role === 'moderator')
  });

  const allUsersQuery = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => userDataService.getAllUsers(),
    enabled: auth.isAuthenticated && (auth.currentUser.role === 'admin' || auth.currentUser.role === 'moderator')
  });

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
    reviews: reviewsQuery.data || [],
    proposalPointCreatures: proposalPointCreaturesQuery.data || [],
    proposalCreatures: proposalCreaturesQuery.data || [],
    proposalPoints: proposalPointsQuery.data || [],
    proposalReviews: [], // TODO: 汎用フック化
    allUsers: allUsersQuery.data || [],

    // ログ操作
    addLog: async (log: any) => {
      if (!auth.isAuthenticated) return;
      const res = await userDataService.saveLog(auth.currentUser.id, log);
      logsQuery.refetch();
      return { id: res };
    },
    updateLog: async (id: string, data: any) => {
      if (!auth.isAuthenticated) return;
      const log = (logsQuery.data || []).find((l: any) => l.id === id);
      if (log) {
        const res = await userDataService.saveLog(auth.currentUser.id, { ...log, ...data });
        logsQuery.refetch();
        return { id: res };
      }
    },
    deleteLog: async (id: string) => {
      if (!auth.isAuthenticated) return;
      await userDataService.deleteLog(auth.currentUser.id, id);
      logsQuery.refetch();
    },
    deleteLogs,
    updateLogs,

    // レビュー・申請
    addReview: async (review: any) => {
      if (!auth.isAuthenticated) return;
      const res = await userDataService.saveReview(auth.currentUser.id, review);
      reviewsQuery.refetch();
      return { id: res };
    },
    updateReview: async (id: string, data: any) => {
      if (!auth.isAuthenticated) return;
      const res = await userDataService.saveReview(auth.currentUser.id, { id, ...data });
      reviewsQuery.refetch();
      return { id: res };
    },
    deleteReview: async (id: string) => {
      await userDataService.deleteReview(id);
      reviewsQuery.refetch();
    },
    addCreature: async (creature: any) => {
      await adminActions.approveProposal('creature', creature.id || Date.now().toString(), creature);
    },
    addCreatureProposal: async (proposal: any) => {
      await userDataService.saveLog(auth.currentUser.id, proposal as any); // Dummy for now
    },
    addPoint: async (point: any) => {
      await adminActions.approveProposal('point', point.id || Date.now().toString(), point);
    },
    addPointProposal: async (proposal: any) => {
      console.log("Point proposal:", proposal);
    },
    addPointCreature: async (rel: any) => {
      console.log("addPointCreature in AppContext:", rel);
    },
    addPointCreatureProposal: async (proposal: any) => {
      console.log("Point creature proposal:", proposal);
    },
    deleteAccount: async () => {
      if (!auth.isAuthenticated) return;
      await userDataService.deleteAccount(auth.currentUser.id);
      auth.logout();
    },

    // 管理者
    updateUserRole: async (userId: string, role: string) => {
      await updateDoc(doc(firestore, 'users', userId), { role });
    },
    updateCreature: async (id: string, data: any) => {
      await updateDoc(doc(firestore, 'creatures', id), data);
    },
    updatePoint: async (id: string, data: any) => {
      await updateDoc(doc(firestore, 'points', id), data);
    },
    removePointCreature: async (id: string) => {
      await deleteDoc(doc(firestore, 'point_creatures', id));
    },
    removePointCreatureProposal: async (id: string) => {
      await deleteDoc(doc(firestore, 'point_creature_proposals', id));
    },

    toggleFavorite,
    toggleWanted,
    toggleBookmarkPoint,
    toggleLikeLog: async (logOrId: any) => {
      const logId = typeof logOrId === 'string' ? logOrId : logOrId.id;
      if (!auth.isAuthenticated || !logId) return;
      await userDataService.toggleLikeLog(auth.currentUser.id, logId);
      logsQuery.refetch();
      recentLogsQuery.refetch();
    },
    isLoading: auth.isLoading || points.isLoading || creatures.isLoading || zones.isLoading || areas.isLoading || agencies.isLoading || regions.isLoading || logsQuery.isLoading || recentLogsQuery.isLoading
  }), [
    auth, adminActions, points.data, creatures.data, pointCreatures.data,
    regions.data, zones.data, areas.data, agencies.data,
    logsQuery.data, recentLogsQuery.data, reviewsQuery.data, proposalPointCreaturesQuery.data
  ]);

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
