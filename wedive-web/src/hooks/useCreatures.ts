import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import type { Creature } from '../types';

export const useCreatures = () => {
  return useQuery<Creature[]>({
    queryKey: ['creatures'],
    queryFn: async () => {
      console.log('[useCreatures] Fetching creatures from MasterDataService...');
      return await masterDataService.getAllCreatures();
    },
    staleTime: Infinity,
  });
};
