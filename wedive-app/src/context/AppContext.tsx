import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Point, Creature } from '../types';

type AppContextType = {
  points: Point[];
  creatures: Creature[];
  isLoading: boolean;
};

const AppContext = createContext<AppContextType>({
  points: [],
  creatures: [],
  isLoading: true,
});

export const useApp = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [points, setPoints] = useState<Point[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 承認済みデータのみを取得して監視
    const pointsQuery = query(collection(db, 'points'), where('status', 'in', ['approved', 'pending']));
    const creaturesQuery = query(collection(db, 'creatures'), where('status', 'in', ['approved', 'pending']));

    const unsubPoints = onSnapshot(pointsQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Point));
      setPoints(data);
    });

    const unsubCreatures = onSnapshot(creaturesQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creature));
      setCreatures(data);
      setIsLoading(false);
    });

    return () => {
      unsubPoints();
      unsubCreatures();
    };
  }, []);

  return (
    <AppContext.Provider value={{ points, creatures, isLoading }}>
      {children}
    </AppContext.Provider>
  );
};
