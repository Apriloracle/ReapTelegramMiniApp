import React, { useEffect, useState } from 'react'

// Define the structure of the Telegram WebApp object
interface TelegramWebApp {
  ready: () => void;
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    onClick: (callback: () => void) => void;
  };
  showAlert: (message: string) => void;
}

// Declare the global Telegram object
declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const TelegramMiniApp: React.FC = () => {
  const [tg, setTg] = useState<TelegramWebApp | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      setTg(window.Telegram.WebApp)
      window.Telegram.WebApp.ready()
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
