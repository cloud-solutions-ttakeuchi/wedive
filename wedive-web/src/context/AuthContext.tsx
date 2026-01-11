import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { auth, googleProvider, db as firestore } from '../lib/firebase';
import { signInWithRedirect, signOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import type { User } from '../types';
import { userDataService } from '../services/UserDataService';
import { AiConciergeService } from '../services/AiConciergeService';

interface AuthContextType {
  currentUser: User;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_USER: User = {
  id: 'guest',
  name: 'Guest',
  role: 'user',
  trustScore: 0,
  favoriteCreatureIds: [],
  favorites: { points: [], areas: [], shops: [], gear: { tanks: [] } },
  wanted: [],
  bookmarkedPointIds: []
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setIsAuthenticated(true);
        setIsLoading(true);

        // 1. Initialize SQLite User Data
        await userDataService.initialize(fbUser.uid);

        // 2. Daily Chat Ticket Bonus
        await AiConciergeService.grantDailyTicket(fbUser.uid);

        // 3. Initial Sync (if needed)
        await userDataService.syncInitialData(fbUser.uid);

        // 4. Load from SQLite
        const localProfile = await userDataService.getSetting<User>('profile');
        if (localProfile) {
          setCurrentUser(localProfile);
        } else {
          // Fallback to Firestore if SQLite is somehow empty
          const docSnap = await getDoc(doc(firestore, 'users', fbUser.uid));
          if (docSnap.exists()) {
            const user = { ...docSnap.data(), id: fbUser.uid } as User;
            setCurrentUser(user);
            await userDataService.saveSetting('profile', user);
          }
        }
        setIsLoading(false);
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
        setCurrentUser(GUEST_USER);
        await userDataService.logout();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const login = async () => {
    setIsLoading(true);
    // Bypassing COOP/COEP for Google Auth via popup
    const width = 500;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    const popup = window.open('/auth.html', 'firebase_auth_popup', `width=${width},height=${height},left=${left},top=${top}`);

    if (!popup) {
      alert('ポップアップがブロックされました。許可してください。');
      setIsLoading(false);
      return;
    }
  };

  const logout = async () => {
    try { setIsLoading(true); await signOut(auth); }
    catch (error) { console.error(error); setIsLoading(false); }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!isAuthenticated || currentUser.id === 'guest') return;

    try {
      await runTransaction(firestore, async (transaction) => {
        const userRef = doc(firestore, 'users', currentUser.id);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User document does not exist!");
        }
        transaction.update(userRef, {
          ...userData,
          updatedAt: new Date().toISOString()
        });
      });

      // Update local state only after successful transaction
      const updatedUser = { ...currentUser, ...userData };
      setCurrentUser(updatedUser);
      await userDataService.saveSetting('profile', updatedUser);
    } catch (error) {
      console.error("Failed to update user profile:", error);
    }
  };

  const refreshProfile = async () => {
    if (!isAuthenticated || currentUser.id === 'guest') return;
    const localProfile = await userDataService.getSetting<User>('profile');
    if (localProfile) {
      setCurrentUser(localProfile);
    }
  };

  const value = {
    currentUser,
    firebaseUser,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
