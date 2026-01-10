import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import type { Point } from '../types';

export const usePoints = () => {
  return useQuery<Point[]>({
    queryKey: ['points'],
    queryFn: async () => {
      console.log('[usePoints] Fetching points from MasterDataService...');
      return await masterDataService.getAllPoints();
    },
    staleTime: Infinity,
  });
};
