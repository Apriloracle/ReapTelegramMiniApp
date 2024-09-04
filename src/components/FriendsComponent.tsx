import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import WebApp from '@twa-dev/sdk'
import { LocalWallet } from "@thirdweb-dev/wallets";

const FriendsComponent: React.FC = () => {
  const navigate = useNavigate();
  const [referralLink, setReferralLink] = useState<string>('');
  const [referralCode, setReferralCode] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [referrerId, setReferrerId] = useState<string | null>(null);

  const referralHandler = useCallback(async (referralCode: string) => {
    if (!userId) {
      console.error('User ID not available');
      return;
    }

    try {
      console.log('Processing referral for user:', userId, 'with code:', referralCode);
      const functionUrl = 'https://asia-southeast1-fourth-buffer-421320.cloudfunctions.net/handleReferral';
      
      const response = await axios.post(functionUrl, { 
        userId: userId,
        referralCode: referralCode
      });

      if (response.data.success) {
        console.log('Referral processed successfully');
        alert('Referral processed successfully!');
      } else {
        console.error('Referral processing failed:', response.data.message);
        alert('Referral processing failed. Please try again.');
      }
    } catch (error) {
      console.error('Error processing referral:', error);
      alert('An error occurred while processing the referral. Please try again later.');
    }
  }, [userId]);

  useEffect(() => {
    const userStore = createStore();
    const userPersister = createLocalPersister(userStore, 'telegram-user-data');

    const initializeUserData = async () => {
      await userPersister.load();
      let storedUserId = userStore.getCell('user', 'data', 'id') as string | null;

      if (!storedUserId) {
        const telegramUserId = WebApp.initDataUnsafe?.user?.id?.toString();
        if (telegramUserId) {
          storedUserId = telegramUserId;
          userStore.setCell('user', 'data', 'id', telegramUserId);
          await userPersister.save();
        } else {
          console.error('Unable to get user ID from Telegram');
        }
      }

      setUserId(storedUserId);

      if (storedUserId) {
        const generatedReferrerId = await generateReferrerId(storedUserId);
        if (generatedReferrerId) {
          getUserReferralLink(generatedReferrerId);
        }
      } else {
        console.error('User ID not found in store or Telegram');
      }
    };

    initializeUserData().catch(console.error);

    // Update this block to handle referral when the component mounts
    const handleReferral = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const referralCode = urlParams.get('ref');
      if (referralCode) {
        console.log('Referral code found:', referralCode);
        if (userId) {
          referralHandler(referralCode);
        } else {
          console.log('User ID not yet available. Storing referral code for later.');
          localStorage.setItem('pendingReferralCode', referralCode);
        }
      } else {
        console.log('No referral code found in URL');
      }
    };

    handleReferral();

    // Call handleReferral after a short delay to ensure userId is set
    const timeoutId = setTimeout(handleReferral, 1000);

    // Cleanup function
    return () => clearTimeout(timeoutId);
  }, [referralHandler, userId]);

  const generateReferrerId = async (telegramUserId: string): Promise<string | null> => {
    try {
      let wallet = new LocalWallet();
      
      try {
        await wallet.load({
          strategy: "encryptedJson",
          password: telegramUserId,
        });
        console.log('Existing wallet loaded for referrer ID');
      } catch (loadError) {
        console.log('No existing wallet found for referrer ID, creating new one');
        await wallet.generate();
        await wallet.save({
          strategy: "encryptedJson",
          password: telegramUserId,
        });
      }

      const walletAddress = await wallet.getAddress();
      setReferrerId(walletAddress);
      console.log('Referrer ID (wallet address) set:', walletAddress);
      return walletAddress;
    } catch (error) {
      console.error("Error generating referrer ID:", error);
      return null;
    }
  };

  const getUserReferralLink = async (referrerId: string) => {
    try {
      const functionUrl = 'https://asia-southeast1-fourth-buffer-421320.cloudfunctions.net/telegramReferral/getUserReferralLink';
      
      const response = await axios.post(functionUrl, { 
        referrerId: referrerId
      });
      setReferralLink(response.data.referralLink);
      setReferralCode(response.data.referralCode);
    } catch (error) {
      console.error('Error fetching referral link:', error);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    alert('Referral link copied to clipboard!');
  };

  useEffect(() => {
    if (userId) {
      const storedReferralCode = localStorage.getItem('pendingReferralCode');
      if (storedReferralCode) {
        console.log('Processing stored referral code:', storedReferralCode);
        referralHandler(storedReferralCode);
        localStorage.removeItem('pendingReferralCode');
      }
    }
  }, [userId, referralHandler]);

  return (
    <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1rem', maxWidth: '28rem', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ textAlign: 'center', color: '#f05e23' }}>Friends & Referrals</h2>
      </div>
      
      {userId ? (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: '#f05e23' }}>Your Referral Link</h3>
            <p style={{ backgroundColor: '#1A202C', padding: '0.5rem', borderRadius: '4px', wordBreak: 'break-all' }}>
              {referralLink}
            </p>
            <button 
              onClick={copyToClipboard}
              style={{ 
                backgroundColor: '#f05e23', 
                color: '#FFFFFF', 
                border: 'none', 
                padding: '0.5rem 1rem', 
                borderRadius: '4px', 
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              Copy Link
            </button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: '#f05e23' }}>Your Referral Code</h3>
            <p style={{ backgroundColor: '#1A202C', padding: '0.5rem', borderRadius: '4px', wordBreak: 'break-all' }}>
              {referralCode}
            </p>
          </div>

          <div style={{ backgroundColor: '#1A202C', padding: '1rem', borderRadius: '4px' }}>
            <h3 style={{ color: '#f05e23', marginTop: 0 }}>How it works</h3>
            <p>1. Share your unique referral link or code with friends</p>
            <p>2. When a friend starts our Telegram bot using your link or code, you'll earn a reward</p>
            <p>3. Keep referring to earn more rewards!</p>
          </div>
        </>
      ) : (
        <p>Loading user data...</p>
      )}
    </div>
  );
};

export default FriendsComponent;
