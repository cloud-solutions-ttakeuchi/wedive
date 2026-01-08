import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User, DiveLog } from '../types';
import { userDataService } from '../services/UserDataService';
import { aiConciergeService } from '../services/AiConciergeService';

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
          // b-3: 隔離。まずメモリ上の（他人の可能性がある）データを即座に消去する
          setLogs([]);
          setUser(null);
          setIsLoading(true);

          // 1. UIDベースでのSQLite初期化と、他人のデータの掃除
          await userDataService.initialize(fbUser.uid);
          await userDataService.cleanupOtherUsersData(fbUser.uid);

          // 2. 必要に応じた初回同期（Firestore -> SQLite）
          await userDataService.syncInitialData(fbUser.uid);

          // 3. AIコンシェルジュチケットの付与チェックと同期
          await aiConciergeService.grantDailyTicket(fbUser.uid);
          await aiConciergeService.syncTickets(fbUser.uid);

          // 4. 常に最新の SQLite からデータをロード
          const [localLogs, localProfile] = await Promise.all([
            userDataService.getLogs(),
            userDataService.getSetting<User>('profile')
          ]);

          setLogs(localLogs || []);
          setUser(localProfile);

          setIsLoading(false);
        } catch (err) {
          console.error("Initial data load error:", err);
          setIsLoading(false);
        }
      } else {
        // ログアウト時
        await userDataService.logout();
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
      // セキュリティのためログアウト時にローカルデータをクリアするか検討が必要ですが、
      // 今回は「ログイン時の UID チェック」で不一致なら消すロジックに倒しています。
      // 仕様通り「退会時」は確実に消します。
      await userDataService.logout();
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
      // 1. Firestoreデータ削除
      await deleteDoc(doc(db, 'users', firebaseUser.uid));
      // 2. ローカルデータ削除 (不具合報告に基づき追加)
      await userDataService.clearUserData();
      // 3. 認証ユーザー削除
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
