import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import { Creature } from '../types';

export const useCreatures = () => {
  const queryInfo = useQuery<Creature[]>({
    queryKey: ['creatures'],
    queryFn: async () => {
      console.log('[useCreatures] Fetching creatures from MasterDataService (SQLite/Hybrid)...');
      return await masterDataService.getAllCreatures();
    },
    staleTime: Infinity,
  });

  return {
    data: queryInfo.data || [],
    isLoading: queryInfo.isLoading
  };
};
