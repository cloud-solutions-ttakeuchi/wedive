import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc, orderBy, where } from 'firebase/firestore';
import { db as firestoreDb } from '../lib/firebase';
import type { Log, User, Review, PointCreatureProposal } from '../types';
import { userDbEngine } from './WebSQLiteEngine';

export class UserDataService {
  private currentUserId: string | null = null;

  /**
   * SQLite接続とテーブルの初期化
   */
  async initialize(userId: string): Promise<boolean> {
    if (this.currentUserId === userId) return true;

    try {
      await userDbEngine.initialize();
      this.currentUserId = userId;

      // テーブル作成
      await userDbEngine.runAsync(`
        CREATE TABLE IF NOT EXISTS my_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          date TEXT,
          dive_number INTEGER,
          data_json TEXT,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS my_reviews (
          id TEXT PRIMARY KEY,
          point_id TEXT,
          data_json TEXT,
          status TEXT,
          created_at TEXT,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS my_settings (
          key TEXT PRIMARY KEY,
          value TEXT
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
      console.error('[UserDataService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * ログアウト処理
   */
  async logout(): Promise<void> {
    await userDbEngine.close();
    this.currentUserId = null;
  }

  /**
   * 個人のログを取得
   */
  async getLogs(): Promise<Log[]> {
    try {
      const results = await userDbEngine.getAllAsync<{ data_json: string }>(
        'SELECT data_json FROM my_logs ORDER BY date DESC, dive_number DESC'
      );
      return results.map(row => JSON.parse(row.data_json));
    } catch (error) {
      console.error('[UserDataService] Failed to get logs:', error);
      return [];
    }
  }

  /**
   * 個人のレビューを取得
   */
  async getReviews(): Promise<Review[]> {
    try {
      const results = await userDbEngine.getAllAsync<{ data_json: string }>(
        'SELECT data_json FROM my_reviews ORDER BY created_at DESC'
      );
      return results.map(row => JSON.parse(row.data_json));
    } catch (error) {
      console.error('[UserDataService] Failed to get reviews:', error);
      return [];
    }
  }

  /**
   * ログを保存
   */
  async saveLog(userId: string, log: Log, skipFirestore = false): Promise<void> {
    const now = new Date().toISOString();
    try {
      await userDbEngine.runAsync(
        'INSERT OR REPLACE INTO my_logs (id, user_id, date, dive_number, data_json, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
        [log.id, userId, log.date, log.diveNumber || 0, JSON.stringify(log), now]
      );

      if (!skipFirestore) {
        const logRef = doc(firestoreDb, 'users', userId, 'logs', log.id);
        await setDoc(logRef, { ...log, updatedAt: now });
      }
    } catch (error) {
      console.error('[UserDataService] Failed to save log:', error);
    }
  }

  /**
   * ログを削除
   */
  async deleteLog(userId: string, logId: string): Promise<void> {
    try {
      await userDbEngine.runAsync('DELETE FROM my_logs WHERE id = ?', [logId]);
      const logRef = doc(firestoreDb, 'users', userId, 'logs', logId);
      await deleteDoc(logRef);
    } catch (error) {
      console.error('[UserDataService] Failed to delete log:', error);
    }
  }

  /**
   * 初回同期
   */
  async syncInitialData(userId: string): Promise<void> {
    const isAvailable = await this.initialize(userId);
    if (!isAvailable) return;

    try {
      const localProfile = await this.getSetting<User>('profile');
      if (localProfile) {
        console.log('[Sync] Local data exists. Skipping initial sync.');
        return;
      }

      console.log('[Sync] Starting initial sync for web user:', userId);

      // 1. ログの取得
      const snapshot = await getDocs(query(
        collection(firestoreDb, 'users', userId, 'logs'),
        orderBy('date', 'desc')
      ));
      for (const doc of snapshot.docs) {
        await this.saveLog(userId, { id: doc.id, ...doc.data() } as Log, true);
      }

      // 2. プロフィールの取得
      const userSnap = await getDocs(query(collection(firestoreDb, 'users'), where('id', '==', userId)));
      if (!userSnap.empty) {
        await this.saveSetting('profile', { ...userSnap.docs[0].data(), id: userId });
      }

      console.log('[Sync] Initial sync completed.');
    } catch (error) {
      console.error('[Sync] Initial sync failed:', error);
    }
  }

  /**
   * 汎用設定保存
   */
  async saveSetting(key: string, value: any): Promise<void> {
    try {
      await userDbEngine.runAsync(
        'INSERT OR REPLACE INTO my_settings (key, value) VALUES (?, ?)',
        [key, JSON.stringify(value)]
      );
    } catch (error) {
      console.error('[UserDataService] Failed to save setting:', error);
    }
  }

  /**
   * 汎用設定取得
   */
  async getSetting<T>(key: string): Promise<T | null> {
    try {
      const rows = await userDbEngine.getAllAsync<{ value: string }>(
        'SELECT value FROM my_settings WHERE key = ?',
        [key]
      );
      if (rows.length > 0) return JSON.parse(rows[0].value);
    } catch (error) {
      console.error('[UserDataService] Failed to get setting:', error);
    }
    return null;
  }
}

export const userDataService = new UserDataService();
