import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';

export const useRegions = () => {
  return useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      // Basic region mock as they are often hardcoded or derived from zones
      const zones = await masterDataService.getZones();
      const regionNames = Array.from(new Set(zones.map(z => z.regionId))).filter(Boolean);
      return regionNames.map(name => ({ id: name, name }));
    },
    staleTime: Infinity,
  });
};
