import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  codes?: Code[] | Code;
}

const MerchantDealsComponent: React.FC = () => {
  const { merchantName } = useParams<{ merchantName: string }>();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activatedDeals, setActivatedDeals] = useState<Set<string>>(new Set());
  const [activatingDeal, setActivatingDeal] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true); // Assume logged in for now

  useEffect(() => {
    const loadDeals = async () => {
      const dealsStore = createStore();
      const dealsPersister = createLocalPersister(dealsStore, 'kindred-deals');
      await dealsPersister.load();

      const dealsTable = dealsStore.getTable('deals');
      if (dealsTable) {
        const merchantDeals = Object.values(dealsTable)
          .filter((deal: any) => deal.merchantName === merchantName)
          .map((deal: any) => ({
            ...deal,
            codes: parseCodes(deal.codes),
          }));
        setDeals(merchantDeals);
      }
    };

    loadDeals();
  }, [merchantName]);

  const parseCodes = (codes: string | Code[] | Code): Code[] => {
    if (typeof codes === 'string') {
      try {
        return JSON.parse(codes);
      } catch (error) {
        console.error('Error parsing codes:', error);
        return [{ code: 'DEFAULT', summary: 'Default offer' }];
      }
    } else if (Array.isArray(codes)) {
      return codes;
    } else if (codes && typeof codes === 'object') {
      return [codes];
    }
    return [{ code: 'DEFAULT', summary: 'Default offer' }];
  };

  const handleActivateDeal = (dealId: string, code: string) => {
    setActivatingDeal(`${dealId}-${code}`);
    setTimeout(() => {
      setActivatedDeals(prev => new Set(prev).add(`${dealId}-${code}`));
      setActivatingDeal(null);
    }, 1000);
  };

  const renderCodes = (deal: Deal) => {
    const codesArray = Array.isArray(deal.codes) ? deal.codes : [deal.codes].filter(Boolean);
    
    return codesArray.map((code: Code | undefined, index: number) => {
      if (!code) return null; // Skip undefined or null codes
      return (
        <div key={code.code || index} style={{ 
          marginTop: '1rem', // Increased spacing between cards
          backgroundColor: '#6e3a07', // Light orange background
          borderRadius: '0.5rem', // Rounded corners
          padding: '1rem', // Padding inside the card
        }}>
          <p style={{ color: '#FFFFFF', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{code.summary}</p>
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
      );
    });
  };

  return (
    <div style={{ padding: '1rem', backgroundColor: '#000000', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/deals')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ color: '#f05e23', margin: 0 }}>{merchantName} Deals</h2>
      </div>
      
      {deals.length > 0 ? (
        <div>
          {deals.map((deal) => (
            <div key={deal.id} style={{ marginBottom: '1rem', backgroundColor: '#130B03', borderRadius: '0.5rem', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <img 
                  src={deal.logoAbsoluteUrl || deal.logo} 
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
              {renderCodes(deal)}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#A0AEC0' }}>No deals available for this merchant at the moment.</p>
      )}
    </div>
  );
};

export default MerchantDealsComponent;
