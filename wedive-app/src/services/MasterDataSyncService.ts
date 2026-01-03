import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { GzipHelper } from '../utils/GzipHelper';
import { userDataService } from './UserDataService';

const { cacheDirectory, documentDirectory } = FileSystem;

const GCS_MASTER_URL = 'https://storage.googleapis.com/wedive-app-static-master/v1/master/latest.db.gz';
const MASTER_DB_NAME = 'master.db';
const ETAG_STORAGE_KEY = 'master_db_etag';
const BUNDLED_DB_ASSET = require('../../assets/master.db');

export class MasterDataSyncService {
  /**
   * 同期実行（ETagチェック -> DL -> 解凍 -> クリーンアップ）
   */
  static async syncMasterData(): Promise<void> {
    try {
      // 0. まず内蔵DBがあるか確認し、なければ展開する
      await this.ensureDatabaseExists();

      console.log('[Sync] Checking master data update...');

      // 1. ETag の取得（HEADリクエスト）
      const response = await axios.head(GCS_MASTER_URL);
      const newEtag = response.headers['etag'];
      const cachedEtag = await AsyncStorage.getItem(ETAG_STORAGE_KEY);

      if (cachedEtag === newEtag) {
        console.log('[Sync] Master data is up to date.');
        return;
      }

      console.log('[Sync] New master data version detected. Downloading...');

      // 2. ダウンロード
      const tempPath = (cacheDirectory || '') + 'latest_master.db.gz';
      const downloadResult = await FileSystem.downloadAsync(GCS_MASTER_URL, tempPath);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      // 3. 解凍
      const sqliteDir = (documentDirectory || '') + 'SQLite/';
      const targetPath = sqliteDir + MASTER_DB_NAME;
      await GzipHelper.decompressGzipFile(tempPath, targetPath);

      // 4. ETag の保存
      if (newEtag) {
        await AsyncStorage.setItem(ETAG_STORAGE_KEY, newEtag);
      }

      console.log('[Sync] Master data updated to latest version.');

      // 5. プロポーザルのクリーンアップ
      await this.cleanupProposals();

    } catch (error) {
      console.warn('[Sync] Master data sync failed:', error);
      // 通信エラー等の場合は既存のローカルDBを使用するため、エラーを伝播させない
    }
  }

  /**
   * 同梱されているDBアセットを展開する（必要な場合のみ）
   */
  private static async ensureDatabaseExists() {
    const sqliteDir = (documentDirectory || '') + 'SQLite/';
    const dbPath = sqliteDir + MASTER_DB_NAME;
    const dbInfo = await FileSystem.getInfoAsync(dbPath);

    if (!dbInfo.exists) {
      console.log('[Sync] No local database found. Extracting bundled asset...');

      // SQLiteディレクトリを作成
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }

      // Bundleされたアセットをスマホのドキュメントにコピー
      const asset = Asset.fromModule(BUNDLED_DB_ASSET);
      await asset.downloadAsync();

      if (asset.localUri) {
        await FileSystem.copyAsync({
          from: asset.localUri,
          to: dbPath
        });
        console.log('[Sync] Bundled database extracted successfully.');
      }
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
}
