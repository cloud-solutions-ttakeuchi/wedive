// WebSQLiteEngine.ts – Robust SQLite WASM implementation via Worker
import type { SQLiteExecutor } from 'wedive-shared';
// @ts-ignore - Vite special import
import SQLiteWorker from './sqlite-worker?worker';

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
            // Vite の ?worker 方式で生成した Worker クラスを使用
            worker: () => new SQLiteWorker(),
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
    console.log(`[SQLite Web] Opening database: ${this.dbName} (VFS: unix-none)`);
    await this.promiser('open', {
      filename: this.dbName,
      vfs: 'unix-none',
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
      } catch {
        // Ignore close errors
      }
      this.promiser = null;
    }
  }

  /**
   * 外部から取得したデータベース（Uint8Array）を SQLite 側に流し込む
   */
  async importDatabase(data: Uint8Array): Promise<void> {
    console.log(`[SQLite Web] Importing binary data into SQLite: ${data.byteLength} bytes`);

    // 1. 既存の接続を閉じる
    await this.close();
    initializationPromise = null;

    // 2. ブラウザの OPFS (Origin Private File System) に直接書き込む
    // SQLite の API に頼らず、ファイルとして配置してしまうのが最も確実
    try {
      const root = await navigator.storage.getDirectory();

      // 既存ファイルを削除（クリーンアップ）
      await root.removeEntry(this.dbName).catch(() => { });
      await root.removeEntry(`${this.dbName}-journal`).catch(() => { });
      await root.removeEntry(`${this.dbName}-wal`).catch(() => { });

      // 新しいファイルを作成して書き込み
      const fileHandle = await root.getFileHandle(this.dbName, { create: true });
      const writable = await fileHandle.createWritable();
      // SharedArrayBuffer の可能性があるため、slice() でコピーして純粋な ArrayBuffer にする
      await writable.write(data.slice().buffer);
      await writable.close();

      console.log('[SQLite Web] Written database directly to OPFS.');
    } catch (err) {
      console.error('[SQLite Web] Failed to write to OPFS:', err);
      throw err;
    }

    // 3. 改めて普通に開く
    console.log('[SQLite Web] Re-opening database...');
    // initialize を呼べば、先ほど配置したファイルを読み込んでくれる
    await this.initialize();

    // 検証
    await this.logDatabaseSummary();
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
