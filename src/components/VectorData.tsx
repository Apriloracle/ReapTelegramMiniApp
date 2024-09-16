import React, { useEffect, useState, useCallback } from 'react';
import { createStore } from 'tinybase';
import { createYjsPersister } from 'tinybase/persisters/persister-yjs';
import { createPglitePersister } from 'tinybase/persisters/persister-pglite';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import { Doc } from 'yjs';
import { PGlite } from '@electric-sql/pglite';

declare global {
  interface Window {
    ml5?: {
      KNNClassifier: () => any;
    };
  }
}

const VectorData: React.FC = () => {
  const [store, setStore] = useState<any>(null);
  const [persister, setPersister] = useState<any>(null);
  const [yjsPersister, setYjsPersister] = useState<any>(null);
  const [classifier, setClassifier] = useState<any>(null);
  const [ml5Available, setMl5Available] = useState<boolean>(false);
  const [isClassifierTrained, setIsClassifierTrained] = useState<boolean>(false);

  const recommendationsStore = React.useMemo(() => createStore(), []);
  const recommendationsPersister = React.useMemo(() => createLocalPersister(recommendationsStore, 'personalized-recommendations'), [recommendationsStore]);

  useEffect(() => {
    const initializeStore = async () => {
      console.log('Initializing stores...');
      const pglite = await PGlite.create();
      const newStore = createStore();
      const yDoc = new Doc();
      
      // Initialize PGlite persister for vector data
      const newPersister = await createPglitePersister(newStore, pglite, {
        mode: 'tabular',
        tables: {
          load: { vectorData: 'vector_data' },
          save: { vectorData: 'vector_data' },
        },
      });

      // Initialize Yjs persister
      const newYjsPersister = createYjsPersister(newStore, yDoc, 'vectorData');

      setStore(newStore);
      setPersister(newPersister);
      setYjsPersister(newYjsPersister);

      // Create the VectRecomDeals table without vector support
      await pglite.query(`
        CREATE TABLE IF NOT EXISTS VectRecomDeals (
          _id TEXT PRIMARY KEY,
          vector JSONB,
          metadata JSONB
        )
      `);

      console.log('Stores initialized and tables created');

      // Load data from other stores
      const dealsStore = createStore();
      const dealsPersister = createLocalPersister(dealsStore, 'kindred-deals');
      await dealsPersister.load();

      const merchantDescriptionStore = createStore();
      const merchantDescriptionPersister = createLocalPersister(merchantDescriptionStore, 'merchant-descriptions');
      await merchantDescriptionPersister.load();

      const merchantProductRangeStore = createStore();
      const merchantProductRangePersister = createLocalPersister(merchantProductRangeStore, 'merchant-product-range');
      await merchantProductRangePersister.load();

      const surveyStore = createStore();
      const surveyPersister = createLocalPersister(surveyStore, 'survey-responses');
      await surveyPersister.load();

      // Combine and vectorize data
      const deals = dealsStore.getTable('deals');
      const merchantDescriptions = merchantDescriptionStore.getTable('merchants');
      const productRanges = merchantProductRangeStore.getTable('merchants');
      const surveyResponses = surveyStore.getTable('answeredQuestions');

      // Vectorize survey responses
      const surveyVector = vectorizeSurveyResponses(surveyResponses);

      // Load geolocation data
      const geolocationStore = createStore();
      const geolocationPersister = createLocalPersister(geolocationStore, 'user-geolocation');
      await geolocationPersister.load();

      // Retrieve geolocation data
      const geolocationData = geolocationStore.getRow('geolocation', 'userGeo');
      const geoVector = vectorizeGeolocation(geolocationData);

      // Check if ml5 is available
      if (typeof window !== 'undefined' && window.ml5 && window.ml5.KNNClassifier) {
        setMl5Available(true);
        const knnClassifier = window.ml5.KNNClassifier();
        console.log('KNN Classifier initialized');
        setClassifier(knnClassifier);

        let exampleAdded = false;

        for (const [dealId, deal] of Object.entries(deals)) {
          const merchantName = deal.merchantName as string;
          const description = merchantDescriptions[merchantName]?.name || '';
          const productRange = productRanges[merchantName]?.productRange || '';
          
          // Combine all relevant data
          const combinedData = `${deal.merchantName} ${deal.cashbackType} ${deal.cashback} ${description} ${productRange}`;
          
          // Vectorize the combined data using simple method
          const dealVector = simpleVectorize(combinedData);
          
          // Combine deal vector with survey vector and geolocation vector
          const combinedVector = combineVectors([dealVector, surveyVector, geoVector]);
          
          // Add the combined vector to the KNN Classifier
          knnClassifier.addExample(combinedVector, dealId);
          exampleAdded = true;
          
          await pglite.query(`
            INSERT INTO VectRecomDeals (_id, vector, metadata)
            VALUES ($1, $2, $3)
            ON CONFLICT (_id) DO UPDATE
            SET vector = EXCLUDED.vector, metadata = EXCLUDED.metadata
          `, [dealId, JSON.stringify(combinedVector), JSON.stringify({ ...deal, surveyResponses, geolocation: geolocationData })]);
        }

        if (exampleAdded) {
          setIsClassifierTrained(true);
          console.log('KNN Classifier trained with vectorized deal data');
        } else {
          console.warn('No examples added to the KNN Classifier');
        }
      } else {
        console.warn('ml5 library not available. KNN Classifier functionality will be limited.');
      }

      console.log('Vectorized data including survey responses and geolocation stored in VectRecomDeals');
    };

    initializeStore();

    return () => {
      if (persister) {
        persister.destroy();
      }
      if (yjsPersister) {
        yjsPersister.destroy();
      }
      console.log('Persisters destroyed');
    };
  }, []);

  // Update the simpleVectorize function to use a larger vector size
  const simpleVectorize = (text: string): number[] => {
    const words = text.toLowerCase().split(/\W+/);
    const vector = new Array(1000).fill(0); // Increase vector size to 1000
    words.forEach((word) => {
      const hash = simpleHash(word);
      vector[hash % 1000] += 1; // Use modulo 1000
    });
    return vector;
  };

  // Simple hash function
  const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };

  // Update vectorizeSurveyResponses to use the new vector size
  const vectorizeSurveyResponses = (surveyResponses: Record<string, any>): number[] => {
    const vector = new Array(1000).fill(0);
    for (const [question, response] of Object.entries(surveyResponses)) {
      const answer = response.answer as string;
      const combinedText = `${question} ${answer}`;
      const responseVector = simpleVectorize(combinedText);
      for (let i = 0; i < vector.length; i++) {
        vector[i] += responseVector[i];
      }
    }
    return vector;
  };

  // Update vectorizeGeolocation to use the new vector size
  const vectorizeGeolocation = (geolocationData: any): number[] => {
    const vector = new Array(1000).fill(0);
    if (geolocationData && geolocationData.countryCode) {
      const geoText = `${geolocationData.countryCode} ${geolocationData.ip || ''}`;
      const geoVector = simpleVectorize(geoText);
      for (let i = 0; i < vector.length; i++) {
        vector[i] += geoVector[i];
      }
    }
    return vector;
  };

  // Update the combineVectors function to normalize the result
  const combineVectors = (vectors: number[][]): number[] => {
    const resultVector = new Array(1000).fill(0); // Match the new vector size
    for (const vector of vectors) {
      for (let i = 0; i < resultVector.length; i++) {
        resultVector[i] += vector[i];
      }
    }
    // Normalize the combined vector
    const magnitude = Math.sqrt(resultVector.reduce((sum, val) => sum + val * val, 0));
    return resultVector.map(val => val / magnitude);
  };

  const getDeviceData = useCallback(() => {
    const deviceData: any = {};

    // Device information
    deviceData.deviceType = /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile/.test(navigator.userAgent) ? 'mobile' : 'desktop';
    deviceData.os = navigator.platform;
    deviceData.browser = navigator.userAgent;

    // Time-based information
    const now = new Date();
    deviceData.timeOfDay = now.getHours();
    deviceData.dayOfWeek = now.getDay();
    deviceData.month = now.getMonth();

    // Network information
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      deviceData.connectionType = connection.effectiveType;
      deviceData.networkSpeed = connection.downlink;
    }

    // Screen properties
    deviceData.screenWidth = window.screen.width;
    deviceData.screenHeight = window.screen.height;
    deviceData.colorDepth = window.screen.colorDepth;

    // Language and locale
    deviceData.language = navigator.language;
    deviceData.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Battery status
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        deviceData.batteryLevel = battery.level;
        deviceData.isCharging = battery.charging;
      });
    }

    return deviceData;
  }, []);

  const vectorizeDeviceData = (deviceData: any): number[] => {
    const vector = new Array(1000).fill(0);
    
    // Encode device type
    vector[0] = deviceData.deviceType === 'mobile' ? 1 : 0;
    
    // Encode time of day (0-23)
    vector[1] = deviceData.timeOfDay / 23;
    
    // Encode day of week (0-6)
    vector[2] = deviceData.dayOfWeek / 6;
    
    // Encode month (0-11)
    vector[3] = deviceData.month / 11;
    
    // Encode network speed (normalized, assuming max speed of 100 Mbps)
    vector[4] = Math.min(deviceData.networkSpeed / 100, 1);
    
    // Encode screen size (normalized, assuming max width of 4000 pixels)
    vector[5] = Math.min(deviceData.screenWidth / 4000, 1);
    
    // Add more encodings for other device data...
    
    return vector;
  };

  // Update getPersonalizedRecommendations to include device data
  const getPersonalizedRecommendations = useCallback(async (userProfile: any, topK: number = 5) => {
    if (!classifier || !ml5Available || !isClassifierTrained) {
      console.error('Classifier not initialized, ml5 not available, or classifier not trained');
      return [];
    }

    const deviceData = getDeviceData();
    const deviceVector = vectorizeDeviceData(deviceData);

    // Vectorize user profile with more data
    const userVector = combineVectors([
      simpleVectorize(`${userProfile.interests.join(' ')} ${userProfile.shoppingFrequency}`),
      vectorizeSurveyResponses(userProfile.surveyResponses || {}),
      vectorizeGeolocation(userProfile.geolocation || {}),
      deviceVector
    ]);

    try {
      // Get recommendations
      const results = await classifier.classify(userVector, topK);
      
      if (!results || !results.confidencesByLabel) {
        console.error('Unexpected results format from classifier');
        return [];
      }

      const sortedResults = Object.entries(results.confidencesByLabel)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, topK)
        .map(([dealId, confidence]) => ({ dealId, confidence: confidence as number }));

      // Store recommendations in TinyBase
      const recommendationsTable: Record<string, Record<string, any>> = {};
      sortedResults.forEach((rec, index) => {
        recommendationsTable[index.toString()] = rec;
      });
      recommendationsStore.setTable('recommendations', recommendationsTable);
      await recommendationsPersister.save();

      return sortedResults;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }, [classifier, ml5Available, isClassifierTrained, getDeviceData, recommendationsStore, recommendationsPersister]);

  // Update the example usage with more user data and device data
  useEffect(() => {
    const fetchRecommendations = async () => {
      const userProfile = {
        interests: ['Tech', 'Fashion'],
        shoppingFrequency: 'Weekly',
        surveyResponses: {
          favoriteColors: { answer: 'Blue, Green' },
          preferredBrands: { answer: 'Apple, Nike' }
        },
        geolocation: {
          countryCode: 'US',
          ip: '192.168.1.1'
        }
      };

      if (isClassifierTrained) {
        const recommendations = await getPersonalizedRecommendations(userProfile);
        console.log('Personalized recommendations:', recommendations);
      } else {
        console.log('Classifier not yet trained, skipping recommendations');
      }
    };

    if (classifier && ml5Available) {
      fetchRecommendations();
    }
  }, [classifier, ml5Available, isClassifierTrained, getPersonalizedRecommendations]);

  return null;
};

export default VectorData;