/*
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * AI AGENT WARNING: READ THIS BEFORE EDITING
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *
 * This service MUST use Google Cloud Storage (GCS) and SQLite for master data.
 *
 * ABSOLUTELY FORBIDDEN:
 * - Attempting to sync master data (Points, Creatures) directly from Firestore.
 * - Using `getDocs` or `onSnapshot` for master data collections.
 *
 * If data is missing or broken, FIX THE GCS IMPORT OR SQLITE LOGIC.
 * DO NOT REVERT TO FIRESTORE SYNC.
 *
 * See DATABASE_DESIGN.md for details.
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 */
import { BaseMasterDataService } from 'wedive-shared';
import type { Point, Creature, AgencyMaster, Zone, Area } from 'wedive-shared';
import { masterDbEngine } from './WebSQLiteEngine';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Web 版 MasterDataService
 * GCSからダウンロードしたSQLite DBを利用し、アプリが必要とするデータ形式への変換（アダプター）機能を提供します。
 */
export class MasterDataService extends BaseMasterDataService {
  private isInitialized = false;

  constructor(sqlite: any) {
    super(sqlite);
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      // エンジンの初期化 (IDBのオープンなど)
      if ('initialize' in this.sqlite && typeof this.sqlite.initialize === 'function') {
        await (this.sqlite as any).initialize();
      }
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.error('[MasterData] Initialization failed:', e);
      return false;
    }
  }

  /*
   * (同期機能は MasterDataSyncService に移行しました)
   */

  // --- Override Search Methods to use local mapping (with IDs) ---

  async searchPoints(text: string, limitCount = 50): Promise<Point[]> {
    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

    if (await this.initialize()) {
      try {
        const results = await super.searchPoints(normalizedQuery, limitCount);
        if (results.length > 0) {
          // BaseMasterDataService でマッピング済み
          return results;
        }
      } catch (e) {
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
          // BaseMasterDataService でマッピング済み
          return results;
        }
      } catch (e) {
        console.warn('SQLite creature search failed, falling back...', e);
      }
    }
    return [];
  }

  async getAgencies(): Promise<AgencyMaster[]> {
    if (await this.initialize()) {
      try {
        return await super.getAgencies();
      } catch (e) {
        console.warn('SQLite getAgencies failed, falling back...', e);
      }
    }
    return [];
  }

  // --- Adapter Methods: SQLite Data -> App Model ---

  async getAllPoints(): Promise<Point[]> {
    if (await this.initialize()) {
      try {
        // master_geography と結合して、region_name / zone_name 等を補完する
        // Note: BaseMasterDataServiceにはgetAllPointsがないか、もしくは単純な実装しかないため
        // ここではJOINを含むアプリ要件に合わせたクエリを実行する
        const sql = `
          SELECT
            p.*,
            g.region_id, g.region_name,
            g.zone_id, g.zone_name,
            g.area_name
          FROM master_points p
          LEFT JOIN master_geography g ON p.area_id = g.area_id
          ORDER BY p.name ASC
        `;
        const results = await this.sqlite.getAllAsync<any>(sql);
        return results.map(p => this.mapPointFromSQLite(p));
      } catch (e: any) {
        console.error('getAllPoints failed:', e);
      }
    }
    return [];
  }

  async getAllCreatures(): Promise<Creature[]> {
    if (await this.initialize()) {
      try {
        const results = await this.sqlite.getAllAsync<any>('SELECT * FROM master_creatures ORDER BY name ASC');
        return results.map(c => this.mapCreatureFromSQLite(c));
      } catch (e: any) { console.error('getAllCreatures failed:', e); }
    }
    return [];
  }

  /**
   * 地域一覧を取得
   */
  async getRegions(): Promise<any[]> {
    await this.initialize();
    try {
      // master_geography から重複を除いて取得
      const res = await this.sqlite.getAllAsync(`
        SELECT DISTINCT
          region_id as id,
          region_name as name,
          region_description as description
        FROM master_geography
        WHERE region_status = 'approved'
        ORDER BY region_id
      `);
      console.log(`[MasterData] getRegions: found ${res.length} rows`);
      return res;
    } catch (e) {
      console.warn('[MasterData] Failed to fetch regions, returning empty array.', e);
      return [];
    }
  }

  /**
   * ゾーン一覧を取得
   */
  async getZones(): Promise<any[]> {
    await this.initialize();
    try {
      const res = await this.sqlite.getAllAsync(`
        SELECT DISTINCT
          zone_id as id,
          zone_name as name,
          zone_description as description,
          region_id as regionId
        FROM master_geography
        WHERE zone_status = 'approved'
        ORDER BY zone_id
      `);
      // parentId マッピング (互換性維持)
      console.log(`[MasterData] getZones: found ${res.length} rows`);
      return (res as any[]).map((r: any) => ({ ...r, parentId: r.regionId }));
    } catch (e) {
      console.warn('[MasterData] Failed to fetch zones, returning empty array.', e);
      return [];
    }
  }

  /**
   * エリア一覧を取得
   */
  async getAreas(): Promise<any[]> {
    await this.initialize();
    try {
      const res = await this.sqlite.getAllAsync(`
        SELECT
          area_id as id,
          area_name as name,
          area_description as description,
          zone_id as zoneId
        FROM master_geography
        WHERE area_status = 'approved'
        ORDER BY area_id
      `);
      // parentId マッピング
      console.log(`[MasterData] getAreas: found ${res.length} rows`);
      return (res as any[]).map((r: any) => ({ ...r, parentId: r.zoneId }));
    } catch (e) {
      console.warn('[MasterData] Failed to fetch areas, returning empty array.', e);
      return [];
    }
  }

  private mapPointFromSQLite(p: any): Point {
    return {
      id: p.id,
      name: p.name,
      nameKana: p.name_kana,
      areaId: p.area_id,
      zoneId: p.zone_id,
      regionId: p.region_id,
      region: p.region_name || '',
      area: p.area_name || '',
      zone: p.zone_name || '',
      latitude: p.latitude,
      longitude: p.longitude,
      level: p.level || 'Unknown',
      maxDepth: p.max_depth,
      mainDepth: p.main_depth_json ? JSON.parse(p.main_depth_json) : undefined,
      entryType: p.entry_type,
      current: p.current_condition,
      topography: p.topography_json ? JSON.parse(p.topography_json) : [],
      description: p.description || '',
      features: p.features_json ? JSON.parse(p.features_json) : [],
      googlePlaceId: p.google_place_id,
      formattedAddress: p.formatted_address,
      imageUrl: p.image_url,
      images: p.images_json ? JSON.parse(p.images_json) : [],
      rating: p.rating,
      status: 'approved',
      updatedAt: p.updated_at
    } as unknown as Point;
  }

  private mapCreatureFromSQLite(c: any): Creature {
    return {
      id: c.id,
      name: c.name,
      nameKana: c.name_kana,
      scientificName: c.scientific_name,
      englishName: c.english_name,
      category: c.category || '',
      family: c.family,
      description: c.description || '',
      rarity: c.rarity,
      imageUrl: c.image_url,
      tags: c.tags_json ? JSON.parse(c.tags_json) : [],
      gallery: c.gallery_json ? JSON.parse(c.gallery_json) : [],
      status: 'approved',
      updatedAt: c.updated_at
    } as unknown as Creature;
  }

  async getAllPointCreatures(): Promise<any[]> {
    if (await this.initialize()) {
      try {
        const results = await masterDbEngine.getAllAsync<any>('SELECT * FROM master_point_creatures');
        return results.map(r => ({
          id: r.id,
          pointId: r.point_id,
          creatureId: r.creature_id,
          localRarity: r.localRarity,
          updatedAt: r.updatedAt
        }));
      } catch (e: any) { console.error(e); }
    }
    return [];
  }

  // --- Cache Update Methods (For local updates after edit) ---

  async updatePointInCache(point: Point): Promise<void> {
    if (await this.initialize()) {
      const searchText = `${point.name} ${point.nameKana || ''} ${point.area || ''} ${point.zone || ''} ${point.region || ''}`.toLowerCase();
      const sql = `
        INSERT OR REPLACE INTO master_points (
          id, name, name_kana, area_id, zone_id, region_id,
          region_name, area_name, zone_name,
          latitude, longitude, level, max_depth, main_depth_json,
          entry_type, current_condition, topography_json, description,
          features_json, google_place_id, formatted_address, image_url,
          images_json, image_keyword, submitter_id, bookmark_count,
          official_stats_json, actual_stats_json, rating,
          search_text, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await masterDbEngine.runAsync(sql, [
        point.id, point.name, point.nameKana || '', point.areaId || null, point.zoneId || null, point.regionId || null,
        point.region || '', point.area || '', point.zone || '',
        point.latitude || null, point.longitude || null, point.level || null, point.maxDepth || null,
        JSON.stringify(point.mainDepth || null), point.entryType || null, point.current || null,
        JSON.stringify(point.topography || []), point.description || '', JSON.stringify(point.features || []),
        point.googlePlaceId || null, point.formattedAddress || null, point.imageUrl || null,
        JSON.stringify(point.images || []), point.imageKeyword || null, point.submitterId || null,
        point.bookmarkCount || 0, JSON.stringify(point.officialStats || {}), JSON.stringify(point.actualStats || {}),
        point.rating || null, searchText, point.updatedAt || new Date().toISOString()
      ]);
    }
  }

  async updateCreatureInCache(creature: Creature): Promise<void> {
    if (await this.initialize()) {
      const searchText = `${creature.name} ${creature.nameKana || ''} ${creature.scientificName || ''} ${creature.englishName || ''}`.toLowerCase();
      const sql = `
        INSERT OR REPLACE INTO master_creatures (
          id, name, name_kana, scientific_name, english_name, category, family,
          description, rarity, image_url, tags_json, depth_range_json,
          special_attributes_json, water_temp_range_json, size, season_json,
          gallery_json, stats_json, image_credit, image_license, image_keyword,
          search_text, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await masterDbEngine.runAsync(sql, [
        creature.id, creature.name, creature.nameKana || '', creature.scientificName || '',
        creature.englishName || '', creature.category || '', creature.family || '',
        creature.description || '', creature.rarity || 'Common', creature.imageUrl || null,
        JSON.stringify(creature.tags || []), JSON.stringify(creature.depthRange || {}),
        JSON.stringify(creature.specialAttributes || []), JSON.stringify(creature.waterTempRange || {}),
        creature.size || '', JSON.stringify(creature.season || []), JSON.stringify(creature.gallery || []),
        JSON.stringify(creature.stats || {}), creature.imageCredit || '', creature.imageLicense || '',
        creature.imageKeyword || '', searchText, creature.updatedAt || new Date().toISOString()
      ]);
    }
  }

  async updateAreaInCache(area: Area): Promise<void> {
    if (await this.initialize()) {
      // 仕様書準拠: master_areas の親IDカラムは parent_id
      await masterDbEngine.runAsync('INSERT OR REPLACE INTO master_areas (id, name, parent_id) VALUES (?, ?, ?)', [area.id, area.name, area.zoneId]);
    }
  }

  async updateZoneInCache(zone: Zone): Promise<void> {
    if (await this.initialize()) {
      // 仕様書準拠: master_zones の親IDカラムは parent_id
      await masterDbEngine.runAsync('INSERT OR REPLACE INTO master_zones (id, name, parent_id) VALUES (?, ?, ?)', [zone.id, zone.name, zone.regionId]);
    }
  }

  async updateRegionInCache(region: any): Promise<void> {
    if (await this.initialize()) {
      await masterDbEngine.runAsync('INSERT OR REPLACE INTO master_regions (id, name) VALUES (?, ?)', [region.id, region.name]);
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

  async deletePointFromCache(id: string): Promise<void> {
    if (await this.initialize()) await masterDbEngine.runAsync('DELETE FROM master_points WHERE id = ?', [id]);
  }
  async deleteCreatureFromCache(id: string): Promise<void> {
    if (await this.initialize()) await masterDbEngine.runAsync('DELETE FROM master_creatures WHERE id = ?', [id]);
  }
  async deleteAreaFromCache(id: string): Promise<void> {
    if (await this.initialize()) await masterDbEngine.runAsync('DELETE FROM master_areas WHERE id = ?', [id]);
  }
  async deleteZoneFromCache(id: string): Promise<void> {
    if (await this.initialize()) await masterDbEngine.runAsync('DELETE FROM master_zones WHERE id = ?', [id]);
  }
  async deleteRegionFromCache(id: string): Promise<void> {
    if (await this.initialize()) await masterDbEngine.runAsync('DELETE FROM master_regions WHERE id = ?', [id]);
  }
}

export const masterDataService = new MasterDataService(masterDbEngine);
