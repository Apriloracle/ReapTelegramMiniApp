import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SurveyList.module.css';

function SurveyList() {
  const navigate = useNavigate();

  useEffect(() => {
    // Add the CPX Research script
    const script = document.createElement('script');
    script.src = 'https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js';
    script.async = true;

    // Add the configuration script
    const configScript = document.createElement('script');
    configScript.textContent = `
      (function() {
        const script1 = {
          div_id: "fullscreen",
          theme_style: 1,
          order_by: 1,
          limit_surveys: 10
        };

        const config = {
          general_config: {
            app_id: 22722,
            ext_user_id: "your_user_id", // Replace with actual user ID
          },
          style_config: {
            text_color: "#FFFFFF",
            survey_box: {
              topbar_background_color: "#f05e23",
              box_background_color: "#000000",
              rounded_borders: true,
              stars_filled: "#f05e23",
            },
          },
          script_config: [script1],
          debug: false,
          useIFrame: true,
          iFramePosition: 1,
        };

        window.config = config;
      })();
    `;

    // Append scripts to the body
    document.body.appendChild(configScript);
    document.body.appendChild(script);

    // Cleanup function to remove scripts when component unmounts
    return () => {
      document.body.removeChild(script);
      document.body.removeChild(configScript);
    };
  }, []);

  return (
    <div style={{ padding: '1rem', backgroundColor: '#000000', minHeight: '100vh', color: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/earn')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="#f05e23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ color: '#f05e23', margin: 0 }}>Available Surveys</h2>
      </div>
      
      <div style={{maxWidth: '950px', margin: 'auto'}} id="fullscreen"></div>
    </div>
  );
}

export default SurveyList;