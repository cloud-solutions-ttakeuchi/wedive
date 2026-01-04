/**
 * 抽象化された SQLite 実行インターフェース
 * Web (SQLite Wasm) と Mobile (expo-sqlite) の差異を吸収します。
 */
export interface SQLiteExecutor {
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  runAsync(sql: string, params?: any[]): Promise<void>;
  close?(): Promise<void>;
}
