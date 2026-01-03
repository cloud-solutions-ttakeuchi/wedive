import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { DiveLog, User } from '../types';

// ネイティブモジュール不足時にファイル全体がクラッシュするのを防ぐ
let SQLite: any = null;
try {
  SQLite = require('expo-sqlite');
} catch (e) {
  console.warn('ExpoSQLite module not found in UserDataService.');
}

export class UserDataService {
  private sqliteDb: any = null;
  private isInitializing = false;

  /**
   * SQLite接続とテーブルの初期化
   */
  async initialize(): Promise<boolean> {
    if (this.sqliteDb) return true;
    if (this.isInitializing) return false;
    if (!SQLite || !SQLite.openDatabaseAsync) {
      return false;
    }

    this.isInitializing = true;
    try {
      this.sqliteDb = await SQLite.openDatabaseAsync('user.db');

      // テーブル作成 (設計書 03_file_formats_and_gcs_naming.md および DATABASE_DESIGN.md に準拠)
      await this.sqliteDb.execAsync(`
        CREATE TABLE IF NOT EXISTS my_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          date TEXT,
          dive_number INTEGER,
          location_json TEXT,
          point_id TEXT,
          point_name TEXT,
          team_json TEXT,
          time_json TEXT,
          depth_info_json TEXT,
          condition_info_json TEXT,
          gear_json TEXT,
          entry_type TEXT,
          creature_id TEXT,
          sighted_creatures_json TEXT,
          photos_json TEXT,
          comment TEXT,
          is_private INTEGER,
          garmin_activity_id TEXT,
          review_id TEXT,
          profile_json TEXT,
          data_json TEXT,
          search_text TEXT,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS my_reviews (
          id TEXT PRIMARY KEY,
          point_id TEXT,
          rating REAL,
          comment TEXT,
          images_json TEXT,
          condition_json TEXT,
          metrics_json TEXT,
          radar_json TEXT,
          tags_json TEXT,
          status TEXT,
          created_at TEXT,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS my_proposals (
          id TEXT PRIMARY KEY,
          target_id TEXT,
          proposal_type TEXT,
          status TEXT,
          data_json TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS my_bookmarks (
          point_id TEXT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS my_favorites (
          creature_id TEXT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS my_settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS my_mastery (
          point_id TEXT PRIMARY KEY,
          point_name TEXT,
          dive_count INTEGER,
          discovered_creatures_count INTEGER,
          last_visit_date TEXT
        );
      `);

      console.log('UserData SQLite initialized (All my_ tables created).');
      return true;
    } catch (error) {
      console.error('UserData SQLite initialization failed:', error);
      this.sqliteDb = null;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 個人のログを取得（ローカルSQLite優先）
   */
  async getLogs(): Promise<DiveLog[]> {
    const isAvailable = await this.initialize();
    if (isAvailable && this.sqliteDb) {
      try {
        const results = await this.sqliteDb.getAllAsync(
          'SELECT data_json FROM my_logs ORDER BY date DESC, dive_number DESC'
        );
        return results.map((row: any) => JSON.parse(row.data_json));
      } catch (error) {
        console.error('Failed to get logs from SQLite:', error);
      }
    }
    return [];
  }

  /**
   * ログを保存（SQLite & Firestore非同期）
   */
  async saveLog(userId: string, log: DiveLog, skipFirestore = false): Promise<void> {
    const isAvailable = await this.initialize();
    const now = new Date().toISOString();

    // 1. SQLiteに保存（即時）
    if (isAvailable && this.sqliteDb) {
      try {
        const searchText = `${log.location.pointName} ${log.comment || ''}`.toLowerCase();
        await this.sqliteDb.runAsync(
          `INSERT OR REPLACE INTO my_logs (
            id, user_id, date, dive_number, location_json, point_id, point_name,
            team_json, time_json, depth_info_json, condition_info_json, gear_json,
            entry_type, creature_id, sighted_creatures_json, photos_json, comment,
            is_private, garmin_activity_id, review_id, profile_json, data_json,
            search_text, synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            log.id,
            userId,
            log.date,
            log.diveNumber || 0,
            JSON.stringify(log.location),
            log.location.pointId,
            log.location.pointName,
            JSON.stringify(log.team || {}),
            JSON.stringify(log.time || {}),
            JSON.stringify(log.depth || {}),
            JSON.stringify(log.condition || {}),
            JSON.stringify(log.gear || {}),
            log.entryType || '',
            log.creatureId || '',
            JSON.stringify(log.sightedCreatures || []),
            JSON.stringify(log.photos || []),
            log.comment || '',
            log.isPrivate ? 1 : 0,
            log.garminActivityId || '',
            log.reviewId || '',
            JSON.stringify(log.profile || {}), // profileはオブジェクトなので{}
            JSON.stringify(log),
            searchText,
            now
          ]
        );
        console.log(`Log ${log.id} saved to SQLite (my_logs).`);
      } catch (error) {
        console.error('Failed to save log to SQLite:', error);
      }
    }

    if (skipFirestore) return;

    // 2. Firestoreに非同期で保存（バックアップ）
    // 本来はバックグラウンドジョブが望ましいが、簡易的に非同期実行
    const logRef = doc(firestoreDb, 'users', userId, 'logs', log.id);
    setDoc(logRef, { ...log, updatedAt: now }).catch(err => {
      console.error('Failed to sync log to Firestore:', err);
      // TODO: 失敗時の再試行キューイング
    });
  }

  /**
   * ログを削除
   */
  async deleteLog(userId: string, logId: string): Promise<void> {
    const isAvailable = await this.initialize();

    if (isAvailable && this.sqliteDb) {
      await this.sqliteDb.runAsync('DELETE FROM my_logs WHERE id = ?', [logId]);
    }

    const logRef = doc(firestoreDb, 'users', userId, 'logs', logId);
    deleteDoc(logRef).catch(err => console.error('Failed to delete log from Firestore:', err));
  }

  /**
   * 初回同期：SQLiteが空の場合にFirestoreから全件取得
   */
  async syncInitialData(userId: string): Promise<void> {
    const isAvailable = await this.initialize();
    if (!isAvailable) return;

    try {
      // ローカルの件数確認
      const row: any = await this.sqliteDb.getFirstAsync('SELECT COUNT(*) as count FROM my_logs');
      if (row && row.count > 0) {
        console.log('Local user data already exists (my_logs). Skipping initial sync.');
        return;
      }

      console.log('Starting initial sync from Firestore for user:', userId);

      // 1. ログの取得
      const logsQuery = query(
        collection(firestoreDb, 'users', userId, 'logs'),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(logsQuery);

      if (!snapshot.empty) {
        for (const doc of snapshot.docs) {
          const log = { id: doc.id, ...doc.data() } as DiveLog;
          await this.saveLog(userId, log, true); // SQLite のみ保存
        }
        console.log(`Synced ${snapshot.size} logs from Firestore to my_logs.`);
      }

      // 2. 自分のレビューの取得
      // TODO: Firestore の reviews コレクションから userId == userId のものを取得して my_reviews に保存

      // 3. お気に入り、ブックマーク、プロフィールの同期
      // TODO: 同様に実装

    } catch (error) {
      console.error('Initial sync failed:', error);
    }
  }

  /**
   * 汎用設定（プロフィールなど）の保存
   */
  async saveSetting(key: string, value: any): Promise<void> {
    const isAvailable = await this.initialize();
    if (isAvailable && this.sqliteDb) {
      await this.sqliteDb.runAsync(
        'INSERT OR REPLACE INTO my_settings (key, value) VALUES (?, ?)',
        [key, JSON.stringify(value)]
      );
    }
  }

  /**
   * 汎用設定の取得
   */
  async getSetting<T>(key: string): Promise<T | null> {
    const isAvailable = await this.initialize();
    if (isAvailable && this.sqliteDb) {
      const row: any = await this.sqliteDb.getFirstAsync(
        'SELECT value FROM my_settings WHERE key = ?',
        [key]
      );
      if (row) return JSON.parse(row.value);
    }
    return null;
  }
}

export const userDataService = new UserDataService();
