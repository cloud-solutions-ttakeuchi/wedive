import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';

export const useAreas = () => {
  return useQuery({
    queryKey: ['areas'],
    queryFn: () => masterDataService.getAreas(),
    staleTime: Infinity,
  });
};
