import React, { useEffect, useState, useCallback } from 'react';
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
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activatingDeal, setActivatingDeal] = useState<string | null>(null);
  const geolocationData = useIPGeolocation();

  const dealsStore = React.useMemo(() => createStore(), []);
  const dealsPersister = React.useMemo(() => createLocalPersister(dealsStore, 'kindred-deals'), [dealsStore]);

  // ... (previous useEffects and other logic remain the same)

  const handleActivateDeal = async (dealId: string, code: string) => {
    setActivatingDeal(`${dealId}-${code}`);
    try {
      // In a real application, you'd want to securely manage the userId
      // For this example, we'll use a placeholder
      const userId = 'example-user-id';
      
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

  return (
    <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1rem', maxWidth: '28rem', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {/* ... (header and search input remain the same) */}

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
                  <li key={index} style={{ marginBottom: '1rem', backgroundColor: '#1c1c1c', padding: '0.5rem', borderRadius: '4px' }}>
                    <p style={{ color: '#f05e23', fontWeight: 'bold', marginBottom: '0.25rem' }}>{code.code}</p>
                    <p style={{ color: '#A0AEC0', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      {code.summary.includes("Please note the codes can not be used for orders to") 
                        ? "Restrictions apply in some regions" 
                        : code.summary}
                    </p>
                    <button 
                      onClick={() => handleActivateDeal(deal.dealId, code.code)}
                      disabled={activatingDeal === `${deal.dealId}-${code.code}`}
                      style={{
                        backgroundColor: '#f05e23',
                        color: '#FFFFFF',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: activatingDeal === `${deal.dealId}-${code.code}` ? 'not-allowed' : 'pointer',
                        opacity: activatingDeal === `${deal.dealId}-${code.code}` ? 0.6 : 1,
                        width: '100%'
                      }}
                    >
                      {activatingDeal === `${deal.dealId}-${code.code}` ? 'Activating...' : 'Activate Deal'}
                    </button>
                  </li>
                ))}
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
