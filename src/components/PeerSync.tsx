import React, { useState, useEffect } from 'react';
import { createMergeableStore } from 'tinybase';
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';

interface PeerSyncProps {
  onConnectionStatus?: (status: boolean) => void;
}

const PeerSync: React.FC<PeerSyncProps> = ({ onConnectionStatus }) => {
  const [store] = useState(() => createMergeableStore());
  const [synchronizer, setSynchronizer] = useState<any>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const initializeSync = async () => {
      try {
        const webSocket = new WebSocket('');

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
  }, [store, onConnectionStatus]);

  return null;
};

export default PeerSync;

