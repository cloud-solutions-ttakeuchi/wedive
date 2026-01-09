import React, { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { usePoints } from '../hooks/usePoints';
import { useCreatures } from '../hooks/useCreatures';
import { usePointCreatures } from '../hooks/usePointCreatures';
import { useQuery } from '@tanstack/react-query';
import { userDataService } from '../services/UserDataService';

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

  // マスタデータ（非推奨アクセス）
  points: any[];
  creatures: any[];
  pointCreatures: any[];

  // ログ（非推奨アクセス）
  logs: any[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const points = usePoints();
  const creatures = useCreatures();
  const pointCreatures = usePointCreatures();

  // ログも一旦ここに繋ぐ（互換性のため）
  const logsQuery = useQuery({
    queryKey: ['logs', auth.currentUser.id],
    queryFn: () => userDataService.getLogs(),
    enabled: auth.isAuthenticated && auth.currentUser.id !== 'guest'
  });

  const value = useMemo(() => ({
    ...auth,
    points: points.data || [],
    creatures: creatures.data || [],
    pointCreatures: pointCreatures.data || [],
    logs: logsQuery.data || [],
    isLoading: auth.isLoading || points.isLoading || creatures.isLoading
  }), [auth, points.data, points.isLoading, creatures.data, creatures.isLoading, pointCreatures.data, logsQuery.data]);

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
