import React, { useState, useEffect } from 'react';

interface PeerSyncProps {
  onConnectionStatus?: (status: boolean) => void;
}

const PeerSync: React.FC<PeerSyncProps> = ({ onConnectionStatus }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    let webSocket: WebSocket;

    const initializeWebSocket = () => {
      try {
        webSocket = new WebSocket('');  // Replace with your actual WebSocket server URL

        webSocket.onopen = () => {
          setIsConnected(true);
          if (onConnectionStatus) onConnectionStatus(true);
          console.log('WebSocket connection established');
        };

        webSocket.onclose = () => {
          setIsConnected(false);
          if (onConnectionStatus) onConnectionStatus(false);
          console.log('WebSocket connection closed');
        };

        webSocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
          if (onConnectionStatus) onConnectionStatus(false);
        };

      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        setIsConnected(false);
        if (onConnectionStatus) onConnectionStatus(false);
      }
    };

    initializeWebSocket();

    return () => {
      if (webSocket) {
        webSocket.close();
      }
    };
  }, [onConnectionStatus]);

  return null;
};

export default PeerSync;
