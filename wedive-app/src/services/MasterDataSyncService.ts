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
        // 初回起動でダウンロード失敗 → DBがないので動けない
        throw new Error('初回起動時はネットワーク接続が必要です');
      }
      // 2回目以降 → ローカルDBを使い続ける（オフライン対応）
      console.warn('[Sync] Could not update master data. Using local database.');
    }
  }

  /**
   * マスタ反映済みプロポーザルのクリーンアップ
   * master.db と user.db を突き合わせて、反映済み ID を削除
   */
  private static async cleanupProposals(): Promise<void> {
    try {
      // user.db が初期化されていることを確認
      await userDataService.initialize();

      // 仮の SQLite モジュール（expo-sqlite）を再取得
      const SQLite = require('expo-sqlite');
      const masterDb = await SQLite.openDatabaseAsync(MASTER_DB_NAME);
      const userDb = await SQLite.openDatabaseAsync('user.db');

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
