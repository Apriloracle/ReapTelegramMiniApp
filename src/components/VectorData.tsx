import React, { useEffect, useState, useCallback } from 'react';
import { createStore } from 'tinybase';
import { createYjsPersister } from 'tinybase/persisters/persister-yjs';
import { createPglitePersister } from 'tinybase/persisters/persister-pglite';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import { Doc } from 'yjs';
import { PGlite } from '@electric-sql/pglite';
import Annoy from '../lib/annoy';
import Graph from 'graphology';
import { addDays, isAfter, isBefore } from 'date-fns';

// Define the Deal interface here
interface Deal {
  id: string;
  dealId: string;
  merchantName: string;
  title?: string;
  description?: string;
  logo?: string;
  logoAbsoluteUrl?: string;
  expirationDate?: string;
  categories?: string[];
  // Add any other properties that a Deal might have
}

const interactionStore = createStore();
const interactionPersister = createLocalPersister(interactionStore, 'user-interactions');

export const interactionGraph = new Graph();
export const dealGraph = new Graph({ multi: true, type: 'mixed' });  // Allow multiple edges between nodes and mixed node types

export type InteractionType = 'view' | 'click' | 'activate';

export const logInteraction = async (userId: string, dealId: string, type: InteractionType) => {
  await interactionPersister.load();
  
  const interactionId = `${userId}-${dealId}-${Date.now()}`;
  
  interactionStore.setRow('interactions', interactionId, {
    userId,
    dealId,
    type,
    timestamp: Date.now(),
  });

  await interactionPersister.save();

  // Update graph
  if (!interactionGraph.hasNode(userId)) {
    interactionGraph.addNode(userId, { type: 'user' });
  }
  if (!interactionGraph.hasNode(dealId)) {
    interactionGraph.addNode(dealId, { type: 'deal' });
  }

  const edgeId = `${userId}-${dealId}`;
  if (interactionGraph.hasEdge(edgeId)) {
    const weight = interactionGraph.getEdgeAttribute(edgeId, 'weight') || 0;
    interactionGraph.setEdgeAttribute(edgeId, 'weight', weight + 1);
    interactionGraph.setEdgeAttribute(edgeId, type, (interactionGraph.getEdgeAttribute(edgeId, type) || 0) + 1);
  } else {
    interactionGraph.addEdge(userId, dealId, { weight: 1, [type]: 1 });
  }
};

export const loadInteractions = async () => {
  await interactionPersister.load();
  const interactions = interactionStore.getTable('interactions');
  if (interactions) {
    Object.values(interactions).forEach((interaction: any) => {
      logInteraction(interaction.userId, interaction.dealId, interaction.type as InteractionType);
    });
  }
};

export const getCurrentUserId = (): string => {
  // This function should return the current user's ID
  // For now, we'll return a placeholder. In a real app, you'd get this from your auth system
  return 'current-user-id';
};

declare global {
  interface Window {
    ml5?: {
      KNNClassifier: () => any;
    };
  }
}

export function addDealToGraph(deal: any) {
  if (!deal.dealId || !deal.merchantName) {
    console.warn('Invalid deal data:', deal);
    return;
  }

  if (!dealGraph.hasNode(deal.dealId)) {
    dealGraph.addNode(deal.dealId, {
      type: 'deal',
      ...deal
    });
  }

  // Add edges to merchant
  if (!dealGraph.hasNode(deal.merchantName)) {
    dealGraph.addNode(deal.merchantName, { type: 'merchant' });
  }
  dealGraph.addEdge(deal.dealId, deal.merchantName, { type: 'offered_by' });

  // Add edges for categories or tags if available
  if (deal.categories && Array.isArray(deal.categories)) {
    deal.categories.forEach((category: string) => {
      if (category) {
        if (!dealGraph.hasNode(category)) {
          dealGraph.addNode(category, { type: 'category' });
        }
        dealGraph.addEdge(deal.dealId, category, { type: 'belongs_to' });
      }
    });
  }

  // Add expiration date to deal node
  if (deal.expirationDate) {
    dealGraph.setNodeAttribute(deal.dealId, 'expirationDate', deal.expirationDate);
  }
}

