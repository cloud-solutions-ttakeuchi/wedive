import { collection, query, where, getDocs, limit as firestoreLimit, orderBy, startAt, endAt } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { Point, Creature } from '../types';

// ネイティブモジュール不足時にファイル全体がクラッシュするのを防ぐために
// ローカルで SQLite を import する
let SQLite: any = null;
try {
  SQLite = require('expo-sqlite');
} catch (e) {
  console.warn('ExpoSQLite module not found in this build.');
}

export interface MasterPoint {
  id: string;
  name: string;
  name_kana?: string;
  region_name?: string;
  zone_name?: string;
  area_name?: string;
  latitude?: number;
  longitude?: number;
}

export interface MasterCreature {
  id: string;
  name: string;
  name_kana?: string;
  category?: string;
}

// TODO: Phase 2 - 将来の管理画面実装に合わせて有効化
/*
export interface MasterCertification {
  id: string;
  name: string;
  organization?: string;
  ranks?: any[];
}

export interface MasterBadge {
  id: string;
  name: string;
  icon_url?: string;
  condition?: any;
}
*/

class MasterDataService {
  private sqliteDb: any = null;
  private isInitializing = false;

  /**
   * SQLite接続の初期化
   */
  async initialize(): Promise<boolean> {
    if (this.sqliteDb) return true;
    if (this.isInitializing) return false;
    if (!SQLite || !SQLite.openDatabaseAsync) {
      return false; // SQLite が存在しないビルド
    }

    this.isInitializing = true;
    try {
      this.sqliteDb = await SQLite.openDatabaseAsync('master.db');
      console.log('MasterData SQLite connection established.');
      return true;
    } catch (error) {
      console.warn('SQLite not available, using Firestore fallback:', error);
      this.sqliteDb = null;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * ポイント検索（ハイブリッド）
   */
  async searchPoints(text: string, limitCount = 50): Promise<Point[]> {
    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

    // 1. SQLite が使えれば SQLite で検索
    const isAvailable = await this.initialize();
    if (isAvailable && this.sqliteDb) {
      try {
        const sql = `
          SELECT * FROM master_points
          WHERE search_text LIKE ?
          ORDER BY
            CASE
              WHEN name = ? THEN 1
              WHEN name LIKE ? THEN 2
              ELSE 3
            END,
            name ASC
          LIMIT ?
        `;
        const results = await this.sqliteDb.getAllAsync(sql, [
          `%${normalizedQuery}%`,
          normalizedQuery,
          `${normalizedQuery}%`,
          limitCount
        ]);

        console.log(`[MasterData] Found ${results.length} points from SQLite 🚀`);

        if (results.length > 0) {
          return results.map((p: any) => ({
            id: p.id,
            name: p.name,
            name_kana: p.name_kana,
            region: p.region_name || '',
            area: p.area_name || '',
            zone: p.zone_name || '',
            latitude: p.latitude,
            longitude: p.longitude,
            level: p.level || 'Unknown',
            status: 'approved'
          } as unknown as Point));
        }
      } catch (e) {
        console.error('SQLite search failed, falling back to Firestore:', e);
      }
    }

    // 2. フォールバック: Firestore 検索
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

    const isAvailable = await this.initialize();
    if (isAvailable && this.sqliteDb) {
      try {
        const sql = `
          SELECT * FROM master_creatures
          WHERE search_text LIKE ?
          ORDER BY
            CASE
              WHEN name = ? THEN 1
              WHEN name LIKE ? THEN 2
              ELSE 3
            END,
            name ASC
          LIMIT ?
        `;
        const results = await this.sqliteDb.getAllAsync(sql, [
          `%${normalizedQuery}%`,
          normalizedQuery,
          `${normalizedQuery}%`,
          limitCount
        ]);

        console.log(`[MasterData] Found ${results.length} creatures from SQLite 🚀`);

        if (results.length > 0) {
          return results.map((c: any) => ({
            id: c.id,
            name: c.name,
            name_kana: c.name_kana,
            category: c.category || '',
            status: 'approved'
          } as unknown as Creature));
        }
      } catch (e) {
        console.error('SQLite creature search failed, falling back...', e);
      }
    }

    // 2. フォールバック: Firestore 検索
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

  // TODO: Phase 2 - 認定資格マスタの取得 (管理画面実装後に有効化)
  /*
  async getAllCertifications(): Promise<any[]> {
    const isAvailable = await this.initialize();
    if (isAvailable && this.sqliteDb) {
      try {
        const results = await this.sqliteDb.getAllAsync('SELECT * FROM master_certifications ORDER BY name ASC');
        return results.map((r: any) => ({
          ...r,
          ranks: r.ranks_json ? JSON.parse(r.ranks_json) : []
        }));
      } catch (e) {
        console.error('SQLite certs fetch failed:', e);
      }
    }
    const snapshot = await getDocs(collection(firestoreDb, 'certifications'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getAllBadges(): Promise<any[]> {
    const isAvailable = await this.initialize();
    if (isAvailable && this.sqliteDb) {
      try {
        const results = await this.sqliteDb.getAllAsync('SELECT * FROM master_badges ORDER BY name ASC');
        return results.map((r: any) => ({
          ...r,
          condition: r.condition_json ? JSON.parse(r.condition_json) : null
        }));
      } catch (e) {
        console.error('SQLite badges fetch failed:', e);
      }
    }
    const snapshot = await getDocs(collection(firestoreDb, 'badges'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  */
}

export const masterDataService = new MasterDataService();
