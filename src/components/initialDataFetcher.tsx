import React, { useEffect } from 'react';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import useIPGeolocation from './IPGeolocation';
import axios from 'axios';

const CACHE_DURATION = 100 * 60 * 60 * 1000; // 100 hours in milliseconds

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

        const data = await response.json();
        
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
        dealsStore.setValue('lastFetchTime', Date.now());

        await dealsPersister.save();

        console.log('Deals fetched and stored successfully');
      } catch (err) {
        console.error('Error fetching deals:', err);
      }
    };

    const loadOrFetchDeals = async () => {
      await dealsPersister.load();
      const lastFetchTime = dealsStore.getValue('lastFetchTime') as number | undefined;
      const currentTime = Date.now();

      if (!lastFetchTime || currentTime - lastFetchTime > CACHE_DURATION) {
        console.log('Fetching new deals data');
        await fetchAndStoreDeals();
      } else {
        console.log('Using cached deals data');
      }
    };

    const loadActivatedDeals = async () => {
      await activatedDealsPersister.load();
      console.log('Loaded activated deals');
    };

    const loadMerchantDescriptions = async () => {
      await merchantDescriptionPersister.load();
      await merchantProductRangePersister.load();
      console.log('Loaded merchant descriptions and product ranges');
      
      const storedMerchantNames = merchantDescriptionStore.getTable('merchants');
      const storedProductDescriptions = merchantProductRangeStore.getTable('merchants');
      
      const merchantsNeedingFetch = Object.keys(storedMerchantNames)
        .filter(merchantName => !storedProductDescriptions[merchantName]?.productDescription);
      
      if (merchantsNeedingFetch.length > 0) {
        console.log('Some merchants need product descriptions, queueing...');
        fetchProductDescriptions(merchantsNeedingFetch);
      } else {
        console.log('All merchant descriptions are complete');
      }
    };

    const fetchProductDescriptions = async (merchantNames: string[]) => {
      for (const merchantName of merchantNames) {
        try {
          const response = await axios.post('https://us-central1-fourth-buffer-421320.cloudfunctions.net/chatPplx70b', {
            merchantName,
            temperature: 0.2,
            model: "llama-3.1-sonar-small-128k-chat"
          });

          const productRange = response.data.productRange;

          if (!productRange) {
            throw new Error('Product range not found in response');
          }

          merchantProductRangeStore.setCell('merchants', merchantName, 'productRange', productRange);
          await merchantProductRangePersister.save();
          console.log(`Stored and saved product range for: ${merchantName}`);

          // Wait for 5 seconds before processing the next item
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          console.error(`Error fetching product range for ${merchantName}:`, error);
        }
      }
    };

    loadOrFetchDeals();
    loadActivatedDeals();
    loadMerchantDescriptions();
  }, [geolocationData, dealsStore, dealsPersister, activatedDealsStore, activatedDealsPersister, merchantDescriptionStore, merchantDescriptionPersister, merchantProductRangeStore, merchantProductRangePersister]);

  return null;
};

export default InitialDataFetcher;
