import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Review } from '../types';
import { useAuth } from '../context/AuthContext';

export function useReviews(pointId?: string, areaId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!pointId) {
      setIsLoading(false);
      return;
    }

    // 1. Snapshot for all approved reviews for this point
    const qApproved = query(
      collection(db, 'reviews'),
      where('pointId', '==', pointId),
      limit(100)
    );

    const unsubscribeApproved = onSnapshot(qApproved, (snapshot) => {
      const approvedReviews = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Review))
        .filter(r => r.status === 'approved' || !r.status);

      queryClient.setQueryData(['reviews', pointId, 'approved'], approvedReviews);
      setIsLoading(false);
    });

    // 2. Snapshot for personal reviews (including pending)
    let unsubscribePersonal = () => { };
    if (user && user.id !== 'guest') {
      const qPersonal = query(
        collection(db, 'reviews'),
        where('pointId', '==', pointId),
        where('userId', '==', user.id)
      );
      unsubscribePersonal = onSnapshot(qPersonal, (snapshot) => {
        const personalReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
        queryClient.setQueryData(['reviews', pointId, user.id], personalReviews);
      });
    }

    // 3. Snapshot for area reviews (to calculate average)
    let unsubscribeArea = () => { };
    if (areaId) {
      const qArea = query(
        collection(db, 'reviews'),
        where('areaId', '==', areaId),
        limit(200)
      );
      unsubscribeArea = onSnapshot(qArea, (snapshot) => {
        const areaReviews = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Review))
          .filter(r => r.status === 'approved' || !r.status);
        queryClient.setQueryData(['reviews', 'area', areaId], areaReviews);
      });
    }

    return () => {
      unsubscribeApproved();
      unsubscribePersonal();
      unsubscribeArea();
    };
  }, [pointId, areaId, user?.id, queryClient]);

  const approved = useQuery<Review[]>({
    queryKey: ['reviews', pointId, 'approved'],
    enabled: !!pointId,
    initialData: []
  });

  const personal = useQuery<Review[]>({
    queryKey: ['reviews', pointId, user?.id],
    enabled: !!pointId && !!user && user.id !== 'guest',
    initialData: []
  });

  const area = useQuery<Review[]>({
    queryKey: ['reviews', 'area', areaId],
    enabled: !!areaId,
    initialData: []
  });

  return {
    approved: approved.data || [],
    personal: personal.data || [],
    area: area.data || [],
    isLoading: isLoading || approved.isLoading
  };
}
