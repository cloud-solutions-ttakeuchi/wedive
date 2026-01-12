
import { BaseMasterDataService, mapAgencyFromSQLite } from 'wedive-shared';
import type { Point, Creature, AgencyMaster } from 'wedive-shared';
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
    return [];
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
    return [];
  }

  /**
   * 最新レビューの取得（ホーム画面用）
   */
  async getLatestReviews(limitCount = 20): Promise<any[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_point_reviews ORDER BY created_at DESC LIMIT ?';
        return await appDbEngine.getAllAsync<any>(sql, [limitCount]);
      } catch (e) {
        console.error('SQLite getLatestReviews failed:', e);
      }
    }
    return [];
  }

  /**
   * 特定ポイントのレビュー取得
   */
  async getReviewsByPoint(pointId: string): Promise<any[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_point_reviews WHERE point_id = ? ORDER BY created_at DESC';
        return await appDbEngine.getAllAsync<any>(sql, [pointId]);
      } catch (e) {
        console.error('SQLite getReviewsByPoint failed:', e);
      }
    }
    return [];
  }

  /**
   * エリア全体のレビュー取得（点数計算用等）
   */
  async getReviewsByArea(areaId: string): Promise<any[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_point_reviews WHERE area_id = ? ORDER BY created_at DESC';
        return await appDbEngine.getAllAsync<any>(sql, [areaId]);
      } catch (e) {
        console.error('SQLite getReviewsByArea failed:', e);
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
    return [];
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
    return [];
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
    return [];
  }

  /**
   * 全エージェンシー（指導団体）の取得
   */
  async getAllAgencies(): Promise<AgencyMaster[]> {
    if (await this.initialize()) {
      try {
        const sql = 'SELECT * FROM master_agencies';
        const results = await appDbEngine.getAllAsync<any>(sql);
        if (results.length > 0) {
          return results.map(mapAgencyFromSQLite);
        }
      } catch (e: any) {
        if (e.message?.includes('no such table')) {
          console.warn('[MasterData] master_agencies table not found in SQLite, returning empty.');
        } else {
          console.error('SQLite getAllAgencies failed:', e);
        }
      }
    }
    return [];
  }

  /**
   * 地域一覧を取得
   */
  async getRegions(): Promise<any[]> {
    if (await this.initialize()) {
      try {
        // master_geography から取得（Web版と同様）
        const res = await appDbEngine.getAllAsync(`
          SELECT DISTINCT
            region_id as id,
            region_name as name
          FROM master_geography
          WHERE (region_status IS NULL OR region_status != 'rejected')
          ORDER BY region_id
        `);
        if (res.length > 0) return res;
      } catch (e: any) {
        // master_geography がない場合のフォールバック: master_points から抽出
        if (e.message?.includes('no such table')) {
          console.warn('[MasterData] master_geography not found, falling back to master_points distinct.');
          try {
            const res = await appDbEngine.getAllAsync(`
              SELECT DISTINCT region_name as name FROM master_points WHERE region_name IS NOT NULL AND region_name != ''
            `);
            // IDがないのでnameをIDにする
            return res.map((r: any) => ({ id: r.name, name: r.name }));
          } catch (e2) {
            console.error('getRegions fallback failed:', e2);
          }
        } else {
          console.error('getRegions failed:', e);
        }
      }
    }
    return [];
  }

  /**
   * ゾーン一覧を取得
   */
  async getZones(regionId?: string): Promise<any[]> {
    if (await this.initialize()) {
      try {
        let sql = `
          SELECT DISTINCT
            zone_id as id,
            zone_name as name,
            region_id as regionId
          FROM master_geography
          WHERE (zone_status IS NULL OR zone_status != 'rejected')
        `;
        const params: any[] = [];
        if (regionId) {
          sql += ' AND region_id = ?';
          params.push(regionId);
        }
        sql += ' ORDER BY zone_id';

        const res = await appDbEngine.getAllAsync<any>(sql, params);
        if (res.length > 0) return res.map(r => ({ ...r, parentId: r.regionId }));
      } catch (e: any) {
        console.error('getZones failed:', e);
      }
    }
    return [];
  }

  /**
   * エリア一覧を取得
   */
  async getAreas(zoneId?: string): Promise<any[]> {
    if (await this.initialize()) {
      try {
        let sql = `
          SELECT DISTINCT
            area_id as id,
            area_name as name,
            zone_id as zoneId
          FROM master_geography
          WHERE (area_status IS NULL OR area_status != 'rejected')
        `;
        const params: any[] = [];
        if (zoneId) {
          sql += ' AND zone_id = ?';
          params.push(zoneId);
        }
        sql += ' ORDER BY area_id';

        const res = await appDbEngine.getAllAsync<any>(sql, params);
        if (res.length > 0) return res.map(r => ({ ...r, parentId: r.zoneId }));
      } catch (e: any) {
        console.error('getAreas failed:', e);
      }
    }
    return [];
  }

  /**
   * エリアIDからポイント一覧を取得
   */
  async getPointsByArea(areaId: string): Promise<Point[]> {
    if (await this.initialize()) {
      try {
        // master_points には area_id カラムがある前提だが、
        // Web版同期ロジックによっては master_geography と JOIN が必要かも。
        // ここでは単純に master_points の area_id を信じる（App版定義による）
        const sql = 'SELECT * FROM master_points WHERE area_id = ? ORDER BY name ASC';
        const results = await appDbEngine.getAllAsync<any>(sql, [areaId]);
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
            status: 'approved',
            imageUrl: p.image_url
          } as unknown as Point));
        }
      } catch (e) {
        console.error('getPointsByArea failed:', e);
      }
    }
    return [];
  }
}

export const masterDataService = new MasterDataService(appDbEngine);
