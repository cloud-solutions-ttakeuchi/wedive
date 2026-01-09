import { collection, query, getDocs, doc, increment, orderBy, where, runTransaction } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { ConciergeTicket, User, BaseAiConciergeService, CONCIERGE_CAMPAIGN } from '../types';
import { aiService } from '../api/aiService';

let SQLite: any = null;
try {
  SQLite = require('expo-sqlite');
} catch (e) {
  console.warn('ExpoSQLite module not found in AiConciergeService.');
}

export class AiConciergeService extends BaseAiConciergeService {
  /**
   * チケットの同期：Firestoreから最新のチケットを取得してSQLiteに反映
   */
  async syncTickets(userId: string): Promise<void> {
    if (!SQLite) return;
    const dbName = `user_${userId}.db`;
    const db = await SQLite.openDatabaseAsync(dbName);

    try {
      const ticketsRef = collection(firestoreDb, 'users', userId, 'aiConciergeTickets');
      const q = query(ticketsRef, where('status', '==', 'active'));
      const snapshot = await getDocs(q);

      const sortedDocs = snapshot.docs.sort((a, b) => {
        const valA = (a.data() as ConciergeTicket).expiresAt || '9999-12-31';
        const valB = (b.data() as ConciergeTicket).expiresAt || '9999-12-31';
        return valA.localeCompare(valB);
      });

      await db.runAsync('DELETE FROM my_ai_concierge_tickets WHERE status = "active"');

      for (const ticketDoc of sortedDocs) {
        const data = ticketDoc.data() as ConciergeTicket;
        await db.runAsync(
          `INSERT OR REPLACE INTO my_ai_concierge_tickets (id, type, remaining_count, granted_at, expires_at, status, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ticketDoc.id, data.type, data.remainingCount, data.grantedAt, data.expiresAt || null, data.status, data.reason || '']
        );
      }
      console.log(`[AiConciergeService] Synced ${snapshot.size} tickets for user ${userId}`);
    } catch (error) {
      console.error('[AiConciergeService] Sync failed:', error);
    }
  }

  /**
   * 1日1回のログインボーナスチケット付与
   */
  async grantDailyTicket(userId: string): Promise<boolean> {
    const today = new Date().toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replaceAll('/', '-');

    try {
      return await runTransaction(firestoreDb, async (transaction) => {
        const userRef = doc(firestoreDb, 'users', userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) return false;
        const userData = userDoc.data() as User;

        if (userData.aiConciergeTickets?.lastDailyGrant === today) {
          return false;
        }

        const ticketId = `daily_${today}_${userId}`;
        const ticketRef = doc(firestoreDb, 'users', userId, 'aiConciergeTickets', ticketId);

        const newTicket = this.createTicketBase({
          id: ticketId,
          type: 'daily',
          count: 1,
          reason: 'ログインボーナス',
          expirationDays: CONCIERGE_CAMPAIGN.DAILY_EXPIRATION_DAYS
        });

        transaction.set(ticketRef, newTicket);
        transaction.set(userRef, {
          aiConciergeTickets: {
            lastDailyGrant: today,
            totalAvailable: increment(1)
          }
        }, { merge: true });

        return true;
      });
    } catch (error) {
      console.error('[AiConciergeService] Failed to grant daily ticket:', error);
      return false;
    }
  }

  /**
   * テスト用：無制限に1枚付与
   */
  async grantTestTicket(userId: string): Promise<void> {
    try {
      await runTransaction(firestoreDb, async (transaction) => {
        const userRef = doc(firestoreDb, 'users', userId);
        const ticketId = `test_${Date.now()}_${userId}`;
        const ticketRef = doc(firestoreDb, 'users', userId, 'aiConciergeTickets', ticketId);

        const newTicket = this.createTicketBase({
          id: ticketId,
          type: 'daily',
          count: 1,
          reason: 'テスト付与',
          expirationDays: 30
        });

        transaction.set(ticketRef, newTicket);
        transaction.set(userRef, {
          aiConciergeTickets: {
            totalAvailable: increment(1)
          }
        }, { merge: true });
      });
    } catch (error) {
      console.error('[AiConciergeService] Test grant failed:', error);
    }
  }

  async getRemainingCount(userId: string): Promise<number> {
    if (!SQLite) return 0;
    const dbName = `user_${userId}.db`;
    const db = await SQLite.openDatabaseAsync(dbName);

    const row: any = await db.getFirstAsync(
      'SELECT SUM(remaining_count) as total FROM my_ai_concierge_tickets WHERE status = "active" AND (expires_at IS NULL OR expires_at > ?)',
      [new Date().toISOString()]
    );
    return row?.total || 0;
  }

  async consumeTicket(userId: string): Promise<boolean> {
    if (!SQLite) return false;
    const dbName = `user_${userId}.db`;
    const db = await SQLite.openDatabaseAsync(dbName);

    const oldestTicket: any = await db.getFirstAsync(
      'SELECT id, remaining_count FROM my_ai_concierge_tickets WHERE status = "active" AND (expires_at IS NULL OR expires_at > ?) ORDER BY expires_at ASC LIMIT 1',
      [new Date().toISOString()]
    );

    if (!oldestTicket) return false;

    const newCount = oldestTicket.remaining_count - 1;
    const newStatus = newCount <= 0 ? 'used' : 'active';

    try {
      const ticketRef = doc(firestoreDb, 'users', userId, 'aiConciergeTickets', oldestTicket.id);
      const userRef = doc(firestoreDb, 'users', userId);

      await runTransaction(firestoreDb, async (transaction) => {
        transaction.update(ticketRef, {
          remainingCount: newCount,
          status: newStatus
        });
        transaction.update(userRef, {
          'aiConciergeTickets.totalAvailable': increment(-1)
        });
      });

      await db.runAsync(
        'UPDATE my_ai_concierge_tickets SET remaining_count = ?, status = ? WHERE id = ?',
        [newCount, newStatus, oldestTicket.id]
      );

      return true;
    } catch (error) {
      console.error('[AiConciergeService] Failed to consume ticket:', error);
      return false;
    }
  }

  async askConcierge(userId: string, query: string, history: any[] = []): Promise<{ content: string, error?: string }> {
    const hasTicket = await this.consumeTicket(userId);
    if (!hasTicket) {
      return { content: '', error: 'tickets_exhausted' };
    }

    try {
      const response = await aiService.sendMessage(query, history);
      return { content: response.content };
    } catch (error) {
      console.error('[AiConciergeService] AI Error:', error);
      return { content: '', error: 'ai_failed' };
    }
  }

  /**
   * 貢献に対するチケット付与
   */
  async grantContributionTicket(userId: string, reason: string, category: 'points' | 'creatures' | 'reviews'): Promise<void> {
    try {
      await runTransaction(firestoreDb, async (transaction) => {
        const userRef = doc(firestoreDb, 'users', userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) return;

        const ticketId = `contrib_${Date.now()}_${userId}`;
        const ticketRef = doc(firestoreDb, 'users', userId, 'aiConciergeTickets', ticketId);

        const newTicket = this.createTicketBase({
          id: ticketId,
          type: 'contribution',
          count: 1,
          reason,
          expirationDays: CONCIERGE_CAMPAIGN.CONTRIBUTION_EXPIRATION_DAYS,
        });

        transaction.set(ticketRef, newTicket);

        // 階層を壊さないよう、incrementデータを作成
        transaction.set(userRef, {
          aiConciergeTickets: {
            totalAvailable: increment(1)
          }
        }, { merge: true });

        // キャンペーン期間中の貢献度
        if (this.isCampaignPeriod()) {
          const updateData: any = {};
          updateData[`aiConciergeTickets.periodContribution.${category}`] = increment(1);
          transaction.update(userRef, updateData);
        }
      });
    } catch (error) {
      console.error('[AiConciergeService] Failed to grant contribution ticket:', error);
    }
  }
}

export const aiConciergeService = new AiConciergeService();
