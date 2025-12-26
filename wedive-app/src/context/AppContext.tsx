import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Point, Creature, PointCreature } from '../types';

type AppContextType = {
  points: Point[];
  creatures: Creature[];
  pointCreatures: PointCreature[];
  isLoading: boolean;
};

const AppContext = createContext<AppContextType>({
  points: [],
  creatures: [],
  pointCreatures: [],
  isLoading: true,
});

export const useApp = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [points, setPoints] = useState<Point[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [pointCreatures, setPointCreatures] = useState<PointCreature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const pointsQuery = query(collection(db, 'points'));
    const creaturesQuery = query(collection(db, 'creatures'));
    const pointCreaturesQuery = query(collection(db, 'point_creatures'));

    const unsubPoints = onSnapshot(pointsQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Point));
      setPoints(data);
    });

    const unsubCreatures = onSnapshot(creaturesQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creature));
      setCreatures(data);
    });

    const unsubPointCreatures = onSnapshot(pointCreaturesQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PointCreature));
      setPointCreatures(data);
      setIsLoading(false);
    });

    return () => {
      unsubPoints();
      unsubCreatures();
      unsubPointCreatures();
    };
  }, []);

  return (
    <AppContext.Provider value={{ points, creatures, pointCreatures, isLoading }}>
      {children}
    </AppContext.Provider>
  );
};
