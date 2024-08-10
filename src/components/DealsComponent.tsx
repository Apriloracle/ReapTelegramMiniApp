import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useIPGeolocation from './IPGeolocation';
import { createStore, Store, Table } from 'tinybase';
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

function isDeal(obj: any): obj is Deal {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.dealId === 'string' &&
    typeof obj.merchantName === 'string' &&
    typeof obj.logo === 'string' &&
    typeof obj.logoAbsoluteUrl === 'string' &&
    typeof obj.cashbackType === 'string' &&
    typeof obj.cashback === 'number' &&
    typeof obj.currency === 'string' &&
    Array.isArray(obj.domains) &&
    Array.isArray(obj.countries) &&
    Array.isArray(obj.codes) &&
    typeof obj.startDate === 'string' &&
    typeof obj.endDate === 'string'
  );
}

const DealsComponent: React.FC = () => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const geolocationData = useIPGeolocation();

  const dealsStore = React.useMemo(() => createStore(), []);
  const dealsPersister = React.useMemo(() => createLocalPersister(dealsStore, 'deals-data'), [dealsStore]);

  useEffect(() => {
    const fetchDeals = async () => {
      if (!geolocationData) return;

      setLoading(true);
      setError(null);

      try {
        // Load data from local storage
        await dealsPersister.load();
        const lastFetchTime = dealsStore.getCell('metadata', 'lastFetch', 'time') as number | undefined;
        
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        if (dealsStore.hasTable('deals') && lastFetchTime && (now - lastFetchTime) < twentyFourHours) {
          // If deals are in local storage and less than 24 hours old, use them
          const storedDeals: Deal[] = [];
          dealsStore.forEachRow('deals', (rowId) => {
            const deal = dealsStore.getRow('deals', rowId);
            if (isDeal(deal)) {
              storedDeals.push(deal);
            }
          });

          if (storedDeals.length > 0) {
            setDeals(storedDeals);
            setLoading(false);
            return;
          }
        }

        // If no valid deals in local storage or deals are older than 24 hours, fetch from API
        const response = await fetch(`https://us-central1-fourth-buffer-421320.cloudfunctions.net/kindredMerchant?countryCode=${geolocationData.countryCode}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch deals');
        }

        const data = await response.json();
        
        if (Array.isArray(data) && data.every(isDeal)) {
          // Store the fetched deals in local storage
          const dealsTable: Table = {};
          data.forEach((deal) => {
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
              endDate: deal.endDate,
            };
          });
          dealsStore.setTable('deals', dealsTable);
          
          // Update the last fetch time
          dealsStore.setCell('metadata', 'lastFetch', 'time', now);
          
          await dealsPersister.save();

          setDeals(data);
        } else {
          throw new Error('Invalid data format received from API');
        }
      } catch (err) {
        setError('Failed to load deals. Please try again later.');
        console.error('Error fetching deals:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, [geolocationData, dealsStore, dealsPersister]);

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#A0AEC0' }}>Loading deals...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', color: '#EF4444' }}>{error}</div>;
  }

  return (
    <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1rem', maxWidth: '28rem', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ textAlign: 'center', color: '#f05e23' }}>Deals for {geolocationData?.countryCode}</h2>
      </div>
      {deals.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#A0AEC0' }}>No deals available for your region.</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {deals.map((deal) => (
            <li key={deal.id} style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#111111', borderRadius: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <img src={deal.logoAbsoluteUrl} alt={deal.merchantName} style={{ width: '40px', height: '40px', marginRight: '1rem', borderRadius: '4px' }} />
                <h3 style={{ color: '#f05e23', margin: 0 }}>{deal.merchantName}</h3>
              </div>
              {deal.cashback > 0 && (
                <p style={{ color: '#22c55e', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Cashback: {deal.cashback} {deal.currency}
                </p>
              )}
              <p style={{ color: '#A0AEC0', marginBottom: '0.5rem' }}>Available codes:</p>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {deal.codes.map((code, index) => (
                  <li key={index} style={{ marginBottom: '0.5rem', backgroundColor: '#1c1c1c', padding: '0.5rem', borderRadius: '4px' }}>
                    <p style={{ color: '#f05e23', fontWeight: 'bold', marginBottom: '0.25rem' }}>{code.code}</p>
                    <p style={{ color: '#A0AEC0', fontSize: '0.9rem' }}>
                      {code.summary.includes("Please note the codes can not be used for orders to") 
                        ? "Restrictions apply in some regions" 
                        : code.summary}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DealsComponent;
