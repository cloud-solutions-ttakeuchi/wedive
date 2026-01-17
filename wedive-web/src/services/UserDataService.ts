import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc, orderBy, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db as firestoreDb } from '../lib/firebase';
import { masterDataService } from './MasterDataService';
import type { Log, User, Review, PointCreatureProposal } from '../types';
import { userDbEngine } from './WebSQLiteEngine';

export class UserDataService {
  private currentUserId: string | null = null;

  /**
   * SQLite接続とテーブルの初期化
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      await userDbEngine.initialize();
      this.currentUserId = userId;

      // テーブル作成 (IF NOT EXISTS なので毎回実行してスキーマを保証する)
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
        -- 管理用キャッシュテーブル (Admin/Moderator用)
        CREATE TABLE IF NOT EXISTS admin_proposals (
          id TEXT PRIMARY KEY,
          type TEXT, -- 'creature', 'point', 'point-creature', 'review'
          data_json TEXT,
          status TEXT,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        -- 自分の提案履歴 (Personal用)
        CREATE TABLE IF NOT EXISTS my_proposals (
          id TEXT PRIMARY KEY,
          type TEXT,
          target_id TEXT,
          data_json TEXT,
          status TEXT,
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
   * 管理用申請データを取得
   */
  async getAdminProposals(type: 'creature' | 'point' | 'point-creature' | 'review'): Promise<any[]> {
    try {
      const results = await userDbEngine.getAllAsync<{ data_json: string }>(
        'SELECT data_json FROM admin_proposals WHERE type = ?',
        [type]
      );
      return results.map(row => JSON.parse(row.data_json));
    } catch (error) {
      console.error(`[UserDataService] Failed to get admin proposals (${type}):`, error);
      return [];
    }
  }

  /**
   * 管理用申請データを削除
   */
  async deleteAdminProposal(id: string): Promise<void> {
    try {
      await userDbEngine.runAsync('DELETE FROM admin_proposals WHERE id = ?', [id]);
    } catch (error) {
      console.error('[UserDataService] Failed to delete admin proposal:', error);
    }
  }

  /**
   * 管理用申請データを保存 (Sync用)
   */
  private async saveAdminProposal(type: string, id: string, data: any): Promise<void> {
    try {
      await userDbEngine.runAsync(
        'INSERT OR REPLACE INTO admin_proposals (id, type, data_json, status) VALUES (?, ?, ?, ?)',
        [id, type, JSON.stringify(data), data.status || 'pending']
      );
    } catch (error) {
      console.error('[UserDataService] Failed to save admin proposal:', error);
    }
  }

