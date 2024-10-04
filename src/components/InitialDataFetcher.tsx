import React, { useEffect, useState, useCallback } from 'react';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import useIPGeolocation from './IPGeolocation';
import axios from 'axios';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
  codes: any[]; // You might want to define a more specific type for codes
  startDate: string;
  endDate: string;
}

const InitialDataFetcher: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
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
  const surveyStore = React.useMemo(() => createStore(), []);
  const surveyPersister = React.useMemo(() => createLocalPersister(surveyStore, 'survey-responses'), [surveyStore]);

  const [isGeolocationAvailable, setIsGeolocationAvailable] = useState(false);
  const [fetchedMerchants, setFetchedMerchants] = useState<Set<string>>(new Set());

  const fetchAndStoreDeals = useCallback(async (countryCode: string) => {
    console.log('Fetching deals with country code:', countryCode);
    try {
      const response = await fetch(`https://asia-southeast1-fourth-buffer-421320.cloudfunctions.net/kindredMerchant?countryCode=${countryCode}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch deals: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data: Deal[] = await response.json();
      
      const dealsTable: Record<string, Record<string, string | number | boolean>> = {};
      const merchantDescriptions: Record<string, string> = {};

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

        merchantDescriptions[deal.merchantName] = deal.merchantName;
      });

      dealsStore.setTable('deals', dealsTable);
      dealsStore.setValue('lastFetchTime', Date.now());

      if (Object.keys(merchantDescriptionStore.getTable('merchants')).length === 0) {
        Object.entries(merchantDescriptions).forEach(([key, value]) => {
          merchantDescriptionStore.setCell('merchants', key, 'name', value);
        });
        await merchantDescriptionPersister.save();
      }

      await dealsPersister.save();
    } catch (err) {
      console.error('Error fetching deals:', err);
      // You might want to set an error state here to display to the user
    }
  }, [dealsStore, dealsPersister, merchantDescriptionStore, merchantDescriptionPersister]);

  const loadOrFetchDeals = useCallback(async (countryCode: string) => {
    await dealsPersister.load();
    const lastFetchTime = dealsStore.getValue('lastFetchTime') as number | undefined;
    const currentTime = Date.now();

    if (!lastFetchTime || currentTime - lastFetchTime > CACHE_DURATION) {
      console.log('Fetching new deals data');
      await fetchAndStoreDeals(countryCode);
    } else {
      console.log('Using cached deals data');
    }
  }, [dealsPersister, dealsStore, fetchAndStoreDeals]);

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
      // Check if the product range is already stored
      const storedProductRange = merchantProductRangeStore.getCell('merchants', merchantName, 'productRange');
      
      if (storedProductRange) {
        // Remove this console.log
        // console.log(`Product range for ${merchantName} already stored, skipping fetch.`);
        continue; // Skip to the next merchant
      }

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
      } catch (error) {
        console.error(`Error fetching product range for ${merchantName}:`, error);
      }
    }
  };

  useEffect(() => {
    console.log('InitialDataFetcher useEffect triggered');
    
    const initializeData = async () => {
      console.log('Initializing data...');
      
      try {
        // Load geolocation data from the existing store
        const geolocationStore = createStore();
        const geolocationPersister = createLocalPersister(geolocationStore, 'user-geolocation');
        await geolocationPersister.load();
        
        const storedGeolocationData = geolocationStore.getRow('geolocation', 'userGeo');
        
        let currentCountryCode: string;
        if (storedGeolocationData && 'countryCode' in storedGeolocationData) {
          currentCountryCode = storedGeolocationData.countryCode as string;
          console.log('Country code loaded from store:', currentCountryCode);
        } else if (geolocationData && geolocationData.countryCode) {
          currentCountryCode = geolocationData.countryCode;
          console.log('Country code from IPGeolocation:', currentCountryCode);
        } else {
          console.log('Country code not available, using default');
          currentCountryCode = ''; // Set a default country code
        }

        setCountryCode(currentCountryCode);
        setIsGeolocationAvailable(!!geolocationData);

        // Now that we have the country code, we can load or fetch deals
        await loadOrFetchDeals(currentCountryCode);
        await loadActivatedDeals();
        await loadMerchantDescriptions();
        setIsInitialized(true);
        console.log('Data initialization complete');
      } catch (error) {
        console.error('Error during data initialization:', error);
      }
    };

    if (!isInitialized) {
      initializeData();
    }
  }, [geolocationData, isInitialized, loadOrFetchDeals, loadActivatedDeals, loadMerchantDescriptions]);

  useEffect(() => {
    // This effect will run once when the component mounts
    const timer = setTimeout(() => {
      if (!isInitialized) {
        console.log('Initialization timeout reached, forcing initialization');
        setIsInitialized(true);
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timer);
  }, [isInitialized]);

  // Use countryCode in your component logic
  useEffect(() => {
    if (countryCode) {
      console.log('Using country code:', countryCode);
      // You can now use the countryCode in your data fetching logic
      // For example, you might want to pass it to the fetchAndStoreDeals function
      // fetchAndStoreDeals(countryCode);
    }
  }, [countryCode]);

  return (
    <div style={{ display: 'none' }}>
      {isInitialized ? 'Data fetched and initialized' : 'Initializing data...'}
      <br />
      Geolocation available: {isGeolocationAvailable ? 'Yes' : 'No'}
      <br />
      Country Code: {countryCode || 'Not available'}
    </div>
  );
};

export default InitialDataFetcher;
