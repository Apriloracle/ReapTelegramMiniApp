import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Declare the adsbygoogle property on the window object
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

const WatchAdsComponent: React.FC = () => {
  const navigate = useNavigate();
  const [adWatched, setAdWatched] = useState(false);

  useEffect(() => {
    // Load Google AdSense script
    const script = document.createElement('script');
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3797921058365233';
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);

    // Initialize ads
    (window.adsbygoogle = window.adsbygoogle || []).push({});

    return () => {
      // Clean up script when component unmounts
      document.body.removeChild(script);
    };
  }, []);

  const handleWatchAd = () => {
    // Simulating ad watching process
    setTimeout(() => {
      setAdWatched(true);
    }, 3000); // 3 seconds delay to simulate ad watching
  };

  return (
    <div style={{ padding: '1rem', backgroundColor: '#000000', minHeight: '100vh', color: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/earn')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ color: '#f05e23', margin: 0 }}>Watch Ads</h2>
      </div>

      <div style={{ backgroundColor: '#3D261B', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ color: '#f05e23', marginTop: 0 }}>Available Ads</h3>
        <p>Watch ads to earn rewards. Each ad watched will earn you points!</p>
      </div>

      {/* Google AdSense Ad */}
      <ins className="adsbygoogle"
           style={{ display: 'block', marginBottom: '1rem' }}
           data-ad-client="ca-pub-3797921058365233"
           data-ad-slot="8693944559"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>

      <div style={{ backgroundColor: '#3D261B', borderRadius: '0.5rem', padding: '1rem' }}>
        {!adWatched ? (
          <>
            <p>Ready to watch an ad?</p>
            <button 
              onClick={handleWatchAd}
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
              Watch Ad
            </button>
          </>
        ) : (
          <>
            <p>Great job! You've earned rewards for watching the ad.</p>
            <button 
              onClick={() => setAdWatched(false)}
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
              Watch Another Ad
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default WatchAdsComponent;
