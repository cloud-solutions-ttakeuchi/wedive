// WebSQLiteEngine.ts – Official SQLite WASM implementation with OPFS
// @ts-ignore
import sqlite3Worker1Promiser from '@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3-worker1-promiser-bundler-friendly.mjs';
import type { SQLiteExecutor } from 'wedive-shared';

// Shared promiser instance and lock
let sharedPromiser: any = null;
let initializationPromise: Promise<any> | null = null;

export class WebSQLiteEngine implements SQLiteExecutor {
  private promiser: any = null;
  private dbName: string;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  /** Initialise the SQLite WASM Promiser and open the DB via OPFS */
  async initialize(): Promise<void> {
    if (this.promiser) return;

    if (initializationPromise) {
      this.promiser = await initializationPromise;
      return;
    }

    initializationPromise = (async () => {
      if (!sharedPromiser) {
        console.log('[SQLite Web] Initializing Official SQLite WASM Promiser (Bundler Friendly)...');

        // sqlite3Worker1Promiser.v2() returns a promise that resolves to the promiser function
        sharedPromiser = await sqlite3Worker1Promiser.v2({
          // By using the bundler version, we don't need to manually provide the worker
          // but we can if the default path resolution fails.
          // For now, let's try the default provided by the bundler-friendly mjs.
        });

        console.log('[SQLite Web] Worker ready.');
      }
      return sharedPromiser;
    })();

    this.promiser = await initializationPromise;

    console.log(`[SQLite Web] Opening database: ${this.dbName}...`);
    try {
      await this.promiser('open', {
        filename: `file:${this.dbName}?vfs=opfs`,
      });
      console.log(`[SQLite Web] Database ${this.dbName} opened via OPFS successfully.`);
    } catch (e) {
      console.error(`[SQLite Web] Failed to open database ${this.dbName}:`, e);
      throw e;
    }

    // Log database summary
    await this.logDatabaseSummary();
  }

  /** Execute a SELECT and return rows as objects */
  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.promiser) await this.initialize();

    try {
      const response = await this.promiser('exec', {
        sql,
        bind: params,
        rowMode: 'object',
      });

      const rows = response.result.resultRows || [];
      return rows as T[];
    } catch (e) {
      console.error(`[SQLite Web] getAllAsync error for ${sql}:`, e);
      throw e;
    }
  }

  /** Execute a non‑SELECT statement */
  async runAsync(sql: string, params: any[] = []): Promise<void> {
    if (!this.promiser) await this.initialize();

    try {
      await this.promiser('exec', {
        sql,
        bind: params,
      });
    } catch (e) {
      console.error(`[SQLite Web] runAsync error for ${sql}:`, e);
      throw e;
    }
  }

  /** Close the database */
  async close(): Promise<void> {
    if (this.promiser) {
      try {
        await this.promiser('close', {
          filename: `file:${this.dbName}?vfs=opfs`,
        });
      } catch (_) {
        // Ignore if error during close
      }
      this.promiser = null;
    }
  }

  /**
   * Import a SQLite database from a Uint8Array.
   * In OPFS, we simply write the bytes to the virtual file system.
   */
  async importDatabase(data: Uint8Array): Promise<void> {
    console.log(`[SQLite Web] Importing database into OPFS: ${this.dbName}...`);

    try {
      // 1. Close current connection if any to release file lock
      if (this.promiser) {
        await this.close();
      }

      // 2. Write directly to OPFS using the browser's FileSystem API
      const root = await navigator.storage.getDirectory();

      // Delete existing file if any to be clean
      try {
        await root.removeEntry(this.dbName);
        await root.removeEntry(`${this.dbName}-journal`).catch(() => { });
        await root.removeEntry(`${this.dbName}-wal`).catch(() => { });
      } catch (_) {
        // Ignore if file doesn't exist
      }

      const fileHandle = await root.getFileHandle(this.dbName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(data);
      await writable.close();

      console.log(`[SQLite Web] Successfully wrote ${data.byteLength} bytes to OPFS file: ${this.dbName}`);

      // 3. Re-open the database
      await this.initialize();

    } catch (err) {
      console.error('[SQLite Web] importDatabase error:', err);
      throw err;
    }
  }

  /**
   * Log all tables and their row counts to the console for debugging.
   */
  async logDatabaseSummary(): Promise<void> {
    try {
      const tables = await this.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

      console.group(`[SQLite Web] Database Summary: ${this.dbName}`);
      if (tables.length === 0) {
        console.log('No tables found.');
      }

      for (const table of tables) {
        try {
          const countResult = await this.getAllAsync<any>(`SELECT count(*) as count FROM ${table.name}`);
          const count = countResult[0]?.count ?? 0;
          console.log(`- ${table.name.padEnd(25)}: ${count.toLocaleString()} rows`);
        } catch (e) {
          console.error(`- ${table.name.padEnd(25)}: Error getting count`, e);
        }
      }
      console.groupEnd();
    } catch (e) {
      console.error('[SQLite Web] Failed to get database summary:', e);
    }
  }
}

export const masterDbEngine = new WebSQLiteEngine('master.db');
export const userDbEngine = new WebSQLiteEngine('user.db');
