import React, { useEffect, useState } from 'react'
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi'
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import WebApp from '@twa-dev/sdk'
import { LocalWallet } from "@thirdweb-dev/wallets";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";

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

      // Parse the initData to get the user_id
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

    // Initialize stores with default values
    clickStore.setTables({
      stats: { clicks: { count: 0 } }
    });
    shareStore.setTables({
      stats: { shares: { count: 0 } }
    });
    dailyStore.setTables({
      dailyStats: { clicks: { count: 0, lastReset: new Date().toISOString() } }
    });

    // Load persisted data
    loadPersistedData();

    // Add listeners for score and share changes
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

    // Check for reset every minute
    const intervalId = setInterval(() => {
      const lastReset = new Date(dailyStore.getCell('dailyStats', 'clicks', 'lastReset') as string);
      if (shouldResetDailyTaps(lastReset)) {
        resetDailyTaps();
      }
    }, 60000);

    // Cleanup
    return () => {
      clickStore.delListener(scoreListenerId);
      shareStore.delListener(shareListenerId);
      clickPersister.destroy();
      sharePersister.destroy();
      dailyPersister.destroy();
      clearInterval(intervalId);
    };
  }, [])

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

 const loadWallet = async (userId: string) => {
    setLoading(true);
    try {
      const wallet = new LocalWallet();
      await wallet.load({
        strategy: "encryptedJson",
        password: userId,
      });
      setLocalWallet(wallet);
      const walletAddress = await wallet.getAddress();
      setLocalWalletAddress(walletAddress);
      console.log('Loaded wallet address:', walletAddress);
    } catch (error) {
      console.error("Error loading local wallet:", error);
      setLocalWallet(null);
      setLocalWalletAddress(null);
    } finally {
      setLoading(false);
    }
  };

  
  const handleLogin = async () => {
    if (!userId) {
      setError("User ID not available. Please try reloading the app.");
      return;
    }
    setLoading(true);
    try {
      let wallet = new LocalWallet();
      
      // Try to load existing wallet
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

      // Call the cloud function for ERC20 transfer
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
        // Update the score in Tinybase
        const currentScore = clickStore.getCell('stats', 'clicks', 'count') as number;
        const newScore = currentScore + 1;
        clickStore.setCell('stats', 'clicks', 'count', newScore);
        
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

  const handleShare = async () => {
    try {
      if (WebApp && WebApp.openTelegramLink) {
        await WebApp.openTelegramLink(SHARE_URL);
      } else {
        // Fallback for when WebApp is not available
        window.open(SHARE_URL, '_blank');
      }

      // Update the share count
      const currentShares = shareStore.getCell('stats', 'shares', 'count') as number;
      const newShares = currentShares + 1;
      shareStore.setCell('stats', 'shares', 'count', newShares);

      console.log('Share processed successfully');
    } catch (err) {
      console.error('Error processing share:', err);
    }
  };


return (
    <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1rem', maxWidth: '28rem', margin: '0 auto', fontFamily: 'sans-serif', minHeight: '100vh', position: 'relative' }}>
      {/* Settings Button */}
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

      {/* Login and Connect Wallet Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <ConnectKitButton.Custom>
          {({ show }) => (
            <button 
              onClick={show}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '2rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ marginRight: '0.5rem' }}>🔗</span>
              Connect Wallet
            </button>
          )}
        </ConnectKitButton.Custom>
        
        <button 
          onClick={handleLogin}
          disabled={loading || !!localWalletAddress}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '2rem',
            border: 'none',
            cursor: loading || !!localWalletAddress ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            opacity: loading || !!localWalletAddress ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ marginRight: '0.5rem' }}>➡️</span>
          {loading ? 'Connecting...' : (localWalletAddress ? 'Logged In' : 'Login to Wallet')}
        </button>
      </div>

      {/* Display Local Wallet Address */}
      {localWalletAddress && (
        <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.8rem', color: '#A0AEC0', wordBreak: 'break-all' }}>
          Local Wallet: {localWalletAddress}
        </div>
      )}

      {/* ConnectKit Button */}
      {!localWalletAddress && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <ConnectKitButton />
        </div>
      )}

      {/* Score Card */}
      <div style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
          <svg style={{ width: '2rem', height: '2rem', color: '#F59E0B', marginRight: '0.5rem' }} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 011-1h1V7a1 1 0 012 0v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H8a1 1 0 01-1-1z" clipRule="evenodd" fillRule="evenodd"></path>
          </svg>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFFFFF' }}>{score}</p>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#A0AEC0' }}>Current Score</p>
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
          Taps: {dailyTaps} / {DAILY_TAP_LIMIT}
        </p>
        {error && (
          <p style={{ marginTop: '0.5rem', color: '#EF4444', fontSize: '0.875rem' }}>{error}</p>
        )}
      </div>

      {/* Share Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
        <button
          onClick={handleShare}
          style={{
            background: 'linear-gradient(135deg, #4CAF50, #45a049)',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '9999px',
            fontSize: '1rem',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 300ms ease-in-out',
            boxShadow: '0 4px 6px rgba(76,175,80,0.3)',
          }}
        >
          Share and Earn More!
        </button>
      </div>

      {/* Share Count */}
      <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.875rem', color: '#A0AEC0' }}>
        Shares: {shares}
      </p>
    </div>
  )
}

export default TelegramMiniApp
