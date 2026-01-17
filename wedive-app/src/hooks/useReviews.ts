import { useQuery, useQueryClient } from '@tanstack/react-query';
import { masterDataService } from '../services/MasterDataService';
import { userDataService } from '../services/UserDataService';
import { Review } from '../types';
import { useAuth } from '../context/AuthContext';

export function useReviews(pointId?: string, areaId?: string) {
  const { user } = useAuth();

  // 1. Approved reviews from MasterDataService (SQLite)
  const approved = useQuery<Review[]>({
    queryKey: ['reviews', pointId, 'approved'],
    enabled: !!pointId,
    queryFn: async () => {
      const results = await masterDataService.getReviewsByPoint(pointId!);
      return results as Review[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // 2. Personal reviews from UserDataService (Local SQLite)
  const personal = useQuery<Review[]>({
    queryKey: ['reviews', pointId, user?.id],
    enabled: !!pointId && !!user && user.id !== 'guest',
    queryFn: async () => {
      // 修正: my_settings参照ではなく、正しい my_reviews テーブルから取得する
      const allMyReviews = await userDataService.getMyReviews();
      return allMyReviews.filter(r => r.pointId === pointId) as Review[];
    },
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  // 3. Area reviews (for average) from MasterDataService
  const area = useQuery<Review[]>({
    queryKey: ['reviews', 'area', areaId],
    enabled: !!areaId,
    queryFn: async () => {
      const results = await masterDataService.getReviewsByArea(areaId!);
      return results as Review[];
    },
    staleTime: 1000 * 60 * 60,
  });

  const deleteReview = async (reviewId: string) => {
    // TODO: implement delete in UserDataService if needed
    console.log('Delete review:', reviewId);
  };

  return {
    approved: approved.data || [],
    personal: personal.data || [],
    area: area.data || [],
    isLoading: approved.isPending || personal.isPending || area.isPending,
    deleteReview
  };
}
