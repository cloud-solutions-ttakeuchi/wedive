import {
  collection,
  query,
  getDocs,
  doc,
  increment,
  orderBy,
  where,
  runTransaction,
  limit
} from 'firebase/firestore';
import { db as firestoreDb } from '../lib/firebase';
import { auth } from '../lib/firebase';
import type { ConciergeTicket, User } from '../types';
import { BaseAiConciergeService, CONCIERGE_CAMPAIGN } from '../types';

class AiConciergeServiceImpl extends BaseAiConciergeService {
  /**
   * 1日1回のログインボーナスチケット付与
   */
  grantDailyTicket = async (userId: string): Promise<boolean> => {
    const today = new Date().toISOString().split('T')[0];

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
          expirationDays: CONCIERGE_CAMPAIGN.DAILY_EXPIRATION_DAYS,
        });

        transaction.set(ticketRef, newTicket);
        transaction.set(userRef, {
          aiConciergeTickets: {
            lastDailyGrant: today,
            totalAvailable: increment(1)
          }
        }, { merge: true });

        console.log(`[AiConciergeService] Daily ticket granted for Web: ${ticketId}`);
        return true;
      });
    } catch (error) {
      console.error('[AiConciergeService] Failed to grant daily ticket:', error);
      return false;
    }
  }

  /**
   * チケットを1枚消費する
   */
  consumeTicket = async (userId: string): Promise<boolean> => {
    try {
      return await runTransaction(firestoreDb, async (transaction) => {
        const ticketsRef = collection(firestoreDb, 'users', userId, 'aiConciergeTickets');
        const q = query(
          ticketsRef,
          where('status', '==', 'active')
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return false;

        // メモリ上で有効期限順にソートして最古の1件を選択
        const sortedDocs = snapshot.docs.sort((a, b) => {
          const valA = (a.data() as ConciergeTicket).expiresAt || '9999-12-31';
          const valB = (b.data() as ConciergeTicket).expiresAt || '9999-12-31';
          return valA.localeCompare(valB);
        });

        const ticketDoc = sortedDocs[0];
        const ticketData = ticketDoc.data() as ConciergeTicket;

        const newCount = ticketData.remainingCount - 1;
        const newStatus = newCount <= 0 ? 'used' : 'active';

        const userRef = doc(firestoreDb, 'users', userId);

        transaction.update(ticketDoc.ref, {
          remainingCount: newCount,
          status: newStatus
        });
        transaction.update(userRef, {
          'aiConciergeTickets.totalAvailable': increment(-1)
        });

        return true;
      });
    } catch (error) {
      console.error('[AiConciergeService] Failed to consume ticket:', error);
      return false;
    }
  }

  /**
   * 貢献に対する報酬チケット付与
   */
  grantContributionTicket = async (userId: string, reason: string, category: 'points' | 'creatures' | 'reviews'): Promise<void> => {
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

        // キャンペーン期間中（2026/01 - 04）であれば貢献数をカウント
        const contributionData: any = {
          totalAvailable: increment(1)
        };

        if (this.isCampaignPeriod()) {
          contributionData.periodContribution = {
            [category]: increment(1)
          };
        }

        transaction.set(userRef, {
          aiConciergeTickets: contributionData
        }, { merge: true });

        console.log(`[AiConciergeService] Contribution ticket granted: ${category} for user ${userId}`);
      });
    } catch (error) {
      console.error('[AiConciergeService] Failed to grant contribution ticket:', error);
    }
  }

  /**
   * コンシェルジュに質問する（チケット消費を含む）
   */
  askConcierge = async (userId: string, query: string, sessionId: string | null = null): Promise<any> => {
    const hasTicket = await this.consumeTicket(userId);
    if (!hasTicket) {
      throw new Error('tickets_exhausted');
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Unauthenticated');

    const response = await fetch('/api/concierge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        data: {
          query,
          sessionId
        }
      })
    });

    if (!response.ok) throw new Error('API Error');
    const json = await response.json();
    return json.result; // httpsCallable format wrapper
  }
}

export const AiConciergeService = new AiConciergeServiceImpl();
