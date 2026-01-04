// @ts-ignore
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
// @ts-ignore
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js';
// @ts-ignore
import { MemoryVFS } from 'wa-sqlite/src/examples/MemoryVFS.js';
import type { SQLiteExecutor } from 'wedive-shared';

// 共有の WASM インスタンス管理
let sharedSqlite: any = null;
let sharedApi: any = null;
const registeredVFS = new Set<string>();

export class WebSQLiteEngine implements SQLiteExecutor {
  private db: number | null = null;
  private api: any = null;
  private vfs: any = null;
  private dbName: string;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  async initialize() {
    if (this.db) return;

    // WASM インスタンスを一度だけ作成
    if (!sharedSqlite) {
      sharedSqlite = await SQLiteESMFactory();
      sharedApi = SQLite.Factory(sharedSqlite);
    }
    this.api = sharedApi;

    // VFS の登録 (一度だけ)
    if (!registeredVFS.has(this.dbName)) {
      this.vfs = new IDBBatchAtomicVFS(this.dbName);
      this.api.vfs_register(this.vfs, true);
      registeredVFS.add(this.dbName);
    }

    this.db = await this.api.open_v2(this.dbName);
    console.log(`[SQLite Web] Database ${this.dbName} initialized.`);
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) await this.initialize();

    const results: T[] = [];
    await this.api.statements(this.db, sql, (s: any) => {
      for (let i = 0; i < params.length; ++i) {
        this.api.bind(s, i + 1, params[i]);
      }
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
    if (this.db && this.api) {
      await this.api.close(this.db);
      this.db = null;
    }
  }

  /**
   * バイナリデータ (Uint8Array) からデータベースをインポート (Backup API 使用)
   */
  async importDatabase(data: Uint8Array): Promise<void> {
    if (!this.api) await this.initialize();

    // 1. メモリ上に一時的なソース DB を作成
    const memoryVfsName = 'memory-import';
    if (!registeredVFS.has(memoryVfsName)) {
      const memoryVfs = new MemoryVFS();
      (memoryVfs as any).name = memoryVfsName;
      this.api.vfs_register(memoryVfs);
      registeredVFS.add(memoryVfsName);
    }

    const tempName = `import_${Date.now()}.db`;
    const tempVfs = this.api.vfs_find(memoryVfsName);
    const buffer = data.slice().buffer;
    (tempVfs as any).mapNameToFile.set(tempName, {
      name: tempName,
      flags: SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
      size: buffer.byteLength,
      data: buffer
    });

    try {
      const srcDb = await this.api.open_v2(tempName, SQLite.SQLITE_OPEN_READONLY, memoryVfsName);

      try {
        // 現在の DB 接続が開いていなければ初期化
        if (!this.db) await this.initialize();

        // 2. Backup API を使用してメモリから永続ストレージへコピー
        // これにより、既存のハンドルを維持したまま中身を入れ替えられる
        const backup = await this.api.backup_init(this.db, 'main', srcDb, 'main');
        await this.api.backup_step(backup, -1);
        await this.api.backup_finish(backup);

        console.log(`[SQLite Web] ${this.dbName} updated via Backup API.`);
      } finally {
        await this.api.close(srcDb);
        (tempVfs as any).mapNameToFile.delete(tempName);
      }
    } catch (e) {
      console.error('[SQLite Web] Import failed:', e);
      throw e;
    }
  }
}

export const masterDbEngine = new WebSQLiteEngine('master.db');
export const userDbEngine = new WebSQLiteEngine('user.db');

export const masterDbEngine = new WebSQLiteEngine('master.db');
export const userDbEngine = new WebSQLiteEngine('user.db');
