import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

interface ProfileComponentProps {
  localWalletAddress: string | null;
  address: string | undefined;
}

const ProfileComponent: React.FC<ProfileComponentProps> = ({ localWalletAddress, address }) => {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [copySuccess, setCopySuccess] = useState<string>('');

  useEffect(() => {
    const fetchUserProfile = async () => {
      const surveyStore = createStore();
      const surveyPersister = createLocalPersister(surveyStore, 'survey-responses');
      await surveyPersister.load();

      const surveyResponses = surveyStore.getTable('answeredQuestions') || {};

      const interests = [];
      if (surveyResponses['Are you interested in photography?']?.answer === 'Yes') {
        interests.push('Photography');
      }
      if (surveyResponses['Are you interested in sports?']?.answer === 'Yes') {
        interests.push('Sports');
      }

      const shoppingFrequency = surveyResponses['How often do you shop online?']?.answer || '';

      setUserProfile({
        interests,
        shoppingFrequency,
        surveyResponses,
      });
    };

    fetchUserProfile();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    }, (err) => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div style={{ padding: '1rem', backgroundColor: '#000000', minHeight: '100vh', color: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ color: '#f05e23', margin: 0 }}>User Profile</h2>
      </div>
      
      {localWalletAddress && (
        <div style={{ marginBottom: '1rem', fontSize: '1rem', color: '#A0AEC0', wordBreak: 'break-all' }}>
          <strong>Local Wallet:</strong> {localWalletAddress}
        </div>
      )}
      {address && (
        <div style={{ marginBottom: '1rem', fontSize: '1rem', color: '#A0AEC0', wordBreak: 'break-all' }}>
          <strong>Connected Wallet:</strong> {address}
          <button 
            onClick={() => copyToClipboard(address)}
            style={{
              backgroundColor: '#f05e23',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginLeft: '0.5rem',
            }}
          >
            Copy
          </button>
          {copySuccess && <span style={{ color: '#4CAF50', marginLeft: '0.5rem' }}>{copySuccess}</span>}
        </div>
      )}
      
      {userProfile ? (
        <div>
          <h3 style={{ color: '#f05e23' }}>Interests</h3>
          <ul style={{ fontSize: '1rem' }}>
            {userProfile.interests.map((interest: string, index: number) => (
              <li key={index}>{interest}</li>
            ))}
          </ul>

          <h3 style={{ color: '#f05e23' }}>Shopping Frequency</h3>
          <p style={{ fontSize: '1rem' }}>{userProfile.shoppingFrequency}</p>

          <h3 style={{ color: '#f05e23' }}>Survey Responses</h3>
          {Object.entries(userProfile.surveyResponses).map(([question, response]: [string, any]) => (
            <div key={question} style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
              <p><strong>{question}</strong>: {response.answer}</p>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: '1rem' }}>Loading user profile...</p>
      )}
    </div>
  );
};

export default ProfileComponent;