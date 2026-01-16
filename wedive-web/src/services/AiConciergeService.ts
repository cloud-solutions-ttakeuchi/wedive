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
import { userDataService } from './UserDataService';

class AiConciergeServiceImpl extends BaseAiConciergeService {
  /**
   * 1日1回のログインボーナスチケット付与
   */
  grantDailyTicket = async (userId: string): Promise<boolean> => {
    // JST (Asia/Tokyo) ベースで今日の日付を取得 (YYYY-MM-DD)
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
          count: 5,
          reason: 'ログインボーナス',
          expirationDays: CONCIERGE_CAMPAIGN.DAILY_EXPIRATION_DAYS,
        });

        transaction.set(ticketRef, newTicket);
        transaction.set(userRef, {
          aiConciergeTickets: {
            lastDailyGrant: today,
            totalAvailable: increment(5)
          }
        }, { merge: true });

        // Update local SQLite cache
        const localProfile = await userDataService.getSetting<User>('profile');
        if (localProfile) {
          const tickets = localProfile.aiConciergeTickets || { totalAvailable: 0 };
          tickets.lastDailyGrant = today;
          tickets.totalAvailable = (tickets.totalAvailable || 0) + 1;
          localProfile.aiConciergeTickets = tickets;
          await userDataService.saveSetting('profile', localProfile);
        }

        console.log(`[AiConciergeService] Daily ticket granted for Web: ${ticketId}`);
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
  grantTestTicket = async (userId: string): Promise<void> => {
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

        // Update local SQLite cache
        const localProfile = await userDataService.getSetting<User>('profile');
        if (localProfile) {
          const tickets = localProfile.aiConciergeTickets || { totalAvailable: 0 };
          tickets.totalAvailable = (tickets.totalAvailable || 0) + 1;
          localProfile.aiConciergeTickets = tickets;
          await userDataService.saveSetting('profile', localProfile);
        }
      });
    } catch (error) {
      console.error('[AiConciergeService] Test grant failed:', error);
    }
  }

  /**
   * チケットを1枚消費する
   */
  consumeTicket = async (userId: string): Promise<boolean> => {
    try {
      // 1. 最新のチケット候補を取得（この時点ではロックなし）
      const ticketsRef = collection(firestoreDb, 'users', userId, 'aiConciergeTickets');
      const q = query(
        ticketsRef,
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);

      // 2. 自己修復ロジック: チケットがないのにサマリーが残っている場合
      if (snapshot.empty) {
        let shouldAutoCorrect = false;
        try {
          const localProfile = await userDataService.getSetting<User>('profile');
          if ((localProfile?.aiConciergeTickets?.totalAvailable || 0) > 0) {
            shouldAutoCorrect = true;
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
          // ローカルも補正
          try {
            const localProfile = await userDataService.getSetting<User>('profile');
            if (localProfile && localProfile.aiConciergeTickets) {
              localProfile.aiConciergeTickets.totalAvailable = 0;
              await userDataService.saveSetting('profile', localProfile);
            }
          } catch (e) { /* ignore */ }
        }
        return false;
      }

      // 3. メモリ上で期限順にソート（Firestore index節約のためクライアント側で実施）
      const sortedDocs = snapshot.docs.sort((a, b) => {
        const valA = (a.data() as ConciergeTicket).expiresAt || '9999-12-31';
        const valB = (b.data() as ConciergeTicket).expiresAt || '9999-12-31';
        return valA.localeCompare(valB);
      });
      const ticketCandidates = sortedDocs[0]; // 最も期限が近いチケット

      // 変数を外出ししてトランザクション後に参照可能にする
      let currentData: ConciergeTicket | null = null;
      let newCount = 0;

      // 4. トランザクション実行 (消費 + サマリー更新)
      await runTransaction(firestoreDb, async (transaction) => {
        const tRef = ticketCandidates.ref;
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

        // サマリー更新
        const userRef = doc(firestoreDb, 'users', userId);
        transaction.update(userRef, {
          'aiConciergeTickets.totalAvailable': increment(-1)
        });
      });

      if (!currentData) {
        throw new Error('Transaction succeeded but data missing');
      }

      // 5. ローカルキャッシュの同期 (Dual-Write Consistency)
      // リトライロジック (Max 3 times)
      let syncSuccess = false;
      for (let i = 0; i < 3; i++) {
        try {
          const localProfile = await userDataService.getSetting<User>('profile');
          if (localProfile) {
            const tickets = localProfile.aiConciergeTickets || { totalAvailable: 0 };
            tickets.totalAvailable = Math.max(0, (tickets.totalAvailable || 0) - 1);
            localProfile.aiConciergeTickets = tickets;
            await userDataService.saveSetting('profile', localProfile);
          }

          // チケット実体の状態もローカルへ反映 (Step 3で確定した値を使用)
          await userDataService.saveTicket(ticketCandidates.id, {
            ...(currentData as ConciergeTicket), // 元データ
            status: newCount <= 0 ? 'used' : 'active', // 新ステータス
            remainingCount: newCount // 新残数
          });

          syncSuccess = true;
          break; // Success
        } catch (localError) {
          console.warn(`[AiConcierge] Local sync attempt ${i + 1} failed:`, localError);
          // Wait a bit before retry? (Optional, but immediate retry is specified)
        }
      }

      if (!syncSuccess) {
        console.error('[AiConcierge] All local sync attempts failed. Triggering Self-Healing...');
        // 最終手段: 全同期による修復
        try {
          await userDataService.syncTickets(userId);
          console.log('[AiConcierge] Self-Healing (syncTickets) completed.');
        } catch (healingError) {
          console.error('[AiConcierge] Self-Healing failed. Local data might be inconsistent until next reload.', healingError);
        }
      }

      return true;

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

        // Update local SQLite cache
        const localProfile = await userDataService.getSetting<User>('profile');
        if (localProfile) {
          const tickets = localProfile.aiConciergeTickets || { totalAvailable: 0 };

          tickets.totalAvailable = (tickets.totalAvailable || 0) + 1;

          if (this.isCampaignPeriod()) {
            const contrib = tickets.periodContribution || { points: 0, creatures: 0, reviews: 0 };
            contrib[category] = (contrib[category] || 0) + 1;
            tickets.periodContribution = contrib;
          }
          localProfile.aiConciergeTickets = tickets;
          await userDataService.saveSetting('profile', localProfile);
        }

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
