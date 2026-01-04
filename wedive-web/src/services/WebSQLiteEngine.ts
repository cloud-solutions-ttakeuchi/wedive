// WebSQLiteEngine.ts – Robust SQLite WASM implementation via Worker
import type { SQLiteExecutor } from 'wedive-shared';

// Vite-native 方式で Worker を読み込む
const workerUrl = new URL('./sqlite-worker.ts', import.meta.url);

let sharedPromiser: any = null;
let initializationPromise: Promise<any> | null = null;

export class WebSQLiteEngine implements SQLiteExecutor {
  private dbName: string;
  private promiser: any = null;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  /**
   * SQLite WASM を Worker 経由で初期化します。
   * これが「唯一の正攻法」であり、OPFS へのアクセスと Vite のビルド問題を同時に解決します。
   */
  async initialize(): Promise<void> {
    if (this.promiser) return;

    if (initializationPromise) {
      this.promiser = await initializationPromise;
      return;
    }

    initializationPromise = (async () => {
      console.log('[SQLite Web] Setting up SQLite Worker Promiser...');

      // 公式ライブラリから Promiser ファクトリをインポート
      const { sqlite3Worker1Promiser } = await import('@sqlite.org/sqlite-wasm') as any;

      return new Promise((resolve, reject) => {
        try {
          const _promiser = sqlite3Worker1Promiser({
            // Vite でビルドされた Worker を指定
            worker: () => new Worker(workerUrl, { type: 'module' }),
            onready: () => {
              console.log('[SQLite Web] Worker is ready and connected.');
              resolve(_promiser);
            },
            onerror: (err: any) => {
              console.error('[SQLite Web] Worker initialization failed:', err);
              reject(err);
            }
          });
        } catch (e) {
          reject(e);
        }
      });
    })();

    this.promiser = await initializationPromise;

    // データベースを OPFS (高速モード) で開く
    console.log(`[SQLite Web] Opening database: ${this.dbName} (VFS: opfs)`);
    await this.promiser('open', {
      filename: this.dbName,
      vfs: 'opfs',
    });

    console.log(`[SQLite Web] Database ${this.dbName} is now open.`);
    await this.logDatabaseSummary();
  }

  /** SELECT クエリを実行し、結果をオブジェクトの配列として返す */
  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.promiser) await this.initialize();

    try {
      const response = await this.promiser('exec', {
        sql,
        bind: params,
        rowMode: 'object',
      });
      return (response.result.resultRows || []) as T[];
    } catch (e: any) {
      console.error(`[SQLite Web] Query failed: ${sql}`, e);
      // 詳細なエラー情報をログ出力
      if (e.result?.message) {
        console.error(`[SQLite Web] SQLite Message: ${e.result.message}`);
      }
      throw e;
    }
  }

  /** INSERT/UPDATE/DELETE などの更新クエリを実行する */
  async runAsync(sql: string, params: any[] = []): Promise<void> {
    if (!this.promiser) await this.initialize();
    try {
      await this.promiser('exec', { sql, bind: params });
    } catch (e: any) {
      console.error(`[SQLite Web] Execution failed: ${sql}`, e);
      throw e;
    }
  }

  /** 接続を解除する */
  async close(): Promise<void> {
    if (this.promiser) {
      try {
        await this.promiser('close');
      } catch (_) { }
      this.promiser = null;
    }
  }

  /**
   * 外部から取得したデータベース（Uint8Array）を SQLite 側に流し込む
   */
  async importDatabase(data: Uint8Array): Promise<void> {
    console.log(`[SQLite Web] Importing binary data into SQLite: ${data.byteLength} bytes`);

    // 1. 既存の接続を完全に削除してリセット（重要）
    await this.close();
    initializationPromise = null;

    // 2. ブラウザ側の OPFS も一旦掃除する（ゴミが残らないように）
    const root = await navigator.storage.getDirectory();
    try {
      await root.removeEntry(this.dbName).catch(() => { });
      await root.removeEntry(`${this.dbName}-journal`).catch(() => { });
      await root.removeEntry(`${this.dbName}-wal`).catch(() => { });
    } catch (_) { }

    // 3. SQLite の 'open' コマンドで 'buffer' を渡してインポート！
    // こうすることで SQLite が内部で最適な OPFS 管理ファイルとして保存してくれます
    console.log('[SQLite Web] Performing native import via open(buffer)...');

    // まず Promiser を再取得（初期化）
    await this.initialize(); // これで promiser がセットされる

    try {
      // 既存の空DBを一度閉じてから、バッファを指定して開き直すことでインポートを実現
      await this.promiser('close');
      await this.promiser('open', {
        filename: this.dbName,
        vfs: 'opfs',
        buffer: data.buffer, // これが決め手！
      });
      console.log('[SQLite Web] Native import successful.');
      await this.logDatabaseSummary();
    } catch (err) {
      console.error('[SQLite Web] Native import failed:', err);
      throw err;
    }
  }

  /** テーブル件数をログ出力（検証用） */
  async logDatabaseSummary(): Promise<void> {
    try {
      const tables = await this.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      console.group(`[SQLite Web] Summary: ${this.dbName}`);
      for (const table of tables) {
        const result = await this.getAllAsync<any>(`SELECT count(*) as count FROM ${table.name}`);
        console.log(`- ${table.name.padEnd(20)}: ${result[0]?.count?.toLocaleString()} rows`);
      }
      console.groupEnd();
    } catch (e) {
      console.error('[SQLite Web] Could not log summary', e);
    }
  }
}

export const masterDbEngine = new WebSQLiteEngine('master.db');
export const userDbEngine = new WebSQLiteEngine('user.db');
