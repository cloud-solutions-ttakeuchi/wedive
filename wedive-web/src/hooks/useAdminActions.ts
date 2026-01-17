import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import { masterDataService } from '../services/MasterDataService';
import { userDataService } from '../services/UserDataService';
import type { Point, Creature } from '../types';
import { useQueryClient } from '@tanstack/react-query';

export const useAdminActions = () => {
  const queryClient = useQueryClient();
  /**
   * 申請の承認
   */
  const approveProposal = async (type: 'creature' | 'point' | 'point-creature', id: string, item: any) => {
    const now = new Date().toISOString();
    const proposalRef = doc(db, type === 'point-creature' ? 'point_creature_proposals' : `${type}_proposals`, id);

    // 1. Concurrency Check
    const snap = await getDoc(proposalRef);
    if (!snap.exists()) {
      alert('申請データが見つかりません。');
      return;
    }
    const data = snap.data();
    if (data.status !== 'pending' && data.processedAt) {
      alert('この申請は既に他の管理者によって処理されました。');
      return;
    }

    try {
      if (type === 'point-creature') {
        // Point-Creature Relationship
        const newId = `${item.pointId}_${item.creatureId}`;
        const pcRef = doc(db, 'point_creatures', newId);

        if (item.proposalType === 'delete') {
          await deleteDoc(pcRef);
          // TODO: Local cache delete if we have it
        } else {
          await setDoc(pcRef, {
            ...item,
            id: newId,
            status: 'approved',
            updatedAt: now
          });
          // Update local cache
          await masterDataService.updatePointCreatureInCache({
            id: newId,
            pointId: item.pointId,
            creatureId: item.creatureId,
            localRarity: item.localRarity,
            updatedAt: now
          });
        }
      } else {
        // Point or Creature
        const targetId = item.targetId || item.id;
        const targetRef = doc(db, `${type}s`, targetId);

        if (item.proposalType === 'delete' || item.isDeletionRequest) {
          await deleteDoc(targetRef);
          if (type === 'point') await masterDataService.deletePointFromCache(targetId);
          else await masterDataService.deleteCreatureFromCache(targetId);
        } else if (item.proposalType === 'update') {
          const updateData = { ...item.diffData, updatedAt: now };
          await updateDoc(targetRef, updateData);

          // Update local cache
          const latestSnap = await getDoc(targetRef);
          if (latestSnap.exists()) {
            const latest = { ...latestSnap.data(), id: targetId } as any;
            if (type === 'point') await masterDataService.updatePointInCache(latest);
            else await masterDataService.updateCreatureInCache(latest);
          }
        } else {
          // New Registration
          const newDocRef = doc(db, `${type}s`, targetId);
          await setDoc(newDocRef, { ...item, status: 'approved', updatedAt: now });

          if (type === 'point') await masterDataService.updatePointInCache({ ...item, id: targetId, updatedAt: now });
          else await masterDataService.updateCreatureInCache({ ...item, id: targetId, updatedAt: now });
        }
      }

      // 2. Mark Proposal as processed
      await updateDoc(proposalRef, {
        status: 'approved',
        processedAt: now
      });

      // 3. User Trust Score Bonus
      if (item.submitterId) {
        const userRef = doc(db, 'users', item.submitterId);
        await updateDoc(userRef, { trustScore: increment(5) });
      }

      // 4. Remove from local admin cache to update dashboard count
      await userDataService.deleteAdminProposal(id);

      // Invalidate query to update UI
      if (type === 'point') queryClient.invalidateQueries({ queryKey: ['proposalPoints'] });
      else if (type === 'creature') queryClient.invalidateQueries({ queryKey: ['proposalCreatures'] });
      else if (type === 'point-creature') queryClient.invalidateQueries({ queryKey: ['proposalPointCreatures'] });

    } catch (e) {
      console.error('Approve failed:', e);
      alert('承認処理中にエラーが発生しました。');
    }
  };

  /**
   * 申請の却下
   */
  const rejectProposal = async (type: 'creature' | 'point' | 'point-creature', id: string) => {
    const now = new Date().toISOString();
    const proposalRef = doc(db, type === 'point-creature' ? 'point_creature_proposals' : `${type}_proposals`, id);

    const snap = await getDoc(proposalRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== 'pending' && data.processedAt) {
      alert('この申請は既に他の管理者によって処理されました。');
      return;
    }

    await updateDoc(proposalRef, {
      status: 'rejected',
      processedAt: now
    });

    // Remove from local admin cache
    await userDataService.deleteAdminProposal(id);

    // Invalidate query to update UI
    if (type === 'point') queryClient.invalidateQueries({ queryKey: ['proposalPoints'] });
    else if (type === 'creature') queryClient.invalidateQueries({ queryKey: ['proposalCreatures'] });
    else if (type === 'point-creature') queryClient.invalidateQueries({ queryKey: ['proposalPointCreatures'] });
  };

  /**
   * レビューの承認
   */
  const approveReview = async (id: string) => {
    const now = new Date().toISOString();
    const reviewRef = doc(db, 'reviews', id);

    // 1. Check current status
    const snap = await getDoc(reviewRef);
    if (!snap.exists()) {
      alert('レビューが見つかりません。');
      return;
    }
    const data = snap.data();

    // Already processed?
    if (data.status === 'approved') {
      alert('このレビューは既に承認済みです。');
      return;
    }

    // 2. Update status to approved
    await updateDoc(reviewRef, {
      status: 'approved',
      approvedAt: now,
      updatedAt: now
    });

    // Remove from local admin cache
    await userDataService.deleteAdminProposal(id);
    // UI Update
    queryClient.invalidateQueries({ queryKey: ['proposalReviews'] });

    // TODO: Trigger aggregation or other side effects if needed
  };

  /**
   * レビューの却下
   */
  const rejectReview = async (id: string) => {
    const reviewRef = doc(db, 'reviews', id);
    await updateDoc(reviewRef, {
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Remove from local admin cache
    await userDataService.deleteAdminProposal(id);
    // UI Update
    queryClient.invalidateQueries({ queryKey: ['proposalReviews'] });
  };

  return {
    approveProposal,
    rejectProposal,
    approveReview,
    rejectReview
  };
};
