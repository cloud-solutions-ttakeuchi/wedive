import { createContext, useContext, useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import type { User, Log, Rarity, Creature, Point, PointCreature, Review, PointCreatureProposal, Region, Zone, Area } from '../types';

import { auth, googleProvider, db as firestore, functions } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';

import { MasterDataSyncService } from '../services/MasterDataSyncService';
import { masterDbEngine } from '../services/WebSQLiteEngine';
// Helper to remove undefined values
const sanitizePayload = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => sanitizePayload(item));
  }
  if (data !== null && typeof data === 'object') {
    return Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = sanitizePayload(value);
      }
      return acc;
    }, {} as any);
  }
  return data;
};

interface AppContextType {
  currentUser: User;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  calculateRarity: (creatureId: string) => Rarity;
  addLog: (logData: Omit<Log, 'id' | 'userId'>) => Promise<Log>;
  addCreature: (creatureData: Omit<Creature, 'id'>) => Promise<Creature>;
  addPoint: (pointData: Omit<Point, 'id'>) => Promise<Point>;
  updateLog: (logId: string, logData: Partial<Log>) => Promise<void>;
  updateCreature: (creatureId: string, creatureData: Partial<Creature>) => Promise<void>;
  updatePoint: (pointId: string, pointData: Partial<Point>) => Promise<void>;
  deleteLog: (logId: string) => Promise<void>;
  deleteLogs: (logIds: string[]) => Promise<void>;
  updateLogs: (logIds: string[], data: Record<string, any>) => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  toggleLikeLog: (log: Log) => Promise<void>;
  toggleFavorite: (creatureId: string) => void;
  toggleWanted: (creatureId: string) => void;
  toggleBookmarkPoint: (pointId: string) => void;

  areas: Area[];
  addPointCreature: (pointId: string, creatureId: string, localRarity: Rarity) => Promise<void>;
  removePointCreature: (pointId: string, creatureId: string) => Promise<void>;
  approveProposal: (type: 'creature' | 'point' | 'point-creature', id: string, data: any) => Promise<void>;
  rejectProposal: (type: 'creature' | 'point' | 'point-creature', id: string) => Promise<void>;
  addCreatureProposal: (data: any) => Promise<void>;
  addPointProposal: (data: any) => Promise<void>;
  addPointCreatureProposal: (data: any) => Promise<void>;
  removePointCreatureProposal: (pointId: string, creatureId: string) => Promise<void>;
  addReview: (reviewData: Omit<Review, 'id' | 'userId' | 'userName' | 'userProfileImage' | 'trustLevel' | 'createdAt' | 'status' | 'helpfulCount' | 'helpfulBy'>) => Promise<void>;

  // Expose data directly
  creatures: Creature[];
  points: Point[];
  pointCreatures: PointCreature[];
  logs: Log[];
  reviews: Review[];
  proposalReviews: Review[];
  recentLogs: Log[];
  proposalCreatures: (Creature & { proposalType?: string, diffData?: any, targetId?: string, reason?: string })[];
  proposalPoints: (Point & { proposalType?: string, diffData?: any, targetId?: string, reason?: string })[];
  proposalPointCreatures: PointCreatureProposal[];
  regions: Region[];
  zones: Zone[];

  // Admin
  allUsers: User[];
  updateUserRole: (uid: string, newRole: 'user' | 'moderator' | 'admin') => Promise<void>;
  deleteAccount: () => Promise<void>;
  approveReview: (reviewId: string) => Promise<void>;
  rejectReview: (reviewId: string) => Promise<void>;
  updateReview: (reviewId: string, reviewData: Partial<Review>) => Promise<void>;
  deleteReview: (reviewId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

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

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isDeletingRef = useRef(false);

  // Data State
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [pointCreatures, setPointCreatures] = useState<PointCreature[]>([]);
  const [dbProposalCreatures, setDbProposalCreatures] = useState<Creature[]>([]);
  const [dbProposalPoints, setDbProposalPoints] = useState<Point[]>([]);
  const [proposalPointCreatures, setProposalPointCreatures] = useState<PointCreatureProposal[]>([]);
  const [allLogs, setAllLogs] = useState<Log[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [proposalReviews, setProposalReviews] = useState<Review[]>([]);
  const [recentLogs, setRecentLogs] = useState<Log[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Master Data State
  const [regions, setRegions] = useState<Region[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // Emulator connections (development only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      if (!(window as any)._firebaseFunctionsConnected) {
        connectFunctionsEmulator(functions, "localhost", 5001);
        (window as any)._firebaseFunctionsConnected = true;
      }
    }
  }, []);

