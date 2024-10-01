import React from 'react';
import { useNavigate } from 'react-router-dom';

const EarnComponent: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '1rem', backgroundColor: '#000000', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ color: '#f05e23', margin: 0 }}>Earn Rewards</h2>
      </div>
      
      <div style={{ marginBottom: '1rem', backgroundColor: '#3D261B', borderRadius: '0.5rem', padding: '1rem' }}>
        <h3 style={{ color: '#f05e23', marginTop: 0 }}>Refer Friends</h3>
        <p style={{ color: '#FFFFFF' }}>Invite friends and earn rewards when they join and complete activities.</p>
        <button 
          onClick={() => navigate('/friends')}
          style={{
            backgroundColor: '#f05e23',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            cursor: 'pointer',
            marginTop: '0.5rem'
          }}
        >
          Go to Referrals
        </button>
      </div>

      <div style={{ marginBottom: '1rem', backgroundColor: '#3D261B', borderRadius: '0.5rem', padding: '1rem' }}>
        <h3 style={{ color: '#f05e23', marginTop: 0 }}>Earn from Surveys</h3>
        <p style={{ color: '#FFFFFF' }}>Complete surveys and earn rewards for your opinions.</p>
        <button 
          onClick={() => navigate('/surveys')}
          style={{
            backgroundColor: '#f05e23',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            cursor: 'pointer',
            marginTop: '0.5rem'
          }}
        >
          Take Surveys
        </button>
      </div>

      <div style={{ backgroundColor: '#3D261B', borderRadius: '0.5rem', padding: '1rem' }}>
        <h3 style={{ color: '#f05e23', marginTop: 0 }}>Shop and Earn</h3>
        <p style={{ color: '#FFFFFF' }}>Earn cashback and rewards by shopping through our partner merchants.</p>
        <button 
          onClick={() => navigate('/deals')}
          style={{
            backgroundColor: '#f05e23',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            cursor: 'pointer',
            marginTop: '0.5rem'
          }}
        >
          View Deals
        </button>
      </div>
    </div>
  );
};

export default EarnComponent;