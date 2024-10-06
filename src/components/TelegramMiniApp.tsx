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
<rect x="7" y="50" width="46" height="18" rx="9" fill="#E6602C"/>
<path d="M14.576 63.144C13.96 63.144 13.424 63.032 12.968 62.808C12.512 62.584 12.16 62.272 11.912 61.872C11.664 61.472 11.54 61.008 11.54 60.48H12.596C12.596 60.808 12.672 61.112 12.824 61.392C12.976 61.664 13.196 61.884 13.484 62.052C13.78 62.212 14.144 62.292 14.576 62.292C14.952 62.292 15.272 62.232 15.536 62.112C15.808 61.984 16.012 61.812 16.148 61.596C16.292 61.38 16.364 61.136 16.364 60.864C16.364 60.536 16.292 60.272 16.148 60.072C16.012 59.864 15.824 59.696 15.584 59.568C15.344 59.44 15.064 59.328 14.744 59.232C14.432 59.128 14.104 59.016 13.76 58.896C13.096 58.672 12.608 58.396 12.296 58.068C11.984 57.732 11.828 57.296 11.828 56.76C11.828 56.304 11.932 55.904 12.14 55.56C12.356 55.216 12.66 54.948 13.052 54.756C13.452 54.556 13.924 54.456 14.468 54.456C15.004 54.456 15.468 54.556 15.86 54.756C16.26 54.956 16.572 55.232 16.796 55.584C17.02 55.928 17.132 56.328 17.132 56.784H16.076C16.076 56.552 16.016 56.324 15.896 56.1C15.776 55.876 15.592 55.692 15.344 55.548C15.104 55.396 14.8 55.32 14.432 55.32C14.128 55.312 13.856 55.364 13.616 55.476C13.384 55.58 13.2 55.732 13.064 55.932C12.936 56.132 12.872 56.376 12.872 56.664C12.872 56.936 12.928 57.156 13.04 57.324C13.16 57.492 13.328 57.636 13.544 57.756C13.768 57.868 14.028 57.972 14.324 58.068C14.62 58.164 14.948 58.272 15.308 58.392C15.716 58.528 16.076 58.696 16.388 58.896C16.708 59.088 16.956 59.336 17.132 59.64C17.316 59.944 17.408 60.332 17.408 60.804C17.408 61.204 17.3 61.584 17.084 61.944C16.876 62.296 16.564 62.584 16.148 62.808C15.732 63.032 15.208 63.144 14.576 63.144ZM20.9969 63.144C20.5329 63.144 20.1249 63.052 19.7729 62.868C19.4289 62.684 19.1609 62.4 18.9689 62.016C18.7849 61.632 18.6929 61.152 18.6929 60.576V56.952H19.7009V60.468C19.7009 61.068 19.8329 61.52 20.0969 61.824C20.3609 62.128 20.7329 62.28 21.2129 62.28C21.5489 62.28 21.8529 62.2 22.1249 62.04C22.3969 61.872 22.6089 61.636 22.7609 61.332C22.9209 61.02 23.0009 60.636 23.0009 60.18V56.952H24.0089V63H23.0969L23.0369 61.944C22.8529 62.32 22.5809 62.616 22.2209 62.832C21.8609 63.04 21.4529 63.144 20.9969 63.144ZM25.6798 63V56.952H26.5918L26.6638 58.104C26.7998 57.832 26.9718 57.6 27.1798 57.408C27.3958 57.216 27.6518 57.068 27.9478 56.964C28.2518 56.86 28.5958 56.808 28.9798 56.808V57.864H28.6078C28.3518 57.864 28.1078 57.9 27.8758 57.972C27.6438 58.036 27.4358 58.144 27.2518 58.296C27.0758 58.448 26.9358 58.656 26.8318 58.92C26.7358 59.176 26.6878 59.496 26.6878 59.88V63H25.6798ZM31.8613 63L29.5693 56.952H30.6253L32.4492 62.028L34.2853 56.952H35.3173L33.0253 63H31.8613ZM38.7967 63.144C38.2367 63.144 37.7367 63.012 37.2967 62.748C36.8567 62.484 36.5127 62.116 36.2647 61.644C36.0167 61.164 35.8927 60.608 35.8927 59.976C35.8927 59.336 36.0127 58.78 36.2527 58.308C36.5007 57.836 36.8447 57.468 37.2847 57.204C37.7327 56.94 38.2447 56.808 38.8207 56.808C39.4127 56.808 39.9167 56.94 40.3327 57.204C40.7487 57.468 41.0647 57.816 41.2807 58.248C41.5047 58.672 41.6167 59.14 41.6167 59.652C41.6167 59.732 41.6167 59.816 41.6167 59.904C41.6167 59.992 41.6127 60.092 41.6047 60.204H36.6487V59.424H40.6207C40.5967 58.872 40.4127 58.44 40.0687 58.128C39.7327 57.816 39.3087 57.66 38.7967 57.66C38.4607 57.66 38.1447 57.74 37.8487 57.9C37.5527 58.052 37.3167 58.28 37.1407 58.584C36.9647 58.88 36.8767 59.252 36.8767 59.7V60.036C36.8767 60.532 36.9647 60.948 37.1407 61.284C37.3247 61.62 37.5607 61.872 37.8487 62.04C38.1447 62.208 38.4607 62.292 38.7967 62.292C39.2207 62.292 39.5687 62.2 39.8407 62.016C40.1207 61.824 40.3247 61.564 40.4527 61.236H41.4487C41.3447 61.604 41.1727 61.932 40.9327 62.22C40.6927 62.5 40.3927 62.724 40.0327 62.892C39.6807 63.06 39.2687 63.144 38.7967 63.144ZM43.3906 65.64L44.8666 62.328H44.5186L42.1426 56.952H43.2346L45.2026 61.572L47.2786 56.952H48.3226L44.4466 65.64H43.3906Z" fill="#F5F5F5"/>
<path d="M39.4948 13.166H31.5781C31.5781 14.0368 30.8656 14.7493 29.9948 14.7493C29.124 14.7493 28.4115 14.0368 28.4115 13.166H20.4948C18.7531 13.166 17.3281 14.591 17.3281 16.3327V41.666C17.3281 43.4077 18.7531 44.8327 20.4948 44.8327H39.4948C41.2365 44.8327 42.6615 43.4077 42.6615 41.666V16.3327C42.6615 14.591 41.2365 13.166 39.4948 13.166Z" fill="#455A64"/>
<path d="M39.4948 42.4577H20.4948C20.0198 42.4577 19.7031 42.141 19.7031 41.666V16.3327C19.7031 15.8577 20.0198 15.541 20.4948 15.541H39.4948C39.9698 15.541 40.2865 15.8577 40.2865 16.3327V41.666C40.2865 42.141 39.9698 42.4577 39.4948 42.4577Z" fill="white"/>
<path d="M31.5833 13.166C31.5833 14.0368 30.8708 14.7493 30 14.7493C29.1292 14.7493 28.4167 14.0368 28.4167 13.166H22.875V16.3327C22.875 17.2035 23.5875 17.916 24.4583 17.916H35.5417C36.4125 17.916 37.125 17.2035 37.125 16.3327V13.166H31.5833Z" fill="#90A4AE"/>
<path d="M29.9948 10C28.2531 10 26.8281 11.425 26.8281 13.1667C26.8281 14.9083 28.2531 16.3333 29.9948 16.3333C31.7365 16.3333 33.1615 14.9083 33.1615 13.1667C33.1615 11.425 31.7365 10 29.9948 10ZM29.9948 14.75C29.124 14.75 28.4115 14.0375 28.4115 13.1667C28.4115 12.2958 29.124 11.5833 29.9948 11.5833C30.8656 11.5833 31.5781 12.2958 31.5781 13.1667C31.5781 14.0375 30.8656 14.75 29.9948 14.75Z" fill="#90A4AE"/>
<path d="M27.625 25.8327H37.125V27.416H27.625V25.8327ZM22.875 25.041H26.0417V28.2077H22.875V25.041Z" fill="#CFD8DC"/>
<path d="M27.625 32.9577H37.125V34.541H27.625V32.9577ZM22.875 32.166H26.0417V35.3327H22.875V32.166Z" fill="#E6602C"/>
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
  <g filter="url(#filter0_d_2295_27907)">
    <path d="M2 16C2 8.26801 8.26801 2 16 2H45C52.732 2 59 8.26801 59 16V35C59 42.732 52.732 49 45 49H16C8.26801 49 2 42.732 2 35V16Z" fill="url(#paint0_linear_2295_27907)"/>
    <path d="M1.5 16C1.5 7.99187 7.99187 1.5 16 1.5H45C53.0081 1.5 59.5 7.99187 59.5 16V35C59.5 43.0081 53.0081 49.5 45 49.5H16C7.99187 49.5 1.5 43.0081 1.5 35V16Z" stroke="white"/>
  </g>
  <path d="M30 55L20 45H45C52.732 45 59 38.732 59 31V35C59 42.732 52.732 49 45 49H30V55Z" fill="#E6602C"/>
  <path d="M20 20H40M20 30H40" stroke="white" stroke-width="2" stroke-linecap="round"/>
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
    <linearGradient id="paint0_linear_2295_27907" x1="30.5" y1="2" x2="30.5" y2="49" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6BCDF5"/>
      <stop offset="1" stop-color="#3E788F"/>
    </linearGradient>
  </defs>
</svg>
    
              <span style={{ marginTop: '0.1rem', fontSize: '1rem' }}></span>
            </button>
          </div>
        </div>

        <div style={{ padding: '0.5rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
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