  // 1 & 2. Local-First Master Data Sync & Load
  useEffect(() => {
    const initMasterData = async () => {
      try {
        console.log('[MasterData] Initializing Local-First engine...');

        // A. SQLite 同期 (Firebase Storage から最新 DB を取得)
        await MasterDataSyncService.syncMasterData();

        // B. SQLite からデータをロード
        await masterDbEngine.initialize();

        const loadTable = async <T,>(tableName: string, query: string): Promise<T[]> => {
          try {
            return await masterDbEngine.getAllAsync<T>(query);
          } catch (err) {
            console.warn(`[MasterData] Table ${tableName} not found or query failed, skipping.`);
            return [];
          }
        };

        const [geo, c, p, pc, rv, pl] = await Promise.all([
          loadTable<any>('master_geography', 'SELECT * FROM master_geography'),
          loadTable<any>('master_creatures', 'SELECT * FROM master_creatures LIMIT 1000'),
          loadTable<any>('master_points', 'SELECT * FROM master_points LIMIT 1000'),
          loadTable<any>('master_point_creatures', 'SELECT * FROM master_point_creatures'),
          loadTable<any>('master_point_reviews', 'SELECT * FROM master_point_reviews ORDER BY created_at DESC LIMIT 100'),
          loadTable<any>('master_public_logs', 'SELECT * FROM master_public_logs ORDER BY date DESC LIMIT 20')
        ]);

        // Geography (Region / Zone / Area) の振り分け
        if (geo.length) {
          const regionsObj = geo.filter((i: any) => i.type === 'region');
          const zonesObj = geo.filter((i: any) => i.type === 'zone');
          const areasObj = geo.filter((i: any) => i.type === 'area');

          if (regionsObj.length) setRegions(regionsObj);
          if (zonesObj.length) setZones(zonesObj.map((i: any) => ({ ...i, regionId: i.region_id })));
          if (areasObj.length) setAreas(areasObj.map((i: any) => ({ ...i, zoneId: i.zone_id, regionId: i.region_id })));
        }

        if (c.length) setCreatures(c.map(i => ({ ...i, status: 'approved' })));
        if (p.length) setPoints(p.map(i => ({ ...i, status: 'approved' })));
        if (pc.length) setPointCreatures(pc.map(i => ({ ...i, status: 'approved' })));
        if (rv.length) setReviews(rv.map(i => ({ ...i, status: 'approved' })));
        if (pl.length) setRecentLogs(pl);

        console.log('[MasterData] Master data loaded from SQLite (using unified geography).');

      } catch (e) {
        console.error('[MasterData] Fatal error loading master data:', e);
      }
    };

    initMasterData();
  }, []);

  // 3. Auth & User-Specific Sync
  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(true);
        isDeletingRef.current = false;