export function addVectorToGraph(dealId: string, vector: number[]) {
  if (dealGraph.hasNode(dealId)) {
    dealGraph.setNodeAttribute(dealId, 'vector', vector);
  } else {
    console.warn(`Attempted to add vector to non-existent deal: ${dealId}`);
  }
}

export function getGraphStats() {
  return {
    nodeCount: dealGraph.order,
    edgeCount: dealGraph.size,
    dealCount: dealGraph.nodes().filter(node => dealGraph.getNodeAttribute(node, 'type') === 'deal').length,
    merchantCount: dealGraph.nodes().filter(node => dealGraph.getNodeAttribute(node, 'type') === 'merchant').length,
    categoryCount: dealGraph.nodes().filter(node => dealGraph.getNodeAttribute(node, 'type') === 'category').length,
    userCount: dealGraph.nodes().filter(node => dealGraph.getNodeAttribute(node, 'type') === 'user').length,
    interestCount: dealGraph.nodes().filter(node => dealGraph.getNodeAttribute(node, 'type') === 'interest').length,
  };
}

export function getDealVector(dealId: string): number[] | null {
  if (dealGraph.hasNode(dealId)) {
    return dealGraph.getNodeAttribute(dealId, 'vector') || null;
  }
  return null;
}

export function getRelatedDeals(dealId: string): string[] {
  if (!dealGraph.hasNode(dealId)) return [];

  const relatedDeals = new Set<string>();

  // Get deals from the same merchant
  const merchants = dealGraph.neighbors(dealId, 'out', 'offered_by');
  merchants.forEach(merchant => {
    dealGraph.neighbors(merchant, 'in', 'offered_by').forEach(deal => relatedDeals.add(deal));
  });

  // Get deals from the same categories
  const categories = dealGraph.neighbors(dealId, 'out', 'belongs_to');
  categories.forEach(category => {
    dealGraph.neighbors(category, 'in', 'belongs_to').forEach(deal => relatedDeals.add(deal));
  });

  // Remove the original deal from the set
  relatedDeals.delete(dealId);

  return Array.from(relatedDeals);
}

