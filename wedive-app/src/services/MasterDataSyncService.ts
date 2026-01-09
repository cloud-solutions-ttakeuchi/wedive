import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { app } from '../firebase';
import { ref, getDownloadURL, getMetadata, getStorage } from 'firebase/storage';
import { appDbEngine } from './AppSQLiteEngine';
import { GzipHelper } from '../utils/GzipHelper';
import { userDataService } from './UserDataService';

const { cacheDirectory, documentDirectory } = FileSystem;

// マスターデータ専用のバケット（gs://...）を指定
const rawBucket = process.env.EXPO_PUBLIC_MASTER_DATA_BUCKET;
if (!rawBucket) {
  throw new Error('EXPO_PUBLIC_MASTER_DATA_BUCKET environment variable is not set');
}
const MASTER_BUCKET = rawBucket.startsWith('gs://') ? rawBucket : `gs://${rawBucket}`;
console.log('[Sync] Master Data Storage Bucket:', MASTER_BUCKET);
const storage = getStorage(app, MASTER_BUCKET);

const MASTER_STORAGE_PATH = 'v1/master/latest.db.gz';
const MASTER_DB_NAME = 'master.db';
const LAST_UPDATED_KEY = 'master_db_last_updated';

export class MasterDataSyncService {
  /**
   * 同期実行（Firebase Storage メタデータチェック -> DL -> 解凍 -> クリーンアップ）
   */
  static async syncMasterData(): Promise<void> {
    // ローカルDBの存在確認（catchブロックでも使うため先に宣言）
    const sqliteDir = (documentDirectory || '') + 'SQLite/';
    const dbPath = sqliteDir + MASTER_DB_NAME;
    const dbInfo = await FileSystem.getInfoAsync(dbPath);
    const isFirstSync = !dbInfo.exists;

    try {
      // SQLiteディレクトリを作成（なければ）
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }

      if (isFirstSync) {
        console.log('[Sync] No local database found. Will download from GCS...');
      }

      console.log('[Sync] Checking master data update via Firebase Storage...');

      const masterRef = ref(storage, MASTER_STORAGE_PATH);

      // 1. メタデータの取得（更新日時のチェック）
      const metadata = await getMetadata(masterRef);
      const serverUpdated = metadata.updated; // ISO8601 string
      const cachedUpdated = await AsyncStorage.getItem(LAST_UPDATED_KEY);

      // 初回 or 更新がある場合のみダウンロード
      if (!isFirstSync && cachedUpdated === serverUpdated) {
        console.log('[Sync] Master data is up to date.');
        return;
      }

      console.log('[Sync] New master data version detected. Downloading...');

      // 2. 署名付き（トークン付き）URLの取得
      const downloadUrl = await getDownloadURL(masterRef);

      // 3. ダウンロード
      const tempPath = (cacheDirectory || '') + 'latest_master.db.gz';
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, tempPath);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      // 4. 解凍
      await GzipHelper.decompressGzipFile(tempPath, dbPath);

      // 4.5 DBエンジンのリロード（古い接続を閉じて新しいファイルを開く）
      console.log('[Sync] Reloading database connection...');
      await appDbEngine.close();
      await appDbEngine.initialize(MASTER_DB_NAME);

      // 5. 更新日時の保存
      if (serverUpdated) {
        await AsyncStorage.setItem(LAST_UPDATED_KEY, serverUpdated);
      }

      console.log('[Sync] Master data updated to latest version.');

      // 6. プロポーザルのクリーンアップ
      await this.cleanupProposals();

    } catch (error) {
      console.error('[Sync] Master data sync failed:', error);

      if (isFirstSync) {
        console.warn('[Sync] First sync failed. Creating empty tables locallly as fallback.');
        await this.createLocalTables(dbPath);
      } else {
        // 2回目以降 → ローカルDBを使い続ける（オフライン対応）
        console.warn('[Sync] Could not update master data. Using local database.');
      }
    }
  }

  /**
   * ローカルフォールバック用の空テーブル作成
   */
  private static async createLocalTables(dbPath: string): Promise<void> {
    try {
      const SQLite = require('expo-sqlite');
      const db = await SQLite.openDatabaseAsync(MASTER_DB_NAME);

      await db.execAsync(`
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

  /**
   * マスタ反映済みプロポーザルのクリーンアップ
   * master.db と user.db を突き合わせて、反映済み ID を削除
   */
  private static async cleanupProposals(): Promise<void> {
    try {
      // ログイン中のユーザーがいなければスキップ
      const userId = userDataService.getCurrentUserId();
      if (!userId) {
        console.log('[Sync] No user logged in. Skipping proposal cleanup.');
        return;
      }

      // user.db が初期化されていることを確認
      await userDataService.initialize(userId);

      // 仮の SQLite モジュール（expo-sqlite）を再取得
      const SQLite = require('expo-sqlite');
      const masterDb = await SQLite.openDatabaseAsync(MASTER_DB_NAME);
      const userDb = await SQLite.openDatabaseAsync(`user_${userId}.db`);

      // (A) マスタ反映済みポイントの ID リストを取得
      const masterPoints = await masterDb.getAllAsync('SELECT id FROM master_points');
      const masterPointIds = masterPoints.map((p: any) => p.id);

      // (B) マスタ反映済み生物の ID リストを取得
      const masterCreatures = await masterDb.getAllAsync('SELECT id FROM master_creatures');
      const masterCreatureIds = masterCreatures.map((c: any) => c.id);

      const allMasterIds = [...masterPointIds, ...masterCreatureIds];

      if (allMasterIds.length === 0) return;

      // (C) my_proposals から削除
      // SQLite の IN 句の上限に配慮しつつ処理
      const placeholders = allMasterIds.map(() => '?').join(',');
      await userDb.runAsync(
        `DELETE FROM my_proposals WHERE target_id IN (${placeholders})`,
        allMasterIds
      );

      console.log(`[Sync] Cleanup completed: Removed matching proposals from local.`);

    } catch (error) {
      console.error('[Sync] Proposal cleanup failed:', error);
    }
  }

  /**
   * データベースの整合性チェック
   * 必須テーブルやカラムが存在するか確認し、不足していれば true (要修復) を返す
   */
  private static async checkDatabaseIntegrity(): Promise<boolean> {
    try {
      // DB初期化
      await appDbEngine.initialize(MASTER_DB_NAME);

      // 1. master_agencies テーブルの存在確認
      const tableCheck = await appDbEngine.getAllAsync<any>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='master_agencies'"
      );
      if (!tableCheck || tableCheck.length === 0) {
        console.warn('[Sync] Integrity Check: master_agencies table missing.');
        return true;
      }

      // 2. master_points テーブルの search_text カラム確認 (search機能に必須)
      try {
        await appDbEngine.getAllAsync("SELECT search_text FROM master_points LIMIT 1");
      } catch (e) {
        console.warn('[Sync] Integrity Check: search_text column missing in master_points.');
        return true;
      }

      return false; // 正常
    } catch (error) {
      console.warn('[Sync] Integrity Check failed (DB access error):', error);
      return true; // エラーなら安全のため修復対象とする
    }
  }
}
