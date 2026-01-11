import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc, orderBy, where, getDoc } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import { db as firestoreDb } from '../firebase';
import { DiveLog, User } from '../types';

const { documentDirectory } = FileSystem;

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
  private currentUserId: string | null = null;

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * SQLite接続とテーブルの初期化
   * @param userId ログイン中のユーザーID（物理隔離用）
   */
  async initialize(userId?: string): Promise<boolean> {
    const targetUserId = userId || this.currentUserId;
    if (!targetUserId) {
      console.warn('[UserDataService] No userId provided for initialization.');
      return false;
    }

    const dbName = `user_${targetUserId}.db`;

    // 既に同じユーザーのDBが開いている場合は何もしない
    // FIX: テーブル追加等があるため、接続済みでも初期化SQL（CREATE IF NOT EXISTS）を通すようにする
    // if (this.sqliteDb && this.currentUserId === targetUserId) {
    //   return true;
    // }

    if (this.isInitializing) return false;
    if (!SQLite || !SQLite.openDatabaseAsync) {
      return false;
    }

    this.isInitializing = true;
    try {
      // 別のユーザーのDBが開いている場合は一度閉じる
      if (this.sqliteDb) {
        // 接続をクリア
        this.sqliteDb = null;
      }

      console.log(`[UserDataService] Opening database: ${dbName}`);
      this.sqliteDb = await SQLite.openDatabaseAsync(dbName);
      this.currentUserId = targetUserId;

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
        CREATE TABLE IF NOT EXISTS my_ai_concierge_tickets (
          id TEXT PRIMARY KEY,
          type TEXT,
          remaining_count INTEGER,
          granted_at TEXT,
          expires_at TEXT,
          status TEXT,
          reason TEXT,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      return true;
    } catch (error) {
      console.error('UserData SQLite initialization failed:', error);
      this.sqliteDb = null;
      this.currentUserId = null;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 他のユーザーの古いDBファイルを削除（案1: 通用済み）
   */
  async cleanupOtherUsersData(currentUserId: string): Promise<void> {
    try {
      const sqliteDir = `${documentDirectory || ''}SQLite/`;
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) return;

      const files = await FileSystem.readDirectoryAsync(sqliteDir);
      const currentUserDb = `user_${currentUserId}.db`;

      for (const file of files) {
        // user_*.db で、現在のユーザーのものでないファイルを削除
        // user.db (旧形式) も念のため削除対象に含む
        if ((file.startsWith('user_') && file !== currentUserDb) || file === 'user.db') {
          console.log(`[UserDataService] Deleting old user data: ${file}`);
          await FileSystem.deleteAsync(sqliteDir + file, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('[UserDataService] Cleanup failed:', error);
    }
  }

  /**
   * 現在のユーザーのデータをすべて削除（退会時など）
   */
  async clearUserData(): Promise<void> {
    const isAvailable = await this.initialize();
    if (isAvailable && this.sqliteDb && this.currentUserId) {
      console.log(`[UserDataService] Clearing data for user: ${this.currentUserId}`);
      try {
        await this.sqliteDb.execAsync(`
          DELETE FROM my_logs;
          DELETE FROM my_reviews;
          DELETE FROM my_proposals;
          DELETE FROM my_bookmarks;
          DELETE FROM my_favorites;
          DELETE FROM my_settings;
          DELETE FROM my_mastery;
        `);
      } catch (error) {
        console.error('Failed to clear user data from SQLite:', error);
      }
    }
  }

  /**
   * ログアウト処理
   */
  async logout(): Promise<void> {
    this.sqliteDb = null;
    this.currentUserId = null;
  }

  /**
   * 個人のログを取得
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
    const isAvailable = await this.initialize(userId);
    const now = new Date().toISOString();

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
            JSON.stringify(log.profile || {}),
            JSON.stringify(log),
            searchText,
            now
          ]
        );
      } catch (error) {
        console.error('Failed to save log to SQLite:', error);
      }
    }

    if (skipFirestore) return;

    const logRef = doc(firestoreDb, 'users', userId, 'logs', log.id);
    setDoc(logRef, { ...log, updatedAt: now }).catch(err => {
      console.error('Failed to sync log to Firestore:', err);
    });
  }

  /**
   * ログを削除
   */
  async deleteLog(userId: string, logId: string): Promise<void> {
    const isAvailable = await this.initialize(userId);

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
    const isAvailable = await this.initialize(userId);
    if (!isAvailable) return;

    try {
      // プロフィールの有無で初期同期済みか判断
      const localProfile = await this.getSetting<User>('profile');
      if (localProfile) {
        console.log('[Sync] Local data exists for this user. Skipping initial sync.');
        return;
      }

      console.log('Starting initial sync from Firestore for user:', userId);

      // 1. ログの取得
      const snapshot = await getDocs(query(
        collection(firestoreDb, 'users', userId, 'logs'),
        orderBy('date', 'desc')
      ));

      if (!snapshot.empty) {
        for (const doc of snapshot.docs) {
          const log = { id: doc.id, ...doc.data() } as DiveLog;
          await this.saveLog(userId, log, true);
        }
      }

      // 2. 自分のレビューの取得
      const reviewSnapshot = await getDocs(query(
        collection(firestoreDb, 'reviews'),
        where('userId', '==', userId)
      ));
      for (const doc of reviewSnapshot.docs) {
        const data = doc.data();
        await this.sqliteDb.runAsync(
          `INSERT OR REPLACE INTO my_reviews (id, point_id, rating, comment, images_json, condition_json, metrics_json, radar_json, tags_json, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [doc.id, data.pointId, data.rating, data.comment, JSON.stringify(data.images || []), JSON.stringify(data.condition || {}), JSON.stringify(data.metrics || {}), JSON.stringify(data.radar || {}), JSON.stringify(data.tags || []), data.status, data.createdAt]
        );
      }

      // 3 & 4. ブックマークとお気に入り
      const [bmSnap, favSnap] = await Promise.all([
        getDocs(collection(firestoreDb, 'users', userId, 'bookmarks')),
        getDocs(collection(firestoreDb, 'users', userId, 'favorites'))
      ]);
      for (const doc of bmSnap.docs) await this.sqliteDb.runAsync('INSERT OR REPLACE INTO my_bookmarks (point_id) VALUES (?)', [doc.id]);
      for (const doc of favSnap.docs) await this.sqliteDb.runAsync('INSERT OR REPLACE INTO my_favorites (creature_id) VALUES (?)', [doc.id]);

      // 5. プロフィールの取得
      const userDocRef = doc(firestoreDb, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        await this.saveSetting('profile', userDocSnap.data());
      }

      console.log('Initial sync completed successfully.');

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
