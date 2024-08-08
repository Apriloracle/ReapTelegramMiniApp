import React, { useState, useEffect, useCallback } from 'react';
import { createMergeableStore } from 'tinybase';
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';

interface PeerSyncProps {
  onPeerCountUpdate?: (count: number) => void;
  onConnectionStatus?: (status: boolean) => void;
}

const PeerSync: React.FC<PeerSyncProps> = ({ onPeerCountUpdate, onConnectionStatus }) => {
  const [store] = useState(() => createMergeableStore());
  const [synchronizer, setSynchronizer] = useState<any>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const initializeSync = async () => {
      if (!store.hasTable('peers')) {
        store.setTable('peers', { count: { value: 1 } });
      }

      try {
        const webSocket = new WebSocket('wss://todo.demo.tinybase.org');

        webSocket.onopen = () => {
          setIsConnected(true);
          if (onConnectionStatus) onConnectionStatus(true);
        };

        webSocket.onclose = () => {
          setIsConnected(false);
          if (onConnectionStatus) onConnectionStatus(false);
        };

        const newSynchronizer = await createWsSynchronizer(store, webSocket);

        setSynchronizer(newSynchronizer);

        store.addCellListener('peers', 'count', 'value', (_, __, ___, ____, newValue) => {
          if (onPeerCountUpdate) {
            onPeerCountUpdate(newValue as number);
          }
        });

        await newSynchronizer.startSync();
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        setIsConnected(false);
        if (onConnectionStatus) onConnectionStatus(false);
      }
    };

    initializeSync();

    return () => {
      if (synchronizer) {
        synchronizer.destroy();
      }
    };
  }, [store, onPeerCountUpdate, onConnectionStatus]);

  return null;
};

export default PeerSync;
