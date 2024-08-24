import React from 'react';

interface BalanceCardProps {
  totalBalance: number;
  availableApril: {
    value: string;
    display: string;
  };
}

const BalanceCard: React.FC<BalanceCardProps> = ({ totalBalance, availableApril }) => {
  const formatUsdBalance = (balance: number): string => {
    return balance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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
        <button style={{
          backgroundColor: 'white',
          color: '#f05e23',
          border: 'none',
          borderRadius: '20px',
          padding: '8px 16px',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}>
          Cashout
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '8px', flex: 1, marginRight: '8px' }}>
          <div style={{ fontSize: '12px' }}>Available APRIL</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{availableApril.display}</div>
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;
