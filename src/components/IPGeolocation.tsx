import React, { useEffect, useState } from 'react';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

interface GeolocationData {
  countryCode: string;
  ip: string;
}

const IPGeolocation: React.FC = () => {
  const [geolocationData, setGeolocationData] = useState<GeolocationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const geolocationStore = createStore();
    const geolocationPersister = createLocalPersister(geolocationStore, 'user-geolocation');

    const fetchGeolocation = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) {
          throw new Error('Failed to fetch geolocation data');
        }
        const data = await response.json();
        const newGeolocationData: GeolocationData = {
          countryCode: data.country_code,
          ip: data.ip,
        };

        setGeolocationData(newGeolocationData);

        // Store the data in TinyBase
        geolocationStore.setTable('geolocation', {
          userGeo: newGeolocationData,
        });

        // Persist the data
        await geolocationPersister.save();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    const loadPersistedGeolocation = async () => {
      await geolocationPersister.load();
      const persistedData = geolocationStore.getRow('geolocation', 'userGeo') as GeolocationData | undefined;
      if (persistedData) {
        setGeolocationData(persistedData);
      } else {
        fetchGeolocation();
      }
    };

    loadPersistedGeolocation();

    return () => {
      geolocationPersister.destroy();
    };
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!geolocationData) {
    return <div>Loading geolocation data...</div>;
  }

  return (
    <div>
      <p>Country Code: {geolocationData.countryCode}</p>
      <p>IP Address: {geolocationData.ip}</p>
    </div>
  );
};

export default IPGeolocation;
