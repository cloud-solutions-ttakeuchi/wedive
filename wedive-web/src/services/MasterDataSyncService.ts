import { ref, getDownloadURL, getMetadata, getStorage } from 'firebase/storage';
import { app } from '../lib/firebase';
import pako from 'pako';
import { masterDbEngine } from './WebSQLiteEngine';

const MASTER_BUCKET = `gs://${import.meta.env.VITE_MASTER_DATA_BUCKET}`;
const storage = getStorage(app, MASTER_BUCKET);
const MASTER_STORAGE_PATH = 'v1/master/latest.db.gz';
const LAST_UPDATED_KEY = 'master_db_last_updated';

export class MasterDataSyncService {
  private static isSyncing = false;

  /**
   * マスターデータの同期実行
   */
  static async syncMasterData(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      console.log('[Sync] Checking master data update via Firebase Storage...');

      const masterRef = ref(storage, MASTER_STORAGE_PATH);

      // 1. メタデータの取得
      const metadata = await getMetadata(masterRef);
      const serverUpdated = metadata.updated; // ISO8601 string
      const cachedUpdated = localStorage.getItem(LAST_UPDATED_KEY);

      // Force sync once for engine migration (wa-sqlite -> official sqlite-wasm)
      const ENGINE_VERSION = 'v2-opfs-v10';
      const lastEngineVersion = localStorage.getItem('master_db_engine_version');

      if (cachedUpdated === serverUpdated && lastEngineVersion === ENGINE_VERSION) {
        console.log('[Sync] Master data is up to date.');
        return;
      }

      console.log('[Sync] New master data or engine version detected. Synchronizing...');
      localStorage.setItem('master_db_engine_version', ENGINE_VERSION);

      // 2. ダウンロード URL の取得
      const downloadUrl = await getDownloadURL(masterRef);

      // 3. フェッチ
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      // 4. 解凍 (Gzip)
      console.log('[Sync] Decompressing master data...');
      const decompressed = pako.ungzip(new Uint8Array(arrayBuffer));

      // Debug: Check header
      const header = new TextDecoder().decode(decompressed.slice(0, 16));
      console.log('[Sync] DB Header (Text):', header);
      console.log('[Sync] DB Header (Hex):', Array.from(decompressed.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // 5. SQLite への反映
      // Web 版ではバイナリデータをメモリにロードしてから永続化ストレージへ保存する
      await this.updateSQLiteDatabase(decompressed);

      // 6. 更新日時の保存
      if (serverUpdated) {
        localStorage.setItem(LAST_UPDATED_KEY, serverUpdated);
      }

      console.log('[Sync] Master data updated to latest version.');

    } catch (error) {
      console.error('[Sync] Master data sync failed:', error);
      // 初回同期失敗時（またはファイルがない場合）に備えてフォールバックを実行
      await this.fallbackToLocalTables();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * SQLite データベースのバイナリを更新
   */
  private static async updateSQLiteDatabase(data: Uint8Array): Promise<void> {
    // 既存のエンジンを初期化
    await masterDbEngine.initialize();

    // エンジン内部の API を使用してバイナリをロード
    if ('importDatabase' in masterDbEngine && typeof (masterDbEngine as any).importDatabase === 'function') {
      await (masterDbEngine as any).importDatabase(data);
    } else {
      console.error('[Sync] importDatabase method not found on masterDbEngine');
    }
  }

  /**
   * ローカルフォールバック用の空テーブル作成
   */
  private static async fallbackToLocalTables(): Promise<void> {
    console.warn('[Sync] Attempting to create local fallback tables...');
    try {
      await masterDbEngine.initialize();
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
        CREATE TABLE IF NOT EXISTS master_geography (
          area_id TEXT, area_name TEXT, area_description TEXT, area_status TEXT,
          zone_id TEXT, zone_name TEXT, zone_description TEXT, zone_status TEXT,
          region_id TEXT, region_name TEXT, region_description TEXT, region_status TEXT,
          full_path TEXT
        );
        CREATE TABLE IF NOT EXISTS master_point_creatures (
          id TEXT PRIMARY KEY, point_id TEXT, creature_id TEXT, localRarity TEXT, updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS master_point_reviews (
          id TEXT PRIMARY KEY, point_id TEXT, area_id TEXT, user_id TEXT,
          rating REAL, comment TEXT, created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS master_agencies (id TEXT PRIMARY KEY, name TEXT);
      `);
      console.log('[Sync] Local fallback tables created successfully.');
    } catch (e) {
      console.error('[Sync] Failed to create local fallback tables:', e);
    }
  }
}
