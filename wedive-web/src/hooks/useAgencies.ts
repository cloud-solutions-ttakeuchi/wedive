import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';

export const useAgencies = () => {
  return useQuery({
    queryKey: ['agencies'],
    queryFn: () => masterDataService.getAgencies(),
    staleTime: Infinity,
  });
};
