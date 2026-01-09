import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';

export const useZones = () => {
  return useQuery({
    queryKey: ['zones'],
    queryFn: () => masterDataService.getZones(),
    staleTime: Infinity,
  });
};
