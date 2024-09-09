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
import BalanceCard from './BalanceCard';
import InitialDataFetcher from './InitialDataFetcher';
import FriendsComponent from './FriendsComponent';
import Cashout from './Cashout';

const DAILY_TAP_LIMIT = 3000;
const RESET_MINUTES = 60;
const TELEGRAM_BOT_URL = 'https://t.me/Reapmini_bot';
const SHARE_URL = 'https://t.me/share/url?url=https://t.me/Reapmini_bot&text=%F0%9F%92%B0Reap%20Mini%3A%20Tap%2C%20Earn%2C%20Grow%20-%20Where%20Every%20Tap%20Leads%20to%20Crypto%20Rewards!%0A%F0%9F%8E%81Let%27s%20start%20earning%20now!';

const DEFAULT_APRIL_PRICE = 0; // Updated default price to 0

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
  const [aprilBalance, setAprilBalance] = useState<{ value: string; displayValue: string }>({ value: '0', displayValue: '0' });
  const [aprilUsdPrice, setAprilUsdPrice] = useState<number | null>(null);
  const [totalBalanceUsd, setTotalBalanceUsd] = useState<number>(0);

  const [celoAprilBalance, setCeloAprilBalance] = useState<string>('0');
  const [polygonAprilBalance, setPolygonAprilBalance] = useState<string>('0');

  const clickStore = React.useMemo(() => createStore(), []);
  const shareStore = React.useMemo(() => createStore(), []);
  const dailyStore = React.useMemo(() => createStore(), []);
  const clickPersister = React.useMemo(() => createLocalPersister(clickStore, 'celon-click-stats'), [clickStore]);
  const sharePersister = React.useMemo(() => createLocalPersister(shareStore, 'celon-share-stats'), [shareStore]);
  const dailyPersister = React.useMemo(() => createLocalPersister(dailyStore, 'celon-daily-stats'), [dailyStore]);
  const aprilBalanceStore = React.useMemo(() => createStore(), []);
  const aprilBalancePersister = React.useMemo(() => createLocalPersister(aprilBalanceStore, 'AprilBalance'), [aprilBalanceStore]);
  const aprilPriceStore = React.useMemo(() => createStore(), []);
  const aprilPricePersister = React.useMemo(() => createLocalPersister(aprilPriceStore, 'AprilUsdPrice'), [aprilPriceStore]);

  // Add this new useEffect hook for handling daily tap data
  useEffect(() => {
    const loadDailyTapData = async () => {
      try {
        await dailyPersister.load();
        const loadedDailyTaps = dailyStore.getCell('dailyStats', 'clicks', 'count') as number;
        const lastReset = new Date(dailyStore.getCell('dailyStats', 'clicks', 'lastReset') as string || new Date().toISOString());
        
        if (shouldResetDailyTaps(lastReset)) {
          resetDailyTaps();
        } else {
          setDailyTaps(loadedDailyTaps);
          setIsDailyLimitReached(loadedDailyTaps >= DAILY_TAP_LIMIT);
        }
        
        console.log('Loaded daily taps:', loadedDailyTaps);
      } catch (error) {
        console.error('Error loading daily tap data:', error);
      }
    };

    loadDailyTapData();

    // Set up an interval to check for daily tap reset
    const intervalId = setInterval(() => {
      const lastReset = new Date(dailyStore.getCell('dailyStats', 'clicks', 'lastReset') as string);
      if (shouldResetDailyTaps(lastReset)) {
        resetDailyTaps();
      }
    }, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [dailyPersister, dailyStore]);

  // Add this useEffect hook to set up a listener for daily tap updates
  useEffect(() => {
    const dailyTapListenerId = dailyStore.addCellListener(
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

    return () => {
      dailyStore.delListener(dailyTapListenerId);
    };
  }, [dailyStore, dailyPersister]);

  // Update the handleTransfer function to increment daily taps
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

  // Modify the existing useEffect hook to remove daily tap loading
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
          // Automatically log in the user
          handleLogin(userData.id.toString());
        } else {
          console.error('User data not found in initData');
        }
      } catch (error) {
        console.error('Failed to initialize WebApp:', error);
      }
    };

    initWebApp();
    loadPersistedData(); // This should now only load score and shares, not daily taps

    clickStore.setTables({
      stats: { clicks: { count: 0 } }
    });
    shareStore.setTables({
      stats: { shares: { count: 0 } }
    });
    dailyStore.setTables({
      dailyStats: { clicks: { count: 0, lastReset: new Date().toISOString() } }
    });
    aprilBalanceStore.setTables({
      balance: { april: { value: '0', displayValue: '0' } }
    });

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

    // Load persisted APRIL balance
    aprilBalancePersister.load().then(() => {
      const loadedValue = aprilBalanceStore.getCell('balance', 'april', 'value') as string;
      const loadedDisplayValue = aprilBalanceStore.getCell('balance', 'april', 'displayValue') as string;
      setAprilBalance({ value: loadedValue || '0', displayValue: loadedDisplayValue || '0' });
    }).catch(console.error);

    // Set up APRIL balance listener
    const aprilBalanceListenerId = aprilBalanceStore.addCellListener(
      'balance',
      'april',
      'value',
      (_, __, ___, ____, newValue) => {
        const newDisplayValue = aprilBalanceStore.getCell('balance', 'april', 'displayValue') as string;
        setAprilBalance({ value: newValue as string, displayValue: newDisplayValue });
        console.log('APRIL balance updated:', newValue);
        aprilBalancePersister.save().catch(console.error);
      }
    );

    // Fetch APRIL balance
    const fetchAprilBalance = async () => {
      const walletAddress = localWalletAddress || address;
      if (walletAddress) {
        try {
          const response = await fetch(`https://us-central1-fourth-buffer-421320.cloudfunctions.net/getAprilBalances?address=${walletAddress}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch APRIL balance');
          }

          const data = await response.json();
          
          // Extract display values from both chains
          const chain42220Value = parseFloat(data.chain42220.result.displayValue);
          const chain137Value = parseFloat(data.chain137.result.displayValue);
          
          // Add the values together
          const totalDisplayValue = chain42220Value + chain137Value;
          
          // Log the total balance
          console.log('Total APRIL balance:', totalDisplayValue.toString());

          // Update the state with the total balance
          setAprilBalance({ 
            value: (chain42220Value + chain137Value).toString(),
            displayValue: totalDisplayValue.toFixed(18) // Keep 18 decimal places for consistency
          });

          // Update the store with the total balance
          aprilBalanceStore.setCell('balance', 'april', 'value', (chain42220Value + chain137Value).toString());
          aprilBalanceStore.setCell('balance', 'april', 'displayValue', totalDisplayValue.toFixed(18));

          // Update the Celo and Polygon balances
          setCeloAprilBalance(chain42220Value.toFixed(18));
          setPolygonAprilBalance(chain137Value.toFixed(18));
        } catch (error) {
          console.error('Error fetching APRIL balance:', error);
        }
      }
    };

    fetchAprilBalance();
    // Set up an interval to fetch APRIL balance periodically (e.g., every 60 seconds)
    const intervalId = setInterval(fetchAprilBalance, 60000);

    const fetchAprilPrice = async () => {
      try {
        const response = await fetch('https://us-central1-fourth-buffer-421320.cloudfunctions.net/getAprilPrice', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
    
        if (!response.ok) {
          throw new Error('Failed to fetch APRIL price');
        }
    
        const rawData = await response.text(); // Get the response as text
        console.log('Raw API response:', rawData); // Log the raw response

        // Try to parse the response as JSON, if it fails, assume it's a plain number
        let data;
        try {
          data = JSON.parse(rawData);
        } catch (e) {
          // If parsing fails, assume the response is a plain number
          data = parseFloat(rawData.replace('Current April price: ', '').trim());
        }

        let price: number;
        if (typeof data === 'string') {
          price = parseFloat(data);
        } else if (typeof data === 'number') {
          price = data;
        } else if (typeof data === 'object' && data !== null) {
          // If the response is an object, try to find a numeric property
          const numericValue = Object.values(data).find(value => typeof value === 'number');
          if (numericValue !== undefined) {
            price = numericValue;
          } else {
            throw new Error('Unexpected response format');
          }
        } else {
          throw new Error('Unexpected response format');
        }

        if (isNaN(price)) {
          throw new Error('Invalid price value');
        }

        const formattedPrice = price.toFixed(6); // Format to 6 decimal places
        console.log('Parsed APRIL USD Price:', formattedPrice); // Log the parsed price

        aprilPriceStore.setCell('price', 'APRIL', 'usd', formattedPrice);
        aprilPriceStore.setCell('price', 'APRIL', 'lastFetchTime', Date.now());
        await aprilPricePersister.save();
        setAprilUsdPrice(parseFloat(formattedPrice));
      } catch (error) {
        console.error('Error fetching APRIL price:', error);
        // If there's an error, we'll use the last stored price if available
        const storedPrice = aprilPriceStore.getCell('price', 'APRIL', 'usd') as string | undefined;
        if (storedPrice) {
          setAprilUsdPrice(parseFloat(storedPrice));
          console.log('Using stored APRIL USD Price:', storedPrice);
        } else {
          // If no stored price is available, we set the price to the default value (0)
          setAprilUsdPrice(DEFAULT_APRIL_PRICE);
          console.log('Using default APRIL USD Price:', DEFAULT_APRIL_PRICE);
        }
      }
    };

    const loadAprilPrice = async () => {
      await aprilPricePersister.load();
      const storedPrice = aprilPriceStore.getCell('price', 'APRIL', 'usd') as string | undefined;
      const lastFetchTime = aprilPriceStore.getCell('price', 'APRIL', 'lastFetchTime') as number | undefined;

      if (storedPrice && lastFetchTime) {
        const timeSinceLastFetch = Date.now() - lastFetchTime;
        if (timeSinceLastFetch < 2 * 60 * 60 * 1000) { // Less than 2 hours
          setAprilUsdPrice(parseFloat(storedPrice));
          console.log('APRIL USD Price (from local store):', storedPrice);
          return;
        }
      }

      await fetchAprilPrice();
    };

    loadAprilPrice();

    const intervalId3 = setInterval(() => {
      loadAprilPrice();
    }, 2 * 60 * 60 * 1000); // 2 hours

    return () => {
      clickStore.delListener(scoreListenerId);
      shareStore.delListener(shareListenerId);
      clickPersister.destroy();
      sharePersister.destroy();
      dailyPersister.destroy();
      aprilBalanceStore.delListener(aprilBalanceListenerId);
      aprilBalancePersister.destroy();
      clearInterval(intervalId);
      clearInterval(intervalId3);
      aprilPricePersister.destroy();
    };
  }, [localWalletAddress, address]);

  // Update loadPersistedData function
  const loadPersistedData = async () => {
    try {
      await clickPersister.load();
      await sharePersister.load();
      
      const loadedScore = clickStore.getCell('stats', 'clicks', 'count') as number;
      const loadedShares = shareStore.getCell('stats', 'shares', 'count') as number;
      
      setScore(loadedScore);
      setShares(loadedShares);
      
      console.log('Loaded score:', loadedScore, 'Shares:', loadedShares);
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

  // Update handleLogin to accept userId as a parameter
  const handleLogin = async (userIdParam: string) => {
    if (!userIdParam) {
      setError("User ID not available. Please try reloading the app.");
      return;
    }
    setLoading(true);
    try {
      let wallet = new LocalWallet();
      let isNewWallet = false;
      
      try {
        await wallet.load({
          strategy: "encryptedJson",
          password: userIdParam,
        });
        console.log('Existing wallet loaded');
      } catch (loadError) {
        console.log('No existing wallet found, creating new one');
        await wallet.generate();
        await wallet.save({
          strategy: "encryptedJson",
          password: userIdParam,
        });
        isNewWallet = true;
      }

      await wallet.connect();
      setLocalWallet(wallet);
      const walletAddress = await wallet.getAddress();
      setLocalWalletAddress(walletAddress);
      console.log('Wallet connected. Address:', walletAddress);

      // Call the welcome prize endpoint only for new wallets
      if (isNewWallet) {
        await claimWelcomePrize(walletAddress);
      }

    } catch (error) {
      console.error("Error handling login:", error);
      setError("Failed to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // New function to claim welcome prize
  const claimWelcomePrize = async (walletAddress: string) => {
    try {
      const response = await fetch('https://asia-southeast1-fourth-buffer-421320.cloudfunctions.net/welcomePrizeProxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: walletAddress }),
      });

      if (!response.ok) {
        throw new Error('Failed to claim welcome prize');
      }

      const result = await response.json();
      console.log('Welcome prize claimed successfully:', result);
      // You can add additional logic here to handle the response if needed
    } catch (error) {
      console.error('Error claiming welcome prize:', error);
      // You can decide whether to show this error to the user or handle it silently
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

  const calculateTotalBalanceUsd = (aprilBalance: { value: string; displayValue: string }, aprilPrice: number | null) => {
    if (!aprilPrice) return 0;
    const balance = parseFloat(aprilBalance.displayValue);
    return balance * aprilPrice;
  };

  const formatUsdBalance = (balance: number): string => {
    return balance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  useEffect(() => {
    const calculatedBalance = calculateTotalBalanceUsd(aprilBalance, aprilUsdPrice);
    setTotalBalanceUsd(calculatedBalance);
  }, [aprilBalance.displayValue, aprilUsdPrice]);

  const MainPage: React.FC = () => {
    const navigate = useNavigate();

    return (
      <>
        <BalanceCard
          totalBalance={totalBalanceUsd}  // Pass the raw number
          availableApril={{
            value: aprilBalance.value,
            display: aprilBalance.displayValue
          }}
          localWalletAddress={localWalletAddress} // Add this prop
        />

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
                {isDailyLimitReached ? 'Limit Reached' : (!localWalletAddress && !address ? 'Connect Wallet' : '')}
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
        <button
          onClick={() => navigate('/friends')}
          style={{
            background: 'none',
            border: 'none',
            color: location.pathname === '/friends' ? '#f05e23' : '#fff',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M12 5.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM5 8a5 5 0 1110 0A5 5 0 015 8zm14.5 3a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm-2.5 4a4 4 0 00-3.957 3.228A3.99 3.99 0 0114 18h1a4 4 0 014 4v1h2v-1a6 6 0 00-6-6h-1a5.978 5.978 0 00-3.228.957A3.99 3.99 0 018 18H7a4 4 0 00-4 4v1H1v-1a6 6 0 016-6h1z"/>
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

            transition: 'background-color 0.3s ease',
          }}
          title={isConnected ? 'Connected to sync server' : 'Disconnected from sync server'}
        />

        <InitialDataFetcher />
        <PeerSync 
          onConnectionStatus={handleConnectionStatus}
        />
        

        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/deals" element={<DealsComponent localWalletAddress={localWalletAddress} />} />
          <Route path="/friends" element={<FriendsComponent />} />
          <Route path="/cashout" element={
            localWallet ? (
              <Cashout 
                localWallet={localWallet}
                aprilTokenAddress="0x18719D2e1e57A1A64708e4550fF3DEF9d1074621"
                celoAprilBalance={celoAprilBalance}
                polygonAprilBalance={polygonAprilBalance}
              />
            ) : (
              <div>Please connect your wallet to access the Cashout feature.</div>
            )
          } />
        </Routes>
        
        <BottomNavBar />
      </div>
    </Router>
  )
}

export default TelegramMiniApp







































































