import React, { useState, useEffect } from 'react';
import { createStore } from 'tinybase';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';

interface SurveyQuestionProps {
  onResponse: (question: string, response: string) => void;
  onClose: () => void;
}

const SurveyQuestion: React.FC<SurveyQuestionProps> = ({ onResponse, onClose }) => {
  const [question, setQuestion] = useState<string>('');
  const [options, setOptions] = useState<string[]>([]);
  const [isInteractionEnabled, setIsInteractionEnabled] = useState<boolean>(false);
  const [surveyStore] = useState(() => createStore());
  const [surveyPersister] = useState(() => createLocalPersister(surveyStore, 'survey-responses'));
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState<boolean>(false);

  const surveyQuestions = [
    { question: "Which do you prefer?", options: ["Fashion", "Electronics"] },
    { question: "What type of products do you shop for most?", options: ["Home Goods", "Tech Gadgets", "Clothing", "Food"] },
    { question: "How often do you shop online?", options: ["Daily", "Weekly", "Monthly", "Rarely"] },
    { question: "Are you interested in deals from Amazon?", options: ["Yes", "No"] },
    { question: "Are you interested in tech?", options: ["Yes", "No"] },
    { question: "Are you interested in cars?", options: ["Yes", "No"] },
    { question: "Are you interested in cooking?", options: ["Yes", "No"] },
    { question: "Are you interested in fashion?", options: ["Yes", "No"] },
    { question: "Are you interested in games?", options: ["Yes", "No"] },
    { question: "Are you interested in art?", options: ["Yes", "No"] },
    { question: "Are you interested in movies?", options: ["Yes", "No"] },
    { question: "Are you interested in sports?", options: ["Yes", "No"] },
    { question: "Are you interested in photography?", options: ["Yes", "No"] },
    { question: "Are you interested in food?", options: ["Yes", "No"] },
    { question: "Do you shop for electronics?", options: ["Yes", "No"] },
    { question: "Do you shop for gaming products?", options: ["Yes", "No"] },
    { question: "Do you shop for computing products?", options: ["Yes", "No"] },
    { question: "Do you shop for sporting gear?", options: ["Yes", "No"] },
    { question: "Do you shop for phones and tablets?", options: ["Yes", "No"] },
    { question: "Do you shop for appliances?", options: ["Yes", "No"] },
    { question: "Do you shop for fashion items?", options: ["Yes", "No"] },
    { question: "What's your preferred payment method?", options: ["Credit Card", "PayPal", "Crypto", "Bank Transfer"] }
  ];

  useEffect(() => {
    const loadSurveyData = async () => {
      await surveyPersister.load();
      selectQuestion();
    };

    loadSurveyData();

    const timer = setTimeout(() => {
      setIsInteractionEnabled(true);
    }, 3000);

    return () => {
      clearTimeout(timer);
      surveyPersister.destroy();
    };
  }, [surveyPersister]);

  const selectQuestion = () => {
    const answeredQuestions = surveyStore.getTable('answeredQuestions') || {};
    const unansweredQuestions = surveyQuestions.filter(q => !answeredQuestions[q.question]);
    
    if (unansweredQuestions.length === 0) {
      setAllQuestionsAnswered(true);
      onClose(); // Close the survey component as all questions have been answered
    } else {
      const randomQuestion = unansweredQuestions[Math.floor(Math.random() * unansweredQuestions.length)];
      setQuestion(randomQuestion.question);
      setOptions(randomQuestion.options);
    }
  };

  const handleResponse = async (response: string) => {
    if (isInteractionEnabled) {
      onResponse(question, response);
      
      // Store the response
      surveyStore.setCell('answeredQuestions', question, 'answer', response);
      await surveyPersister.save();

      onClose(); // Close the current question
    }
  };

  if (allQuestionsAnswered) {
    return null; // Don't render anything if all questions have been answered
  }

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
            disabled={!isInteractionEnabled}
            style={{
              backgroundColor: isInteractionEnabled ? '#f05e23' : '#a0522d',
              color: 'white',
              padding: '0.75rem 1rem',
              margin: '0.5rem 0',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: isInteractionEnabled ? 'pointer' : 'not-allowed',
              width: '100%',
              fontSize: '1rem',
              transition: 'background-color 0.3s, opacity 0.3s',
              opacity: isInteractionEnabled ? 1 : 0.7,
            }}
          >
            {option}
          </button>
        ))}
        <button
          onClick={onClose}
          disabled={!isInteractionEnabled}
          style={{
            backgroundColor: 'transparent',
            color: isInteractionEnabled ? '#a0aec0' : '#6b7280',
            border: 'none',
            marginTop: '1rem',
            cursor: isInteractionEnabled ? 'pointer' : 'not-allowed',
            fontSize: '0.9rem',
            opacity: isInteractionEnabled ? 1 : 0.7,
          }}
        >
          Skip
        </button>
        {!isInteractionEnabled && (
          <p style={{ color: '#a0aec0', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Survey will be active in a moment...
          </p>
        )}
      </div>
    </div>
  );
};

export default SurveyQuestion;

