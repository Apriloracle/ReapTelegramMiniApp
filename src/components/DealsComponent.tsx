import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useIPGeolocation from './IPGeolocation';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import { useAccount } from 'wagmi';
import axios from 'axios';

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

interface DealsComponentProps {
  localWalletAddress: string | null;
}

const DealsComponent: React.FC<DealsComponentProps> = ({ localWalletAddress }) => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activatingDeal, setActivatingDeal] = useState<string | null>(null);
  const [activatedDeals, setActivatedDeals] = useState<Set<string>>(new Set());
  const geolocationData = useIPGeolocation();
  const { address } = useAccount();

  const dealsStore = React.useMemo(() => createStore(), []);
  const dealsPersister = React.useMemo(() => createLocalPersister(dealsStore, 'kindred-deals'), [dealsStore]);
  
  const activatedDealsStore = React.useMemo(() => createStore(), []);
  const activatedDealsPersister = React.useMemo(() => createLocalPersister(activatedDealsStore, 'activated-deals'), [activatedDealsStore]);

  // New store for MerchantDescription
  const merchantDescriptionStore = React.useMemo(() => createStore(), []);
  const merchantDescriptionPersister = React.useMemo(() => createLocalPersister(merchantDescriptionStore, 'merchant-descriptions'), [merchantDescriptionStore]);

  // New state to track if product descriptions have been fetched
  const [fetchedMerchants, setFetchedMerchants] = useState<Set<string>>(new Set());

  const [fetchQueue, setFetchQueue] = useState<string[]>([]);
  const isFetchingRef = useRef(false);
  const processFetchQueueRef = useRef<(() => Promise<void>) | null>(null);

  const merchantProductRangeStore = React.useMemo(() => createStore(), []);
  const merchantProductRangePersister = React.useMemo(() => createLocalPersister(merchantProductRangeStore, 'merchant-product-range'), [merchantProductRangeStore]);

  const [filteredMerchants, setFilteredMerchants] = useState<string[]>([]);
  const surveyStore = React.useMemo(() => createStore(), []);
  const surveyPersister = React.useMemo(() => createLocalPersister(surveyStore, 'survey-responses'), []);

  useEffect(() => {
    const loadSurveyResponses = async () => {
      await surveyPersister.load();
      const surveyResponses = surveyStore.getTable('answeredQuestions');
      
      if (surveyResponses) {
        const matchingMerchants = deals.filter(deal => {
          const productRange = merchantProductRangeStore.getCell('merchants', deal.merchantName, 'productRange') as string;
          if (!productRange) return false;

          return Object.entries(surveyResponses).some(([question, response]) => {
            const answer = (response as any).answer;
            return productRange.toLowerCase().includes(answer.toLowerCase());
          });
        });

        setFilteredMerchants(matchingMerchants.map(deal => deal.merchantName));
      }
    };

    loadSurveyResponses();
  }, [deals, surveyPersister, surveyStore, merchantProductRangeStore]);

  const searchDeals = useCallback((term: string) => {
    const lowercasedTerm = term.toLowerCase();
    const filtered = deals.filter(deal => 
      deal.merchantName.toLowerCase().includes(lowercasedTerm) ||
      deal.codes.some(code => code.code.toLowerCase().includes(lowercasedTerm)) ||
      deal.cashbackType.toLowerCase().includes(lowercasedTerm)
    );
    setFilteredDeals(filtered);
  }, [deals]);

  useEffect(() => {
    searchDeals(searchTerm);
  }, [searchTerm, searchDeals]);

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

          // Add merchant name to the merchantDescriptions
          merchantDescriptions[deal.merchantName] = deal.merchantName;
        });

        dealsStore.setTable('deals', dealsTable);
        dealsStore.setValue('lastFetchTime', Date.now());

        // Only set and save merchant descriptions if they haven't been saved before
        if (Object.keys(merchantDescriptionStore.getTable('merchants')).length === 0) {
          Object.entries(merchantDescriptions).forEach(([key, value]) => {
            merchantDescriptionStore.setCell('merchants', key, 'name', value);
            console.log(`Storing merchant name: ${key}`); // New log
          });
          await merchantDescriptionPersister.save();
          console.log('Merchant descriptions saved to local storage'); // New log
        }

        await dealsPersister.save();

        setDeals(data);
        setFilteredDeals(data);
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
        setFilteredDeals(dealsArray);
        setLoading(false);
      } else {
        fetchAndStoreDeals();
      }
    };

    loadDealsFromStore();
  }, [geolocationData, dealsStore, dealsPersister, merchantDescriptionStore, merchantDescriptionPersister]);

  useEffect(() => {
    const loadActivatedDeals = async () => {
      await activatedDealsPersister.load();
      const storedActivatedDeals = activatedDealsStore.getTable('activatedDeals');
      if (storedActivatedDeals) {
        setActivatedDeals(new Set(Object.keys(storedActivatedDeals)));
      }
    };

    loadActivatedDeals();
  }, [activatedDealsPersister, activatedDealsStore]);

  // Function to fetch product descriptions
  const fetchProductDescriptions = useCallback(async (merchantName: string) => {
    // Check if the product range is already stored
    const storedProductRange = merchantProductRangeStore.getCell('merchants', merchantName, 'productRange');
    
    if (storedProductRange) {
      console.log(`Product range for ${merchantName} already stored, skipping fetch.`);
      return;
    }

    if (!fetchedMerchants.has(merchantName) && merchantProductRangePersister) {
      try {
        const response = await axios.post('https://us-central1-fourth-buffer-421320.cloudfunctions.net/chatPplx70b', {
          merchantName,
          temperature: 0.2,
          model: "llama-3.1-sonar-small-128k-chat"
        });

        // Extract the productRange from the response
        const productRange = response.data.productRange;

        if (!productRange) {
          throw new Error('Product range not found in response');
        }

        // Ensure the 'merchants' table exists
        if (!merchantProductRangeStore.hasTable('merchants')) {
          merchantProductRangeStore.setTable('merchants', {});
        }

        // Set the product range for the merchant
        merchantProductRangeStore.setCell('merchants', merchantName, 'productRange', productRange);
        console.log(`Stored product range for: ${merchantName}`);

        // Save the changes to local storage
        await merchantProductRangePersister.save();
        console.log(`Saved product range for ${merchantName} to local storage`);

        setFetchedMerchants(prev => new Set(prev).add(merchantName));
      } catch (error) {
        console.error(`Error fetching product range for ${merchantName}:`, error);
      }
    } else {
      console.log(`Product range for ${merchantName} already fetched or persister not available, skipping.`);
    }
  }, [merchantProductRangeStore, merchantProductRangePersister, fetchedMerchants]);

  useEffect(() => {
    processFetchQueueRef.current = async () => {
      if (fetchQueue.length > 0 && !isFetchingRef.current) {
        isFetchingRef.current = true;
        const merchantName = fetchQueue[0];
        
        await fetchProductDescriptions(merchantName);
        
        setFetchQueue(prev => prev.slice(1));
        
        // Wait for 5 seconds before processing the next item
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        isFetchingRef.current = false;
        if (processFetchQueueRef.current) {
          processFetchQueueRef.current();
        }
      }
    };
  }, [fetchQueue, fetchProductDescriptions]);

  useEffect(() => {
    if (processFetchQueueRef.current) {
      processFetchQueueRef.current();
    }
  }, [fetchQueue]);

  useEffect(() => {
    const loadMerchantDescriptions = async () => {
      if (merchantDescriptionPersister && merchantProductRangePersister) {
        await merchantDescriptionPersister.load();
        await merchantProductRangePersister.load();
        console.log('Loaded merchant descriptions from local storage');
        
        const storedMerchantNames = merchantDescriptionStore.getTable('merchants');
        const storedProductDescriptions = merchantProductRangeStore.getTable('merchants');
        
        console.log('Stored merchant names:', storedMerchantNames);
        console.log('Stored product descriptions:', storedProductDescriptions);
        
        console.log('Number of stored merchant names:', Object.keys(storedMerchantNames).length);
        console.log('Number of stored product descriptions:', Object.keys(storedProductDescriptions).length);
        
        const merchantsNeedingFetch = Object.keys(storedMerchantNames)
          .filter(merchantName => 
            !storedProductDescriptions[merchantName]?.productDescription && 
            !fetchedMerchants.has(merchantName)
          );
        
        console.log('Merchants needing fetch:', merchantsNeedingFetch);
        
        if (merchantsNeedingFetch.length > 0) {
          console.log('Some merchants need product descriptions, queueing...');
          setFetchQueue(prev => [...prev, ...merchantsNeedingFetch]);
        } else {
          console.log('All merchant descriptions are complete, no need to fetch');
        }
      }
    };

    loadMerchantDescriptions();
  }, [merchantDescriptionPersister, merchantProductRangePersister, merchantDescriptionStore, merchantProductRangeStore, fetchedMerchants]);

  const handleActivateDeal = async (dealId: string, code: string) => {
    const isLoggedIn = !!localWalletAddress || !!address;
    
    if (!isLoggedIn) {
      setError('Please login or connect wallet to activate deals');
      return;
    }

    setActivatingDeal(`${dealId}-${code}`);
    try {
      const userId = localWalletAddress || address;

      if (!userId) {
        throw new Error('No wallet address available');
      }
      
      const response = await fetch('https://us-central1-fourth-buffer-421320.cloudfunctions.net/kindredDealActivation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, dealId }),
      });

      if (!response.ok) {
        throw new Error('Failed to activate deal');
      }

      const data = await response.json();
      if (data.success && data.redirectUrl) {
        const dealKey = `${dealId}-${code}`;
        activatedDealsStore.setCell('activatedDeals', dealKey, 'activated', true);
        await activatedDealsPersister.save();

        setActivatedDeals(prevDeals => new Set(prevDeals).add(dealKey));
        
        window.location.href = data.redirectUrl;
      } else {
        throw new Error('Invalid response from activation endpoint');
      }
    } catch (err) {
      console.error('Error activating deal:', err);
      setError('Failed to activate deal. Please try again later.');
    } finally {
      setActivatingDeal(null);
    }
  };

  const isLoggedIn = !!localWalletAddress || !!address;

  return (
    <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1rem', maxWidth: '28rem', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ textAlign: 'center', color: '#f05e23' }}>Recommended Deals</h2>
      </div>
      
      {filteredMerchants.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#A0AEC0' }}>No matching deals available based on your preferences.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
          {deals.filter(deal => filteredMerchants.includes(deal.merchantName)).map((deal) => (
            <div key={deal.id} style={{ margin: '0.5rem', textAlign: 'center' }}>
              <img 
                src={deal.logoAbsoluteUrl} 
                alt={deal.merchantName} 
                style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '8px',
                  objectFit: 'contain',
                  backgroundColor: 'white',
                  padding: '4px'
                }} 
              />
              <p style={{ color: '#f05e23', fontSize: '0.8rem', marginTop: '0.25rem' }}>{deal.merchantName}</p>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div style={{ color: '#EF4444', textAlign: 'center', marginTop: '1rem' }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default DealsComponent;









