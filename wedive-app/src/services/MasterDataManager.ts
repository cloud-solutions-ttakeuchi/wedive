import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pako from 'pako';
import { Buffer } from 'buffer';

// @ts-ignore - SDKバージョンの違いによる型定義不一致を一旦回避
const documentDirectory = FileSystem.documentDirectory;
// @ts-ignore
const cacheDirectory = FileSystem.cacheDirectory;
// @ts-ignore
const EncodingType = FileSystem.EncodingType;

const GCS_BASE_URL = 'https://storage.googleapis.com/wedive-app-static-master/v1/master';
const DB_NAME = 'master.db';
const DB_GZ_NAME = 'latest.db.gz';
const STORAGE_KEY_LAST_UPDATED = 'master_data_last_updated';

/**
 * モバイルアプリ起動時のマスターデータ同期管理クラス
 */
export class MasterDataManager {
  private static getDBPath() {
    return `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
  }

  private static getTempGzPath() {
    return `${FileSystem.cacheDirectory}${DB_GZ_NAME}`;
  }

  /**
   * 同期が必要かチェックし、必要に応じて更新を実行する
   */
  static async syncIfNeeded(force = false): Promise<boolean> {
    try {
      console.log('Checking master data sync...');

      const lastUpdated = await AsyncStorage.getItem(STORAGE_KEY_LAST_UPDATED);

      // GCSのファイルのメタデータ（ETagやLast-Modified）を確認するのが理想
      // 今回はシンプルにHEADリクエストでContent-LengthやLast-Modifiedをチェックする
      const response = await fetch(`${GCS_BASE_URL}/${DB_GZ_NAME}`, { method: 'HEAD' });
      const serverLastModified = response.headers.get('last-modified');

      if (!force && lastUpdated && lastUpdated === serverLastModified) {
        // すでに最新
        const dbExists = await FileSystem.getInfoAsync(this.getDBPath());
        if (dbExists.exists) {
          console.log('Master data is up to date.');
          return false;
        }
      }

      console.log('New master data version found. Starting download...');
      await this.downloadAndUpdate();

      if (serverLastModified) {
        await AsyncStorage.setItem(STORAGE_KEY_LAST_UPDATED, serverLastModified);
      }

      return true;
    } catch (error) {
      console.error('Failed to sync master data:', error);
      // 通信失敗時はフォールバック（既存のDBを使う）
      return false;
    }
  }

  /**
   * ダウンロードと解凍、ファイルの差し替えを実行
   */
  private static async downloadAndUpdate() {
    const gzPath = this.getTempGzPath();
    const dbPath = this.getDBPath();
    const sqliteDir = `${FileSystem.documentDirectory}SQLite`;

    // 1. ディレクトリ作成 (存在しない場合)
    const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
    }

    // 2. GZファイルのダウンロード
    const downloadRes = await FileSystem.downloadAsync(
      `${GCS_BASE_URL}/${DB_GZ_NAME}`,
      gzPath
    );

    if (downloadRes.status !== 200) {
      throw new Error(`Download failed with status ${downloadRes.status}`);
    }

    console.log('Download complete. Decompressing...');

    // 3. pakoで解凍
    // ExpoのFileSystemでファイルをバイナリ（base64）として読み込む
    const base64Data = await FileSystem.readAsStringAsync(gzPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const buffer = Buffer.from(base64Data, 'base64');

    // gz解凍 (Uint8Array)
    const decompressed = pako.ungzip(new Uint8Array(buffer));

    // 4. 書き出し
    const decompressedBase64 = Buffer.from(decompressed).toString('base64');
    await FileSystem.writeAsStringAsync(dbPath, decompressedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 5. キャッシュ（gz）の削除
    await FileSystem.deleteAsync(gzPath, { idempotent: true });

    console.log('Master data updated successfully.');
  }
}
