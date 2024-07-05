import React, { useEffect, useState } from 'react'
import { useWeb3 } from '@/utils/web3'
import { useConnect } from 'wagmi'

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
  const { account, isConnected, balance, chainId } = useWeb3()
  const { connect, connectors } = useConnect()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tgApp = window.Telegram.WebApp
      setTg(tgApp)
      tgApp.ready()
    }
  }, [])

  useEffect(() => {
    if (tg) {
      tg.MainButton.setText('Connect Wallet')
      tg.MainButton.show()
      tg.MainButton.onClick(() => {
        if (!isConnected && connectors.length > 0) {
          connect({ connector: connectors[0] })
        } else {
          tg.showAlert(isConnected ? 'Already connected!' : 'No connectors available')
        }
      })
    }
  }, [tg, isConnected, connect, connectors])

  return (
    <div className="bg-gray-100 p-4 max-w-md mx-auto font-sans pb-16">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Home</h1>
        <button className="text-gray-600 text-2xl">⋮</button>
      </header>

      {/* Balance Card */}
      <div className="bg-orange-500 rounded-3xl p-4 mb-6 text-white">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm opacity-80">Total Balance</p>
            <h2 className="text-4xl font-bold">${isConnected ? balance : '0.00'}</h2>
          </div>
          <button className="bg-white text-orange-500 px-4 py-2 rounded-full flex items-center">
            Cashout 💼
          </button>
        </div>
        <div className="flex justify-between">
          <div className="bg-orange-400 rounded-xl p-2 flex items-center">
            <span className="mr-2">💼</span>
            <div>
              <p className="text-xs opacity-80">Available APRIL</p>
              <p className="font-bold">4000</p>
            </div>
          </div>
          <div className="bg-orange-400 rounded-xl p-2 flex items-center">
            <span className="mr-2">💳</span>
            <div>
              <p className="text-xs opacity-80">Pending APRIL</p>
              <p className="font-bold">15.0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Web3 Connection Status */}
      <div className="bg-white rounded-xl p-4 mb-6">
        {isConnected ? (
          <div>
            <p className="font-bold mb-2">Connected to Web3</p>
            <p className="text-sm">Account: {account?.slice(0, 6)}...{account?.slice(-4)}</p>
            <p className="text-sm">Chain ID: {chainId}</p>
          </div>
        ) : (
          <div>
            <p className="font-bold mb-2">Not connected to Web3</p>
            <p className="text-sm">Connect using the button at the bottom of the screen</p>
          </div>
        )}
      </div>

      {/* Referral Banner */}
      <div className="bg-white rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="font-bold">Earn <span className="text-orange-500">80 APRIL</span> per friend invited</p>
        </div>
        <img src="/api/placeholder/80/80" alt="Referral" className="rounded-xl" />
      </div>

      {/* Recommended Section */}
      <section className="mb-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Recommended</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: "⚽", label: "Sports" },
            { icon: "🛒", label: "Shopping" },
            { icon: "📝", label: "Survey" },
            { icon: "💱", label: "Crypto to Fiat" },
            { icon: "🎟️", label: "Vouchers" },
            { icon: "📡", label: "Airtime/data" },
          ].map((item, index) => (
            <div key={index} className="bg-white rounded-xl p-4 flex flex-col items-center justify-center">
              <span className="text-2xl mb-2">{item.icon}</span>
              <p className="text-sm text-gray-600">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Navigation is handled by Telegram's native UI */}
    </div>
  )
}

export default TelegramMiniApp
