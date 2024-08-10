import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useIPGeolocation from './IPGeolocation';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

interface Code {
  code: string;
  summary: string;
}

interface Deal {
  id: string;
  dealId: string;
  merchantName: string;
  logo: string;
  logoAbsoluteUrl: string;
  cashbackType: string;
  cashback: number;
  currency: string;
  domains: string[];
  countries: string[];
  codes: Code[];
  startDate: string;
  endDate: string;
}

const DealsComponent: React.FC = () => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const geolocationData = useIPGeolocation();

  const dealsStore = React.useMemo(() => createStore(), []);
  const dealsPersister = React.useMemo(() => createLocalPersister(dealsStore, 'kindred-deals'), [dealsStore]);

  useEffect(() => {
    const fetchAndStoreDeals = async () => {
      if (!geolocationData) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`https://us-central1-fourth-buffer-421320.cloudfunctions.net/kindredMerchant?countryCode=${geolocationData.countryCode}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch deals');
        }

        const data: Deal[] = await response.json();
        
        // Store the fetched deals in TinyBase
        const dealsTable: Record<string, Record<string, string | number | boolean>> = {};
        data.forEach(deal => {
          dealsTable[deal.id] = {
            dealId: deal.dealId,
            merchantName: deal.merchantName,
            logo: deal.logo,
            logoAbsoluteUrl: deal.logoAbsoluteUrl,
            cashbackType: deal.cashbackType,
            cashback: deal.cashback,
            currency: deal.currency,
            domains: JSON.stringify(deal.domains),
            countries: JSON.stringify(deal.countries),
            codes: JSON.stringify(deal.codes),
            startDate: deal.startDate,
            endDate: deal.endDate
          };
        });
        dealsStore.setTable('deals', dealsTable);

        // Store the last fetch time
        dealsStore.setValue('lastFetchTime', Date.now());

        // Persist the data
        await dealsPersister.save();

        setDeals(data);
      } catch (err) {
        setError('Failed to load deals. Please try again later.');
        console.error('Error fetching deals:', err);
      } finally {
        setLoading(false);
      }
    };

    const loadDealsFromStore = async () => {
      await dealsPersister.load();
      const lastFetchTime = dealsStore.getValue('lastFetchTime') as number | undefined;
      const storedDeals = dealsStore.getTable('deals');

      if (lastFetchTime && Date.now() - lastFetchTime < 24 * 60 * 60 * 1000 && Object.keys(storedDeals).length > 0) {
        // If less than 24 hours have passed and we have stored deals, use the stored deals
        const dealsArray: Deal[] = Object.entries(storedDeals).map(([id, deal]) => ({
          id,
          dealId: deal.dealId as string,
          merchantName: deal.merchantName as string,
          logo: deal.logo as string,
          logoAbsoluteUrl: deal.logoAbsoluteUrl as string,
          cashbackType: deal.cashbackType as string,
          cashback: deal.cashback as number,
          currency: deal.currency as string,
          domains: JSON.parse(deal.domains as string),
          countries: JSON.parse(deal.countries as string),
          codes: JSON.parse(deal.codes as string),
          startDate: deal.startDate as string,
          endDate: deal.endDate as string
        }));
        setDeals(dealsArray);
        setLoading(false);
      } else {
        // Otherwise, fetch new deals
        fetchAndStoreDeals();
      }
    };

    loadDealsFromStore();
  }, [geolocationData, dealsStore, dealsPersister]);

  // ... rest of the component remains the same

  return (
    // ... existing JSX
  );
};

export default DealsComponent;
