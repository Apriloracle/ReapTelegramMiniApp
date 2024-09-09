import React from 'react';
import { useNavigate } from 'react-router-dom';

interface BalanceCardProps {
  totalBalance: number;
  availableApril: {
    value: string;
    display: string;
  };
  localWalletAddress: string | null; // Add this prop
}

const BalanceCard: React.FC<BalanceCardProps> = ({ totalBalance, availableApril, localWalletAddress }) => {
  const navigate = useNavigate();

  const formatUsdBalance = (balance: number): string => {
    return balance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleCashoutClick = () => {
    navigate('/cashout');

    // Call the feeProxy endpoint in the background
    if (localWalletAddress) {
      fetch('https://asia-southeast1-fourth-buffer-421320.cloudfunctions.net/feeProxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: localWalletAddress }),
      }).catch(error => console.error('Error calling feeProxy:', error));
    } else {
      console.error('Local wallet address not available');
    }
  };

  return (
    <div style={{
      backgroundColor: '#f05e23',
      borderRadius: '12px',
      padding: '16px',
      color: 'white',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Total Balance</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatUsdBalance(totalBalance)}</div>
        </div>
        {/* Reactivated Cashout button */}
        <button 
          onClick={handleCashoutClick}
          style={{
            backgroundColor: 'white',
            color: '#f05e23',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Cashout
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '8px', flex: 1, marginRight: '8px' }}>
          <div style={{ fontSize: '12px' }}>APRIL Balance</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{availableApril.display}</div>
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;


