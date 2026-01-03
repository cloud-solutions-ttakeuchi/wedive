import * as SQLite from 'wa-sqlite';
// @ts-ignore
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
// @ts-ignore
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js';
import type { SQLiteExecutor } from 'wedive-shared';

export class WebSQLiteEngine implements SQLiteExecutor {
  private db: number | null = null;
  private sqlite: any = null;
  private api: any = null;
  private dbName: string;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  /**
   * バイナリデータ (Uint8Array) からデータベースをインポート
   */
  async importDatabase(data: Uint8Array): Promise<void> {
    if (!this.sqlite || !this.api) await this.initialize();

    // 1. メモリ上に一時的なデータベースを作成
    const memDb = await this.api.open_v1('temp_mem', SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_MEMORY);

    try {
      // 2. バイナリデータをロード (deserialize)
      // Note: wa-sqlite の deserialize 実装を確認
      await this.api.deserialize(memDb, 'main', data, data.length, data.length, 1 | 2); // 1: FREEONCLOSE, 2: RESIZEABLE

      // 3. 永続化データベースを開く
      if (!this.db) {
        this.db = await this.api.open_v1(this.dbName);
      }

      // 4. メモリ DB から永続 DB へ内容をコピー (VACUUM INTO は SQLite 3.27+ で利用可能)
      // または単純に現在の DB を閉じてファイルを置き換える手法もありますが、
      // ここでは一番安全な「一時 DB として開き、永続 DB へ移行」するフローを想定
      await this.api.exec(memDb, `VACUUM INTO '${this.dbName}'`);

    } finally {
      await this.api.close(memDb);
    }
  }
}

export const masterDbEngine = new WebSQLiteEngine('master.db');
export const userDbEngine = new WebSQLiteEngine('user.db');