function connectSimilarDeals(similarityThreshold: number) {
  const deals = dealGraph.nodes().filter(node => dealGraph.getNodeAttribute(node, 'type') === 'deal');
  
  for (let i = 0; i < deals.length; i++) {
    const dealA = deals[i];
    const vectorA = dealGraph.getNodeAttribute(dealA, 'vector');
    
    for (let j = i + 1; j < deals.length; j++) {
      const dealB = deals[j];
      const vectorB = dealGraph.getNodeAttribute(dealB, 'vector');
      
      const similarity = cosineSimilarity(vectorA, vectorB);
      
      if (similarity > similarityThreshold) {
        dealGraph.addEdge(dealA, dealB, { type: 'similar', weight: similarity });
      }
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, _, i) => sum + a[i] * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Call this after building the initial graph
connectSimilarDeals(0.8); // Adjust threshold as needed

export function addUserToGraph(userId: string, userProfile: any) {
  if (!dealGraph.hasNode(userId)) {
    dealGraph.addNode(userId, {
      type: 'user',
      ...userProfile
    });
  } else {
    // Update existing user node with new profile data
    Object.entries(userProfile).forEach(([key, value]) => {
      dealGraph.setNodeAttribute(userId, key, value);
    });
  }

  // Add edges for user interests
  if (userProfile.interests && Array.isArray(userProfile.interests)) {
    userProfile.interests.forEach((interest: string) => {
      if (interest) {
        if (!dealGraph.hasNode(interest)) {
          dealGraph.addNode(interest, { type: 'interest' });
        }
        dealGraph.addEdge(userId, interest, { type: 'interested_in' });
      }
    });
  }
}

const VectorData: React.FC = () => {
  const [store, setStore] = useState<any>(null);
  const [persister, setPersister] = useState<any>(null);
  const [yjsPersister, setYjsPersister] = useState<any>(null);
  const [annoyIndex, setAnnoyIndex] = useState<Annoy | null>(null);
  const [isAnnoyIndexBuilt, setIsAnnoyIndexBuilt] = useState<boolean>(false);

  const recommendationsStore = React.useMemo(() => createStore(), []);
  const recommendationsPersister = React.useMemo(() => createLocalPersister(recommendationsStore, 'personalized-recommendations'), [recommendationsStore]);

  // Constants for Annoy
  const FOREST_SIZE = 10;
  const VECTOR_LEN = 1000; // Match your vector size
  const MAX_LEAF_SIZE = 50;

  useEffect(() => {
    const initializeAnnoy = async () => {
      console.log('Initializing Annoy index...');
      const annoy = new Annoy(FOREST_SIZE, VECTOR_LEN, MAX_LEAF_SIZE);
      setAnnoyIndex(annoy);

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

      const geolocationStore = createStore();
      const geolocationPersister = createLocalPersister(geolocationStore, 'user-geolocation');
      await geolocationPersister.load();

      const deals = dealsStore.getTable('deals');
      const merchantDescriptions = merchantDescriptionStore.getTable('merchants');
      const productRanges = merchantProductRangeStore.getTable('merchants');
      const surveyResponses = surveyStore.getTable('answeredQuestions');

      console.log(`Total deals to process: ${Object.keys(deals).length}`);
      console.log(`Total merchant descriptions: ${Object.keys(merchantDescriptions).length}`);
      console.log(`Total product ranges: ${Object.keys(productRanges).length}`);

      const surveyVector = vectorizeSurveyResponses(surveyResponses);
      const geolocationData = geolocationStore.getRow('geolocation', 'userGeo');
      const geoVector = vectorizeGeolocation(geolocationData);

      console.log('Survey Vector length:', surveyVector.length);
      console.log('Geo Vector length:', geoVector.length);

      let validDealsCount = 0;
      let invalidDealsCount = 0;

      for (const [dealId, deal] of Object.entries(deals)) {
        const merchantName = deal.merchantName as string;
        const description = merchantDescriptions[merchantName]?.name || '';
        const productRange = productRanges[merchantName]?.productRange || '';
        
        const combinedData = `${deal.merchantName} ${deal.cashbackType} ${deal.cashback} ${description} ${productRange}`;
        const dealVector = simpleVectorize(combinedData);
        const combinedVector = combineVectors([dealVector, surveyVector, geoVector]);

        if (combinedVector.length === VECTOR_LEN) {
          try {
            annoy.add({ v: combinedVector, d: { id: dealId, ...deal } });
            validDealsCount++;
          } catch (error) {
            console.error(`Error adding deal ${dealId}:`, error);
            invalidDealsCount++;
          }
        } else {
          console.error(`Invalid vector length for deal ${dealId}: ${combinedVector.length}`);
          invalidDealsCount++;
        }
      }

      console.log(`Total valid deals added to Annoy index: ${validDealsCount}`);
      console.log(`Total invalid deals skipped: ${invalidDealsCount}`);

      setIsAnnoyIndexBuilt(true);
      console.log('Annoy index built with vectorized deal data');
    };

    initializeAnnoy();
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

  const euclideanDistance = (v1: number[], v2: number[]): number => {
    return Math.sqrt(v1.reduce((sum, x, i) => sum + Math.pow(x - v2[i], 2), 0));
  };

  const getPersonalizedRecommendations = useCallback(async (userProfile: any, topK: number = 5) => {
    if (!annoyIndex || !isAnnoyIndexBuilt) {
      console.error('Annoy index not initialized or not built');
      return [];
    }

    console.log('Getting personalized recommendations...');
    console.log('User profile:', userProfile);

    const deviceData = getDeviceData();
    const deviceVector = vectorizeDeviceData(deviceData);

    const userVector = combineVectors([
      simpleVectorize(`${userProfile.interests.join(' ')} ${userProfile.shoppingFrequency}`),
      vectorizeSurveyResponses(userProfile.surveyResponses || {}),
      vectorizeGeolocation(userProfile.geolocation || {}),
      deviceVector
    ]);

    console.log('User vector length:', userVector.length);

    if (userVector.length !== VECTOR_LEN) {
      console.error('Invalid user vector length');
      return [];
    }

    try {
      const recommendations = annoyIndex.get(userVector, topK);
      console.log('Raw recommendations from Annoy:', recommendations);
      
      const sortedResults = recommendations
        .filter(rec => rec && rec.d && rec.v)
        .map(rec => ({
          dealId: rec.d.id,
          confidence: 1 - euclideanDistance(userVector, rec.v)
        }))
        .sort((a, b) => b.confidence - a.confidence);

      console.log('Sorted and filtered recommendations:', sortedResults);

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
  }, [annoyIndex, isAnnoyIndexBuilt, getDeviceData, recommendationsStore, recommendationsPersister]);

  // Update the example usage with more user data and device data
  useEffect(() => {
    const fetchRecommendations = async () => {
      const surveyStore = createStore();
      const surveyPersister = createLocalPersister(surveyStore, 'survey-responses');
      await surveyPersister.load();

      const geolocationStore = createStore();
      const geolocationPersister = createLocalPersister(geolocationStore, 'user-geolocation');
      await geolocationPersister.load();

      const surveyResponses = surveyStore.getTable('answeredQuestions') || {};
      const geolocationData = geolocationStore.getRow('geolocation', 'userGeo') || {};

      const userProfile = {
        interests: [], // We don't have this stored, so leaving it empty
        shoppingFrequency: '', // We don't have this stored, so leaving it empty
        surveyResponses,
        geolocation: geolocationData
      };

      if (isAnnoyIndexBuilt) {
        console.log('Fetching personalized recommendations...');
        const recommendations = await getPersonalizedRecommendations(userProfile);
        console.log('Personalized recommendations:', recommendations);
      } else {
        console.log('Annoy index not yet built, skipping recommendations');
      }
    };

    if (annoyIndex) {
      fetchRecommendations();
    }
  }, [annoyIndex, isAnnoyIndexBuilt, getPersonalizedRecommendations]);

  useEffect(() => {
    const buildGraph = async () => {
      try {
        // Add deals to the graph
        const dealsStore = createStore();
        const dealsPersister = createLocalPersister(dealsStore, 'kindred-deals');
        await dealsPersister.load();

        const dealsTable = dealsStore.getTable('deals');
        if (dealsTable) {
          Object.values(dealsTable).forEach((deal: any) => {
            if (deal && deal.dealId && deal.merchantName) {
              addDealToGraph(deal);
              const vector = simpleVectorize(`${deal.title || ''} ${deal.description || ''}`);
              addVectorToGraph(deal.dealId, vector);
            } else {
              console.warn('Invalid deal data:', deal);
            }
          });
        }

        // Add users to the graph
        const userStore = createStore();
        const userPersister = createLocalPersister(userStore, 'user-profiles');
        await userPersister.load();

        const userProfiles = userStore.getTable('profiles');
        if (userProfiles) {
          for (const [userId, profile] of Object.entries(userProfiles)) {
            const userProfile = await fetchUserProfile(userId);
            addUserToGraph(userId, { ...profile, ...userProfile });
          }
        }

        console.log('Graph stats:', getGraphStats());
      } catch (error) {
        console.error('Error building graph:', error);
      }
    };

    buildGraph();
  }, []);

  function getRecommendations(userId: string, numRecommendations: number) {
    if (!dealGraph.hasNode(userId)) {
      console.error('User not found in the graph');
      return [];
    }

    const currentDate = new Date();
    
    // Filter out expired deals
    const validDeals = dealGraph.nodes()
      .filter(nodeId => {
        const nodeType = dealGraph.getNodeAttribute(nodeId, 'type');
        const expirationDate = dealGraph.getNodeAttribute(nodeId, 'expirationDate');
        return nodeType === 'deal' && isAfter(new Date(expirationDate), currentDate);
      });

    // Get user interests
    const userInterests = dealGraph.neighbors(userId, 'out', 'interested_in');

    // Calculate scores and sort
    const scoredResults = validDeals.map(dealId => ({
      id: dealId,
      score: calculateRecommendationScore(userId, dealId, userInterests)
    }));

    // Sort by score (descending) and limit to numRecommendations
    return scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, numRecommendations);
  }

  function calculateRecommendationScore(userId: string, dealId: string, userInterests: string[]): number {
    let score = 0;
    const currentDate = new Date();
    const expirationDate = new Date(dealGraph.getNodeAttribute(dealId, 'expirationDate'));

    // Interest match score (keep this part as is)
    const dealCategories = dealGraph.neighbors(dealId, 'out', 'belongs_to');
    const interestMatchScore = userInterests.reduce((sum, interest) => {
      return sum + (dealCategories.includes(interest) ? 1 : 0);
    }, 0) / userInterests.length;
    score += interestMatchScore;

    // Interaction score
    if (interactionGraph.hasEdge(userId, dealId)) {
      const edgeAttributes = interactionGraph.getEdgeAttributes(userId, dealId);
      const interactionScore = (edgeAttributes.view || 0) * 0.1 +
                               (edgeAttributes.click || 0) * 0.3 +
                               (edgeAttributes.activate || 0) * 0.6;
      
      // Consider recency of interactions
      const lastInteractionTime = edgeAttributes.timestamp || 0;
      const daysSinceLastInteraction = (currentDate.getTime() - lastInteractionTime) / (1000 * 3600 * 24);
      const recencyFactor = Math.exp(-daysSinceLastInteraction / 30); // Decay factor, adjust as needed
      
      score += interactionScore * recencyFactor;
    }

    // Time relevance score (keep this part as is)
    const daysUntilExpiration = Math.max(0, (expirationDate.getTime() - currentDate.getTime()) / (1000 * 3600 * 24));
    const timeRelevanceScore = Math.min(1, daysUntilExpiration / 30);
    score += timeRelevanceScore;

    return score;
  }

  function getUserVector(userId: string): number[] | null {
    // Implement this function to retrieve the user vector based on the userId
    // For now, we'll return null to indicate that the function is not implemented
    return null;
  }

  return null;
};

export const buildInteractionGraph = async (): Promise<Graph> => {
  // Initialize store and persister
  const interactionStore = createStore();
  const interactionPersister = createLocalPersister(interactionStore, 'user-interactions');
  await interactionPersister.load();

  // Create a new graph instance
  const graph = new Graph();

  // Fetch interactions
  const interactions = interactionStore.getTable('interactions') || {};

  // Build graph nodes and edges
  Object.values(interactions).forEach((interaction: any) => {
    const { userId, dealId } = interaction;

    // Add user node if it doesn't exist
    if (!graph.hasNode(userId)) {
      graph.addNode(userId, { type: 'user' });
    }

    // Add deal node if it doesn't exist
    if (!graph.hasNode(dealId)) {
      graph.addNode(dealId, { type: 'deal' });
    }

    // Add or update edge between user and deal
    const edgeId = `${userId}-${dealId}`;
    if (graph.hasEdge(edgeId)) {
      const existingWeight = graph.getEdgeAttribute(edgeId, 'weight');
      graph.setEdgeAttribute(edgeId, 'weight', existingWeight + 1);
    } else {
      graph.addEdge(userId, dealId, { weight: 1 });
    }
  });

  return graph;
};

async function fetchUserProfile(userId: string) {
  const surveyStore = createStore();
  const surveyPersister = createLocalPersister(surveyStore, 'survey-responses');
  await surveyPersister.load();

  const geolocationStore = createStore();
  const geolocationPersister = createLocalPersister(geolocationStore, 'user-geolocation');
  await geolocationPersister.load();

  const surveyResponses = surveyStore.getTable('answeredQuestions') || {};
  const geolocationData = geolocationStore.getRow('geolocation', 'userGeo') || {};

  // Map survey responses to user profile fields
  const interests = [];
  if (surveyResponses['Are you interested in photography?']?.answer === 'Yes') {
    interests.push('Photography');
  }
  if (surveyResponses['Are you interested in sports?']?.answer === 'Yes') {
    interests.push('Sports');
  }

  const shoppingFrequency = surveyResponses['How often do you shop online?']?.answer || '';

  return {
    interests,
    shoppingFrequency,
    surveyResponses,
    geolocation: geolocationData
  };
}

export default VectorData;
