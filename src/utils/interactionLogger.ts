import { createStore } from 'tinybase';
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
  return Object.values(interactions).filter((interaction): interaction is Interaction => {
    return typeof interaction === 'object' &&
           interaction !== null &&
           'userId' in interaction &&
           'dealId' in interaction &&
           'type' in interaction &&
           'timestamp' in interaction;
  });
};

export const getCurrentUserId = (): string => {
  // This function should return the current user's ID
  // For now, we'll return a placeholder. In a real app, you'd get this from your auth system
  return 'current-user-id';
};
