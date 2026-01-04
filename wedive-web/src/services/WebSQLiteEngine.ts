// WebSQLiteEngine.ts – Official SQLite WASM implementation with OPFS
import type { SQLiteExecutor } from 'wedive-shared';

// Shared promiser instance and lock
let sharedPromiser: any = null;
let initializationPromise: Promise<any> | null = null;

export class WebSQLiteEngine implements SQLiteExecutor {
  private dbPath: string;
  private promiser: any = null;
  private dbName: string;

  constructor(dbName: string) {
    this.dbName = dbName;
    this.dbPath = `/${dbName}`;
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
        console.log('[SQLite Web] Initializing Official SQLite WASM Promiser...');

        // Wait a bit if the script is still loading (module scripts are deferred)
        let promiserFactory = (globalThis as any).sqlite3Worker1Promiser;
        if (!promiserFactory) {
          console.log('[SQLite Web] Promiser not found yet, waiting...');
          await new Promise(resolve => setTimeout(resolve, 100));
          promiserFactory = (globalThis as any).sqlite3Worker1Promiser;
        }

        if (!promiserFactory) {
          throw new Error('sqlite3Worker1Promiser not found. Ensure script tag is in index.html with type="module"');
        }

        sharedPromiser = await new Promise((resolve, reject) => {
          try {
            const _promiser = promiserFactory({
              // Use direct path for the worker in public folder
              worker: () => new Worker('/sqlite3/sqlite3-worker1.mjs', { type: 'module' }),
              onready: () => {
                console.log('[SQLite Web] Worker ready.');
                resolve(_promiser);
              },
              onerror: (err: any) => {
                console.error('[SQLite Web] Worker error:', err);
                reject(err);
              },
            });
          } catch (e) {
            reject(e);
          }
        });
      }
      return sharedPromiser;
    })();

    this.promiser = await initializationPromise;

    console.log(`[SQLite Web] Opening database: ${this.dbName}...`);
    await this.promiser('open', {
      filename: `file:${this.dbName}?vfs=opfs`,
    });

    console.log(`[SQLite Web] Database ${this.dbName} opened via OPFS successfully.`);
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

      // Promiser returns { type: 'exec', result: { resultRows: [...] } }
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
      await this.promiser('close', {
        filename: `file:${this.dbName}?vfs=opfs`,
      });
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
      // Note: OPFS is available via navigator.storage.getDirectory()
      const root = await navigator.storage.getDirectory();

      // Delete existing file if any to be clean
      try {
        await root.removeEntry(this.dbName);
        // Also remove journal/wal files if they exist
        await root.removeEntry(`${this.dbName}-journal`).catch(() => { });
        await root.removeEntry(`${this.dbName}-wal`).catch(() => { });
      } catch (e) {
        // Ignore if file doesn't exist
      }

      const fileHandle = await root.getFileHandle(this.dbName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(data);
      await writable.close();

      console.log(`[SQLite Web] Successfully wrote ${data.byteLength} bytes to OPFS file: ${this.dbName}`);

      // 3. Re-open the database
      await this.initialize();

      // Verify schema (optional debug)
      const tables = await this.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
      console.log('[SQLite Web] Imported tables:', tables.map(t => t.name).join(', '));

    } catch (e) {
      console.error('[SQLite Web] importDatabase error:', e);
      throw e;
    }
  }
}

export const masterDbEngine = new WebSQLiteEngine('master.db');
export const userDbEngine = new WebSQLiteEngine('user.db');
