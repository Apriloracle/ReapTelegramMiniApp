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

export const logInteraction = async (userId: string, dealId: string, type: 'view' | 'click') => {
  await interactionPersister.load();
  
  const interactions = interactionStore.getTable('interactions') || {};
  const interactionId = `${userId}-${dealId}-${Date.now()}`;
  
  const newInteraction: Interaction = {
    userId,
    dealId,
    type,
    timestamp: Date.now(),
  };

  interactionStore.setRow('interactions', interactionId, {
    ...newInteraction,
    [interactionId]: JSON.stringify(newInteraction)
  });
  await interactionPersister.save();
};

export const loadInteractions = async (): Promise<Interaction[]> => {
  await interactionPersister.load();
  const interactions = interactionStore.getTable('interactions') || {};
  return Object.values(interactions).map(interaction => {
    if (typeof interaction === 'string') {
      return JSON.parse(interaction);
    }
    return interaction as Interaction;
  });
};

export const getCurrentUserId = (): string => {
  // This function should return the current user's ID
  // For now, we'll return a placeholder. In a real app, you'd get this from your auth system
  return 'current-user-id';
};
