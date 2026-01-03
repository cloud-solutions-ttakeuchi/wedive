import { SQLiteExecutor, masterDbEngine } from './WebSQLiteEngine';
import { collection, query, where, getDocs, limit as firestoreLimit, orderBy, startAt, endAt } from 'firebase/firestore';
import { db as firestoreDb } from '../lib/firebase';
import type { Point, Creature } from '../types';

/**
 * Web 版 MasterDataService プロトタイプ
 * モバイル版のロジックを SQLiteExecutor 経由で再利用
 */
export class MasterDataService {
  private isInitialized = false;

  constructor(private sqlite: SQLiteExecutor) { }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      // 本来はここで WebWorker 等の初期化を待つ
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.error('[MasterData] Initialization failed:', e);
      return false;
    }
  }

  /**
   * ポイント検索（ハイブリッド）
   * モバイル版のロジックをほぼそのまま移植可能
   */
  async searchPoints(text: string, limitCount = 50): Promise<Point[]> {
    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

    if (await this.initialize()) {
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
        const results = await this.sqlite.getAllAsync<any>(sql, [
          `%${normalizedQuery}%`,
          normalizedQuery,
          `${normalizedQuery}%`,
          limitCount
        ]);

        console.log(`[MasterData] Found ${results.length} points from SQLite (Web) 🚀`);

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
            level: p.level || 'Unknown',
            status: 'approved'
          } as unknown as Point));
        }
      } catch (e) {
        console.warn('SQLite point search failed, falling back...', e);
      }
    }

    // フェイルオーバー: Firestore 検索 (モバイル版と同一)
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
}

export const masterDataService = new MasterDataService(masterDbEngine);
