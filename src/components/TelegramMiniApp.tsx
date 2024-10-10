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
import SurveyQuestion from './SurveyQuestion';
import BalanceCard from './BalanceCard';
import InitialDataFetcher from './InitialDataFetcher';
import FriendsComponent from './FriendsComponent';
import Cashout from './Cashout';
import VectorData from './VectorData';
import DealsComponent from './DealsComponent';
import MerchantDealsComponent from './MerchantDealsComponent';
import EarnComponent from './EarnComponent';
import WatchAdsComponent from './WatchAdsComponent';
import SurveyList from './SurveyList';
import ProfileComponent from './ProfileComponent';

const DAILY_TAP_LIMIT = 9000;
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

      const response = await fetch('https://us-central1-fourth-buffer-421320.cloudfunctions.net/handleTapProxy', {
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
        WebApp.expand(); // Add this line to expand the mini app

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
    loadPersistedData();

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

  const sendInlineKeyboardMessage = () => {
    if (WebApp && WebApp.sendData) {
      const botUsername = 'Reapmini_bot'; // Replace with your actual bot username
      const startParameter = 'earn';

      const inlineKeyboard = JSON.stringify({
        inline_keyboard: [
          [
            { text: "Earn", url: `https://t.me/${botUsername}?start=${startParameter}` },
            { text: "Join Channel", url: "https://t.me/apriloraclenews" }, // Replace with your actual channel URL
            { text: "Join Group", url: "https://t.me/apriloracle" } // Replace with your actual group URL
          ]
        ]
      });

      if (WebApp.initDataUnsafe.user) {
        WebApp.sendData(JSON.stringify({
          method: "sendMessage",
          chat_id: WebApp.initDataUnsafe.user.id,
          text: "Welcome to Reap Mini! Choose an option to get started:",
          reply_markup: inlineKeyboard
        }));
      } else {
        console.error('User data is not available.');
      }
    }
  };

  const MainPage: React.FC = () => {
    const navigate = useNavigate();

    const openTelegramChat = () => {
      if (WebApp && WebApp.openTelegramLink) {
        WebApp.openTelegramLink('https://t.me/apriloracle');
      } else {
        window.open('https://t.me/apriloracle', '_blank');
      }
    };

    return (
      <>
        <BalanceCard
          totalBalance={totalBalanceUsd}
          availableApril={{
            value: aprilBalance.value,
            display: aprilBalance.displayValue
          }}
          localWalletAddress={localWalletAddress}
        />
        
        {!localWalletAddress && !address && (
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

        {/* Add this new div for the icons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', padding: '0 1rem' }}>
          <div style={{ 
            borderRadius: '0.5rem', 
            padding: '0.5rem',
            display: 'inline-block'
          }}>
            <button
              onClick={() => navigate('/surveys')}
              style={{
                background: 'none',
                border: 'none',
                color: '#f05e23',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
     <svg width="67" height="68" viewBox="0 0 67 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="2.5" y="4.5" width="56" height="56" rx="11.5" stroke="#E6602C"/>
<g filter="url(#filter0_d_2295_27907)">
<rect x="2" y="4" width="57" height="57" rx="12" fill="url(#paint0_linear_2295_27907)"/>
<rect x="1.5" y="3.5" width="58" height="58" rx="12.5" stroke="white"/>
</g>
<rect x="7" y="50" width="46" height="18" rx="9" fill="#A4491E"/>
<path d="M18.4 63V54.6H23.596V55.428H19.408V58.356H23.236V59.172H19.408V62.172H23.596V63H18.4ZM27.0932 63.144C26.6052 63.144 26.1972 63.06 25.8692 62.892C25.5412 62.716 25.2972 62.488 25.1372 62.208C24.9772 61.92 24.8972 61.608 24.8972 61.272C24.8972 60.864 25.0012 60.52 25.2092 60.24C25.4252 59.952 25.7252 59.736 26.1092 59.592C26.5012 59.44 26.9612 59.364 27.4892 59.364H29.0852C29.0852 58.988 29.0252 58.676 28.9052 58.428C28.7932 58.172 28.6252 57.98 28.4012 57.852C28.1852 57.724 27.9132 57.66 27.5852 57.66C27.2012 57.66 26.8692 57.756 26.5892 57.948C26.3092 58.14 26.1372 58.424 26.0732 58.8H25.0412C25.0892 58.368 25.2332 58.008 25.4732 57.72C25.7212 57.424 26.0332 57.2 26.4092 57.048C26.7852 56.888 27.1772 56.808 27.5852 56.808C28.1452 56.808 28.6092 56.912 28.9772 57.12C29.3532 57.32 29.6332 57.604 29.8172 57.972C30.0012 58.332 30.0932 58.76 30.0932 59.256V63H29.1932L29.1332 61.932C29.0532 62.1 28.9492 62.26 28.8212 62.412C28.7012 62.556 28.5572 62.684 28.3892 62.796C28.2292 62.9 28.0412 62.984 27.8252 63.048C27.6092 63.112 27.3652 63.144 27.0932 63.144ZM27.2492 62.292C27.5292 62.292 27.7812 62.236 28.0052 62.124C28.2372 62.004 28.4332 61.844 28.5932 61.644C28.7532 61.436 28.8732 61.208 28.9532 60.96C29.0412 60.712 29.0852 60.452 29.0852 60.18V60.144H27.5732C27.1812 60.144 26.8652 60.192 26.6252 60.288C26.3852 60.376 26.2132 60.504 26.1092 60.672C26.0052 60.832 25.9532 61.016 25.9532 61.224C25.9532 61.44 26.0012 61.628 26.0972 61.788C26.2012 61.948 26.3492 62.072 26.5412 62.16C26.7412 62.248 26.9772 62.292 27.2492 62.292ZM31.6525 63V56.952H32.5645L32.6365 58.104C32.7725 57.832 32.9445 57.6 33.1525 57.408C33.3685 57.216 33.6245 57.068 33.9205 56.964C34.2245 56.86 34.5685 56.808 34.9525 56.808V57.864H34.5805C34.3245 57.864 34.0805 57.9 33.8485 57.972C33.6165 58.036 33.4085 58.144 33.2245 58.296C33.0485 58.448 32.9085 58.656 32.8045 58.92C32.7085 59.176 32.6605 59.496 32.6605 59.88V63H31.6525ZM36.0939 63V56.952H37.0059L37.0539 58.008C37.2459 57.632 37.5179 57.34 37.8699 57.132C38.2299 56.916 38.6379 56.808 39.0939 56.808C39.5659 56.808 39.9739 56.904 40.3179 57.096C40.6619 57.28 40.9299 57.564 41.1219 57.948C41.3139 58.324 41.4099 58.804 41.4099 59.388V63H40.4019V59.496C40.4019 58.888 40.2659 58.432 39.9939 58.128C39.7299 57.824 39.3539 57.672 38.8659 57.672C38.5299 57.672 38.2299 57.756 37.9659 57.924C37.7019 58.084 37.4899 58.32 37.3299 58.632C37.1779 58.936 37.1019 59.316 37.1019 59.772V63H36.0939Z" fill="#F5F5F5"/>
<path d="M38.4974 17.833H31.4141C31.4141 18.6122 30.7766 19.2497 29.9974 19.2497C29.2182 19.2497 28.5807 18.6122 28.5807 17.833H21.4974C19.9391 17.833 18.6641 19.108 18.6641 20.6663V43.333C18.6641 44.8913 19.9391 46.1663 21.4974 46.1663H38.4974C40.0557 46.1663 41.3307 44.8913 41.3307 43.333V20.6663C41.3307 19.108 40.0557 17.833 38.4974 17.833Z" fill="#455A64"/>
<path d="M38.4974 44.0413H21.4974C21.0724 44.0413 20.7891 43.758 20.7891 43.333V20.6663C20.7891 20.2413 21.0724 19.958 21.4974 19.958H38.4974C38.9224 19.958 39.2057 20.2413 39.2057 20.6663V43.333C39.2057 43.758 38.9224 44.0413 38.4974 44.0413Z" fill="white"/>
<path d="M31.4167 17.833C31.4167 18.6122 30.7792 19.2497 30 19.2497C29.2208 19.2497 28.5833 18.6122 28.5833 17.833H23.625V20.6663C23.625 21.4455 24.2625 22.083 25.0417 22.083H34.9583C35.7375 22.083 36.375 21.4455 36.375 20.6663V17.833H31.4167Z" fill="#90A4AE"/>
<path d="M29.9974 15C28.4391 15 27.1641 16.275 27.1641 17.8333C27.1641 19.3917 28.4391 20.6667 29.9974 20.6667C31.5557 20.6667 32.8307 19.3917 32.8307 17.8333C32.8307 16.275 31.5557 15 29.9974 15ZM29.9974 19.25C29.2182 19.25 28.5807 18.6125 28.5807 17.8333C28.5807 17.0542 29.2182 16.4167 29.9974 16.4167C30.7766 16.4167 31.4141 17.0542 31.4141 17.8333C31.4141 18.6125 30.7766 19.25 29.9974 19.25Z" fill="#90A4AE"/>
<path d="M27.875 29.1663H36.375V30.583H27.875V29.1663ZM23.625 28.458H26.4583V31.2913H23.625V28.458Z" fill="#CFD8DC"/>
<path d="M27.875 35.5413H36.375V36.958H27.875V35.5413ZM23.625 34.833H26.4583V37.6663H23.625V34.833Z" fill="#E6602C"/>
<defs>
<filter id="filter0_d_2295_27907" x="0" y="0" width="67" height="67" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="3" dy="1"/>
<feGaussianBlur stdDeviation="2"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2295_27907"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2295_27907" result="shape"/>
</filter>
<linearGradient id="paint0_linear_2295_27907" x1="30.5" y1="4" x2="30.5" y2="61" gradientUnits="userSpaceOnUse">
<stop stop-color="#6BCDF5"/>
<stop offset="1" stop-color="#3E788F"/>
</linearGradient>
</defs>
</svg>
              
            </button>
          </div>

          <div style={{ 
            borderRadius: '0.5rem', 
            padding: '0.5rem',
            display: 'inline-block'
          }}>
            <button
              onClick={openTelegramChat}
              style={{
                background: 'none',
                border: 'none',
                color: '#f05e23',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <svg width="67" height="68" viewBox="0 0 67 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="2.5" y="4.5" width="56" height="56" rx="11.5" stroke="#E6602C"/>
<g filter="url(#filter0_d_2305_27879)">
<rect x="2" y="4" width="57" height="57" rx="12" fill="#6BCDF5"/>
<rect x="1.5" y="3.5" width="58" height="58" rx="12.5" stroke="white"/>
</g>
<rect x="7" y="50" width="46" height="18" rx="9" fill="#A4491E"/>
<path d="M21.048 63.144C20.232 63.144 19.524 62.964 18.924 62.604C18.332 62.236 17.876 61.728 17.556 61.08C17.236 60.424 17.076 59.664 17.076 58.8C17.076 57.936 17.236 57.18 17.556 56.532C17.876 55.876 18.332 55.368 18.924 55.008C19.524 54.64 20.232 54.456 21.048 54.456C22.008 54.456 22.788 54.684 23.388 55.14C23.988 55.596 24.372 56.24 24.54 57.072H23.424C23.296 56.552 23.036 56.136 22.644 55.824C22.252 55.504 21.72 55.344 21.048 55.344C20.456 55.344 19.936 55.484 19.488 55.764C19.048 56.036 18.708 56.432 18.468 56.952C18.228 57.464 18.108 58.08 18.108 58.8C18.108 59.52 18.228 60.14 18.468 60.66C18.708 61.172 19.048 61.568 19.488 61.848C19.936 62.12 20.456 62.256 21.048 62.256C21.72 62.256 22.252 62.104 22.644 61.8C23.036 61.488 23.296 61.076 23.424 60.564H24.54C24.372 61.372 23.988 62.004 23.388 62.46C22.788 62.916 22.008 63.144 21.048 63.144ZM25.9416 63V54.36H26.9496V57.972C27.1496 57.612 27.4296 57.328 27.7896 57.12C28.1576 56.912 28.5576 56.808 28.9896 56.808C29.4536 56.808 29.8576 56.904 30.2016 57.096C30.5456 57.28 30.8096 57.564 30.9936 57.948C31.1776 58.332 31.2696 58.816 31.2696 59.4V63H30.2736V59.508C30.2736 58.9 30.1456 58.444 29.8896 58.14C29.6336 57.828 29.2616 57.672 28.7736 57.672C28.4296 57.672 28.1176 57.756 27.8376 57.924C27.5656 58.092 27.3496 58.332 27.1896 58.644C27.0296 58.956 26.9496 59.34 26.9496 59.796V63H25.9416ZM34.8119 63.144C34.3239 63.144 33.9159 63.06 33.5879 62.892C33.2599 62.716 33.0159 62.488 32.8559 62.208C32.6959 61.92 32.6159 61.608 32.6159 61.272C32.6159 60.864 32.7199 60.52 32.9279 60.24C33.1439 59.952 33.4439 59.736 33.8279 59.592C34.2199 59.44 34.6799 59.364 35.2079 59.364H36.8039C36.8039 58.988 36.7439 58.676 36.6239 58.428C36.5119 58.172 36.3439 57.98 36.1199 57.852C35.9039 57.724 35.6319 57.66 35.3039 57.66C34.9199 57.66 34.5879 57.756 34.3079 57.948C34.0279 58.14 33.8559 58.424 33.7919 58.8H32.7599C32.8079 58.368 32.9519 58.008 33.1919 57.72C33.4399 57.424 33.7519 57.2 34.1279 57.048C34.5039 56.888 34.8959 56.808 35.3039 56.808C35.8639 56.808 36.3279 56.912 36.6959 57.12C37.0719 57.32 37.3519 57.604 37.5359 57.972C37.7199 58.332 37.8119 58.76 37.8119 59.256V63H36.9119L36.8519 61.932C36.7719 62.1 36.6679 62.26 36.5399 62.412C36.4199 62.556 36.2759 62.684 36.1079 62.796C35.9479 62.9 35.7599 62.984 35.5439 63.048C35.3279 63.112 35.0839 63.144 34.8119 63.144ZM34.9679 62.292C35.2479 62.292 35.4999 62.236 35.7239 62.124C35.9559 62.004 36.1519 61.844 36.3119 61.644C36.4719 61.436 36.5919 61.208 36.6719 60.96C36.7599 60.712 36.8039 60.452 36.8039 60.18V60.144H35.2919C34.8999 60.144 34.5839 60.192 34.3439 60.288C34.1039 60.376 33.9319 60.504 33.8279 60.672C33.7239 60.832 33.6719 61.016 33.6719 61.224C33.6719 61.44 33.7199 61.628 33.8159 61.788C33.9199 61.948 34.0679 62.072 34.2599 62.16C34.4599 62.248 34.6959 62.292 34.9679 62.292ZM41.5832 63C41.2232 63 40.9112 62.944 40.6472 62.832C40.3832 62.72 40.1792 62.532 40.0352 62.268C39.8992 61.996 39.8312 61.632 39.8312 61.176V57.804H38.7752V56.952H39.8312L39.9632 55.488H40.8392V56.952H42.5912V57.804H40.8392V61.176C40.8392 61.552 40.9152 61.808 41.0672 61.944C41.2192 62.072 41.4872 62.136 41.8712 62.136H42.5192V63H41.5832Z" fill="#F5F5F5"/>
<g clip-path="url(#clip0_2305_27879)">
<path d="M20 29.997C20.0007 27.1469 20.9379 24.376 22.6676 22.1107C24.3972 19.8454 26.8234 18.2113 29.5727 17.4599C32.322 16.7085 35.242 16.8814 37.8834 17.9521C40.5248 19.0227 42.7411 20.9317 44.1913 23.3853C45.6415 25.8389 46.2452 28.7011 45.9095 31.5314C45.5737 34.3616 44.3172 37.0031 42.3332 39.0494C40.3492 41.0956 37.7478 42.4331 34.9292 42.856C32.1106 43.279 29.2312 42.764 26.734 41.3902L21.6796 42.9294C21.4542 42.9981 21.2143 43.0042 20.9856 42.9471C20.757 42.8899 20.5482 42.7717 20.3815 42.6051C20.2149 42.4384 20.0967 42.2296 20.0396 42.001C19.9824 41.7723 19.9885 41.5325 20.0572 41.307L21.5964 36.2448C20.548 34.3293 19.999 32.1806 20 29.997ZM27.8 28.697C27.8 29.0418 27.937 29.3725 28.1808 29.6163C28.4246 29.8601 28.7552 29.997 29.1 29.997H36.9C37.2448 29.997 37.5754 29.8601 37.8192 29.6163C38.063 29.3725 38.2 29.0418 38.2 28.697C38.2 28.3522 38.063 28.0216 37.8192 27.7778C37.5754 27.534 37.2448 27.397 36.9 27.397H29.1C28.7552 27.397 28.4246 27.534 28.1808 27.7778C27.937 28.0216 27.8 28.3522 27.8 28.697ZM29.1 32.597C28.7552 32.597 28.4246 32.734 28.1808 32.9778C27.937 33.2216 27.8 33.5522 27.8 33.897C27.8 34.2418 27.937 34.5725 28.1808 34.8163C28.4246 35.0601 28.7552 35.197 29.1 35.197H34.3C34.6448 35.197 34.9754 35.0601 35.2192 34.8163C35.463 34.5725 35.6 34.2418 35.6 33.897C35.6 33.5522 35.463 33.2216 35.2192 32.9778C34.9754 32.734 34.6448 32.597 34.3 32.597H29.1Z" fill="white"/>
</g>
<defs>
<filter id="filter0_d_2305_27879" x="0" y="0" width="67" height="67" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="3" dy="1"/>
<feGaussianBlur stdDeviation="2"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2305_27879"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2305_27879" result="shape"/>
</filter>
<clipPath id="clip0_2305_27879">
<rect width="34" height="34" fill="white" transform="translate(16 13)"/>
</clipPath>
</defs>
</svg>

    
              <span style={{ marginTop: '0.1rem', fontSize: '1rem' }}></span>
            </button>
          </div>
        </div>

        <div style={{ padding: '0.5rem', marginBottom: '0.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
            <svg style={{ width: '2rem', height: '2rem', color: '#F59E0B', marginRight: '0.5rem' }} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
               <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 011-1h1V7a1 1 0 012 0v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H8a1 1 0 01-1-1z" clipRule="evenodd" fillRule="evenodd"></path>
            </svg>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFFFFF' }}>{score}</p>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#A0AEC0' }}></p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
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

        {/* Add this button to trigger the inline keyboard */}
        {/* <button
          onClick={sendInlineKeyboardMessage}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#f05e23',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer'
          }}
        >
          Show Options
        </button> */}
      </>
    );
  };

  const Navigation = () => {
    const location = useLocation();
    const navigate = useNavigate();

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
        height: '70px',
        borderTop: '1px solid #333',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            color: location.pathname === '/' ? '#f05e23' : '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '8px',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M7 21H3V10l-3 3v-3l9-9 9 9v3l-3-3v11h-4v-7H7v7zm8-11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z"/>
          </svg>
          <span style={{ marginTop: '4px' }}>Home</span>
        </button>
        <button
          onClick={() => navigate('/deals')}
          style={{
            background: 'none',
            border: 'none',
            color: location.pathname === '/deals' ? '#f05e23' : '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '8px',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
          <span style={{ marginTop: '4px' }}>Shop</span>
        </button>
        <button
          onClick={() => navigate('/earn')}
          style={{
            background: 'none',
            border: 'none',
            color: location.pathname === '/earn' ? '#f05e23' : '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '8px',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
          </svg>
          <span style={{ marginTop: '4px' }}>Earn</span>
        </button>
        <button
          onClick={() => navigate('/friends')}
          style={{
            background: 'none',
            border: 'none',
            color: location.pathname === '/friends' ? '#f05e23' : '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '8px',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M12 5.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM5 8a5 5 0 1110 0A5 5 0 015 8zm14.5 3a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm-2.5 4a4 4 0 00-3.957 3.228A3.99 3.99 0 0114 18h1a4 4 0 014 4v1h2v-1a6 6 0 00-6-6h-1a5.978 5.978 0 00-3.228.957A3.99 3.99 0 018 18H7a4 4 0 00-4 4v1H1v-1a6 6 0 016-6h1z"/>
          </svg>
          <span style={{ marginTop: '4px' }}>Friends</span>
        </button>
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: 'none',
            border: 'none',
            color: location.pathname === '/profile' ? '#f05e23' : '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '8px',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
          <span style={{ marginTop: '4px' }}>Profile</span>
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
          <Route path="/deals" element={<DealsComponent />} />
          <Route path="/merchant-deals/:merchantName" element={<MerchantDealsComponent localWalletAddress={localWalletAddress} address={address} />} />
          <Route path="/earn" element={<EarnComponent />} />
          <Route path="/watch-ads" element={<WatchAdsComponent />} />
          <Route path="/surveys" element={<SurveyList localWalletAddress={localWalletAddress} address={address} />} />
          <Route path="/profile" element={<ProfileComponent localWalletAddress={localWalletAddress} address={address} />} />
        </Routes>

        <Navigation />
        <VectorData />
      </div>
    </Router>
  )
}

export default TelegramMiniApp