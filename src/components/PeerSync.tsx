import React, { useState, useEffect, useCallback } from 'react';
import { createMergeableStore } from 'tinybase';
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';

interface PeerSyncProps {
  onPeerCountUpdate?: (count: number) => void;
}

const PeerSync: React.FC<PeerSyncProps> = ({ onPeerCountUpdate }) => {
  const [store] = useState(() => createMergeableStore());
  const [synchronizer, setSynchronizer] = useState<any>(null);

  useEffect(() => {
    const initializeSync = async () => {
      if (!store.hasTable('peers')) {
        store.setTable('peers', { count: { value: 1 } });
      }

      const newSynchronizer = await createWsSynchronizer(
        store,
        new WebSocket('wss://todo.demo.tinybase.org')
      );

      setSynchronizer(newSynchronizer);

      store.addCellListener('peers', 'count', 'value', (_, __, ___, ____, newValue) => {
        if (onPeerCountUpdate) {
          onPeerCountUpdate(newValue as number);
        }
      });

      await newSynchronizer.startSync();
    };

    initializeSync();

    return () => {
      if (synchronizer) {
        synchronizer.destroy();
      }
    };
  }, [store, onPeerCountUpdate]);

  const getPeerCount = useCallback(() => {
    return store.getCell('peers', 'count', 'value') as number;
  }, [store]);

  // Return null as this component doesn't render anything
  return null;
};

export default PeerSync;
