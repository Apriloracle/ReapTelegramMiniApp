import React, { useEffect, useState } from 'react'
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi'
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import WebApp from '@twa-dev/sdk'
import { LocalWallet } from "@thirdweb-dev/wallets";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import PeerSync from './PeerSync';
import DealsComponent from './DealsComponent';
import SurveyQuestion from './SurveyQuestion';
import ProfilePage from './ProfilePage';

const DAILY_TAP_LIMIT = 1000;
const RESET_MINUTES = 60;
const TELEGRAM_BOT_URL = 'https://t.me/Reapmini_bot';
const SHARE_URL = 'https://t.me/share/url?url=https://t.me/Reapmini_bot&text=%F0%9F%92%B0Reap%20Mini%3A%20Tap%2C%20Earn%2C%20Grow%20-%20Where%20Every%20Tap%20Leads%20to%20Crypto%20Rewards!%0A%F0%9F%8E%81Let%27s%20start%20earning%20now!';

const TelegramMiniApp: React.FC = () => {
  const [webApp, setWebApp] = useState<any>(null);
  const { address } = useAccount()

  const [score, setScore] = useState<number>(0);
  const [dailyTaps, setDailyTaps] = useState<number>(0);
  const [isDailyLimitReached, setIsDailyLimitReached] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [shares, setShares] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [localWallet, setLocalWallet] = useState<LocalWallet | null>(null);
  const [localWalletAddress, setLocalWalletAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showSurvey, setShowSurvey] = useState<boolean>(false);

  const clickStore = React.useMemo(() => createStore(), []);
  const shareStore = React.useMemo(() => createStore(), []);
  const dailyStore = React.useMemo(() => createStore(), []);
  const clickPersister = React.useMemo(() => createLocalPersister(clickStore, 'celon-click-stats'), [clickStore]);
  const sharePersister = React.useMemo(() => createLocalPersister(shareStore, 'celon-share-stats'), [shareStore]);
  const dailyPersister = React.useMemo(() => createLocalPersister(dailyStore, 'celon-daily-stats'), [dailyStore]);

  useEffect(() => {
    const initWebApp = () => {
      try {
        setWebApp(WebApp);
        WebApp.ready();

        const searchParams = new URLSearchParams(WebApp.initData);
        const userDataStr = searchParams.get('user');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          setUserId(userData.id.toString());
          console.log('User ID:', userData.id);
        } else {
          console.error('User data not found in initData');
        }
      } catch (error) {
        console.error('Failed to initialize WebApp:', error);
      }
    };

    initWebApp();

    clickStore.setTables({
      stats: { clicks: { count: 0 } }
    });
    shareStore.setTables({
      stats: { shares: { count: 0 } }
    });
    dailyStore.setTables({
      dailyStats: { clicks: { count: 0, lastReset: new Date().toISOString() } }
    });

    loadPersistedData();

    const scoreListenerId = clickStore.addCellListener(
      'stats',
      'clicks',
      'count',
      (_, __, ___, ____, newValue) => {
        setScore(newValue as number);
        console.log('Score updated:', newValue);
        clickPersister.save().catch(console.error);
      }
    );

    const shareListenerId = shareStore.addCellListener(
      'stats',
      'shares',
      'count',
      (_, __, ___, ____, newValue) => {
        setShares(newValue as number);
        console.log('Shares updated:', newValue);
        sharePersister.save().catch(console.error);
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

    const intervalId = setInterval(() => {
      const lastReset = new Date(dailyStore.getCell('dailyStats', 'clicks', 'lastReset') as string);
      if (shouldResetDailyTaps(lastReset)) {
        resetDailyTaps();
      }
    }, 60000);

    return () => {
      clickStore.delListener(scoreListenerId);
      shareStore.delListener(shareListenerId);
      clickPersister.destroy();
      sharePersister.destroy();
      dailyPersister.destroy();
      clearInterval(intervalId);
    };
  }, []);

  const loadPersistedData = async () => {
    try {
      await clickPersister.load();
      await sharePersister.load();
      await dailyPersister.load();
      
      const loadedScore = clickStore.getCell('stats', 'clicks', 'count') as number;
      const loadedShares = shareStore.getCell('stats', 'shares', 'count') as number;
      const loadedDailyTaps = dailyStore.getCell('dailyStats', 'clicks', 'count') as number;
      const lastReset = new Date(dailyStore.getCell('dailyStats', 'clicks', 'lastReset') as string || new Date().toISOString());
      
      if (shouldResetDailyTaps(lastReset)) {
        resetDailyTaps();
      } else {
        setScore(loadedScore);
        setShares(loadedShares);
        setDailyTaps(loadedDailyTaps);
        setIsDailyLimitReached(loadedDailyTaps >= DAILY_TAP_LIMIT);
      }
      
      console.log('Loaded score:', loadedScore, 'Shares:', loadedShares, 'Daily taps:', loadedDailyTaps);
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

  const handleLogin = async () => {
    if (!userId) {
      setError("User ID not available. Please try reloading the app.");
      return;
    }
    setLoading(true);
    try {
      let wallet = new LocalWallet();
      
      try {
        await wallet.load({
          strategy: "encryptedJson",
          password: userId,
        });
        console.log('Existing wallet loaded');
      } catch (loadError) {
        console.log('No existing wallet found, creating new one');
        await wallet.generate();
        await wallet.save({
          strategy: "encryptedJson",
          password: userId,
        });
      }

      await wallet.connect();
      setLocalWallet(wallet);
      const walletAddress = await wallet.getAddress();
      setLocalWalletAddress(walletAddress);
      console.log('Wallet connected. Address:', walletAddress);
    } catch (error) {
      console.error("Error handling login:", error);
      setError("Failed to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (localWallet) {
      try {
        await localWallet.disconnect();
        setLocalWallet(null);
        setLocalWalletAddress(null);
        console.log('Disconnected from local wallet');
      } catch (error) {
        console.error("Error disconnecting local wallet:", error);
        setError("Failed to disconnect local wallet. Please try again.");
      }
    }
  };

  const handleTransfer = async () => {
  if (isDailyLimitReached) {
    setError("Tap limit reached. Please try again in a few minutes.");
    return;
  }

  try {
    const walletAddress = localWalletAddress || address;
    if (!walletAddress) {
      throw new Error("No wallet connected");
    }

    const response = await fetch('https://nodejsapiproxy-production.up.railway.app/handleTap1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: walletAddress }),
    });

    if (!response.ok) {
      throw new Error('Failed to process the tap');
    }

    const result = await response.json();

    if (result.success) {
      const currentScore = clickStore.getCell('stats', 'clicks', 'count') as number;
      const newScore = currentScore + 1;
      clickStore.setCell('stats', 'clicks', 'count', newScore);
      
      const currentDailyTaps = dailyStore.getCell('dailyStats', 'clicks', 'count') as number;
      const newDailyTaps = currentDailyTaps + 1;
      dailyStore.setCell('dailyStats', 'clicks', 'count', newDailyTaps);

      setError(null);
      console.log('Tap processed successfully');

      // Randomly show a survey question (1% chance)
      if (Math.random() < 0.01) {
        setShowSurvey(true);
      }
    } else {
      throw new Error(result.message || 'Unknown error occurred');
    }

  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
    console.error('Error processing tap:', err);
  }
};

  const handleShare = async () => {
    try {
      if (WebApp && WebApp.openTelegramLink) {
        await WebApp.openTelegramLink(SHARE_URL);
      } else {
        window.open(SHARE_URL, '_blank');
      }

      const currentShares = shareStore.getCell('stats', 'shares', 'count') as number;
      const newShares = currentShares + 1;
      shareStore.setCell('stats', 'shares', 'count', newShares);

      console.log('Share processed successfully');
    } catch (err) {
      console.error('Error processing share:', err);
    }
  };

  const handleConnectionStatus = (status: boolean) => {
    setIsConnected(status);
  };

  const handleSurveyResponse = async (question: string, response: string) => {
    console.log(`Survey question: ${question}`);
    console.log(`Survey response: ${response}`);
    // Here you would typically send the survey response to your backend
    // For example:
    // await updateUserPreferences(userId, question, response);
  };

  const MainPage: React.FC = () => {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <button 
            onClick={handleLogin}
            disabled={loading || !!localWalletAddress}
            style={{
              backgroundColor: 'black',
              color: '#f05e23',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '2px solid #f05e23',
              cursor: loading || !!localWalletAddress ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              opacity: loading || !!localWalletAddress ? 0.5 : 1,
            }}
          >
            {loading ? 'Connecting...' : (localWalletAddress ? 'Logged In' : 'Login')}
          </button>
        </div>

        {localWalletAddress && (
          <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.8rem', color: '#A0AEC0', wordBreak: 'break-all' }}>
            Local Wallet: {localWalletAddress}
          </div>
        )}
        
        {!localWalletAddress && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <ConnectKitButton theme="retro" customTheme={{
              "--ck-connectbutton-background": "black",
              "--ck-connectbutton-color": "#f05e23",
              "--ck-connectbutton-border-radius": "0.375rem",
              "--ck-connectbutton-border-color": "#f05e23",
              "--ck-connectbutton-hover-color": "#f05e23",
              "--ck-connectbutton-active-color": "#f05e23",
            }} />
          </div>
        )}

        <div style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <svg style={{ width: '2rem', height: '2rem', color: '#F59E0B', marginRight: '0.5rem' }} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
               <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 011-1h1V7a1 1 0 012 0v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H8a1 1 0 01-1-1z" clipRule="evenodd" fillRule="evenodd"></path>
            </svg>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFFFFF' }}>{score}</p>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#A0AEC0' }}></p>
        </div>

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
              disabled={isDailyLimitReached || (!localWalletAddress && !address)}
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
                cursor: isDailyLimitReached || (!localWalletAddress && !address) ? 'not-allowed' : 'pointer',
                transition: 'all 300ms ease-in-out',
                boxShadow: '0 10px 20px rgba(240,94,35,0.3), inset 0 -5px 10px rgba(0,0,0,0.2), 0 0 0 6px rgba(240,94,35,0.2), 0 0 0 12px rgba(240,94,35,0.1)',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                transform: 'translateY(0)',
                opacity: isDailyLimitReached || (!localWalletAddress && !address) ? 0.5 : 1,
              }}
            >
              <span style={{
                position: 'relative',
                zIndex: 2,
              }}>
                {isDailyLimitReached ? 'Limit Reached' : (!localWalletAddress && !address ? 'Connect Wallet' : 'Tap to earn')}
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
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#A0AEC0' }}>
             {dailyTaps} / {DAILY_TAP_LIMIT}
          </p>
          {error && (
            <p style={{ marginTop: '0.5rem', color: '#EF4444', fontSize: '0.875rem' }}>{error}</p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={handleShare}
            style={{
              background: 'black',
              color: '#f05e23',
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              fontSize: '1rem',
              fontWeight: 'bold',
              border: '2px solid #f05e23',
              cursor: 'pointer',
              transition: 'all 300ms ease-in-out',
              boxShadow: '0 4px 6px rgba(240,94,35,0.3)',
            }}
          >
            Share and Earn More!
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.875rem', color: '#A0AEC0' }}>
           {shares}
        </p>

        {showSurvey && (
          <SurveyQuestion
            onResponse={handleSurveyResponse}
            onClose={() => setShowSurvey(false)}
          />
        )}
      </>
    );
  };

  const BottomNavBar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        height: '60px',
        borderTop: '1px solid #333'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            color: location.pathname === '/' ? '#f05e23' : '#fff',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M7 21H3V10l-3 3v-3l9-9 9 9v3l-3-3v11h-4v-7H7v7zm8-11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z"/>
          </svg>
        </button>
        <button
          onClick={() => navigate('/deals')}
          style={{
            background: 'none',
            border: 'none',
            color: location.pathname === '/deals' ? '#f05e23' : '#fff',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>
    );
  };

  return (
    <Router>
      <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1rem', maxWidth: '28rem', margin: '0 auto', fontFamily: 'sans-serif', minHeight: '100vh', position: 'relative' }}>
        {/* Connection status icon */}
        <div 
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#22c55e' : '#ef4444',
            transition: 'background-color 0.3s ease',
          }}
          title={isConnected ? 'Connected to sync server' : 'Disconnected from sync server'}
        />

        <PeerSync 
          onConnectionStatus={handleConnectionStatus}
        />
        
        {localWalletAddress && (
          <button
            onClick={handleDisconnect}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '1.5rem',
              cursor: 'pointer',
            }}
          >
            ⋮
          </button>
        )}

        <Routes>
  <Route path="/profile" element={<ProfilePage />} />
          <Route path="/" element={<MainPage />} />
          <Route path="/deals" element={<DealsComponent localWalletAddress={localWalletAddress} />} />
        </Routes>
        
        <BottomNavBar />
      </div>
    </Router>
  )
}

export default TelegramMiniApp
