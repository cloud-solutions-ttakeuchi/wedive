import * as SQLite from 'wa-sqlite';
// @ts-ignore
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
// @ts-ignore
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/vfs/IDBBatchAtomicVFS.js';

/**
 * SQLite 実行インターフェース
 * モバイル版 (expo-sqlite) とロジックを共通化するための抽象レイヤー
 */
export interface SQLiteExecutor {
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  runAsync(sql: string, params?: any[]): Promise<void>;
  close(): Promise<void>;
}

export class WebSQLiteEngine implements SQLiteExecutor {
  private db: number | null = null;
  private sqlite: any = null;
  private api: any = null;

  constructor(private dbName: string) { }

  async initialize() {
    if (this.db) return;

    this.sqlite = await SQLiteESMFactory();
    this.api = SQLite.Factory(this.sqlite);

    // Web では IDBBatchAtomicVFS または OPFS (Origin Private File System) を使用可能
    // ここでは永続化のために IDB または OPFS VFS を登録
    const vfs = new IDBBatchAtomicVFS(this.dbName);
    this.api.vfs_register(vfs, true);

    this.db = await this.api.open_v1(this.dbName);
    console.log(`[SQLite Web] Database ${this.dbName} opened via OPFS/IDB.`);
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) await this.initialize();

    const results: T[] = [];
    await this.api.statements(this.db, sql, (s: any, next: any) => {
      // パラメータのバインド
      for (let i = 0; i < params.length; ++i) {
        this.api.bind(s, i + 1, params[i]);
      }

      // 結果のフェッチ
      while (this.api.step(s) === SQLite.SQLITE_ROW) {
        results.push(this.api.row(s) as T);
      }
    });

    return results;
  }

  async runAsync(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) await this.initialize();
    await this.api.exec(this.db, sql, null, params);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.api.close(this.db);
      this.db = null;
    }
  }
}

export const masterDbEngine = new WebSQLiteEngine('master.db');
export const userDbEngine = new WebSQLiteEngine('user.db');
