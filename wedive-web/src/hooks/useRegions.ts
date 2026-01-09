import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';

export const useRegions = () => {
  return useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      return await masterDataService.getRegions();
    },
    staleTime: Infinity,
  });
};
