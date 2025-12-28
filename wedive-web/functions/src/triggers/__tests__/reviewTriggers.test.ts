
// Mock Firestore
jest.mock('firebase-admin', () => {
  const mockUpdate = jest.fn().mockResolvedValue({} as any);
  const mockGet = jest.fn();
  const mockQuery = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    get: mockGet,
  };
  const mockCollection = jest.fn(() => mockQuery);
  const mockDocInstance = { update: mockUpdate };
  const mockDoc = jest.fn(() => mockDocInstance);

  return {
    firestore: Object.assign(() => ({
      collection: mockCollection,
      doc: mockDoc,
    }), {
      FieldValue: {
        serverTimestamp: () => 'SERVER_TIMESTAMP',
        delete: () => 'DELETE_FIELD'
      }
    }),
    initializeApp: jest.fn(),
  };
});

// Mock Logger
jest.mock('firebase-functions/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

import * as admin from 'firebase-admin';
import { onReviewWriteAggregateStats } from '../reviewTriggers';

describe('onReviewWriteAggregateStats Trigger', () => {
  const db = admin.firestore();

  beforeEach(() => {
    jest.clearAllMocks();

    const mockGet = (db.collection('any') as any).get as jest.Mock;
    mockGet.mockResolvedValue({
      docs: [
        {
          data: () => ({
            pointId: 'p123',
            rating: 5,
            metrics: { visibility: 20 },
            radar: { encounter: 4, excite: 4, macro: 3, comfort: 4, visibility: 4 },
            condition: { weather: 'sunny' },
            createdAt: '2023-01-01T00:00:00Z'
          })
        },
        {
          data: () => ({
            pointId: 'p123',
            rating: 3,
            metrics: { visibility: 10 },
            radar: { encounter: 2, excite: 2, macro: 3, comfort: 2, visibility: 2 },
            condition: { weather: 'cloudy' },
            createdAt: '2023-01-02T00:00:00Z'
          })
        }
      ]
    });
  });

  it('should calculate and update aggregate stats when a review is written', async () => {
    const event = {
      data: {
        after: {
          data: () => ({ pointId: 'p123', rating: 5 })
        },
        before: {
          data: () => ({})
        }
      }
    } as any;

    await (onReviewWriteAggregateStats as any).run(event);

    expect(db.collection).toHaveBeenCalledWith('reviews');
    expect(db.doc).toHaveBeenCalledWith('points/p123');

    const mockUpdate = (db.doc('any') as any).update as jest.Mock;
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      actualStats: expect.objectContaining({
        avgRating: 4,
        reviewCount: 2,
      })
    }));
  });

  it('should fallback to delete actualStats if no reviews remain', async () => {
    const mockGet = (db.collection('any') as any).get as jest.Mock;
    mockGet.mockResolvedValueOnce({ docs: [] });

    const event = {
      data: {
        after: { data: () => null }, // Deleted
        before: { data: () => ({ pointId: 'p123' }) }
      }
    } as any;

    await (onReviewWriteAggregateStats as any).run(event);

    expect(db.doc).toHaveBeenCalledWith('points/p123');
    const mockUpdate = (db.doc('any') as any).update as jest.Mock;
    expect(mockUpdate).toHaveBeenCalledWith({
      actualStats: 'DELETE_FIELD'
    });
  });
});
