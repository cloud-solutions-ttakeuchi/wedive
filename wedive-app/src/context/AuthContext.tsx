import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          // 1. SQLiteの初期化と、必要に応じた初回同期（Firestore -> SQLite）
          await userDataService.initialize();
          await userDataService.syncInitialData(fbUser.uid);

          // 2. 常に SQLite を正本としてデータをロード
          const [localLogs, localProfile] = await Promise.all([
            userDataService.getLogs(),
            userDataService.getSetting<User>('profile')
          ]);

          if (localLogs) setLogs(localLogs);
          if (localProfile) setUser(localProfile);

          setIsLoading(false);
        } catch (err) {
          console.error("Initial data load error:", err);
          setIsLoading(false);
        }
      } else {
        setUser(null);
        setLogs([]);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
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
