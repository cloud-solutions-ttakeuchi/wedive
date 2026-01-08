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
import type { ChatTicket, User } from '../types';
import { BaseAiChatService, CHAT_CAMPAIGN } from '../types';

class AiChatServiceImpl extends BaseAiChatService {
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
          expirationDays: CHAT_CAMPAIGN.DAILY_EXPIRATION_DAYS,
        });

        transaction.set(ticketRef, newTicket);
        transaction.update(userRef, {
          'aiChatTickets.lastDailyGrant': today,
          'aiChatTickets.totalAvailable': increment(1)
        });

        console.log(`[AiChatService] Daily ticket granted for Web: ${ticketId}`);
        return true;
      });
    } catch (error) {
      console.error('[AiChatService] Failed to grant daily ticket:', error);
      return false;
    }
  }

  /**
   * チケットを1枚消費する
   */
  consumeTicket = async (userId: string): Promise<boolean> => {
    try {
      return await runTransaction(firestoreDb, async (transaction) => {
        const ticketsRef = collection(firestoreDb, 'users', userId, 'aiChatTickets');
        const q = query(
          ticketsRef,
          where('status', '==', 'active'),
          orderBy('expiresAt', 'asc'),
          limit(1)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return false;

        const ticketDoc = snapshot.docs[0];
        const ticketData = ticketDoc.data() as ChatTicket;

        const newCount = ticketData.remainingCount - 1;
        const newStatus = newCount <= 0 ? 'used' : 'active';

        const userRef = doc(firestoreDb, 'users', userId);

        transaction.update(ticketDoc.ref, {
          remainingCount: newCount,
          status: newStatus
        });
        transaction.update(userRef, {
          'aiChatTickets.totalAvailable': increment(-1)
        });

        return true;
      });
    } catch (error) {
      console.error('[AiChatService] Failed to consume ticket:', error);
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
        const ticketRef = doc(firestoreDb, 'users', userId, 'aiChatTickets', ticketId);

        const newTicket = this.createTicketBase({
          id: ticketId,
          type: 'contribution',
          count: 1,
          reason,
          expirationDays: CHAT_CAMPAIGN.CONTRIBUTION_EXPIRATION_DAYS,
        });

        transaction.set(ticketRef, newTicket);

        // キャンペーン期間中（2026/01 - 04）であれば貢献数をカウント
        const updateData: any = {
          'aiChatTickets.totalAvailable': increment(1)
        };

        if (this.isCampaignPeriod()) {
          updateData[`aiChatTickets.periodContribution.${category}`] = increment(1);
        }

        transaction.update(userRef, updateData);
        console.log(`[AiChatService] Contribution ticket granted: ${category} for user ${userId}`);
      });
    } catch (error) {
      console.error('[AiChatService] Failed to grant contribution ticket:', error);
    }
  }
}

export const AiChatService = new AiChatServiceImpl();
