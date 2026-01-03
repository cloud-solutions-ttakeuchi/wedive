import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import { Review } from '../types';
import { useAuth } from '../context/AuthContext';

export function useUserReviews() {
  const { user } = useAuth();

  const reviews = useQuery<Review[]>({
    queryKey: ['reviews', 'user', user?.id],
    enabled: !!user && user.id !== 'guest',
    queryFn: async () => {
      // 本来は UserDataService にあるべきだが、一旦 MasterDataService から取得
      // (マスタ反映済みの自分のレビューなど)
      const results = await masterDataService.getLatestReviews(100);
      return results.filter(r => r.user_id === user?.id) as Review[];
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    reviews: reviews.data || [],
    isLoading: reviews.isLoading
  };
}
