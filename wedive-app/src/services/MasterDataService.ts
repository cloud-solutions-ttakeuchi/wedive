import { collection, query, where, getDocs, limit as firestoreLimit, orderBy, startAt, endAt } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { BaseMasterDataService } from 'wedive-shared';
import type { Point, Creature } from 'wedive-shared';
import { appDbEngine } from './AppSQLiteEngine';

/**
 * App 版 MasterDataService
 * wedive-shared の BaseMasterDataService を継承し、App (Expo) 固有の
 * 初期化処理や Firestore フォールバックを追加。
 */
export class MasterDataService extends BaseMasterDataService {

  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      await appDbEngine.initialize('master.db');
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.warn('SQLite initialization failed, using Firestore fallback:', e);
      return false;
    }
  }

  /**
   * ポイント検索（ハイブリッド）
   */
  async searchPoints(text: string, limitCount = 50): Promise<Point[]> {
    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

    if (await this.initialize()) {
      try {
        const results = await super.searchPoints(normalizedQuery, limitCount);
        if (results.length > 0) {
          console.log(`[MasterData] Found ${results.length} points from SQLite (App) 🚀`);
          return results;
        }
      } catch (e) {
        console.warn('SQLite point search failed, falling back...', e);
      }
    }

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
  }

  /**
   * 生物検索（ハイブリッド）
   */
  async searchCreatures(text: string, limitCount = 50): Promise<Creature[]> {
    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

    if (await this.initialize()) {
      try {
        const results = await super.searchCreatures(normalizedQuery, limitCount);
        if (results.length > 0) {
          console.log(`[MasterData] Found ${results.length} creatures from SQLite (App) 🚀`);
          return results;
        }
      } catch (e) {
        console.warn('SQLite creature search failed, falling back...', e);
      }
    }

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
  }

  /**
   * 最新レビューの取得（ホーム画面用）
   */
  async getLatestReviews(limitCount = 20): Promise<any[]> {
    const q = query(
      collection(firestoreDb, 'reviews'),
      where('status', '==', 'approved'),
      orderBy('date', 'desc'),
      firestoreLimit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * 特定ポイントのレビュー取得
   */
  async getReviewsByPoint(pointId: string): Promise<any[]> {
    const q = query(
      collection(firestoreDb, 'reviews'),
      where('pointId', '==', pointId),
      where('status', '==', 'approved'),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * エリア全体のレビュー取得（点数計算用等）
   */
  async getReviewsByArea(areaId: string): Promise<any[]> {
    const q = query(
      collection(firestoreDb, 'reviews'),
      where('areaId', '==', areaId),
      where('status', '==', 'approved'),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * 全ポイントの取得
   */
  async getAllPoints(): Promise<Point[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_points ORDER BY name ASC';
        const results = await appDbEngine.getAllAsync<any>(sql);
        if (results.length > 0) {
          return results.map(p => ({
            id: p.id,
            name: p.name,
            name_kana: p.name_kana,
            region: p.region_name || '',
            area: p.area_name || '',
            zone: p.zone_name || '',
            latitude: p.latitude,
            longitude: p.longitude,
            status: 'approved'
          } as unknown as Point));
        }
      } catch (e: any) {
        if (e.message?.includes('no such table')) {
          console.warn('[MasterData] master_points table not found in SQLite.');
        } else {
          console.error('SQLite getAllPoints failed:', e);
        }
      }
    }
    const q = query(collection(firestoreDb, 'points'), where('status', '==', 'approved'), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Point));
  }

  /**
   * 全生物の取得
   */
  async getAllCreatures(): Promise<Creature[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_creatures ORDER BY name ASC';
        const results = await appDbEngine.getAllAsync<any>(sql);
        if (results.length > 0) {
          return results.map(c => ({
            id: c.id,
            name: c.name,
            name_kana: c.name_kana,
            category: c.category || '',
            status: 'approved'
          } as unknown as Creature));
        }
      } catch (e) {
        console.error('SQLite getAllCreatures failed:', e);
      }
    }
    const q = query(collection(firestoreDb, 'creatures'), where('status', '==', 'approved'), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creature));
  }

  /**
   * 全ポイント生物紐付けデータの取得
   */
  async getAllPointCreatures(): Promise<any[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_point_creatures';
        const results = await appDbEngine.getAllAsync<any>(sql);
        return results.map((r: any) => ({
          id: r.id,
          pointId: r.point_id,
          creatureId: r.creature_id,
          localRarity: r.localRarity,
          updatedAt: r.updatedAt
        }));
      } catch (e) {
        console.error('SQLite getAllPointCreatures failed:', e);
      }
    }
    const snapshotPointCreatures = await getDocs(collection(firestoreDb, 'point_creatures'));
    return snapshotPointCreatures.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

export const masterDataService = new MasterDataService(appDbEngine);
