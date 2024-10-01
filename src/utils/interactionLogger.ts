import { createStore, Row } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

const interactionStore = createStore();
const interactionPersister = createLocalPersister(interactionStore, 'user-interactions');

export interface Interaction {
  userId: string;
  dealId: string;
  type: 'view' | 'click';
  timestamp: number;
}

interface InteractionRow extends Interaction {
  [key: string]: string | number;
}

export const logInteraction = async (userId: string, dealId: string, type: 'view' | 'click') => {
  await interactionPersister.load();
  
  const interactionId = `${userId}-${dealId}-${Date.now()}`;
  
  const newInteraction: InteractionRow = {
    userId,
    dealId,
    type,
    timestamp: Date.now(),
  };

  interactionStore.setRow('interactions', interactionId, newInteraction);
  await interactionPersister.save();
};

export const loadInteractions = async (): Promise<Interaction[]> => {
  await interactionPersister.load();
  const interactions = interactionStore.getTable('interactions') || {};
  return Object.values(interactions).reduce<Interaction[]>((acc, row: Row) => {
    if (
      typeof row === 'object' &&
      row !== null &&
      'userId' in row &&
      'dealId' in row &&
      'type' in row &&
      'timestamp' in row &&
      typeof row.userId === 'string' &&
      typeof row.dealId === 'string' &&
      (row.type === 'view' || row.type === 'click') &&
      typeof row.timestamp === 'number'
    ) {
      acc.push({
        userId: row.userId,
        dealId: row.dealId,
        type: row.type,
        timestamp: row.timestamp
      });
    }
    return acc;
  }, []);
};

export const getCurrentUserId = (): string => {
  // This function should return the current user's ID
  // For now, we'll return a placeholder. In a real app, you'd get this from your auth system
  return 'current-user-id';
};
