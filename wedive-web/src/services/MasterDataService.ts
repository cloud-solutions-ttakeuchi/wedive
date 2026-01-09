import { BaseMasterDataService, mapAgencyFromSQLite } from 'wedive-shared';
import type { Point, Creature, AgencyMaster, Zone, Area } from 'wedive-shared';
import { masterDbEngine } from './WebSQLiteEngine';
import { collection, getDocs, query, where } from 'firebase/firestore';
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
        await (this.sqlite as any).initialize();
      }

      // テーブル作成 (マスターデータ用)
      await masterDbEngine.runAsync(`
        CREATE TABLE IF NOT EXISTS master_points (
          id TEXT PRIMARY KEY,
          name TEXT,
          name_kana TEXT,
          area_id TEXT,
          area_name TEXT,
          zone_name TEXT,
          region_name TEXT,
          latitude REAL,
          longitude REAL,
          search_text TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS master_creatures (
          id TEXT PRIMARY KEY,
          name TEXT,
          name_kana TEXT,
          scientific_name TEXT,
          english_name TEXT,
          category TEXT,
          family TEXT,
          rarity TEXT,
          search_text TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS master_point_creatures (
          id TEXT PRIMARY KEY,
          point_id TEXT,
          creature_id TEXT,
          localRarity TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS master_agencies (
          id TEXT PRIMARY KEY,
          name TEXT,
          ranks_json TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS master_regions (
          id TEXT PRIMARY KEY,
          name TEXT
        );
        CREATE TABLE IF NOT EXISTS master_zones (
          id TEXT PRIMARY KEY,
          name TEXT,
          region_id TEXT
        );
        CREATE TABLE IF NOT EXISTS master_areas (
          id TEXT PRIMARY KEY,
          name TEXT,
          zone_id TEXT
        );
      `);

      this.isInitialized = true;
      return true;
    } catch (e) {
      console.error('[MasterData] Initialization failed:', e);
      return false;
    }
  }

  /**
   * Firestore からマスターデータを一括取得して SQLite に同期する
   */
  async syncMasterData(): Promise<void> {
    const isAvailable = await this.initialize();
    if (!isAvailable) return;

    try {
      // データの存在確認
      const pointsCount = await masterDbEngine.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM master_points');
      if (pointsCount.length > 0 && pointsCount[0].count > 0) {
        console.log('[MasterData Sync] SQLite already has data.');
        return;
      }

      console.log('[MasterData Sync] Starting master data sync from Firestore...');

      // 1. Points 同期 (簡易)
      const pointsSnap = await getDocs(query(collection(firestoreDb, 'points'), where('status', '==', 'approved')));
      for (const d of pointsSnap.docs) {
        await this.updatePointInCache({ id: d.id, ...d.data() } as Point);
      }

      // 2. Creatures 同期 (簡易)
      const creaturesSnap = await getDocs(query(collection(firestoreDb, 'creatures'), where('status', '==', 'approved')));
      for (const d of creaturesSnap.docs) {
        await this.updateCreatureInCache({ id: d.id, ...d.data() } as Creature);
      }

      // 3. Agencies 同期
      const agenciesSnap = await getDocs(collection(firestoreDb, 'agencies'));
      for (const d of agenciesSnap.docs) {
        const data = d.data();
        await masterDbEngine.runAsync(
          'INSERT OR REPLACE INTO master_agencies (id, name, ranks_json, updated_at) VALUES (?, ?, ?, ?)',
          [d.id, data.name, JSON.stringify(data.ranks || []), data.updatedAt || new Date().toISOString()]
        );
      }

      // Regions / Zones / Areas も必要に応じて追加...

      console.log('[MasterData Sync] Master data sync completed.');
    } catch (error) {
      console.error('[MasterData Sync] Error:', error);
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
      } catch (e: any) {
        console.warn('SQLite point search failed, falling back...', e);
      }
    }
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
      } catch (e: any) {
        console.warn('SQLite creature search failed, falling back...', e);
      }
    }
    return [];
  }

  async getAgencies(): Promise<AgencyMaster[]> {
    if (await this.initialize()) {
      try {
        console.log('[MasterData] Fetching agencies from SQLite (Web) 🚀');
        const results = await super.getAgencies();
        return results;
      } catch (e: any) {
        console.warn('SQLite agency fetch failed, falling back...', e);
      }
    }
    return [];
  }

  async getZones(): Promise<Zone[]> {
    if (await this.initialize()) {
      try {
        const results = await masterDbEngine.getAllAsync<any>('SELECT * FROM master_zones ORDER BY name ASC');
        return results.map(z => ({
          id: z.id,
          name: z.name,
          regionId: z.region_id,
          updatedAt: z.updated_at
        } as Zone));
      } catch (e: any) { console.error(e); }
    }
    return [];
  }

  async getAreas(): Promise<Area[]> {
    if (await this.initialize()) {
      try {
        const results = await masterDbEngine.getAllAsync<any>('SELECT * FROM master_areas ORDER BY name ASC');
        return results.map(a => ({
          id: a.id,
          name: a.name,
          zoneId: a.zone_id,
          regionId: '', // SQLite には直接ないため暫定
          updatedAt: a.updated_at
        } as Area));
      } catch (e: any) { console.error(e); }
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
            nameKana: p.name_kana,
            region: p.region_name || '',
            area: p.area_name || '',
            zone: p.zone_name || '',
            latitude: p.latitude,
            longitude: p.longitude,
            status: 'approved',
            updatedAt: p.updated_at
          } as unknown as Point));
        }
      } catch (e: any) {
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
            nameKana: c.name_kana,
            category: c.category || '',
            status: 'approved',
            updatedAt: c.updated_at
          } as unknown as Creature));
        }
      } catch (e: any) {
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
      } catch (e: any) {
        console.error('SQLite getAllPointCreatures failed:', e);
      }
    }
    return [];
  }
  /**
   * ポイントのローカルキャッシュ更新
   */
  async updatePointInCache(point: Point): Promise<void> {
    if (await this.initialize()) {
      const searchText = `${point.name} ${point.nameKana || ''} ${point.area || ''} ${point.zone || ''} ${point.region || ''}`.toLowerCase();
      const sql = `
        INSERT OR REPLACE INTO master_points (
          id, name, name_kana, area_id, area_name, zone_name, region_name,
          latitude, longitude, search_text, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await masterDbEngine.runAsync(sql, [
        point.id, point.name, point.nameKana || '', point.areaId,
        point.area || '', point.zone || '', point.region || '',
        point.latitude, point.longitude, searchText, point.updatedAt || new Date().toISOString()
      ]);
    }
  }

  async deletePointFromCache(id: string): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync('DELETE FROM master_points WHERE id = ?', [id]);
    }
  }

  /**
   * 生物のローカルキャッシュ更新
   */
  async updateCreatureInCache(creature: Creature): Promise<void> {
    if (await this.initialize()) {
      const searchText = `${creature.name} ${creature.nameKana || ''} ${creature.scientificName || ''} ${creature.englishName || ''}`.toLowerCase();
      const sql = `
        INSERT OR REPLACE INTO master_creatures (
          id, name, name_kana, scientific_name, english_name, category, family,
          rarity, search_text, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await masterDbEngine.runAsync(sql, [
        creature.id, creature.name, creature.nameKana || '', creature.scientificName || '',
        creature.englishName || '', creature.category || '', creature.family || '',
        creature.rarity || 'Common', searchText, creature.updatedAt || new Date().toISOString()
      ]);
    }
  }

  async deleteCreatureFromCache(id: string): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync('DELETE FROM master_creatures WHERE id = ?', [id]);
    }
  }

  /**
   * 地域・ゾーン・エリアの更新
   */
  async updateAreaInCache(area: Area): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync('INSERT OR REPLACE INTO master_areas (id, name, zone_id) VALUES (?, ?, ?)', [area.id, area.name, area.zoneId]);
    }
  }
  async deleteAreaFromCache(id: string): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync('DELETE FROM master_areas WHERE id = ?', [id]);
    }
  }

  async updateZoneInCache(zone: Zone): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync('INSERT OR REPLACE INTO master_zones (id, name, region_id) VALUES (?, ?, ?)', [zone.id, zone.name, zone.regionId]);
    }
  }
  async deleteZoneFromCache(id: string): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync('DELETE FROM master_zones WHERE id = ?', [id]);
    }
  }

  async updateRegionInCache(region: any): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync('INSERT OR REPLACE INTO master_regions (id, name) VALUES (?, ?)', [region.id, region.name]);
    }
  }
  async deleteRegionFromCache(id: string): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync('DELETE FROM master_regions WHERE id = ?', [id]);
    }
  }

  async updatePointCreatureInCache(item: any): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync(
        'INSERT OR REPLACE INTO master_point_creatures (id, point_id, creature_id, localRarity) VALUES (?, ?, ?, ?)',
        [item.id, item.pointId, item.creatureId, item.localRarity]
      );
    }
  }
}

export const masterDataService = new MasterDataService(masterDbEngine);
