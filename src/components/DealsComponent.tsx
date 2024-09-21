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
  }, [geolocationData, dealsStore, dealsPersister]);

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ textAlign: 'center', color: '#f05e23', flex: 1 }}>Deals For You</h2>
      </div>

      {/* All Deals */}
      <div>
        <h3 style={{ color: '#f05e23', marginBottom: '1rem' }}>All Deals</h3>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#130B03' }}>Loading deals...</p>
        ) : (
          <div>
            {filteredDeals.map((deal) => (
              <div key={deal.id} style={{ marginBottom: '1rem', backgroundColor: '#130B03', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <img 
                    src={deal.logoAbsoluteUrl} 
                    alt={deal.merchantName} 
                    style={{ 
                      width: '50px', 
                      height: '50px', 
                      borderRadius: '8px',
                      objectFit: 'contain',
                      backgroundColor: 'white',
                      padding: '4px',
                      marginRight: '1rem'
                    }} 
                  />
                  <div>
                    <p style={{ color: '#f05e23', fontSize: '1rem', fontWeight: 'bold' }}>{deal.merchantName}</p>
                    <p style={{ color: '#A0AEC0', fontSize: '0.8rem' }}>{deal.cashbackType}: {deal.cashback}{deal.currency}</p>
                  </div>
                </div>
                {deal.codes.map((code) => (
                  <div key={code.code} style={{ marginTop: '0.5rem' }}>
                    <p style={{ color: '#FFFFFF', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{code.summary}</p>
                    <button
                      onClick={() => handleActivateDeal(deal.id, code.code)}
                      disabled={!isLoggedIn || activatedDeals.has(`${deal.id}-${code.code}`) || activatingDeal === `${deal.id}-${code.code}`}
                      style={{
                        backgroundColor: '#f05e23',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '0.25rem',
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        cursor: isLoggedIn ? 'pointer' : 'not-allowed',
                        opacity: activatedDeals.has(`${deal.id}-${code.code}`) ? 0.5 : 1,
                      }}
                    >
                      {activatedDeals.has(`${deal.id}-${code.code}`) ? 'Activated' : 'Activate Deal'}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#EF4444', textAlign: 'center', marginTop: '1rem', padding: '0.75rem', backgroundColor: '#FEE2E2', borderRadius: '0.375rem' }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default DealsComponent;













