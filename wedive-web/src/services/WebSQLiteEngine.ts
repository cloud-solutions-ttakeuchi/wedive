import * as SQLite from 'wa-sqlite';
// @ts-ignore
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
// @ts-ignore
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js';
// @ts-ignore
import { MemoryVFS } from 'wa-sqlite/src/examples/MemoryVFS.js';
import type { SQLiteExecutor } from 'wedive-shared';

export class WebSQLiteEngine implements SQLiteExecutor {
  private db: number | null = null;
  private sqlite: any = null;
  private api: any = null;
  private vfs: any = null;
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
    this.vfs = new IDBBatchAtomicVFS(this.dbName);
    this.api.vfs_register(this.vfs, true);

    this.db = await this.api.open_v2(this.dbName);
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

    const tempVfs = new MemoryVFS();
    const tempName = `temp_${Date.now()}.db`;
    this.api.vfs_register(tempVfs);

    try {
      // MemoryVFS の内部データ構造に合わせて直接データを流し込む
      (tempVfs as any).mapNameToFile.set(tempName, {
        name: tempName,
        flags: SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
        size: data.byteLength,
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      });

      const srcDb = await this.api.open_v2(tempName, SQLite.SQLITE_OPEN_READWRITE, tempVfs.name);

      try {
        // メイン DB を一旦閉じる (上書きするため)
        if (this.db) {
          await this.api.close(this.db);
          this.db = null;
        }

        // 永続ストレージ上の既存ファイルを削除
        if (this.vfs) {
          await this.vfs.xDelete(this.dbName, 0);
        }

        // データを転送 (VACUUM INTO は対象ファイルが存在しない必要があるため、先に実行)
        await this.api.exec(srcDb, `VACUUM INTO '${this.dbName}'`);

        // 書き出し終わったファイルを、検索用に開く
        this.db = await this.api.open_v2(this.dbName);

        console.log(`[SQLite Web] ${this.dbName} has been updated successfully.`);
      } finally {
        await this.api.close(srcDb);
      }
    } catch (e) {
      console.error('[SQLite Web] Import failed:', e);
      throw e;
    }
  }
}

export const masterDbEngine = new WebSQLiteEngine('master.db');
export const userDbEngine = new WebSQLiteEngine('user.db');
