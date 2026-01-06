import { ref, getDownloadURL, getMetadata, getStorage } from 'firebase/storage';
import { app } from '../lib/firebase';
import pako from 'pako';
import { masterDbEngine } from './WebSQLiteEngine';

const MASTER_BUCKET = 'gs://wedive-app-static-master';
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
    // 注意: wa-sqlite の実装に依存するため、WebSQLiteEngine に
    // バイナリロード用のメソッドを追加するのが望ましい
    if ('importDatabase' in masterDbEngine && typeof (masterDbEngine as any).importDatabase === 'function') {
      await (masterDbEngine as any).importDatabase(data);
    } else {
      console.error('[Sync] importDatabase method not found on masterDbEngine');
    }
  }
}
