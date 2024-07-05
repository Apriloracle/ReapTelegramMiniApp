import React, { useEffect, useState } from 'react';

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
  const [tg, setTg] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      setTg(window.Telegram.WebApp);
      window.Telegram.WebApp.ready();
    }
  }, []);

  useEffect(() => {
    if (tg) {
      tg.MainButton.setText('Open Menu');
      tg.MainButton.show();
      tg.MainButton.onClick(() => {
        tg.showAlert('Menu opened!');
      });
    }
  }, [tg]);

  return (
    <div className="bg-gray-100 p-4 max-w-md mx-auto font-sans pb-16">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Home</h1>
        <button className="text-gray-600">⋮</button>
      </header>

      {/* Balance Card */}
      <div className="bg-orange-500 rounded-3xl p-4 mb-6 text-white">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm opacity-80">Total Balance</p>
            <h2 className="text-4xl font-bold">$5.6</h2>
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

      {/* Referral Banner */}
      <div className="bg-white rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="font-bold">Earn <span className="text-orange-500">80 APRIL</span> per friend invited</p>
        </div>
        <img src="/api/placeholder/80/80" alt="Referral" className="rounded-xl" />
      </div>

      {/* Recommended Section */}
      <section className="mb-6">
        <h3 className="text-xl font-bold mb-4">Recommended</h3>
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
              <p className="text-sm">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Earn History */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Earn History</h3>
          <button className="text-orange-500">View All &gt;</button>
        </div>
        <div className="bg-white rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-4">👥</span>
            <div>
              <p className="font-bold">Referal Bonus</p>
            </div>
          </div>
          <p className="text-green-500 font-bold">+80</p>
        </div>
      </section>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2">
        {[
          { icon: "🏠", label: "Home", active: true },
          { icon: "💰", label: "Earn" },
          { icon: "🎮", label: "Games" },
          { icon: "🏅", label: "Sports" },
        ].map((item, index) => (
          <button key={index} className={`flex flex-col items-center ${item.active ? 'text-orange-500' : 'text-gray-400'}`}>
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs mt-1">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default TelegramMiniApp;
