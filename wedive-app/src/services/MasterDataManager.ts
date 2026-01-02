import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pako from 'pako';
import { Buffer } from 'buffer';
import { getStorage, ref, getMetadata, getDownloadURL } from 'firebase/storage';
import { app } from '../firebase';
import { Asset } from 'expo-asset';

const { documentDirectory, cacheDirectory, EncodingType } = FileSystem;

const BUNDLED_DB_ASSET = require('../../assets/master.db'); // 同梱アセット
const STORAGE_PATH = 'v1/master/latest.db.gz';
const DB_NAME = 'master.db';
const DB_GZ_NAME = 'latest.db.gz';
const STORAGE_KEY_LAST_UPDATED = 'master_data_last_updated';

const storage = getStorage(app, 'gs://wedive-app-static-master');

/**
 * モバイルアプリ起動時のマスターデータ同期管理クラス
 */
export class MasterDataManager {
  private static getDBPath() {
    return `${documentDirectory}SQLite/${DB_NAME}`;
  }

  private static getTempGzPath() {
    return `${cacheDirectory}${DB_GZ_NAME}`;
  }

  /**
   * 同梱されているDBアセットを展開する（必要な場合のみ）
   */
  private static async ensureDatabaseExists() {
    const dbPath = this.getDBPath();
    const dbInfo = await FileSystem.getInfoAsync(dbPath);

    if (!dbInfo.exists) {
      console.log('No local database found. Extracting bundled asset...');

      // SQLiteディレクトリを作成
      const sqliteDir = `${documentDirectory}SQLite`;
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }

      // Bundleされたアセットをスマホのドキュメントにコピー
      const asset = Asset.fromModule(BUNDLED_DB_ASSET);
      await asset.downloadAsync(); // キャッシュへのDL

      if (asset.localUri) {
        await FileSystem.copyAsync({
          from: asset.localUri,
          to: dbPath
        });
        console.log('Bundled database extracted successfully.');
      }
    }
  }

  /**
   * 同期が必要かチェックし、必要に応じて更新を実行する
   */
  static async syncIfNeeded(force = false): Promise<boolean> {
    try {
      // 1. まず内蔵DBがあるか確認し、なければ展開する
      await this.ensureDatabaseExists();

      console.log('Checking master data sync via Firebase Storage...');

      const lastUpdated = await AsyncStorage.getItem(STORAGE_KEY_LAST_UPDATED);
      const masterRef = ref(storage, STORAGE_PATH);

      // 1. メタデータからサーバーの最終更新日時を取得 (403を回避)
      const metadata = await getMetadata(masterRef);
      const serverLastModified = metadata.updated;

      if (!force && lastUpdated && lastUpdated === serverLastModified) {
        // すでに最新
        const dbExists = await FileSystem.getInfoAsync(this.getDBPath());
        if (dbExists.exists) {
          console.log('Master data is up to date.');
          return false;
        }
      }

      console.log('New master data version found. Fetching download URL...');

      // 2. 署名付き(認証済み)URLを取得
      const downloadUrl = await getDownloadURL(masterRef);

      await this.downloadAndUpdate(downloadUrl);

      if (serverLastModified) {
        await AsyncStorage.setItem(STORAGE_KEY_LAST_UPDATED, serverLastModified);
      }

      return true;
    } catch (error) {
      console.warn('Silent fallback: Master data sync failed (Auth/Network error):', error);
      return false;
    }
  }

  /**
   * ダウンロードと解凍、ファイルの差し替えを実行
   */
  private static async downloadAndUpdate(downloadUrl: string) {
    const gzPath = this.getTempGzPath();
    const dbPath = this.getDBPath();
    const sqliteDir = `${documentDirectory}SQLite`;

    // 1. ディレクトリ作成 (存在しない場合)
    const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
    }

    // 2. GZファイルのダウンロード (署名付きURLを使用)
    const downloadRes = await FileSystem.downloadAsync(
      downloadUrl,
      gzPath
    );

    if (downloadRes.status !== 200) {
      throw new Error(`Download failed with status ${downloadRes.status}`);
    }

    console.log('Download complete. Decompressing...');

    // 3. データの書き出し
    console.log('Reading downloaded file...');
    const base64Data = await FileSystem.readAsStringAsync(gzPath, {
      encoding: EncodingType.Base64,
    });
    const buffer = Buffer.from(base64Data, 'base64');

    // GZIPのマジックナンバー (0x1f 0x8b) をチェック
    const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;

    if (isGzip) {
      try {
        console.log('Decompressing GZIP data...');
        const decompressed = pako.ungzip(new Uint8Array(buffer));
        const decompressedBase64 = Buffer.from(decompressed).toString('base64');
        await FileSystem.writeAsStringAsync(dbPath, decompressedBase64, {
          encoding: EncodingType.Base64,
        });
      } catch (gzError) {
        console.error('Ungzip failed, falling back to direct copy:', gzError);
        await FileSystem.copyAsync({ from: gzPath, to: dbPath });
      }
    } else {
      console.log('Data is already decompressed (automatic transcoding). Saving directly.');
      await FileSystem.copyAsync({ from: gzPath, to: dbPath });
    }

    // 5. キャッシュ（gz）の削除
    await FileSystem.deleteAsync(gzPath, { idempotent: true });

    console.log('Master data updated successfully.');
  }
}
