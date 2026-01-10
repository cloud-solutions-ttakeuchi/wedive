import { collection, query, getDocs, doc, increment, orderBy, where, runTransaction, limit } from 'firebase/firestore';
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

      let totalAvailable = 0;
      for (const ticketDoc of sortedDocs) {
        const data = ticketDoc.data() as ConciergeTicket;
        totalAvailable += data.remainingCount;
        await db.runAsync(
          `INSERT OR REPLACE INTO my_ai_concierge_tickets (id, type, remaining_count, granted_at, expires_at, status, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ticketDoc.id, data.type, data.remainingCount, data.grantedAt, data.expiresAt || null, data.status, data.reason || '']
        );
      }

      // SQLiteのプロフィール（my_settings）に枚数をキャッシュ（マイページ表示用）
      const profileRow: any = await db.getFirstAsync('SELECT value FROM my_settings WHERE key = "profile"');
      if (profileRow) {
        const profile = JSON.parse(profileRow.value);
        if (!profile.aiConciergeTickets) profile.aiConciergeTickets = {};
        profile.aiConciergeTickets.totalAvailable = totalAvailable;

        // キャンペーン貢献度もあわせて同期（Firestoreの最新を反映）
        const userSnap = await getDocs(query(collection(firestoreDb, 'users'), where('id', '==', userId)));
        if (!userSnap.empty) {
          const remoteUser = userSnap.docs[0].data() as User;
          if (remoteUser.aiConciergeTickets?.periodContribution) {
            profile.aiConciergeTickets.periodContribution = remoteUser.aiConciergeTickets.periodContribution;
          }
        }

        await db.runAsync('INSERT OR REPLACE INTO my_settings (key, value) VALUES (?, ?)', ['profile', JSON.stringify(profile)]);
      }

      console.log(`[AiConciergeService] Synced ${snapshot.size} tickets and updated profile totalAvailable to ${totalAvailable} for user ${userId}`);
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

    try {
      // 1. 最新のチケット候補をFirestoreから取得（この時点ではロックなし）
      const ticketsRef = collection(firestoreDb, 'users', userId, 'aiConciergeTickets');
      const q = query(
        ticketsRef,
        where('status', '==', 'active'),
        orderBy('expiresAt', 'asc'), // 古い順
        limit(1)
      );
      const snapshot = await getDocs(q);

      // 2. 自己修復ロジック: チケットがないのにサマリーが残っている場合
      if (snapshot.empty) {
        let shouldAutoCorrect = false;
        try {
          // SQLiteのサマリーを確認
          const profileRow: any = await db.getFirstAsync('SELECT value FROM my_settings WHERE key = "profile"');
          if (profileRow) {
            const p = JSON.parse(profileRow.value);
            if ((p.aiConciergeTickets?.totalAvailable || 0) > 0) shouldAutoCorrect = true;
          }
        } catch (e) { /* ignore */ }

        if (shouldAutoCorrect) {
          console.warn('[AiConcierge] Inconsistency detected: No active tickets but totalAvailable > 0. Correcting...');
          await runTransaction(firestoreDb, async (transaction) => {
            const userRef = doc(firestoreDb, 'users', userId);
            const d = await transaction.get(userRef);
            if (d.exists() && (d.data().aiConciergeTickets?.totalAvailable || 0) > 0) {
              transaction.update(userRef, { 'aiConciergeTickets.totalAvailable': 0 });
            }
          });
          // ローカルも補正 (syncTicketsを呼ぶのが確実)
          await this.syncTickets(userId);
        }
        return false;
      }

      const ticketCandidate = snapshot.docs[0];

      // 変数を外出し
      let currentData: ConciergeTicket | null = null;
      let newCount = 0;

      // 3. トランザクション実行 (消費 + サマリー更新)
      await runTransaction(firestoreDb, async (transaction) => {
        const tRef = ticketCandidate.ref;
        // 楽観的ロック: トランザクション内で最新状態を再確認
        const latestTicket = await transaction.get(tRef);
        if (!latestTicket.exists() || latestTicket.data().status !== 'active') {
          throw new Error('Ticket state changed concurrenty');
        }

        currentData = latestTicket.data() as ConciergeTicket;
        newCount = (currentData.remainingCount || 1) - 1;

        // チケット更新
        transaction.update(tRef, {
          remainingCount: newCount,
          status: newCount <= 0 ? 'used' : 'active',
          usedAt: new Date().toISOString()
        });

        transaction.update(doc(firestoreDb, 'users', userId), {
          'aiConciergeTickets.totalAvailable': increment(-1)
        });
      });

      if (!currentData) throw new Error('Transaction succeeded but data missing');

      // 4. ローカルキャッシュの同期 (Dual-Write Consistency)
      // リトライロジック (Max 3 times)
      let syncSuccess = false;
      for (let i = 0; i < 3; i++) {
        try {
          await db.runAsync(
            'UPDATE my_ai_concierge_tickets SET remaining_count = ?, status = ? WHERE id = ?',
            [newCount, newCount <= 0 ? 'used' : 'active', ticketCandidate.id]
          );

          // SQLiteのプロフィールも更新
          const profileRow: any = await db.getFirstAsync('SELECT value FROM my_settings WHERE key = "profile"');
          if (profileRow) {
            const profile = JSON.parse(profileRow.value);
            if (profile.aiConciergeTickets) {
              profile.aiConciergeTickets.totalAvailable = Math.max(0, (profile.aiConciergeTickets.totalAvailable || 1) - 1);
              await db.runAsync('UPDATE my_settings SET value = ? WHERE key = "profile"', [JSON.stringify(profile)]);
            }
          }

          syncSuccess = true;
          break;
        } catch (localError) {
          console.warn(`[AiConcierge] Local sync attempt ${i + 1} failed:`, localError);
        }
      }

      if (!syncSuccess) {
        console.error('[AiConcierge] All local sync attempts failed. Triggering Self-Healing...');
        try {
          await this.syncTickets(userId);
        } catch (e) { console.error('Healing failed', e); }
      }

      return true;
    } catch (error) {
      console.error('[AiConciergeService] Failed to consume ticket:', error);
      // 失敗時は念のため同期して整合性を回復させておく
      try { await this.syncTickets(userId); } catch (e) { }
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

        transaction.set(userRef, {
          aiConciergeTickets: {
            totalAvailable: increment(1)
          }
        }, { merge: true });

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