  /**
   * ログを保存
   */
  async saveLog(userId: string, log: Log, skipFirestore = false): Promise<string> {
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
      return log.id;
    } catch (error) {
      console.error('[UserDataService] Failed to save log:', error);
      throw error;
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
      // パブリックログも削除 (もし存在すれば)
      const publicLogRef = doc(firestoreDb, 'public_logs', logId);
      await deleteDoc(publicLogRef).catch(() => { });
    } catch (error) {
      console.error('[UserDataService] Failed to delete log:', error);
    }
  }

  /**
   * ログのいいね
   */
  async toggleLikeLog(userId: string, logId: string): Promise<void> {
    try {
      const publicLogRef = doc(firestoreDb, 'public_logs', logId);
      // Note: 簡易実装。本来は自分自身の likes 配列を arrayUnion/arrayRemove する
      await updateDoc(publicLogRef, {
        likes: arrayUnion(userId) // TODO: Toggle logic (check if already liked)
      }).catch(() => { });
    } catch (error) {
      console.error('[UserDataService] Failed to toggle like:', error);
    }
  }

  /**
   * レビューを保存
   */
  async saveReview(userId: string, review: Review, skipFirestore = false): Promise<string> {
    const now = new Date().toISOString();
    const profile = await this.getSetting<any>('profile');
    const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator';
    const defaultStatus = isAdmin ? 'approved' : 'pending';
    const finalStatus = review.status || defaultStatus;
    const reviewData = { ...review, status: finalStatus };

    // Ensure ID exists
    if (!reviewData.id) reviewData.id = `rv${Date.now()}`;

    try {
      await userDbEngine.runAsync(
        'INSERT OR REPLACE INTO my_reviews (id, point_id, data_json, status, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
        [reviewData.id, reviewData.pointId, JSON.stringify(reviewData), finalStatus, reviewData.date || now, now]
      );

      if (!skipFirestore) {
        const reviewRef = doc(firestoreDb, 'reviews', reviewData.id);
        // Remove undefined fields
        const firestoreData = JSON.parse(JSON.stringify({ ...reviewData, userId, updatedAt: now }));
        await setDoc(reviewRef, firestoreData, { merge: true });
      }
      return reviewData.id;
    } catch (error) {
      console.error('[UserDataService] Failed to save review:', error);
      throw error;
    }
  }

  /**
   * レビューを削除
   */
  async deleteReview(reviewId: string): Promise<void> {
    try {
      await userDbEngine.runAsync('DELETE FROM my_reviews WHERE id = ?', [reviewId]);
      await deleteDoc(doc(firestoreDb, 'reviews', reviewId));
    } catch (error) {
      console.error('[UserDataService] Failed to delete review:', error);
    }
  }

  /**
   * 地点を保存
   */
  async savePoint(userId: string, point: any): Promise<void> {
    const pointRef = doc(firestoreDb, 'points', point.id || `p${Date.now()}`);
    await setDoc(pointRef, { ...point, updatedAt: new Date().toISOString() });
    await masterDataService.updatePointInCache({ ...point, id: pointRef.id });
  }

  /**
   * 生物申請を保存
   */
  async saveCreatureProposal(userId: string, proposal: any): Promise<void> {
    const propId = proposal.id || `propc${Date.now()}`;
    const propRef = doc(firestoreDb, 'creature_proposals', propId);
    const data = { ...proposal, id: propId, userId, status: 'pending', updatedAt: new Date().toISOString() };
    await setDoc(propRef, data);
    await this.saveMyProposal('creature', propId, data);
  }

  /**
   * 地点申請を保存
   */
  async savePointProposal(userId: string, proposal: any): Promise<void> {
    const propId = proposal.id || `propp${Date.now()}`;
    const propRef = doc(firestoreDb, 'point_proposals', propId);
    const data = { ...proposal, id: propId, userId, status: 'pending', updatedAt: new Date().toISOString() };
    await setDoc(propRef, data);
    await this.saveMyProposal('point', propId, data);
  }

  /**
   * 生物を保存
   */
  async saveCreature(userId: string, creature: any): Promise<void> {
    const creatureRef = doc(firestoreDb, 'creatures', creature.id || `c${Date.now()}`);
    await setDoc(creatureRef, { ...creature, updatedAt: new Date().toISOString() });
    await masterDataService.updateCreatureInCache({ ...creature, id: creatureRef.id });
  }

  /**
   * 地点生物関連を保存
   */
  async savePointCreature(rel: any): Promise<void> {
    // 設計仕様: [PointID]_[CreatureID] (例: p123_c456)
    // ルール: 区切り文字として アンダースコアを1つだけ 使用する。
    const id = rel.id || `${rel.pointId}_${rel.creatureId}`;
    const relRef = doc(firestoreDb, 'point_creatures', id);
    await setDoc(relRef, { ...rel, id, updatedAt: new Date().toISOString() });
    await masterDataService.updatePointCreatureInCache({ ...rel, id });
  }

  /**
   * 地点生物申請を保存
   */
  async savePointCreatureProposal(proposal: any): Promise<void> {
    const propId = proposal.id || `proppc${Date.now()}`;
    const propRef = doc(firestoreDb, 'point_creature_proposals', propId);
    const data = { ...proposal, id: propId, status: 'pending', updatedAt: new Date().toISOString() };
    await setDoc(propRef, data);
    await this.saveMyProposal('point-creature', propId, data);
  }

  /**
   * アカウント削除
   */
  async deleteAccount(userId: string): Promise<void> {
    // 実際の実装はより複雑ですが、ここでは削除フラグのみ
    await updateDoc(doc(firestoreDb, 'users', userId), { deleted: true });
  }

  /**
   * 全ユーザーリストを取得 (管理者用)
   */
  async getAllUsers(): Promise<any[]> {
    return await this.getSetting<any[]>('all_users_cache') || [];
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

      // 3. 自分のレビューの取得
      const reviewsSnap = await getDocs(query(collection(firestoreDb, 'reviews'), where('userId', '==', userId)));
      for (const doc of reviewsSnap.docs) {
        await this.saveReview(userId, { id: doc.id, ...doc.data() } as Review, true);
      }

      console.log('[Sync] Initial sync completed.');

      // 4. 管理者データの同期 (Role が admin/moderator の場合)
      const isAdmin = (localProfile as User | null)?.role === 'admin' || (localProfile as User | null)?.role === 'moderator';
      if (isAdmin) {
        console.log('[Sync] Starting admin data sync...');
        const collections = [
          { name: 'creature_proposals', type: 'creature', isReview: false },
          { name: 'point_proposals', type: 'point', isReview: false },
          { name: 'point_creature_proposals', type: 'point-creature', isReview: false },
          { name: 'reviews', type: 'review', isReview: true }
        ];

        for (const col of collections) {
          let snap;
          if (col.isReview) {
            // レビューの場合は status = pending のものを取得
            snap = await getDocs(query(collection(firestoreDb, col.name), where('status', '==', 'pending')));
          } else {
            snap = await getDocs(collection(firestoreDb, col.name));
          }

          for (const doc of snap.docs) {
            await this.saveAdminProposal(col.type, doc.id, { ...doc.data(), id: doc.id });
          }
        }

        // 全ユーザーリストも管理者用に取得
        const usersSnap = await getDocs(collection(firestoreDb, 'users'));
        const allUsers = usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        await this.saveSetting('all_users_cache', allUsers);

        console.log('[Sync] Admin data sync completed.');
      }

      // 4. 自分の提案履歴の同期 (全ユーザー対象)
      console.log('[Sync] Syncing user proposals...');
      const proposalTypes = [
        { name: 'creature_proposals', type: 'creature' },
        { name: 'point_proposals', type: 'point' },
        { name: 'point_creature_proposals', type: 'point-creature' }
      ];

      for (const p of proposalTypes) {
        const q = query(collection(firestoreDb, p.name), where('submitterId', '==', userId));
        const snap = await getDocs(q);
        for (const doc of snap.docs) {
          await this.saveMyProposal(p.type, doc.id, { ...doc.data(), id: doc.id });
        }
      }

      // 5. AIコンシェルジュチケットの同期
      console.log('[Sync] Syncing AI tickets...');
      const ticketsSnap = await getDocs(collection(firestoreDb, 'users', userId, 'aiConciergeTickets'));
      for (const doc of ticketsSnap.docs) {
        await this.saveTicket(doc.id, { ...doc.data(), id: doc.id });
      }

    } catch (error) {
      console.error('[Sync] Initial sync failed:', error);
    }
  }

  /**
   * AIコンシェルジュのチケット情報を強制同期
   * (不整合発生時の修復用)
   */
  async syncTickets(userId: string): Promise<void> {
    try {
      console.log('[Sync] Force syncing AI tickets for user:', userId);

      // 1. 詳細データの同期
      const ticketsRef = collection(firestoreDb, 'users', userId, 'aiConciergeTickets');
      const ticketsSnap = await getDocs(ticketsRef);

      // 効率化のため、既存を消す処理を入れるか、あるいは上書き更新 (saveTicketはupsertなのでOK)
      // ただし、Firestoreで削除されたチケット（期限切れで消えた場合など）がローカルに残る問題がある。
      // 本来は全削除->全挿入、または論理削除同期が必要だが、
      // ここでは最低限「有効なチケットの状態」を正しくすることに注力する。
      for (const doc of ticketsSnap.docs) {
        await this.saveTicket(doc.id, { ...doc.data(), id: doc.id });
      }

      // 2. サマリーの同期
      const userRef = doc(firestoreDb, 'users', userId);
      const userSnap = await getDocs(query(collection(firestoreDb, 'users'), where('id', '==', userId)));

      if (!userSnap.empty) {
        const firestoreData = userSnap.docs[0].data() as User;
        const localProfile = await this.getSetting<User>('profile');

        if (localProfile) {
          // サマリー部分だけFirestoreの最新値で上書き
          localProfile.aiConciergeTickets = firestoreData.aiConciergeTickets;
          await this.saveSetting('profile', localProfile);
          console.log('[Sync] Ticket summary updated from Firestore.');
        }
      }

      console.log('[Sync] AI tickets force sync completed.');
    } catch (error) {
      console.error('[Sync] Failed to force sync tickets:', error);
      // ここで失敗したらもはや手がないが、ログは残す
      throw error;
    }
  }

  /**
   * チケットをローカルに保存
   */
  async saveTicket(id: string, data: any): Promise<void> {
    try {
      await userDbEngine.runAsync(
        'INSERT OR REPLACE INTO my_ai_concierge_tickets (id, type, remaining_count, granted_at, expires_at, status, reason, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          data.type || 'daily',
          data.remainingCount || 0,
          data.grantedAt || null,
          data.expiresAt || null,
          data.status || 'valid',
          data.reason || '',
          new Date().toISOString()
        ]
      );
    } catch (error) {
      console.error('[UserDataService] Failed to save ticket:', error);
    }
  }

  /**
   * 自分の提案履歴をローカルに保存
   */
  private async saveMyProposal(type: string, id: string, data: any): Promise<void> {
    try {
      await userDbEngine.runAsync(
        'INSERT OR REPLACE INTO my_proposals (id, type, target_id, data_json, status, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, type, data.targetId || '', JSON.stringify(data), data.status || 'pending', new Date().toISOString()]
      );
    } catch (error) {
      console.error('[UserDataService] Failed to save my proposal:', error);
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
  /**
   * 自分の提案履歴を取得
   */
  async getMyProposals(type?: string): Promise<any[]> {
    try {
      let sql = 'SELECT data_json FROM my_proposals';
      const params: any[] = [];
      if (type) {
        sql += ' WHERE type = ?';
        params.push(type);
      }
      sql += ' ORDER BY synced_at DESC';

      const results = await userDbEngine.getAllAsync<{ data_json: string }>(sql, params);
      return results.map(row => JSON.parse(row.data_json));
    } catch (error) {
      console.error('[UserDataService] Failed to get my proposals:', error);
      return [];
    }
  }
  /**
   * 管理者用データを強制同期
   */
  async syncAdminData(userId: string): Promise<void> {
    if (!await this.initialize(userId)) return;

    try {
      console.log('[Sync] Force syncing admin data...');
      const collections = [
        { name: 'creature_proposals', type: 'creature', isReview: false },
        { name: 'point_proposals', type: 'point', isReview: false },
        { name: 'point_creature_proposals', type: 'point-creature', isReview: false },
        { name: 'reviews', type: 'review', isReview: true }
      ];

      for (const col of collections) {
        let snap;
        if (col.isReview) {
          // レビューの場合は status = pending のものを取得
          snap = await getDocs(query(collection(firestoreDb, col.name), where('status', '==', 'pending')));
        } else {
          snap = await getDocs(collection(firestoreDb, col.name));
        }

        for (const doc of snap.docs) {
          await this.saveAdminProposal(col.type, doc.id, { ...doc.data(), id: doc.id });
        }
      }
      console.log('[Sync] Admin data sync completed.');
    } catch (error) {
      console.error('[Sync] Failed to sync admin data:', error);
    }
  }
}

export const userDataService = new UserDataService();
