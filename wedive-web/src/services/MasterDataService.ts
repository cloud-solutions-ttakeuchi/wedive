import { BaseMasterDataService } from 'wedive-shared';
import type { Point, Creature, AgencyMaster } from 'wedive-shared';
import { masterDbEngine } from './WebSQLiteEngine';

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
          console.log(`[MasterData] Found ${results.length} points from SQLite (Web) 🚀`, results[0]);
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
          console.log(`[MasterData] Found ${results.length} creatures from SQLite (Web) 🚀`, results[0]);
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

  async getAgencies(): Promise<AgencyMaster[]> {
    if (await this.initialize()) {
      try {
        console.log('[MasterData] Fetching agencies from SQLite (Web) 🚀');
        const results = await super.getAgencies();
        return results;
      } catch (e) {
        console.warn('SQLite agency fetch failed, falling back...', e);
      }
    }
    return [];
  }

  /**
   * 全ポイントの取得
   */
  async getAllPoints(): Promise<Point[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_points ORDER BY name ASC';
        const results = await masterDbEngine.getAllAsync<any>(sql);
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
      } catch (e) {
        console.error('SQLite getAllPoints failed:', e);
      }
    }
    return [];
  }

  /**
   * 全生物の取得
   */
  async getAllCreatures(): Promise<Creature[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_creatures ORDER BY name ASC';
        const results = await masterDbEngine.getAllAsync<any>(sql);
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
    return [];
  }

  /**
   * 全ポイント生物紐付けデータの取得
   */
  async getAllPointCreatures(): Promise<any[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_point_creatures';
        const results = await masterDbEngine.getAllAsync<any>(sql);
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
    return [];
  }
}

export const masterDataService = new MasterDataService(masterDbEngine);
