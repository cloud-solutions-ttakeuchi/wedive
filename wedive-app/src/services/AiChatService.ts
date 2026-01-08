import { collection, query, getDocs, doc, setDoc, updateDoc, increment, orderBy, where, runTransaction, Timestamp } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { ChatTicket, User, BaseAiChatService, CHAT_CAMPAIGN } from '../types';
import { userDataService } from './UserDataService';
import { aiService } from '../api/aiService';

let SQLite: any = null;
try {
  SQLite = require('expo-sqlite');
} catch (e) {
  console.warn('ExpoSQLite module not found in AiChatService.');
}

export class AiChatService extends BaseAiChatService {
  private currentUserId: string | null = null;

  setUserId(userId: string | null) {
    this.currentUserId = userId;
  }

  /**
   * チケットの同期：Firestoreから最新のチケットを取得してSQLiteに反映
   */
  async syncTickets(userId: string): Promise<void> {
    if (!SQLite) return;
    const dbName = `user_${userId}.db`;
    const db = await SQLite.openDatabaseAsync(dbName);

    try {
      const ticketsRef = collection(firestoreDb, 'users', userId, 'aiChatTickets');
      const q = query(ticketsRef, where('status', '==', 'active'), orderBy('expiresAt', 'asc'));
      const snapshot = await getDocs(q);

      // ローカルのactiveチケットを一旦クリアして最新に
      await db.runAsync('DELETE FROM my_ai_chat_tickets WHERE status = "active"');

      for (const ticketDoc of snapshot.docs) {
        const data = ticketDoc.data() as ChatTicket;
        await db.runAsync(
          `INSERT OR REPLACE INTO my_ai_chat_tickets (id, type, remaining_count, granted_at, expires_at, status, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ticketDoc.id, data.type, data.remainingCount, data.grantedAt, data.expiresAt || null, data.status, data.reason || '']
        );
      }
      console.log(`[AiChatService] Synced ${snapshot.size} tickets for user ${userId}`);
    } catch (error) {
      console.error('[AiChatService] Sync failed:', error);
    }
  }

  /**
   * 1日1回のログインボーナスチケット付与
   */
  async grantDailyTicket(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      return await runTransaction(firestoreDb, async (transaction) => {
        const userRef = doc(firestoreDb, 'users', userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) return false;
        const userData = userDoc.data() as User;

        // 既に付与済みかチェック
        if (userData.aiChatTickets?.lastDailyGrant === today) {
          return false;
        }

        const ticketId = `daily_${today}_${userId}`;
        const ticketRef = doc(firestoreDb, 'users', userId, 'aiChatTickets', ticketId);

        const newTicket = this.createTicketBase({
          id: ticketId,
          type: 'daily',
          count: 1,
          reason: 'ログインボーナス',
          expirationDays: CHAT_CAMPAIGN.DAILY_EXPIRATION_DAYS
        });

        // トランザクション：ユーザープロファイルの更新とチケット作成を不可分に
        transaction.set(ticketRef, newTicket);
        transaction.update(userRef, {
          'aiChatTickets.lastDailyGrant': today,
          'aiChatTickets.totalAvailable': increment(1)
        });

        console.log(`[AiChatService] Daily ticket granted: ${ticketId}`);
        return true;
      });
    } catch (error) {
      console.error('[AiChatService] Failed to grant daily ticket:', error);
      return false;
    }
  }

  /**
   * 有効なチケット合計数を取得（SQLite）
   */
  async getRemainingCount(userId: string): Promise<number> {
    if (!SQLite) return 0;
    const dbName = `user_${userId}.db`;
    const db = await SQLite.openDatabaseAsync(dbName);

    const row: any = await db.getFirstAsync(
      'SELECT SUM(remaining_count) as total FROM my_ai_chat_tickets WHERE status = "active" AND (expires_at IS NULL OR expires_at > ?)',
      [new Date().toISOString()]
    );
    return row?.total || 0;
  }

  /**
   * チケットを1枚消費する
   */
  async consumeTicket(userId: string): Promise<boolean> {
    if (!SQLite) return false;
    const dbName = `user_${userId}.db`;
    const db = await SQLite.openDatabaseAsync(dbName);

    // 期限が近い有効なチケットを1つ取得
    const oldestTicket: any = await db.getFirstAsync(
      'SELECT id, remaining_count FROM my_ai_chat_tickets WHERE status = "active" AND (expires_at IS NULL OR expires_at > ?) ORDER BY expires_at ASC LIMIT 1',
      [new Date().toISOString()]
    );

    if (!oldestTicket) return false;

    const newCount = oldestTicket.remaining_count - 1;
    const newStatus = newCount <= 0 ? 'used' : 'active';

    try {
      // 1. Firestore更新
      const ticketRef = doc(firestoreDb, 'users', userId, 'aiChatTickets', oldestTicket.id);
      const userRef = doc(firestoreDb, 'users', userId);

      await runTransaction(firestoreDb, async (transaction) => {
        transaction.update(ticketRef, {
          remainingCount: newCount,
          status: newStatus
        });
        transaction.update(userRef, {
          'aiChatTickets.totalAvailable': increment(-1)
        });
      });

      // 2. Local SQLite更新
      await db.runAsync(
        'UPDATE my_ai_chat_tickets SET remaining_count = ?, status = ? WHERE id = ?',
        [newCount, newStatus, oldestTicket.id]
      );

      return true;
    } catch (error) {
      console.error('[AiChatService] Failed to consume ticket:', error);
      return false;
    }
  }

  /**
   * チケットを使用してAIチャット送信
   */
  async sendMessageWithTicket(userId: string, query: string, history: any[] = []): Promise<{ content: string, error?: string }> {
    const hasTicket = await this.consumeTicket(userId);
    if (!hasTicket) {
      return { content: '', error: 'tickets_exhausted' };
    }

    try {
      const response = await aiService.sendMessage(query, history);
      return { content: response.content };
    } catch (error) {
      console.error('[AiChatService] AI Error:', error);
      // 通信エラーなどの場合にチケットを戻す処理は、厳密には必要だが一旦は消費で進める
      return { content: '', error: 'ai_failed' };
    }
  }
}

export const aiChatService = new AiChatService();
