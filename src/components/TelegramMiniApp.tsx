import React, { useEffect, useState } from 'react'
import { useWeb3 } from '@/utils/web3'

declare global {
  interface Window {
    Telegram: any;
  }
}

const TelegramMiniApp: React.FC = () => {
  const [tg, setTg] = useState<any>(null)
  const { web3, account, balance } = useWeb3()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tgApp = window.Telegram?.WebApp
      if (tgApp) {
        setTg(tgApp)
        tgApp.ready()
      }
    }
  }, [])

  // Render your Telegram mini app UI here
  return (
    <div className="bg-gray-100 p-4 max-w-md mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-4">Celo Telegram Mini App</h1>
      {account ? (
        <div>
          <p>Connected Account: {account}</p>
          <p>Balance: {balance} ETH</p>
        </div>
      ) : (
        <p>Not connected to Web3</p>
      )}
      {/* Add more UI components here */}
    </div>
  )
}

export default TelegramMiniApp
