import React, { useState } from 'react';
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { LocalWallet } from "@thirdweb-dev/wallets";
import { Celo, Polygon } from "@thirdweb-dev/chains";

interface CashoutProps {
  localWallet: LocalWallet | null;
  aprilTokenAddress: string;
  celoAprilBalance: string;
  polygonAprilBalance: string;
}

const Cashout: React.FC<CashoutProps> = ({ localWallet, aprilTokenAddress, celoAprilBalance, polygonAprilBalance }) => {
  const [to, setTo] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [selectedChain, setSelectedChain] = useState<'Celo' | 'Polygon'>('Celo');

  const handleCashout = async () => {
    if (!localWallet) {
      setError("Local wallet is not available");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const signer = await localWallet.getSigner();
      
      const chain = selectedChain === 'Celo' ? Celo : Polygon;

      const sdk = ThirdwebSDK.fromSigner(signer, chain, {
        clientId: "e9e236080783bd20fe8db9cb9300c70b", // Replace with your actual client ID
      });

      // Get the contract instance
      const contract = await sdk.getContract(aprilTokenAddress);

      // Perform the transfer
      const result = await contract.erc20.transfer(to, amount);

      console.log("Transfer result:", result);
      setSuccess(true);
    } catch (err) {
      console.error("Transfer error:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '1rem' }}>
      <h2 style={{ color: '#f05e23', marginBottom: '1rem' }}>Cashout APRIL Tokens</h2>
      
      {/* Display APRIL balances */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: '#fff', marginBottom: '0.5rem' }}>Celo APRIL Balance:</p>
          <p style={{ color: '#f05e23', fontWeight: 'bold' }}>{celoAprilBalance}</p>
        </div>
        <div>
          <p style={{ color: '#fff', marginBottom: '0.5rem' }}>Polygon APRIL Balance:</p>
          <p style={{ color: '#f05e23', fontWeight: 'bold' }}>{polygonAprilBalance}</p>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="chain" style={{ display: 'block', marginBottom: '0.5rem', color: '#fff' }}>Select Chain:</label>
        <select
          id="chain"
          value={selectedChain}
          onChange={(e) => setSelectedChain(e.target.value as 'Celo' | 'Polygon')}
          style={{ width: '100%', padding: '0.5rem', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '0.25rem' }}
        >
          <option value="Celo">Celo</option>
          <option value="Polygon">Polygon</option>
        </select>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="to" style={{ display: 'block', marginBottom: '0.5rem', color: '#fff' }}>Recipient Address:</label>
        <input
          id="to"
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '0.25rem' }}
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="amount" style={{ display: 'block', marginBottom: '0.5rem', color: '#fff' }}>Amount:</label>
        <input
          id="amount"
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '0.25rem' }}
        />
      </div>
      <button
        onClick={handleCashout}
        disabled={isLoading || !localWallet}
        style={{
          backgroundColor: '#f05e23',
          color: '#fff',
          padding: '0.75rem 1rem',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: isLoading || !localWallet ? 'not-allowed' : 'pointer',
          opacity: isLoading || !localWallet ? 0.5 : 1,
        }}
      >
        {isLoading ? 'Processing...' : `Cashout on ${selectedChain}`}
      </button>
      {error && <p style={{ color: '#ff4444', marginTop: '1rem' }}>{error}</p>}
      {success && <p style={{ color: '#44ff44', marginTop: '1rem' }}>Transfer successful on {selectedChain}!</p>}
    </div>
  );
};

export default Cashout;
