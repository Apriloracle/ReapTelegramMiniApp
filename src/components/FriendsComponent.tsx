import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import WebApp from '@twa-dev/sdk';

const FriendsComponent: React.FC = () => {
  const navigate = useNavigate();
  const [referralLink, setReferralLink] = useState<string>('');
  const [referralCode, setReferralCode] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const userStore = createStore();
    const userPersister = createLocalPersister(userStore, 'telegram-user-data');

    const initializeUserData = async () => {
      await userPersister.load();
      let storedUserId = userStore.getCell('user', 'data', 'id') as string | null;

      if (!storedUserId) {
        // If userId is not in store, get it from Telegram
        const telegramUserId = WebApp.initDataUnsafe?.user?.id?.toString();
        if (telegramUserId) {
          storedUserId = telegramUserId;
          // Store the userId in TinyBase
          userStore.setCell('user', 'data', 'id', telegramUserId);
          await userPersister.save();
        } else {
          console.error('Unable to get user ID from Telegram');
        }
      }

      setUserId(storedUserId);

      if (storedUserId) {
        getUserReferralLink(storedUserId);
      } else {
        console.error('User ID not found in store or Telegram');
      }
    };

    initializeUserData().catch(console.error);
  }, []);

  const getUserReferralLink = async (telegramUserId: string) => {
    try {
      const functionUrl = 'https://asia-southeast1-fourth-buffer-421320.cloudfunctions.net/telegramReferral/getUserReferralLink';
      
      const response = await axios.post(functionUrl, { telegramUserId });
      setReferralLink(response.data.referralLink);
      setReferralCode(response.data.referralCode);
    } catch (error) {
      console.error('Error fetching referral link:', error);
      // Handle error (e.g., show error message to user)
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    alert('Referral link copied to clipboard!');
  };

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
