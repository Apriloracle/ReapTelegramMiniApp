import React, { useEffect, useState } from 'react'
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi'
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

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

const DAILY_TAP_LIMIT = 1000;
const RESET_MINUTES = 60;

const TelegramMiniApp: React.FC = () => {
  const [tg, setTg] = useState<TelegramWebApp | null>(null)
  const { address } = useAccount()

  const [score, setScore] = useState<number>(0);
  const [dailyTaps, setDailyTaps] = useState<number>(0);
  const [isDailyLimitReached, setIsDailyLimitReached] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const store = React.useMemo(() => createStore(), []);
  const dailyStore = React.useMemo(() => createStore(), []);
  const persister = React.useMemo(() => createLocalPersister(store, 'celon-stats'), [store]);
  const dailyPersister = React.useMemo(() => createLocalPersister(dailyStore, 'celon-daily-stats'), [dailyStore]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tgApp = window.Telegram.WebApp
      setTg(tgApp)
      tgApp.ready()
    }

    // Initialize stores with default values
    store.setTables({
      stats: { clicks: { count: 0 } }
    });
    dailyStore.setTables({
      dailyStats: { clicks: { count: 0, lastReset: new Date().toISOString() } }
    });

    // Load persisted data
    loadPersistedData();

    // Add listeners for score changes
    const scoreListenerId = store.addCellListener(
      'stats',
      'clicks',
      'count',
      (_, __, ___, ____, newValue) => {
        setScore(newValue as number);
        console.log('Score updated:', newValue);
        persister.save().catch(console.error);
      }
    );

    dailyStore.addCellListener(
      'dailyStats',
      'clicks',
      'count',
      (_, __, ___, ____, newValue) => {
        const newDailyTaps = newValue as number;
        setDailyTaps(newDailyTaps);
        setIsDailyLimitReached(newDailyTaps >= DAILY_TAP_LIMIT);
        console.log('Daily taps updated:', newDailyTaps);
        dailyPersister.save().catch(console.error);
      }
    );

    // Check for reset every minute
    const intervalId = setInterval(() => {
      const lastReset = new Date(dailyStore.getCell('dailyStats', 'clicks', 'lastReset') as string);
      if (shouldResetDailyTaps(lastReset)) {
        resetDailyTaps();
      }
    }, 60000);

    // Cleanup
    return () => {
      store.delListener(scoreListenerId);
      persister.destroy();
      dailyPersister.destroy();
      clearInterval(intervalId);
    };
  }, [])

  const loadPersistedData = async () => {
    try {
      await persister.load();
      await dailyPersister.load();
      
      const loadedScore = store.getCell('stats', 'clicks', 'count') as number;
      const loadedDailyTaps = dailyStore.getCell('dailyStats', 'clicks', 'count') as number;
      const lastReset = new Date(dailyStore.getCell('dailyStats', 'clicks', 'lastReset') as string || new Date().toISOString());
      
      if (shouldResetDailyTaps(lastReset)) {
        resetDailyTaps();
      } else {
        setScore(loadedScore);
        setDailyTaps(loadedDailyTaps);
        setIsDailyLimitReached(loadedDailyTaps >= DAILY_TAP_LIMIT);
      }
      
      console.log('Loaded score:', loadedScore, 'Daily taps:', loadedDailyTaps);
    } catch (error) {
      console.error('Error loading persisted data:', error);
    }
  };

  const shouldResetDailyTaps = (lastReset: Date): boolean => {
    const now = new Date();
    const diffMinutes = (now.getTime() - lastReset.getTime()) / (1000 * 60);
    return diffMinutes >= RESET_MINUTES;
  };

  const resetDailyTaps = () => {
    dailyStore.setCell('dailyStats', 'clicks', 'count', 0);
    dailyStore.setCell('dailyStats', 'clicks', 'lastReset', new Date().toISOString());
    setDailyTaps(0);
    setIsDailyLimitReached(false);
  };

  const handleTransfer = async () => {
    if (isDailyLimitReached) {
      setError("Tap limit reached. Please try again in a few minutes.");
      return;
    }

    try {
      if (!address) {
        throw new Error("Celo address not found");
      }

      // Call the cloud function for ERC20 transfer
      const response = await fetch('https://us-central1-fourth-buffer-421320.cloudfunctions.net/handleTap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error('Failed to process the tap');
      }

      const result = await response.json();

      if (result.success) {
        // Update the score in Tinybase
        const currentScore = store.getCell('stats', 'clicks', 'count') as number;
        const newScore = currentScore + 1;
        store.setCell('stats', 'clicks', 'count', newScore);
        
        // Update daily taps
        const currentDailyTaps = dailyStore.getCell('dailyStats', 'clicks', 'count') as number;
        const newDailyTaps = currentDailyTaps + 1;
        dailyStore.setCell('dailyStats', 'clicks', 'count', newDailyTaps);

        setError(null);
        console.log('Tap processed successfully');
      } else {
        throw new Error(result.message || 'Unknown error occurred');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('Error processing tap:', err);
    }
  };

  return (
    <div style={{ backgroundColor: '#1F2937', color: '#E5E7EB', padding: '1rem', maxWidth: '28rem', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {/* ConnectKit Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <ConnectKitButton />
      </div>

      {/* Score Card */}
      <div style={{ backgroundColor: '#374151', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
          <svg style={{ width: '2rem', height: '2rem', color: '#F59E0B', marginRight: '0.5rem' }} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 011-1h1V7a1 1 0 012 0v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H8a1 1 0 01-1-1z" clipRule="evenodd" fillRule="evenodd"></path>
          </svg>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#F9FAFB' }}>{score}</p>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#D1D5DB' }}>Current Score</p>
      </div>

      {/* Tap Button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', width: '13rem', height: '13rem' }}>
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'linear-gradient(135deg, #f05e23, #d54d1b)', 
            borderRadius: '9999px', 
            opacity: 0.3, 
            animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
          }}></div>
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'linear-gradient(135deg, #f05e23, #d54d1b)', 
            borderRadius: '9999px', 
            opacity: 0.3, 
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', 
            animationDelay: '0.5s'
          }}></div>
          <button
            onClick={handleTransfer}
            disabled={isDailyLimitReached}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #f05e23, #d54d1b)',
              color: 'white',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              border: 'none',
              cursor: isDailyLimitReached ? 'not-allowed' : 'pointer',
              transition: 'all 300ms ease-in-out',
              boxShadow: '0 10px 20px rgba(240,94,35,0.3), inset 0 -5px 10px rgba(0,0,0,0.2), 0 0 0 6px rgba(240,94,35,0.2), 0 0 0 12px rgba(240,94,35,0.1)',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              transform: 'translateY(0)',
              opacity: isDailyLimitReached ? 0.5 : 1,
            }}
          >
            <span style={{
              position: 'relative',
              zIndex: 2,
            }}>
              {isDailyLimitReached ? 'Limit Reached' : 'Tap to earn'}
            </span>
            <div style={{
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius: '9999px',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)',
              opacity: 1,
              transition: 'opacity 300ms ease-in-out',
            }}></div>
          </button>
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#D1D5DB' }}>
          Taps: {dailyTaps} / {DAILY_TAP_LIMIT}
        </p>
        {error && (
          <p style={{ marginTop: '0.5rem', color: '#EF4444', fontSize: '0.875rem' }}>{error}</p>
        )}
      </div>
    </div>
  )
}

export default TelegramMiniApp
