import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import { PointCreature } from '../types';

const QUERY_KEY = ['pointCreatures'];

export function usePointCreatures() {
  const queryInfo = useQuery<PointCreature[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      console.log('[usePointCreatures] Fetching from MasterDataService (SQLite/Hybrid)...');
      return await masterDataService.getAllPointCreatures();
    },
    staleTime: Infinity,
  });

  return {
    ...queryInfo,
    isLoading: queryInfo.isLoading
  };
}
