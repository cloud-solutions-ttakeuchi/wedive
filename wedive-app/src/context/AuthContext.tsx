import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, onSnapshot, updateDoc, deleteDoc, collection, query, orderBy } from 'firebase/firestore';
import { User, DiveLog } from '../types';
import { userDataService } from '../services/UserDataService';

type AuthContextType = {
  user: User | null;
  logs: DiveLog[];
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  logs: [],
  firebaseUser: null,
  isAuthenticated: false,
  isLoading: true,
  signOut: async () => { },
  updateUser: async () => { },
  deleteAccount: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<DiveLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // SQLiteの初期化と必要に応じた初期同期を開始
        try {
          await userDataService.initialize();
          await userDataService.syncInitialData(fbUser.uid);

          // ローカルSQLiteから初期ロード
          const localLogs = await userDataService.getLogs();
          if (localLogs.length > 0) {
            setLogs(localLogs);
          }
          const localUser = await userDataService.getSetting<User>('profile');
          if (localUser) {
            setUser(localUser);
          }
          setIsLoading(false);
        } catch (err) {
          console.error("Initial SQLite sync error:", err);
        }

        // 1. Sync User Profile
        unsubUser = onSnapshot(doc(db, 'users', fbUser.uid), async (snap) => {
          if (snap.exists()) {
            const userData = { id: snap.id, ...snap.data() } as User;
            setUser(userData);
            await userDataService.saveSetting('profile', userData);
          } else {
            // Fallback for new users
            const guestUser: User = {
              id: fbUser.uid,
              name: fbUser.displayName || 'Guest',
              role: 'user',
              trustScore: 0,
              favorites: { points: [], areas: [], shops: [], gear: { tanks: [] } },
              favoriteCreatureIds: [],
              wanted: [],
              bookmarkedPointIds: [],
            };
            setUser(guestUser);
            await userDataService.saveSetting('profile', guestUser);
          }
        });

        // 2. Sync User Logs (Sub-collection)
        const logsQuery = query(
          collection(db, 'users', fbUser.uid, 'logs'),
          orderBy('date', 'desc')
        );
        unsubLogs = onSnapshot(logsQuery, async (snap) => {
          const logsData = snap.docs.map(d => ({ ...d.data(), id: d.id } as DiveLog));
          setLogs(logsData);
          setIsLoading(false);

          // Firestoreからの変更をSQLiteにも反映（リアルタイム同期）
          // 差分のみ更新するのが理想だが、ここでは全件ループで保存
          for (const log of logsData) {
            await userDataService.saveLog(fbUser.uid, log, false); // 第3引数は Firestore への二重書き込み防止
          }
        }, (err) => {
          console.error("Logs sync error:", err);
          setIsLoading(false);
        });

      } else {
        setUser(null);
        setLogs([]);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
      if (unsubLogs) unsubLogs();
    };
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!firebaseUser || !user) return;
    try {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      // SQLite に即時保存
      await userDataService.saveSetting('profile', updatedUser);
      // Firestore に非同期で反映
      await updateDoc(doc(db, 'users', firebaseUser.uid), userData);
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    if (!firebaseUser) return;
    try {
      await deleteDoc(doc(db, 'users', firebaseUser.uid));
      await firebaseUser.delete();
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      logs,
      firebaseUser,
      isAuthenticated: !!firebaseUser,
      isLoading,
      signOut,
      updateUser,
      deleteAccount
    }}>
      {children}
    </AuthContext.Provider>
  );
};
