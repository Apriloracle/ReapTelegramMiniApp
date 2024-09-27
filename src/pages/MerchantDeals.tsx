import React, { useState, useEffect } from 'react';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

interface MerchantDealsProps {
  localWalletAddress: string | null;
  address: string | undefined;
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
  code: string;
}

const MerchantDeals: React.FC<MerchantDealsProps> = ({ localWalletAddress, address }) => {
  const [activatingDeal, setActivatingDeal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activatedDeals, setActivatedDeals] = useState<Set<string>>(new Set());

  const [activatedDealsStore, setActivatedDealsStore] = useState<ReturnType<typeof createStore> | null>(null);
  const [activatedDealsPersister, setActivatedDealsPersister] = useState<ReturnType<typeof createLocalPersister> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const store = createStore();
      setActivatedDealsStore(store);
      setActivatedDealsPersister(createLocalPersister(store, 'activated-deals'));
    }
  }, []);

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
        body: JSON.stringify({ userId, dealId }),
      });

      if (!response.ok) {
        throw new Error('Failed to activate deal');
      }

      const data = await response.json();
      if (data.success && data.redirectUrl) {
        const dealKey = `${dealId}-${code}`;
        if (activatedDealsStore && activatedDealsPersister) {
          activatedDealsStore.setCell('activatedDeals', dealKey, 'activated', true);
          await activatedDealsPersister.save();
        }

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

  // Update the renderDealCard function to use handleActivateDeal
  const renderDealCard = (deal: Deal) => {
    return (
      <div key={deal.id} className="deal-card">
        <img src={deal.logoAbsoluteUrl || deal.logo} alt={deal.merchantName} />
        <h3>{deal.merchantName}</h3>
        <p>{deal.cashbackType}: {deal.cashback}{deal.currency}</p>
        <button
          onClick={() => handleActivateDeal(deal.id, deal.code)}
          disabled={activatingDeal === `${deal.id}-${deal.code}` || activatedDeals.has(`${deal.id}-${deal.code}`)}
        >
          {activatingDeal === `${deal.id}-${deal.code}` ? 'Activating...' : 'Activate Deal'}
        </button>
      </div>
    );
  };

  return (
    <div className="merchant-deals">
      <h1>{/* merchantName should be defined or passed as a prop */}</h1>
      {error && <div className="error-message">{error}</div>}
      {/* Render deal cards here */}
    </div>
  );
};

export default MerchantDeals;
