import type { SQLiteExecutor } from 'wedive-shared';
import * as SQLite from 'expo-sqlite';

export class AppSQLiteEngine implements SQLiteExecutor {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(dbName: string = 'master.db'): Promise<void> {
    if (this.db) return;
    this.db = await SQLite.openDatabaseAsync(dbName);
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return await this.db.getAllAsync<T>(sql, params);
  }

  async runAsync(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    await this.db.runAsync(sql, params);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export const appDbEngine = new AppSQLiteEngine();
