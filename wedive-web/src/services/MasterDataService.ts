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

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      if ('initialize' in this.sqlite && typeof this.sqlite.initialize === 'function') {
        await (this.sqlite as any).initialize();
      }
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.error('[MasterDataSync] Initialization failed:', e);
      return false;
    }
  }

  /**
   * Firebase Storage (GCS) からビルド済みの SQLite ファイルをダウンロードしてインポートする
   */
  async syncMasterData(): Promise<void> {
    if (!await this.initialize()) return;

    try {
      console.log('[MasterDataSync] Checking for master data updates...');

      // Backend (Exporter) uploads to "v1/master/latest.db.gz"
      const dbRef = ref(storage, 'v1/master/latest.db.gz');
      const url = await getDownloadURL(dbRef);

      console.log(`[MasterDataSync] Downloading master DB from ${url}...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download master DB: ${response.statusText}`);
      }

      // GZIP解凍
      const ds = new DecompressionStream('gzip');
      const decompressedStream = response.body?.pipeThrough(ds);
      if (!decompressedStream) throw new Error('Failed to create decompression stream');

      const buffer = await new Response(decompressedStream).arrayBuffer();
      const data = new Uint8Array(buffer);

      console.log(`[MasterDataSync] Downloaded and decompressed ${data.byteLength} bytes. Importing to SQLite...`);
      await masterDbEngine.importDatabase(data);

      console.log('[MasterDataSync] Master data import completed successfully.');
    } catch (error: any) {
      if (error.code === 'storage/object-not-found' || error.message.includes('404')) {
        console.warn('[MasterDataSync] Master DB file not found in Storage. Creating empty tables locally as fallback.');
        await this.createLocalTables();
      } else {
        console.error('[MasterDataSync] Sync failed:', error);
        // Sync失敗時もテーブルがないと困るので作成を試みる
        await this.createLocalTables();
      }
    }
  }

  /**
   * ローカルフォールバック用の空テーブル作成
   */
  private async createLocalTables(): Promise<void> {
    try {
      await masterDbEngine.runAsync(`
        CREATE TABLE IF NOT EXISTS master_points (
          id TEXT PRIMARY KEY, name TEXT, name_kana TEXT, area_id TEXT, zone_id TEXT, region_id TEXT,
          region_name TEXT, area_name TEXT, zone_name TEXT,
          latitude REAL, longitude REAL, level TEXT, max_depth REAL, main_depth_json TEXT,
          entry_type TEXT, current_condition TEXT, topography_json TEXT, description TEXT,
          features_json TEXT, google_place_id TEXT, formatted_address TEXT, image_url TEXT,
          images_json TEXT, image_keyword TEXT, submitter_id TEXT, bookmark_count INTEGER,
          official_stats_json TEXT, actual_stats_json TEXT, rating REAL,
          search_text TEXT, updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS master_creatures (
          id TEXT PRIMARY KEY, name TEXT, name_kana TEXT, scientific_name TEXT, english_name TEXT, category TEXT, family TEXT,
          description TEXT, rarity TEXT, image_url TEXT, tags_json TEXT, depth_range_json TEXT,
          special_attributes_json TEXT, water_temp_range_json TEXT, size TEXT, season_json TEXT,
          gallery_json TEXT, stats_json TEXT, image_credit TEXT, image_license TEXT, image_keyword TEXT,
          search_text TEXT, updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS master_regions (id TEXT PRIMARY KEY, name TEXT);
        CREATE TABLE IF NOT EXISTS master_zones (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT);
        CREATE TABLE IF NOT EXISTS master_areas (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT);
        CREATE TABLE IF NOT EXISTS master_point_creatures (
          id TEXT PRIMARY KEY, point_id TEXT, creature_id TEXT, localRarity TEXT, updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS master_agencies (id TEXT PRIMARY KEY, name TEXT);
      `);
      console.log('[MasterDataSync] Local tables created successfully.');
    } catch (e) {
      console.error('[MasterDataSync] Failed to create local tables:', e);
    }
  }

  // --- Override Search Methods to use local mapping (with IDs) ---

  async searchPoints(text: string, limitCount = 50): Promise<Point[]> {
    if (!await this.initialize()) return [];

    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

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

    try {
      const results = await masterDbEngine.getAllAsync<any>(sql, [
        `%${normalizedQuery}%`, normalizedQuery, `${normalizedQuery}%`, limitCount
      ]);
      return results.map(p => this.mapPointFromSQLite(p));
    } catch (e: any) {
      console.error('searchPoints failed:', e);
      return [];
    }
  }

  async searchCreatures(text: string, limitCount = 50): Promise<Creature[]> {
    if (!await this.initialize()) return [];

    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

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

    try {
      const results = await masterDbEngine.getAllAsync<any>(sql, [
        `%${normalizedQuery}%`, normalizedQuery, `${normalizedQuery}%`, limitCount
      ]);
      return results.map(c => this.mapCreatureFromSQLite(c));
    } catch (e: any) {
      console.error('searchCreatures failed:', e);
      return [];
    }
  }

  // --- Adapter Methods: SQLite Data -> App Model ---

  async getAllPoints(): Promise<Point[]> {
    if (await this.initialize()) {
      try {
        const results = await masterDbEngine.getAllAsync<any>('SELECT * FROM master_points ORDER BY name ASC');
        return results.map(p => this.mapPointFromSQLite(p));
      } catch (e: any) { console.error('getAllPoints failed:', e); }
    }
    return [];
  }

  async getAllCreatures(): Promise<Creature[]> {
    if (await this.initialize()) {
      try {
        const results = await masterDbEngine.getAllAsync<any>('SELECT * FROM master_creatures ORDER BY name ASC');
        return results.map(c => this.mapCreatureFromSQLite(c));
      } catch (e: any) { console.error('getAllCreatures failed:', e); }
    }
    return [];
  }

  async getRegions(): Promise<{ id: string; name: string }[]> {
    if (await this.initialize()) {
      try {
        const results = await masterDbEngine.getAllAsync<any>('SELECT * FROM master_regions ORDER BY name ASC');
        return results.map(r => ({ id: r.id, name: r.name }));
      } catch (e: any) { console.error('getRegions failed:', e); }
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
          regionId: z.parent_id || z.region_id // 仕様書準拠(parent_id)と旧実装(region_id)の互換性維持
        }));
      } catch (e: any) { console.error('getZones failed:', e); }
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
          zoneId: a.parent_id || a.zone_id, // 仕様書準拠(parent_id)と旧実装(zone_id)の互換性維持
          regionId: ''
        }));
      } catch (e: any) { console.error('getAreas failed:', e); }
    }
    return [];
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
