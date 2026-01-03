import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import { Point } from '../types';

const QUERY_KEY = ['points'];

export function usePoints() {
  const queryInfo = useQuery<Point[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      console.log('[usePoints] Fetching points from MasterDataService (SQLite/Hybrid)...');
      return await masterDataService.getAllPoints();
    },
    staleTime: Infinity, // マスタデータなので、アプリ起動中はキャッシュを保持
  });

  return {
    ...queryInfo,
    isLoading: queryInfo.isLoading
  };
}
