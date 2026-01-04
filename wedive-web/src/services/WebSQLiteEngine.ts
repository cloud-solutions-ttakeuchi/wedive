import * as SQLite from 'wa-sqlite';
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
let memoryVfsInstance: any = null; // メモリ VFS のインスタンスを保持

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
   * バイナリデータ (Uint8Array) からデータベースをインポート
   */
  async importDatabase(data: Uint8Array): Promise<void> {
    if (!this.api) await this.initialize();

    // 1. メモリ VFS を一度だけ登録
    const memoryVfsName = 'memory-import';
    if (!registeredVFS.has(memoryVfsName)) {
      memoryVfsInstance = new MemoryVFS();
      (memoryVfsInstance as any).name = memoryVfsName;
      this.api.vfs_register(memoryVfsInstance);
      registeredVFS.add(memoryVfsName);
    }

    const tempName = `import_${Date.now()}.db`;
    const buffer = data.slice().buffer;

    // 2. メモリ VFS 内にバイナリデータを配置
    (memoryVfsInstance as any).mapNameToFile.set(tempName, {
      name: tempName,
      flags: SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
      size: buffer.byteLength,
      data: buffer
    });

    let srcDb: number | null = null;
    try {
      // 3. メモリ上の DB を開く
      srcDb = await this.api.open_v2(tempName, SQLite.SQLITE_OPEN_READWRITE, memoryVfsName);

      // 4. 現在の DB を閉じる（上書きするため）
      if (this.db) {
        await this.api.close(this.db);
        this.db = null;
      }

      // 5. 永続ストレージ上の既存ファイルを削除
      if (this.vfs) {
        try {
          await this.vfs.xDelete(this.dbName, 0);
        } catch (delErr) {
          console.warn('[SQLite Web] Old DB file may not exist (OK):', delErr);
        }
      }

      // 6. メモリから永続ストレージへデータを転送
      await this.api.exec(srcDb, `VACUUM INTO '${this.dbName}'`);

      // 7. 新しい DB を開く
      this.db = await this.api.open_v2(this.dbName);

      console.log(`[SQLite Web] ${this.dbName} updated successfully.`);
    } catch (e) {
      console.error('[SQLite Web] Import failed:', e);
      // エラーが発生した場合でも DB を開き直す試み
      if (!this.db) {
        try {
          this.db = await this.api.open_v2(this.dbName);
        } catch (reopenErr) {
          console.error('[SQLite Web] Failed to reopen DB after error:', reopenErr);
        }
      }
      throw e;
    } finally {
      // 8. クリーンアップ
      if (srcDb !== null) {
        try {
          await this.api.close(srcDb);
        } catch (closeErr) {
          console.warn('[SQLite Web] Failed to close source DB:', closeErr);
        }
      }
      if (memoryVfsInstance) {
        (memoryVfsInstance as any).mapNameToFile.delete(tempName);
      }
    }
  }
}

export const masterDbEngine = new WebSQLiteEngine('master.db');
export const userDbEngine = new WebSQLiteEngine('user.db');
