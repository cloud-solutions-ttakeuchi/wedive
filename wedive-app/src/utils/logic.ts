import { Rarity, Creature, PointCreature } from '../types';

/**
 * Sanitizes payload by removing undefined values
 */
export const sanitizePayload = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => sanitizePayload(item));
  }
  if (data !== null && typeof data === 'object') {
    return Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = sanitizePayload(value);
      }
      return acc;
    }, {} as any);
  }
  return data;
};

/**
 * Calculates rarity for a creature based on its default rarity or master data.
 */
export const calculateRarity = (creatureId: string, creatures: Creature[]): Rarity => {
  const creature = creatures.find(c => c.id === creatureId);
  if (creature?.rarity) return creature.rarity;
  return 'Common';
};

/**
 * Logic to link creatures and points with rarity.
 */
export const getPointCreatures = (
  pointId: string,
  pointCreatures: PointCreature[],
  creatures: Creature[]
) => {
  return pointCreatures
    .filter(pc => pc.pointId === pointId && pc.status === 'approved')
    .map(pc => {
      const creature = creatures.find(c => c.id === pc.creatureId);
      return {
        ...pc,
        creature
      };
    })
    .filter(item => item.creature !== undefined);
};
