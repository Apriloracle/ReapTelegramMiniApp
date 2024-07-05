import React, { useEffect, useState } from 'react'

// Declare the global Telegram object
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        MainButton: {
          setText: (text: string) => void;
          show: () => void;
          onClick: (callback: () => void) => void;
        };
        showAlert: (message: string) => void;
      };
    };
  }
}

const TelegramMiniApp: React.FC = () => {
  const [tg, setTg] = useState<Window['Telegram']['WebApp'] | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tgApp = window.Telegram.WebApp
      setTg(tgApp)
      tgApp.ready()
    }
  }, [])

  useEffect(() => {
    if (tg) {
      tg.MainButton.setText('Click me!')
      tg.MainButton.show()
      tg.MainButton.onClick(() => {
        tg.showAlert('You clicked the main button!')
      })
    }
  }, [tg])

  return (
    <div className="bg-gray-100 p-4 max-w-md mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-4">Celo Telegram Mini App</h1>
      <p className="mb-4">Welcome to our Telegram Mini App!</p>
      <p>Try clicking the main button at the bottom of your screen.</p>
    </div>
  )
}

export default TelegramMiniApp
