import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import { AgencyMaster } from 'wedive-shared';

const QUERY_KEY = ['agencies'];

export function useAgencies() {
  const queryInfo = useQuery<AgencyMaster[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      console.log('[useAgencies] Fetching agencies from MasterDataService (SQLite)...');
      return await masterDataService.getAllAgencies();
    },
    staleTime: Infinity,
  });

  return {
    ...queryInfo,
    agencies: queryInfo.data || [],
    isLoading: queryInfo.isLoading
  };
}
