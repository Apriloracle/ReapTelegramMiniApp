import React, { useEffect, useState } from 'react'
import { ConnectWallet, useConnect, useAddress, useChain, useBalance } from "@thirdweb-dev/react";
import { client } from "./client" // Make sure to create this client file

interface TelegramWebApp {
  ready: () => void;
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    onClick: (callback: () => void) => void;
  };
  showAlert: (message: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const TelegramMiniApp: React.FC = () => {
  const [tg, setTg] = useState<TelegramWebApp | null>(null)
  const address = useAddress();
  const { data: balance } = useBalance();
  const chain = useChain();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tgApp = window.Telegram.WebApp
      setTg(tgApp)
      tgApp.ready()
    }
  }, [])

  return (
    <div style={{ backgroundColor: '#1F2937', color: '#E5E7EB', padding: '1rem', maxWidth: '28rem', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#F9FAFB' }}>Home</h1>
        <button style={{ fontSize: '1.5rem', background: 'none', border: 'none', color: '#E5E7EB' }}>⋮</button>
      </header>

      <div style={{ backgroundColor: '#4B5563', borderRadius: '1.5rem', padding: '1rem', marginBottom: '1.5rem', color: '#F9FAFB' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>Total Balance</p>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 'bold', margin: '0' }}>${balance ? balance.displayValue : '0.00'}</h2>
          </div>
          <button style={{ backgroundColor: '#F9FAFB', color: '#4B5563', padding: '0.5rem 1rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', border: 'none', cursor: 'pointer' }}>
            Cashout 💼
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ backgroundColor: '#374151', borderRadius: '0.75rem', padding: '0.5rem', display: 'flex', alignItems: 'center', flex: '1', marginRight: '0.5rem' }}>
            <span style={{ marginRight: '0.5rem' }}>💼</span>
            <div>
              <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0' }}>Available APRIL</p>
              <p style={{ fontWeight: 'bold', margin: '0' }}>4000</p>
            </div>
          </div>
          <div style={{ backgroundColor: '#374151', borderRadius: '0.75rem', padding: '0.5rem', display: 'flex', alignItems: 'center', flex: '1', marginLeft: '0.5rem' }}>
            <span style={{ marginRight: '0.5rem' }}>💳</span>
            <div>
              <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0' }}>Pending APRIL</p>
              <p style={{ fontWeight: 'bold', margin: '0' }}>15.0</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#374151', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
        {address ? (
          <div>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#F9FAFB' }}>Connected to Web3</p>
            <p style={{ fontSize: '0.875rem' }}>Account: {address.slice(0, 6)}...{address.slice(-4)}</p>
            <p style={{ fontSize: '0.875rem' }}>Chain: {chain?.name || 'Unknown'}</p>
          </div>
        ) : (
          <div>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#F9FAFB' }}>Not connected to Web3</p>
            <p style={{ fontSize: '0.875rem' }}>Connect using the button below</p>
          </div>
        )}
      </div>

      {/* Thirdweb Connect Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <ConnectWallet />
      </div>

      <div style={{ backgroundColor: '#374151', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontWeight: 'bold', color: '#F9FAFB' }}>Earn <span style={{ color: '#FCD34D' }}>80 APRIL</span> per friend invited</p>
        </div>
        <img src="/api/placeholder/80/80" alt="Referral" style={{ borderRadius: '0.75rem', width: '80px', height: '80px' }} />
      </div>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#F9FAFB' }}>Recommended</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[
            { icon: "⚽", label: "Sports" },
            { icon: "🛒", label: "Shopping" },
            { icon: "📝", label: "Survey" },
            { icon: "💱", label: "Crypto to Fiat" },
            { icon: "🎟️", label: "Vouchers" },
            { icon: "📡", label: "Airtime/data" },
          ].map((item, index) => (
            <div key={index} style={{ backgroundColor: '#374151', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{item.icon}</span>
              <p style={{ fontSize: '0.875rem', color: '#D1D5DB', margin: '0', textAlign: 'center' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default TelegramMiniApp
