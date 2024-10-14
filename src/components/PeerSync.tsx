import React, { useState, useEffect, useRef } from 'react';
import { createStore } from 'tinybase';
import { Doc } from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { createYjsPersister } from 'tinybase/persisters/persister-yjs';

interface PeerSyncProps {
  onConnectionStatus?: (status: boolean) => void;
  onPeerDIDFound?: (peerDID: string) => void;
}

const PeerSync: React.FC<PeerSyncProps> = ({ onConnectionStatus, onPeerDIDFound }) => {
  const [store] = useState(() => createStore());
  const ydocRef = useRef<Doc>(new Doc());
  const providerRef = useRef<WebrtcProvider | null>(null);
  const yjsPersisterRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const initializeSync = async () => {
      try {
        if (!providerRef.current) {
          const roomName = "userSubnet";

          console.log('Initializing Y-WebRTC provider for userSubnet...');
          providerRef.current = new WebrtcProvider(roomName, ydocRef.current, {
            signaling: [],
            password: '', // Change this line from null to an empty string
            filterBcConns: false,
            maxConns: 20
          });

          console.log('Creating YjsPersister...');
          yjsPersisterRef.current = createYjsPersister(store, ydocRef.current, roomName);

          providerRef.current.on('synced', () => {
            console.log('Y-WebRTC provider synced');
            setIsConnected(true);
            if (onConnectionStatus) onConnectionStatus(true);
            checkForExistingPeerDID();
          });

          providerRef.current.on('lost-connection', () => {
            console.log('Y-WebRTC provider lost connection');
            setIsConnected(false);
            if (onConnectionStatus) onConnectionStatus(false);
          });

          console.log('Saving YjsPersister...');
          await yjsPersisterRef.current.save();

          console.log('Y-WebRTC provider initialized and data synced for userSubnet');
        }
      } catch (error) {
        console.error('Failed to initialize Y-WebRTC for userSubnet:', error);
        setIsConnected(false);
        if (onConnectionStatus) onConnectionStatus(false);
      }
    };

    initializeSync();

    // Don't destroy the provider, persister, or document on unmount
    return () => {
      // Optionally, disconnect the provider without destroying it
      if (providerRef.current) {
        providerRef.current.disconnect();
      }
    };
  }, [store, onConnectionStatus, onPeerDIDFound]);

  const checkForExistingPeerDID = () => {
    console.log('Checking for existing Peer:DID...');
    const peerDIDMap = ydocRef.current.getMap('peerDID');
    console.log('Full peerDID Map content:', peerDIDMap.toJSON());
    
    const existingPeerDID = peerDIDMap.get('current');
    console.log('Existing Peer:DID data:', existingPeerDID);
    
    if (existingPeerDID && typeof existingPeerDID === 'object' && 'did' in existingPeerDID) {
      console.log('Existing peer:DID found in userSubnet:', existingPeerDID.did);
      if (onPeerDIDFound) onPeerDIDFound(existingPeerDID.did);
    } else {
      console.log('No existing peer:DID found in userSubnet');
    }
  };

  return null;
};

export default PeerSync;

