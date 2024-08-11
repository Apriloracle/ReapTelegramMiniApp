import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useIPGeolocation from './IPGeolocation';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import { useAccount } from 'wagmi';

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
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const geolocationData = useIPGeolocation();
  const { address } = useAccount();
  const [activatingDeal, setActivatingDeal] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);

  const dealsStore = React.useMemo(() => createStore(), []);
  const dealsPersister = React.useMemo(() => createLocalPersister(dealsStore, 'kindred-deals'), [dealsStore]);

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
    // ... (rest of the useEffect for fetching and storing deals remains the same)
  }, [geolocationData, dealsStore, dealsPersister]);

  const activateDeal = async (dealId: string) => {
    if (!address) {
      setActivationError("Please connect your wallet to activate deals.");
      return;
    }

    setActivatingDeal(dealId);
    setActivationError(null);

    try {
      const response = await fetch('https://us-central1-fourth-buffer-421320.cloudfunctions.net/kindredDealActivation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: address, dealId }),
      });

      if (!response.ok) {
        throw new Error('Failed to activate deal');
      }

      const data = await response.json();
      if (data.success && data.redirectUrl) {
        window.open(data.redirectUrl, '_blank');
      } else {
        throw new Error('Invalid response from activation service');
      }
    } catch (err) {
      console.error('Error activating deal:', err);
      setActivationError('Failed to activate deal. Please try again.');
    } finally {
      setActivatingDeal(null);
    }
  };

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

      {activationError && (
        <div style={{ backgroundColor: '#FEE2E2', color: '#EF4444', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem' }}>
          {activationError}
        </div>
      )}

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
              <button
                onClick={() => activateDeal(deal.dealId)}
                disabled={activatingDeal === deal.dealId}
                style={{
                  backgroundColor: '#f05e23',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: activatingDeal === deal.dealId ? 'not-allowed' : 'pointer',
                  opacity: activatingDeal === deal.dealId ? 0.7 : 1,
                  marginTop: '1rem',
                  width: '100%',
                }}
              >
                {activatingDeal === deal.dealId ? 'Activating...' : 'Activate Deal'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DealsComponent;
