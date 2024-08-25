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
    if (!fetchedMerchants.has(merchantName)) {
      try {
        const response = await axios.post('https://us-central1-fourth-buffer-421320.cloudfunctions.net/chatPplx70b', {
          merchantName,
          temperature: 0.2,
          model: "llama-3.1-sonar-small-128k-chat"
        });

        const productDescription = response.data;
        merchantDescriptionStore.setCell('merchants', merchantName, 'productDescription', productDescription);
        console.log(`Stored product description for: ${merchantName}`);

        await merchantDescriptionPersister.save();
        console.log(`Saved product description for ${merchantName} to local storage`);

        setFetchedMerchants(prev => new Set(prev).add(merchantName));
      } catch (error) {
        console.error(`Error fetching product description for ${merchantName}:`, error);
      }
    } else {
      console.log(`Product description for ${merchantName} already fetched, skipping.`);
    }
  }, [merchantDescriptionStore, merchantDescriptionPersister, fetchedMerchants]);

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
      await merchantDescriptionPersister.load();
      console.log('Loaded merchant descriptions from local storage');
      
      const storedDescriptions = merchantDescriptionStore.getTable('merchants');
      console.log('Stored merchant descriptions:', storedDescriptions);
      
      const merchantsNeedingFetch = Object.entries(storedDescriptions)
        .filter(([merchantName, merchant]) => 
          !merchant.productDescription && 
          !fetchedMerchants.has(merchantName)
        )
        .map(([merchantName]) => merchantName);
      
      if (merchantsNeedingFetch.length > 0) {
        console.log('Some merchants need product descriptions, queueing...');
        setFetchQueue(prev => [...prev, ...merchantsNeedingFetch]);
      } else {
        console.log('All merchant descriptions are complete, no need to fetch');
      }
    };

    loadMerchantDescriptions();
  }, [merchantDescriptionPersister, merchantDescriptionStore, fetchedMerchants]);

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
        <h2 style={{ textAlign: 'center', color: '#f05e23' }}>Shop and earn in {geolocationData?.countryCode}</h2>
      </div>
      
      <input
        type="text"
        placeholder="Search deals..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: '100%',
          padding: '0.5rem',
          marginBottom: '1rem',
          backgroundColor: '#333',
          color: '#fff',
          border: '1px solid #555',
          borderRadius: '4px'
        }}
      />

      {filteredDeals.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#A0AEC0' }}>No deals available for your search.</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {filteredDeals.map((deal) => (
            <li key={deal.id} style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#111111', borderRadius: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <img 
                  src={deal.logoAbsoluteUrl} 
                  alt={deal.merchantName} 
                  style={{ 
                    width: '60px', 
                    height: '60px', 
                    marginRight: '1rem', 
                    borderRadius: '8px',
                    objectFit: 'contain',
                    backgroundColor: 'white',
                    padding: '4px'
                  }} 
                />
                <h3 style={{ color: '#f05e23', margin: 0, fontSize: '1.2rem' }}>{deal.merchantName}</h3>
              </div>
              {deal.cashback > 0 && (
                <p style={{ color: '#22c55e', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Cashback: {deal.cashback} {deal.currency}
                </p>
              )}
              <p style={{ color: '#A0AEC0', marginBottom: '0.5rem' }}>Available codes:</p>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {deal.codes.map((code, index) => {
                  const dealKey = `${deal.dealId}-${code.code}`;
                  const isActivated = activatedDeals.has(dealKey);
                  return (
                    <li key={index} style={{ marginBottom: '1rem', backgroundColor: '#1c1c1c', padding: '0.5rem', borderRadius: '4px' }}>
                      <p style={{ color: '#f05e23', fontWeight: 'bold', marginBottom: '0.25rem' }}>{code.code}</p>
                      <p style={{ color: '#A0AEC0', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        {code.summary.includes("Please note the codes can not be used for orders to") 
                          ? "Restrictions apply in some regions" 
                          : code.summary}
                      </p>
                      <button 
                        onClick={() => handleActivateDeal(deal.dealId, code.code)}
                        disabled={activatingDeal === dealKey || isActivated}
                        style={{
                          backgroundColor: isActivated ? '#22c55e' : '#f05e23',
                          color: '#FFFFFF',
                          padding: '0.5rem 1rem',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: activatingDeal === dealKey || isActivated || !isLoggedIn ? 'not-allowed' : 'pointer',
                          opacity: activatingDeal === dealKey || !isLoggedIn ? 0.6 : 1,
                          width: '100%'
                        }}
                      >
                        {activatingDeal === dealKey 
                          ? 'Activating...' 
                          : isActivated 
                            ? 'Deal Activated' 
                            : 'Activate Deal'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
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










