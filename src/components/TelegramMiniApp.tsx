import React, { useEffect, useState } from 'react'
import { useWeb3 } from '@/utils/web3'
import { useConnect } from 'wagmi'

declare global {
  interface Window {
    Telegram: any;
  }
}

const TelegramMiniApp: React.FC = () => {
  const [tg, setTg] = useState<any>(null)
  const { account, isConnected, balance, chainId } = useWeb3()
  const { connect, connectors } = useConnect()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tgApp = window.Telegram?.WebApp
      if (tgApp) {
        setTg(tgApp)
        tgApp.ready()
      }
    }
  }, [])

  return (
    <div className="bg-gray-100 p-4 max-w-md mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-4">Celo Telegram Mini App</h1>
      {isConnected ? (
        <div>
          <p>Connected Account: {account}</p>
          <p>Balance: {balance} ETH</p>
          <p>Chain ID: {chainId}</p>
        </div>
      ) : (
        <div>
          <p>Not connected to Web3</p>
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => connect({ connector })}
              className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
            >
              Connect with {connector.name}
            </button>
          ))}
        </div>
      )}
      {/* Add more UI components here */}
    </div>
  )
}

export default TelegramMiniApp
