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

interface MerchantDealsComponentProps {
  localWalletAddress: string | null;
  address: string | undefined;
}

const MerchantDealsComponent: React.FC<MerchantDealsComponentProps> = ({ localWalletAddress, address }) => {
  const { merchantName } = useParams<{ merchantName: string }>();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activatedDeals, setActivatedDeals] = useState<Set<string>>(new Set());
  const [activatingDeal, setActivatingDeal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activatedDealsStore = React.useMemo(() => createStore(), []);
  const activatedDealsPersister = React.useMemo(() => createLocalPersister(activatedDealsStore, 'activated-deals'), [activatedDealsStore]);

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

    const loadActivatedDeals = async () => {
      await activatedDealsPersister.load();
      const activatedDealsTable = activatedDealsStore.getTable('activatedDeals');
      if (activatedDealsTable) {
        const activatedDealsSet = new Set(
          Object.entries(activatedDealsTable)
            .filter(([_, value]) => value.activated)
            .map(([key, _]) => key)
        );
        setActivatedDeals(activatedDealsSet);
      }
    };

    loadDeals();
    loadActivatedDeals();
  }, [merchantName, activatedDealsPersister, activatedDealsStore]);

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

  const handleActivateDeal = async (dealId: string, code: string) => {
    setActivatingDeal(`${dealId}-${code}`);
    try {
      const userId = localWalletAddress || address;

      if (!userId) {
        throw new Error('No wallet address available');
      }
      
      const response = await fetch('https://asia-southeast1-fourth-buffer-421320.cloudfunctions.net/kindredDealActivation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: userId,
          dealId: dealId
        }),
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

  const renderCodes = (deal: Deal) => {
    const codesArray = Array.isArray(deal.codes) ? deal.codes : [deal.codes].filter(Boolean);
    
    return codesArray.map((code: Code | undefined, index: number) => {
      if (!code) return null;
      const isDealActivated = activatedDeals.has(`${deal.dealId}-${code.code}`);
      return (
        <div key={code.code || index} style={{ 
          marginTop: '1rem',
          backgroundColor: '#6e3a07',
          borderRadius: '0.5rem',
          padding: '1rem',
        }}>
          <p style={{ color: '#FFFFFF', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{code.summary}</p>
          <button
            onClick={() => handleActivateDeal(deal.dealId, code.code)}
            disabled={activatingDeal === `${deal.dealId}-${code.code}` || isDealActivated}
            style={{
              backgroundColor: isDealActivated ? '#4CAF50' : '#f05e23',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              cursor: isDealActivated ? 'default' : 'pointer',
              opacity: isDealActivated ? 0.8 : 1,
            }}
          >
            {activatingDeal === `${deal.dealId}-${code.code}` ? 'Activating...' : 
             isDealActivated ? 'Activated' : 'Activate Deal'}
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
            <div key={deal.id} style={{ marginBottom: '1rem', backgroundColor: '#3D261B', borderRadius: '0.5rem', padding: '1rem' }}>
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
      {error && <div style={{ color: '#ff4444', marginTop: '1rem' }}>{error}</div>}
    </div>
  );
};

export default MerchantDealsComponent;