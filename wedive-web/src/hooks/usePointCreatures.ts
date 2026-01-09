import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import type { PointCreature } from '../types';

export const usePointCreatures = () => {
  return useQuery<PointCreature[]>({
    queryKey: ['pointCreatures'],
    queryFn: async () => {
      console.log('[usePointCreatures] Fetching pointCreatures from MasterDataService...');
      return await masterDataService.getAllPointCreatures();
    },
    staleTime: Infinity,
  });
};
