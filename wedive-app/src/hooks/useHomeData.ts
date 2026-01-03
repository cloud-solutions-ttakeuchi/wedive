import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import { Review } from '../types';

export function useHomeData() {
  const latestReviews = useQuery<Review[]>({
    queryKey: ['reviews', 'latest'],
    queryFn: async () => {
      const reviews = await masterDataService.getLatestReviews(20);
      return reviews.map(r => ({
        ...r,
        createdAt: r.createdAt || new Date().toISOString()
      } as Review));
    },
    staleTime: 1000 * 60 * 30, // 30分間はキャッシュを利用
  });

  return {
    latestReviews: latestReviews.data || [],
    isLoading: latestReviews.isLoading
  };
}
