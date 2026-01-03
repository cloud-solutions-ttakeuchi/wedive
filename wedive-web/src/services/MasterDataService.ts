import { BaseMasterDataService } from 'wedive-shared';
import type { Point, Creature } from 'wedive-shared';
import { masterDbEngine } from './WebSQLiteEngine';
import { collection, query, where, getDocs, limit as firestoreLimit, orderBy, startAt, endAt } from 'firebase/firestore';
import { db as firestoreDb } from '../lib/firebase';

/**
 * Web 版 MasterDataService
 * wedive-shared の BaseMasterDataService を継承し、Web 固有の
 * 初期化処理や Firestore フォールバックを追加。
 */
export class MasterDataService extends BaseMasterDataService {
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      // エンジンの初期化 (IDBのオープンなど)
      if ('initialize' in this.sqlite && typeof this.sqlite.initialize === 'function') {
        await this.sqlite.initialize();
      }
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.error('[MasterData] Initialization failed:', e);
      return false;
    }
  }

  async searchPoints(text: string, limitCount = 50): Promise<Point[]> {
    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

    if (await this.initialize()) {
      try {
        const results = await super.searchPoints(normalizedQuery, limitCount);
        if (results.length > 0) {
          console.log(`[MasterData] Found ${results.length} points from SQLite (Web) 🚀`);
          return results;
        }
      } catch (e) {
        console.warn('SQLite point search failed, falling back...', e);
      }
    }

    /*
    // フェイルオーバー: Firestore 検索
    console.log('[MasterData] Falling back to Firestore search... ☁️');
    const q = query(
      collection(firestoreDb, 'points'),
      where('status', '==', 'approved'),
      orderBy('name'),
      startAt(normalizedQuery),
      endAt(normalizedQuery + '\uf8ff'),
      firestoreLimit(20)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Point));
    */
    return [];
  }

  async searchCreatures(text: string, limitCount = 50): Promise<Creature[]> {
    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

    if (await this.initialize()) {
      try {
        const results = await super.searchCreatures(normalizedQuery, limitCount);
        if (results.length > 0) {
          console.log(`[MasterData] Found ${results.length} creatures from SQLite (Web) 🚀`);
          return results;
        }
      } catch (e) {
        console.warn('SQLite creature search failed, falling back...', e);
      }
    }

    /*
    // フェイルオーバー: Firestore 検索
    console.log('[MasterData] Falling back to Firestore search... ☁️');
    const q = query(
      collection(firestoreDb, 'creatures'),
      where('status', '==', 'approved'),
      orderBy('name'),
      startAt(normalizedQuery),
      endAt(normalizedQuery + '\uf8ff'),
      firestoreLimit(20)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creature));
    */
    return [];
  }
}

export const masterDataService = new MasterDataService(masterDbEngine);
