import React, { useEffect } from 'react';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import useIPGeolocation from './IPGeolocation';
import axios from 'axios';

const CACHE_DURATION = 100 * 60 * 60 * 1000; // 100 hours in milliseconds

// Define the Deal interface
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
  codes: string[];
  startDate: string;
  endDate: string;
}

const InitialDataFetcher: React.FC = () => {
  const geolocationData = useIPGeolocation();
  const dealsStore = React.useMemo(() => createStore(), []);
  const dealsPersister = React.useMemo(() => createLocalPersister(dealsStore, 'kindred-deals'), [dealsStore]);

  // New stores and persisters
  const activatedDealsStore = React.useMemo(() => createStore(), []);
  const activatedDealsPersister = React.useMemo(() => createLocalPersister(activatedDealsStore, 'activated-deals'), [activatedDealsStore]);
  const merchantDescriptionStore = React.useMemo(() => createStore(), []);
  const merchantDescriptionPersister = React.useMemo(() => createLocalPersister(merchantDescriptionStore, 'merchant-descriptions'), [merchantDescriptionStore]);
  const merchantProductRangeStore = React.useMemo(() => createStore(), []);
  const merchantProductRangePersister = React.useMemo(() => createLocalPersister(merchantProductRangeStore, 'merchant-product-range'), [merchantProductRangeStore]);

  useEffect(() => {
    const fetchAndStoreDeals = async () => {
      if (!geolocationData) return;

      try {
        const response = await fetch(`https://us-central1-fourth-buffer-421320.cloudfunctions.net/kindredMerchant?countryCode=${geolocationData.countryCode}`);

        if (!response.ok) {
          throw new Error('Failed to fetch deals');
        }

        const data: Deal[] = await response.json();

        const dealsTable: Record<string, Record<string, string | number | boolean>> = {};

        data.forEach((deal: Deal) => {
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
        dealsStore.setValue('lastFetchTime', Date.now());

        await dealsPersister.save();

        console.log('Deals fetched and stored successfully');
      } catch (err) {
        console.error('Error fetching deals:', err);
      }
    };

    // ... rest of the code remains the same ...

  }, [geolocationData, dealsStore, dealsPersister, activatedDealsStore, activatedDealsPersister, merchantDescriptionStore, merchantDescriptionPersister, merchantProductRangeStore, merchantProductRangePersister]);

  return null;
};

export default InitialDataFetcher;
