import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { Point, Creature, PointCreature, PointCreatureProposal, Rarity } from '../types';

/**
 * ProposalService
 * Processes user proposals and direct admin actions.
 * Separated at the function level for maximum integrity.
 */
export const ProposalService = {
  // --- Admin Direct Writes (Master Data) ---

  /**
   * Directly add a new point to the master collection.
   */
  async addPoint(data: Omit<Point, 'id'>): Promise<string> {
    const id = `p${Date.now()}`;
    const ref = doc(db, 'points', id);
    await setDoc(ref, {
      ...data,
      id,
      status: 'approved',
      createdAt: new Date().toISOString()
    });
    return id;
  },

  /**
   * Directly add a new creature to the master collection.
   */
  async addCreature(data: Omit<Creature, 'id'>): Promise<string> {
    const id = `c${Date.now()}`;
    const ref = doc(db, 'creatures', id);
    await setDoc(ref, {
      ...data,
      id,
      status: 'approved',
      createdAt: new Date().toISOString()
    });
    return id;
  },

  /**
   * Directly link a creature to a point.
   */
  async addPointCreature(pointId: string, creatureId: string, localRarity: Rarity): Promise<void> {
    const id = `${pointId}_${creatureId}`;
    const ref = doc(db, 'point_creatures', id);
    await setDoc(ref, {
      id,
      pointId,
      creatureId,
      localRarity,
      status: 'approved',
      createdAt: new Date().toISOString()
    });
  },

  // --- User Proposal Submissions ---

  /**
   * Submit a proposal for a new point.
   */
  async addPointProposal(data: Omit<Point, 'id'>): Promise<string> {
    const id = `propp_${Date.now()}`;
    const ref = doc(db, 'point_proposals', id);
    await setDoc(ref, {
      ...data,
      id,
      status: 'pending',
      proposalType: 'create',
      createdAt: new Date().toISOString()
    });
    return id;
  },

  /**
   * Submit a proposal for a new creature.
   */
  async addCreatureProposal(data: Omit<Creature, 'id'>): Promise<string> {
    const id = `propc_${Date.now()}`;
    const ref = doc(db, 'creature_proposals', id);
    await setDoc(ref, {
      ...data,
      id,
      status: 'pending',
      proposalType: 'create',
      createdAt: new Date().toISOString()
    });
    return id;
  },

  /**
   * Submit a proposal to link or unlink a creature to a point.
   */
  async addPointCreatureProposal(params: {
    pointId: string;
    creatureId: string;
    localRarity: Rarity;
    submitterId: string;
    proposalType?: 'create' | 'delete';
  }): Promise<string> {
    const id = `proppc_${Date.now()}`;
    const targetId = `${params.pointId}_${params.creatureId}`;

    const proposal: PointCreatureProposal = {
      id,
      targetId,
      pointId: params.pointId,
      creatureId: params.creatureId,
      localRarity: params.localRarity,
      proposalType: params.proposalType || 'create',
      submitterId: params.submitterId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      processedAt: undefined
    };

    const ref = doc(db, 'point_creature_proposals', id);
    await setDoc(ref, proposal);
    return id;
  },

  /**
   * Submit a deletion proposal for a point-creature relationship.
   */
  async removePointCreatureProposal(pointId: string, creatureId: string, submitterId: string): Promise<string> {
    return this.addPointCreatureProposal({
      pointId,
      creatureId,
      localRarity: 'Common', // Default rarity, but proposalType is delete
      submitterId,
      proposalType: 'delete'
    });
  }
};
