import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, updateDoc, deleteDoc, getDoc, runTransaction } from 'firebase/firestore';
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
  refreshProfile: () => Promise<void>;
  refreshLogs: () => Promise<void>;
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
  refreshProfile: async () => { },
  refreshLogs: async () => { },
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

          // 1. 他人のデータの掃除を先に行う (DBロック回避)
          await userDataService.cleanupOtherUsersData(fbUser.uid);
          // 2. その後、自分のDBを初期化・接続
          await userDataService.initialize(fbUser.uid);

          // 3. 必要に応じた初回同期（Firestore -> SQLite）
          // Issue #146: ログインの度にデータを同期する仕様のため、force=true で実行
          await userDataService.syncInitialData(fbUser.uid, true);

          // 3. AIコンシェルジュチケットの付与チェックと同期
          await aiConciergeService.grantDailyTicket(fbUser.uid);
          await aiConciergeService.syncTickets(fbUser.uid);

          // 3.5. ログの差分同期
          await userDataService.syncLogs(fbUser.uid);

          // 4. 常に最新の SQLite からデータをロード
          const [localLogs, localProfile] = await Promise.all([
            userDataService.getLogs(),
            userDataService.getSetting<User>('profile')
          ]);

          setLogs(localLogs || []);

          if (localProfile) {
            setUser(localProfile);
          } else {
            // SQLiteにない場合(初回ログイン等)、Firestoreから取得
            const userDocRef = doc(db, 'users', fbUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const remoteUser = userDocSnap.data() as User;
              setUser(remoteUser);
              // 次回のために保存
              await userDataService.saveSetting('profile', remoteUser);
            }
          }

          setIsLoading(false);

          // バックグラウンドで最新プロフィールを確認・更新
          refreshProfile();

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
      await userDataService.logout();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!firebaseUser) return;
    try {
      // 1. Transactional Update (Firestore)
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User document does not exist!");
        }
        transaction.update(userRef, {
          ...userData,
          updatedAt: new Date().toISOString()
        });
      });

      // 2. Local Update
      const newUser = { ...(user || { id: firebaseUser.uid } as User), ...userData };
      setUser(newUser);
      await userDataService.saveSetting('profile', newUser);

    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (!firebaseUser) return;
    try {
      // リモートの最新情報を取得してローカルと同期
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const remoteUser = userDocSnap.data() as User;
        const localProfile = await userDataService.getSetting<User>('profile');

        // ローカルがない、あるいはリモートと異なれば更新
        if (!localProfile || JSON.stringify(remoteUser) !== JSON.stringify(localProfile)) {
          console.log("[AuthContext] Profile synced with remote");
          setUser(remoteUser);
          await userDataService.saveSetting('profile', remoteUser);
        } else {
          // ローカルがある場合、まずはそれをセット（初期ロードの補助）
          setUser(localProfile);
        }
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  };

  const syncData = async () => {
    if (!firebaseUser) return;
    try {
      await userDataService.syncInitialData(firebaseUser.uid, true);
      await userDataService.syncLogs(firebaseUser.uid);

      // Refresh local state after sync
      const [localLogs, localProfile] = await Promise.all([
        userDataService.getLogs(),
        userDataService.getSetting<User>('profile')
      ]);
      setLogs(localLogs || []);
      if (localProfile) setUser(localProfile);
    } catch (error) {
      console.error("Error executing force sync:", error);
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
      refreshProfile,
      syncData,
      refreshLogs: async () => {
        if (firebaseUser) {
          const localLogs = await userDataService.getLogs();
          setLogs(localLogs);
        }
      },
      deleteAccount
    }}>
      {children}
    </AuthContext.Provider>
  );
};
