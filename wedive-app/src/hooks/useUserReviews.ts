import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Review } from '../types';
import { useAuth } from '../context/AuthContext';

export function useUserReviews() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || user.id === 'guest') {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'reviews'),
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      queryClient.setQueryData(['reviews', 'user', user.id], userReviews);
      setIsLoading(false);
    }, (err) => {
      console.error("User reviews sync error:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id, queryClient]);

  const reviews = useQuery<Review[]>({
    queryKey: ['reviews', 'user', user?.id],
    enabled: !!user && user.id !== 'guest',
    queryFn: () => [],
    initialData: []
  });

  return {
    reviews: reviews.data || [],
    isLoading
  };
}