        // User Profile Listener
        const userDocRef = doc(firestore, 'users', user.uid);
        unsubUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser({ ...docSnap.data(), id: docSnap.id } as User);
          } else if (!isDeletingRef.current) {
            const newUser: User = {
              id: user.uid,
              name: user.displayName || 'No Name',
              role: 'user',
              trustScore: 0,
              profileImage: user.photoURL || undefined,
              favoriteCreatureIds: [],
              favorites: { points: [], areas: [], shops: [], gear: { tanks: [] } },
              wanted: [],
              bookmarkedPointIds: [],
              createdAt: new Date().toISOString(),
              status: 'provisional'
            };
            setDoc(userDocRef, newUser).catch(console.error);
            setCurrentUser(newUser);
          }
          setIsLoading(false);
        });
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
        setCurrentUser(GUEST_USER);
        setAllLogs([]);
        setDbProposalCreatures([]);
        setDbProposalPoints([]);
        setProposalReviews([]);
        if (unsubUser) { unsubUser(); unsubUser = undefined; }
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
    };
  }, []);

  // 4. Data Sync (Logs, Proposals, Personal Reviews)
  useEffect(() => {
    if (!isAuthenticated || currentUser.id === 'guest') {
      return;
    }

    const userId = currentUser.id;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'moderator';

    // User Logs
    const logsQuery = query(collection(firestore, 'users', userId, 'logs'), orderBy('date', 'desc'));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setAllLogs(snapshot.docs.map(doc => doc.data() as Log));
    }, (err) => console.error("Snapshot error (user logs):", err));

    // Creatures Proposals (Pending)
    const qC = isAdmin
      ? query(collection(firestore, 'creature_proposals'), where('status', '==', 'pending'))
      : query(collection(firestore, 'creature_proposals'), where('submitterId', '==', userId), where('status', '==', 'pending'));
    const unsubC = onSnapshot(qC, (snapshot) => {
      const proposals = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Creature));

      // If Admin, also include 'pending' creatures from the master collection
      if (isAdmin) {
        setDbProposalCreatures(proposals);
      } else {
        setDbProposalCreatures(proposals);
      }
    }, (err) => console.error("Snapshot error (creature proposals):", err));

    // Points Proposals (Pending)
    const qP = isAdmin
      ? query(collection(firestore, 'point_proposals'), where('status', '==', 'pending'))
      : query(collection(firestore, 'point_proposals'), where('submitterId', '==', userId), where('status', '==', 'pending'));
    const unsubP = onSnapshot(qP, (snapshot) => {
      const proposals = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Point));
      if (isAdmin) {
        setDbProposalPoints(proposals); // Just set the database proposals first
      } else {
        setDbProposalPoints(proposals);
      }
    }, (err) => console.error("Snapshot error (point proposals):", err));

    // Reviews (Pending for Admin, Own for User)
    const qR = isAdmin
      ? query(collection(firestore, 'reviews'), where('status', '==', 'pending'))
      : query(collection(firestore, 'reviews'), where('userId', '==', userId));
    const unsubR = onSnapshot(qR, (snapshot) => {
      setProposalReviews(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Review)));
    }, (err: Error) => console.error("Snapshot error (personal/pending reviews):", err));

    // Point-Creature Proposals (New)
    const qPPC = isAdmin
      ? query(collection(firestore, 'point_creature_proposals'), where('status', '==', 'pending'))
      : query(collection(firestore, 'point_creature_proposals'), where('submitterId', '==', userId), where('status', '==', 'pending'));
    const unsubPPC = onSnapshot(qPPC, (snapshot) => {
      setProposalPointCreatures(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PointCreatureProposal)));
    }, (err: Error) => console.error("Snapshot error (point-creature proposals):", err));

    return () => {
      unsubLogs();
      unsubC();
      unsubP();
      unsubR();
      unsubPPC();
    };
  }, [isAuthenticated, currentUser.id, currentUser.role]);

  // [New] Memoized derived proposal lists to avoid set-state-in-effect
  const proposalPoints = useMemo(() => {
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'moderator';
    if (!isAdmin) return dbProposalPoints;

    const pendingMasterPoints = points.filter((p: Point) => p.status === 'pending');
    const prevIds = new Set(dbProposalPoints.map((p: Point) => p.id));
    const newItems = pendingMasterPoints.filter((p: Point) => !prevIds.has(p.id));
    return [...dbProposalPoints, ...newItems].sort((a: Point, b: Point) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [dbProposalPoints, points, currentUser.role]);

  const proposalCreatures = useMemo(() => {
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'moderator';
    if (!isAdmin) return dbProposalCreatures;

    const pendingMasterCreatures = creatures.filter((c: Creature) => c.status === 'pending');
    const prevIds = new Set(dbProposalCreatures.map((c: Creature) => c.id));
    const newItems = pendingMasterCreatures.filter((c: Creature) => !prevIds.has(c.id));
    return [...dbProposalCreatures, ...newItems].sort((a: Creature, b: Creature) => (b.id || '').localeCompare(a.id || ''));
  }, [dbProposalCreatures, creatures, currentUser.role]);

  // Admin Specific: Fetch All Users
  useEffect(() => {
    if (isAuthenticated && (currentUser.role === 'admin' || currentUser.role === 'moderator')) {
      const qUsers = query(collection(firestore, 'users'));
      const unsub = onSnapshot(qUsers, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
      });
      return () => unsub();
    }
  }, [isAuthenticated, currentUser.role]);

  // Actions
  const login = async () => {
    try { setIsLoading(true); await signInWithPopup(auth, googleProvider); }
    catch (error) { console.error(error); setIsLoading(false); }
  };

  const logout = async () => {
    try { setIsLoading(true); await signOut(auth); }
    catch (error) { console.error(error); setIsLoading(false); }
  };

  const deleteAccount = async () => {
    if (!auth.currentUser || !isAuthenticated) return;
    const uid = auth.currentUser.uid;
    setIsLoading(true);
    isDeletingRef.current = true;
    try {
      const batch = writeBatch(firestore);
      allLogs.forEach(log => batch.delete(doc(firestore, 'users', uid, 'logs', log.id)));
      await batch.commit();
      await deleteDoc(doc(firestore, 'users', uid));
      await auth.currentUser.delete();
    } catch (error: any) {
      console.error(error);
      isDeletingRef.current = false;
      await signOut(auth);
      setIsLoading(false);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    const targetId = currentUser?.id;
    if (!targetId || targetId === 'guest') return;
    const cleanData = sanitizePayload(userData);
    setCurrentUser((prev: User) => ({ ...prev, ...userData }));
    if (isAuthenticated) {
      try { await updateDoc(doc(firestore, 'users', targetId), cleanData); }
      catch (e) { console.error(e); }
    }
  };

  const calculateRarity = (creatureId: string): Rarity => {
    const creature = creatures.find(c => c.id === creatureId);
    if (creature?.rarity) return creature.rarity;
    return 'Common';
  };

  const addLog = async (logData: Omit<Log, 'id' | 'userId'>) => {
    const newLogId = `l${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newLog: Log = { ...logData, id: newLogId, userId: currentUser.id };
    if (isAuthenticated) {
      try {
        await setDoc(doc(firestore, 'users', currentUser.id, 'logs', newLogId), sanitizePayload(newLog));
      }
      catch (e) {
        console.error(e);
      }
    }
    return newLog;
  };

  const addCreature = async (creatureData: Omit<Creature, 'id'>) => {
    const newCreature: Creature = { ...creatureData, id: `c${Date.now()}`, status: 'approved' };
    if (isAuthenticated) { await setDoc(doc(firestore, 'creatures', newCreature.id), sanitizePayload(newCreature)); }
    return newCreature;
  };

  const addPoint = async (pointData: Omit<Point, 'id'>) => {
    const newPoint: Point = { ...pointData, id: `p${Date.now()}`, status: 'approved' };
    if (isAuthenticated) { await setDoc(doc(firestore, 'points', newPoint.id), sanitizePayload(newPoint)); }
    return newPoint;
  };

  const addPointCreature = async (pointId: string, creatureId: string, localRarity: Rarity) => {
    const relId = `${pointId}_${creatureId}`;
    const pointCreatureData: PointCreature = { id: relId, pointId, creatureId, localRarity, status: 'approved' };
    try {
      await setDoc(doc(firestore, 'point_creatures', relId), sanitizePayload(pointCreatureData));
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const removePointCreature = async (pointId: string, creatureId: string) => {
    const relId = `${pointId}_${creatureId}`;
    try {
      await deleteDoc(doc(firestore, 'point_creatures', relId));
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteLog = async (logId: string) => {
    if (!isAuthenticated) return;
    try { await deleteDoc(doc(firestore, 'users', currentUser.id, 'logs', logId)); }
    catch (e) { console.error(e); }
  };

  const deleteLogs = async (logIds: string[]) => {
    if (!isAuthenticated) return;
    try {
      const batch = writeBatch(firestore);
      logIds.forEach(id => batch.delete(doc(firestore, 'users', currentUser.id, 'logs', id)));
      await batch.commit();
    } catch (e) { console.error(e); }
  };

  const updateLog = async (logId: string, logData: Partial<Log>) => {
    if (isAuthenticated) {
      try { await updateDoc(doc(firestore, 'users', currentUser.id, 'logs', logId), sanitizePayload(logData)); }
      catch (e) { console.error(e); }
    }
  };

  const updateCreature = async (creatureId: string, creatureData: Partial<Creature>) => {
    if (isAuthenticated) {
      try { await updateDoc(doc(firestore, 'creatures', creatureId), sanitizePayload(creatureData)); }
      catch (e) { console.error(e); }
    }
  };

  const updatePoint = async (pointId: string, pointData: Partial<Point>) => {
    if (isAuthenticated) {
      try { await updateDoc(doc(firestore, 'points', pointId), sanitizePayload(pointData)); }
      catch (e) { console.error(e); }
    }
  };

  const updateLogs = async (logIds: string[], data: Record<string, any>) => {
    if (!isAuthenticated) return;
    try {
      const batch = writeBatch(firestore);
      logIds.forEach(id => batch.update(doc(firestore, 'users', currentUser.id, 'logs', id), sanitizePayload(data)));
      await batch.commit();
    } catch (e) { console.error(e); }
  };

  const toggleLikeLog = async (log: Log) => {
    if (!isAuthenticated) return;
    const isLiked = (log.likedBy || []).includes(currentUser.id);
    const newLikedBy = isLiked ? log.likedBy!.filter(id => id !== currentUser.id) : [...(log.likedBy || []), currentUser.id];
    const newCount = (log.likeCount || 0) + (isLiked ? -1 : 1);
    try { await updateDoc(doc(firestore, 'users', log.userId, 'logs', log.id), { likedBy: newLikedBy, likeCount: newCount }); }
    catch (e) { console.error(e); }
  };

  const toggleFavorite = async (creatureId: string) => {
    const isFav = (currentUser.favoriteCreatureIds || []).includes(creatureId);
    const newFavs = isFav ? currentUser.favoriteCreatureIds!.filter(id => id !== creatureId) : [...(currentUser.favoriteCreatureIds || []), creatureId];
    await updateUser({ favoriteCreatureIds: newFavs });
  };

  const toggleWanted = async (creatureId: string) => {
    const isWanted = (currentUser.wanted || []).includes(creatureId);
    const newWanted = isWanted ? currentUser.wanted!.filter(id => id !== creatureId) : [...(currentUser.wanted || []), creatureId];
    await updateUser({ wanted: newWanted });
  };

  const toggleBookmarkPoint = async (pointId: string) => {
    const isBookmarked = (currentUser.bookmarkedPointIds || []).includes(pointId);
    const newBookmarked = isBookmarked ? currentUser.bookmarkedPointIds!.filter(id => id !== pointId) : [...(currentUser.bookmarkedPointIds || []), pointId];
    await updateUser({ bookmarkedPointIds: newBookmarked });
  };

  const addCreatureProposal = async (data: any) => {
    if (!isAuthenticated) return;
    const proposal = { ...data, submitterId: currentUser.id, status: 'pending', createdAt: new Date().toISOString() };
    await setDoc(doc(firestore, 'creature_proposals', `propc${Date.now()}`), sanitizePayload(proposal));
  };

  const addPointProposal = async (data: any) => {
    if (!isAuthenticated) return;
    const proposal = { ...data, submitterId: currentUser.id, status: 'pending', createdAt: new Date().toISOString() };
    await setDoc(doc(firestore, 'point_proposals', `propp${Date.now()}`), sanitizePayload(proposal));
  };

  const addPointCreatureProposal = async (data: any) => {
    if (!isAuthenticated) return;
    const relId = `${data.pointId}_${data.creatureId}`;
    const proposal = { ...data, targetId: relId, submitterId: currentUser.id, status: 'pending', createdAt: new Date().toISOString() };
    await setDoc(doc(firestore, 'point_creature_proposals', `proppc${Date.now()}`), sanitizePayload(proposal));
  };

  const removePointCreatureProposal = async (pointId: string, creatureId: string) => {
    if (!isAuthenticated) return;
    await addPointCreatureProposal({ pointId, creatureId, proposalType: 'delete' });
  };

  const approveProposal = async (type: 'creature' | 'point' | 'point-creature', id: string, data: any) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') return;
    const now = new Date().toISOString();
    try {
      if (type === 'creature') {
        const targetId = data.targetId || `c${Date.now()}`;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _fid, proposalType: _pt, targetId: _ftid, submitterId: _sid, status: _st, createdAt: _ca, ...finalData } = data;
        await setDoc(doc(firestore, 'creatures', targetId), sanitizePayload({ ...finalData, id: targetId, status: 'approved' }));
        await updateDoc(doc(firestore, 'creature_proposals', id), { status: 'approved', processedAt: now });
      } else if (type === 'point') {
        const targetId = data.targetId || `p${Date.now()}`;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _fid, proposalType: _pt, targetId: _ftid, submitterId: _sid, status: _st, createdAt: _ca, ...finalData } = data;
        await setDoc(doc(firestore, 'points', targetId), sanitizePayload({ ...finalData, id: targetId, status: 'approved' }));
        await updateDoc(doc(firestore, 'point_proposals', id), { status: 'approved', processedAt: now });
      } else if (type === 'point-creature') {
        const targetId = data.targetId || `${data.pointId}_${data.creatureId}`;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _fid, proposalType, targetId: _ftid, submitterId: _sid, status: _st, createdAt: _ca, ...finalData } = data;
        if (proposalType === 'delete') {
          await deleteDoc(doc(firestore, 'point_creatures', targetId));
        } else {
          await setDoc(doc(firestore, 'point_creatures', targetId), sanitizePayload({ ...finalData, id: targetId, status: 'approved' }));
        }
        await updateDoc(doc(firestore, 'point_creature_proposals', id), { status: 'approved', processedAt: now });
      }
      alert('承認完了しました');
    } catch (e: any) {
      console.error(e);
      alert(`承認エラー: ${e.message}`);
    }
  };

  const rejectProposal = async (type: 'creature' | 'point' | 'point-creature', id: string) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') return;
    const now = new Date().toISOString();
    try {
      const colName = type === 'creature' ? 'creature_proposals' : type === 'point' ? 'point_proposals' : 'point_creature_proposals';
      await updateDoc(doc(firestore, colName, id), { status: 'rejected', processedAt: now });
      alert('却下しました');
    } catch (e: any) {
      console.error(e);
      alert(`却下エラー: ${e.message}`);
    }
  };

  const approveReview = async (reviewId: string) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') return;
    try {
      await updateDoc(doc(firestore, 'reviews', reviewId), { status: 'approved' });
      alert('レビューを承認しました');
    } catch (e) { console.error(e); }
  };

  const rejectReview = async (reviewId: string) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') return;
    try {
      await updateDoc(doc(firestore, 'reviews', reviewId), { status: 'rejected' });
      alert('レビューを却下しました');
    } catch (e) { console.error(e); }
  };

  const addReview = async (reviewData: Omit<Review, 'id' | 'userId' | 'userName' | 'userProfileImage' | 'trustLevel' | 'createdAt' | 'status' | 'helpfulCount' | 'helpfulBy'>) => {
    if (!isAuthenticated) return;
    const newReviewId = `rv${Date.now()}`;

    // Determine Trust Level
    let trustLevel: Review['trustLevel'] = 'standard';
    if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
      trustLevel = 'official';
    } else if (reviewData.logId) {
      trustLevel = 'verified';
    } else if (allLogs.length >= 100) {
      trustLevel = 'expert';
    }

    // Determine Approval Status (Only Official is auto-approved to prevent negative campaign)
    const isApproved = trustLevel === 'official';

    const targetPoint = points.find(p => p.id === reviewData.pointId);
    const newReview: Review = {
      ...reviewData,
      areaId: targetPoint?.areaId,
      zoneId: targetPoint?.zoneId,
      regionId: targetPoint?.regionId,
      id: newReviewId,
      userId: currentUser.id,
      userName: currentUser.name,
      userProfileImage: currentUser.profileImage,
      userLogsCount: reviewData.userLogsCount || allLogs.length,
      status: isApproved ? 'approved' : 'pending',
      trustLevel,
      helpfulCount: 0,
      helpfulBy: [],
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(firestore, 'reviews', newReviewId), sanitizePayload(newReview));

      // Link review back to log if it exists
      if (reviewData.logId) {
        await updateLog(reviewData.logId, { reviewId: newReviewId });
      }
    } catch (e) {
      console.error(e);
    }
  };


  const updateReview = async (reviewId: string, reviewData: Partial<Review>) => {
    if (!isAuthenticated) return;
    const existingReview = reviews.find(r => r.id === reviewId) || proposalReviews.find(r => r.id === reviewId);
    if (!existingReview) return;

    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'moderator';
    const isOwner = existingReview.userId === currentUser.id;

    if (!isAdmin && !isOwner) {
      alert('編集権限がありません');
      return;
    }

    try {
      const payload: Partial<Review> = { ...reviewData };

      // If user edits, revert to pending unless admin (excluding only metadata updates if any)
      if (!isAdmin && isOwner && existingReview.status === 'approved') {
        payload.status = 'pending';
      }

      await updateDoc(doc(firestore, 'reviews', reviewId), sanitizePayload(payload));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteReview = async (reviewId: string) => {
    if (!isAuthenticated) return;
    const existingReview = reviews.find(r => r.id === reviewId) || proposalReviews.find(r => r.id === reviewId);
    if (!existingReview) return;

    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'moderator';
    const isOwner = existingReview.userId === currentUser.id;

    if (!isAdmin && !isOwner) {
      alert('削除権限がありません');
      return;
    }

    if (!window.confirm('このレビューを削除しますか？')) return;

    try {
      await deleteDoc(doc(firestore, 'reviews', reviewId));
    } catch (e) {
      console.error(e);
    }
  };

  const updateUserRole = async (uid: string, newRole: 'user' | 'moderator' | 'admin') => {
    if (currentUser.role === 'admin') await updateDoc(doc(firestore, 'users', uid), { role: newRole });
  };

  const value: AppContextType = {
    currentUser, isAuthenticated, isLoading, login, logout, calculateRarity, addLog, addCreature, addPoint, addPointCreature, removePointCreature, updateLog, updateCreature, updatePoint, deleteLog, deleteLogs, updateLogs, updateUser, toggleLikeLog, toggleFavorite, toggleWanted, toggleBookmarkPoint,
    creatures, points, pointCreatures, logs: allLogs, reviews, proposalReviews, recentLogs, proposalCreatures, proposalPoints, proposalPointCreatures, regions, zones, areas, addCreatureProposal, addPointProposal, addPointCreatureProposal, removePointCreatureProposal, approveProposal, rejectProposal, allUsers, updateUserRole, deleteAccount, addReview, approveReview, rejectReview, updateReview, deleteReview
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
};
