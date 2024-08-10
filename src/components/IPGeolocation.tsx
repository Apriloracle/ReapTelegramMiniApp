import { useEffect, useState } from 'react';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

interface GeolocationData {
  countryCode: string;
  ip: string;
}

const useIPGeolocation = () => {
  const [geolocationData, setGeolocationData] = useState<GeolocationData | null>(null);

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
          userGeo: {
            countryCode: newGeolocationData.countryCode,
            ip: newGeolocationData.ip,
          },
        });

        // Persist the data
        await geolocationPersister.save();
      } catch (err) {
        console.error('Error fetching geolocation:', err);
      }
    };

    const loadPersistedGeolocation = async () => {
      await geolocationPersister.load();
      const persistedData = geolocationStore.getRow('geolocation', 'userGeo');
      if (persistedData && 'countryCode' in persistedData && 'ip' in persistedData) {
        setGeolocationData({
          countryCode: persistedData.countryCode as string,
          ip: persistedData.ip as string,
        });
      } else {
        fetchGeolocation();
      }
    };

    loadPersistedGeolocation();

    return () => {
      geolocationPersister.destroy();
    };
  }, []);

  return geolocationData;
};

export default useIPGeolocation;
