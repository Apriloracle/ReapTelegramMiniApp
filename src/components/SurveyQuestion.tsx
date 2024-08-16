import React, { useState, useEffect } from 'react';

interface SurveyQuestionProps {
  onResponse: (question: string, response: string) => void;
  onClose: () => void;
}

const SurveyQuestion: React.FC<SurveyQuestionProps> = ({ onResponse, onClose }) => {
  const [question, setQuestion] = useState<string>('');
  const [options, setOptions] = useState<string[]>([]);

  const surveyQuestions = [
    { question: "Which do you prefer?", options: ["Fashion", "Electronics"] },
    { question: "Are you interested in deals from Amazon?", options: ["Yes", "No"] },
    { question: "What type of products do you shop for most?", options: ["Home Goods", "Tech Gadgets", "Clothing", "Food"] },
    { question: "How often do you shop online?", options: ["Daily", "Weekly", "Monthly", "Rarely"] },
    { question: "What's your preferred payment method?", options: ["Credit Card", "PayPal", "Crypto", "Bank Transfer"] }
  ];

  useEffect(() => {
    selectRandomSurveyQuestion();
  }, []);

  const selectRandomSurveyQuestion = () => {
    const randomQuestion = surveyQuestions[Math.floor(Math.random() * surveyQuestions.length)];
    setQuestion(randomQuestion.question);
    setOptions(randomQuestion.options);
  };

  const handleResponse = (response: string) => {
    onResponse(question, response);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        maxWidth: '80%',
        width: '300px',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}>
        <h3 style={{ color: '#f05e23', marginBottom: '1rem', fontSize: '1.2rem' }}>{question}</h3>
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleResponse(option)}
            style={{
              backgroundColor: '#f05e23',
              color: 'white',
              padding: '0.75rem 1rem',
              margin: '0.5rem 0',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              width: '100%',
              fontSize: '1rem',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d54d1b'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f05e23'}
          >
            {option}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            color: '#a0aec0',
            border: 'none',
            marginTop: '1rem',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
};

export default SurveyQuestion;
