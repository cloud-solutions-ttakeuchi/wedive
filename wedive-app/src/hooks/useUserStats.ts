import { useQuery } from '@tanstack/react-query';
import { userDataService } from '../services/UserDataService';
import { useAuth } from '../context/AuthContext';

const QUERY_KEY = ['userStatsMastery'];

export interface UserMasteryStats {
  points: {
    pointId: string;
    pointName: string;
    imageUrl?: string;
    diveCount: number;
    masteryRate: number;
    discoveredCount: number;
    totalCount: number;
    creaturesAtPoint: {
      id: string;
      imageUrl?: string;
      localRarity?: string;
      isDiscovered: boolean;
    }[];
    discoveredIds: string[];
  }[];
  updatedAt: any;
}

export function useUserStats() {
  const { user } = useAuth();

  const queryInfo = useQuery<UserMasteryStats | null>({
    queryKey: QUERY_KEY,
    enabled: !!user?.id && user.id !== 'guest',
    queryFn: async () => {
      console.log('[useUserStats] Loading stats from UserDataService (SQLite)...');
      return await userDataService.getSetting<UserMasteryStats>('mastery_stats');
    },
    staleTime: 1000 * 60 * 10, // 10 mins
  });

  return {
    ...queryInfo,
    isLoading: queryInfo.isLoading
  };
}
