import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Review } from '../types';

export function useHomeData() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 承認済みの最新レビューを取得（最大20件）
    const qLatest = query(
      collection(db, 'reviews'),
      where('status', '==', 'approved'),
      limit(20)
    );

    const unsubscribe = onSnapshot(qLatest, (snapshot) => {
      console.log('[HomeData] Snapshot size:', snapshot.size);
      const latestReviews = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Review))
        // クライアント側ソート（createdAtの降順）
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      console.log('[HomeData] Filtered reviews:', latestReviews.length);
      queryClient.setQueryData(['reviews', 'latest'], latestReviews);
      setIsLoading(false);
    }, (err) => {
      console.error('[HomeData] Error fetching latest reviews:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [queryClient]);

  const latestReviews = useQuery<Review[]>({
    queryKey: ['reviews', 'latest'],
    staleTime: Infinity,
    enabled: false,
    queryFn: () => [],
    initialData: []
  });

  return {
    latestReviews: latestReviews.data || [],
    isLoading
  };
}
