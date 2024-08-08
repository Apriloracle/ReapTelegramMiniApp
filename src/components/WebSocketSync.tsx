import { useState, useEffect, useCallback } from 'react';
import { createMergeableStore } from 'tinybase';
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';

interface WebSocketSyncProps {
  url: string;
  onSyncStart?: () => void;
  onSyncError?: (error: Error) => void;
}

const WebSocketSync: React.FC<WebSocketSyncProps> = ({ url, onSyncStart, onSyncError }) => {
  const [store] = useState(() => createMergeableStore());
  const [synchronizer, setSynchronizer] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeSync = async () => {
      try {
        if (!store.hasTable('peers')) {
          store.setTable('peers', { count: { value: 1 } });
        }

        const newSynchronizer = await createWsSynchronizer(
          store,
          new WebSocket(url)
        );

        if (isMounted) {
          setSynchronizer(newSynchronizer);
          setIsConnected(true);
          if (onSyncStart) onSyncStart();
        }

        await newSynchronizer.startSync();
      } catch (error) {
        if (isMounted && onSyncError) {
          onSyncError(error instanceof Error ? error : new Error('Unknown error occurred'));
        }
      }
    };

    initializeSync();

    return () => {
      isMounted = false;
      if (synchronizer) {
        synchronizer.destroy();
      }
    };
  }, [url, onSyncStart, onSyncError, store]);

  const incrementPeerCount = useCallback(() => {
    const currentCount = store.getCell('peers', 'count', 'value') as number;
    store.setCell('peers', 'count', 'value', currentCount + 1);
  }, [store]);

  return { incrementPeerCount, isConnected };
};

export default WebSocketSync;
