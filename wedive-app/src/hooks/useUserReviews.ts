import { useQuery } from '@tanstack/react-query';
import { userDataService } from '../services/UserDataService';
import { Review } from '../types';
import { useAuth } from '../context/AuthContext';

export function useUserReviews() {
  const { user } = useAuth();

  const reviews = useQuery<Review[]>({
    queryKey: ['reviews', 'user', user?.id],
    enabled: !!user && user.id !== 'guest',
    queryFn: async () => {
      // 自分のレビュー（承認待ち含む）をSQLiteから取得
      const results = await userDataService.getReviews();
      return results as Review[];
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    reviews: reviews.data || [],
    isLoading: reviews.isLoading
  };
}
