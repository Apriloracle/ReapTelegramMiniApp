import React, { useEffect, useState, useCallback } from 'react';
import { createStore } from 'tinybase';
import { createYjsPersister } from 'tinybase/persisters/persister-yjs';
import { createPglitePersister } from 'tinybase/persisters/persister-pglite';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import { Doc } from 'yjs';
import { PGlite } from '@electric-sql/pglite';
import Annoy from '../lib/annoy';
import Graph from 'graphology';
import { subgraph } from 'graphology-operators';
import { addDays, isAfter, isBefore } from 'date-fns';
import { calculateDegreeCentrality, getTopKNodesByDegreeCentrality } from '../utils/graphUtils';
import { calculateBetweennessCentrality, getTopKNodesByBetweennessCentrality } from '../utils/graphUtils';
import { logInteraction, loadInteractions, getCurrentUserId, Interaction } from '../utils/interactionLogger';

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

export const interactionGraph = new Graph();
export const dealGraph = new Graph({ multi: true, type: 'mixed' });  // Allow multiple edges between nodes and mixed node types

// Add this new function to calculate vector similarity
function calculateVectorSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }
  const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
  const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export function addDealToGraph(deal: any, vector: number[], merchantDescription: string | number | boolean, productRange: string | number | boolean) {
  if (!deal.dealId || !deal.merchantName) {
    console.warn('Invalid deal data:', deal);
    return;
  }

  const description = String(merchantDescription); // Convert to string
  const productRangeString = String(productRange); // Convert to string

  if (!dealGraph.hasNode(deal.dealId)) {
    dealGraph.addNode(deal.dealId, {
      type: 'deal',
      ...deal,
      vector: vector,
      merchantDescription: description,
      productRange: productRangeString
    });
  }

  // Add edges to merchant
  if (!dealGraph.hasNode(deal.merchantName)) {
    dealGraph.addNode(deal.merchantName, { 
      type: 'merchant',
      description: description,
      productRange: productRangeString
    });
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
        // Connect category to merchant
        dealGraph.addEdge(category, deal.merchantName, { type: 'category_of' });
      }
    });
  }

  // Add expiration date to deal node
  if (deal.expirationDate) {
    dealGraph.setNodeAttribute(deal.dealId, 'expirationDate', deal.expirationDate);
  }

  // Add vector to deal node
  dealGraph.setNodeAttribute(deal.dealId, 'vector', vector);
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

export function getRelatedDeals(dealId: string, k: number = 5): string[] {
  if (!dealGraph.hasNode(dealId)) return [];

  const relatedDeals = new Set<string>();

  // Get deals from the same merchant
  dealGraph.forEachOutNeighbor(dealId, (merchant, attributes) => {
    if (attributes.type === 'offered_by') {
      dealGraph.forEachInNeighbor(merchant, (deal, dealAttributes) => {
        if (dealAttributes.type === 'offered_by') {
          relatedDeals.add(deal);
        }
      });
    }
  });

  // Get deals from the same categories
  dealGraph.forEachOutNeighbor(dealId, (category, attributes) => {
    if (attributes.type === 'belongs_to') {
      dealGraph.forEachInNeighbor(category, (deal, dealAttributes) => {
        if (dealAttributes.type === 'belongs_to') {
          relatedDeals.add(deal);
        }
      });
    }
  });

  // Remove the original deal from the set
  relatedDeals.delete(dealId);

  // Create a subgraph of related deals
  const subgraphNodes = Array.from(relatedDeals);
  const subgraphInstance = subgraph(dealGraph, subgraphNodes);

  // Use betweenness centrality to refine the recommendations
  const topDeals = getTopKNodesByBetweennessCentrality(subgraphInstance, k);

  return topDeals;
}

// New function to connect similar deals
function connectSimilarDeals(similarityThreshold: number) {
  const deals = dealGraph.nodes().filter(node => dealGraph.getNodeAttribute(node, 'type') === 'deal');
  let connectionsAdded = 0;
  
  for (let i = 0; i < deals.length; i++) {
    const dealA = deals[i];
    const vectorA = dealGraph.getNodeAttribute(dealA, 'vector');
    
    for (let j = i + 1; j < deals.length; j++) {
      const dealB = deals[j];
      const vectorB = dealGraph.getNodeAttribute(dealB, 'vector');
      
      if (vectorA && vectorB) {
        const similarity = calculateVectorSimilarity(vectorA, vectorB);
        
        if (similarity >= similarityThreshold) {
          dealGraph.addEdge(dealA, dealB, { type: 'similar', weight: similarity });
          connectionsAdded++;
        }
      }
    }
  }
  console.log(`Connected ${connectionsAdded} similar deals based on vector similarity`);
}

// New function to connect users based on common interactions
function connectUsersWithCommonInteractions(interactionGraph: Graph) {
  const users = interactionGraph.nodes().filter(node => interactionGraph.getNodeAttribute(node, 'type') === 'user');
  let connectionsAdded = 0;
  
  for (let i = 0; i < users.length; i++) {
    const userA = users[i];
    const dealsA = new Set(interactionGraph.outNeighbors(userA));
    
    for (let j = i + 1; j < users.length; j++) {
      const userB = users[j];
      const dealsB = new Set(interactionGraph.outNeighbors(userB));
      
      const commonDeals = new Set(Array.from(dealsA).filter(x => dealsB.has(x)));
      if (commonDeals.size > 0) {
        dealGraph.addEdge(userA, userB, { type: 'common_interests', weight: commonDeals.size });
        connectionsAdded++;
      }
    }
  }
  console.log(`Connected ${connectionsAdded} users based on common interactions`);
}

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
            addDealToGraph(deal, combinedVector, String(description), String(productRange));
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

      // Add survey data to graph
      const userId = getCurrentUserId();
      addUserToGraph(userId, {
        type: 'user',
        surveyResponses: surveyResponses,
        surveyVector: surveyVector
      });

      // Add geolocation data to graph
      addGeolocationToGraph(userId, geolocationData, geoVector);

      console.log(`Total valid deals added to Annoy index and graph: ${validDealsCount}`);
      console.log(`Total invalid deals skipped: ${invalidDealsCount}`);

      // Connect similar deals
      connectSimilarDeals(0.8); // Adjust threshold as needed

      // Build interaction graph
      const interactionGraphInstance = await buildInteractionGraph();
      
      // Connect users with common interactions
      connectUsersWithCommonInteractions(interactionGraphInstance);

      setIsAnnoyIndexBuilt(true);
      console.log('Annoy index and graph built with vectorized deal data');
      console.log('Final graph stats:', getGraphStats());
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

  const getPersonalizedRecommendations = useCallback(async (userProfile: any, topK: number = 10) => {
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
        console.log("Starting to build graph...");

        // Load deals and their vectors
        const dealsStore = createStore();
        const dealsPersister = createLocalPersister(dealsStore, 'kindred-deals');
        await dealsPersister.load();
        const dealsTable = dealsStore.getTable('deals');

        // Load product range vectors
        const merchantProductRangeStore = createStore();
        const merchantProductRangePersister = createLocalPersister(merchantProductRangeStore, 'merchant-product-range');
        await merchantProductRangePersister.load();
        const productRanges = merchantProductRangeStore.getTable('merchants');

        if (dealsTable && productRanges) {
          Object.values(dealsTable).forEach((deal: any) => {
            const merchantVector = productRanges[deal.merchantName]?.vector;
            const merchantDescription = productRanges[deal.merchantName]?.description || '';
            const productRange = productRanges[deal.merchantName]?.productRange || '';
            if (merchantVector && Array.isArray(merchantVector)) {
              addDealToGraph(deal, merchantVector, merchantDescription, productRange);
            } else {
              console.warn(`No valid vector found for merchant: ${deal.merchantName}`);
              addDealToGraph(deal, [], merchantDescription, productRange); // Add deal with empty vector
            }
          });
        }

        console.log("Deals and vectors added to graph. Current graph stats:", getGraphStats());

        // Load and apply interactions
        await loadInteractions();

        console.log("Interactions loaded. Current graph stats:", getGraphStats());

        // Connect similar deals using vector similarity
        connectSimilarDeals(0.8); // Adjust threshold as needed

        console.log("Similar deals connected based on vector similarity. Current graph stats:", getGraphStats());

        // Connect users with common interactions
        connectUsersWithCommonInteractions(interactionGraph);

        console.log("Users with common interactions connected. Final graph stats:", getGraphStats());

        // Log degree and betweenness centrality for each node
        const degreeCentrality = calculateDegreeCentrality(dealGraph);
        const betweennessCentrality = calculateBetweennessCentrality(dealGraph);

        dealGraph.forEachNode((nodeId) => {
          const nodeType = dealGraph.getNodeAttribute(nodeId, 'type');
          const degree = degreeCentrality.get(nodeId) || 0;
          const betweenness = betweennessCentrality.get(nodeId) || 0;

          console.log(`Node: ${nodeId} (Type: ${nodeType})`);
          console.log(`  Degree Centrality: ${degree}`);
          console.log(`  Betweenness Centrality: ${betweenness.toFixed(4)}`);
          console.log('---');
        });

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
    const userInterests: string[] = [];
    dealGraph.forEachOutNeighbor(userId, (neighborId, attributes) => {
      if (attributes.type === 'interested_in') {
        userInterests.push(neighborId);
      }
    });

    // Include deals from similar users
    dealGraph.forEachOutNeighbor(userId, (neighborId, attributes) => {
      if (attributes.type === 'common_interests') {
        dealGraph.forEachOutNeighbor(neighborId, (dealId, dealAttributes) => {
          if (dealAttributes.type === 'interacted_with' && !validDeals.includes(dealId)) {
            validDeals.push(dealId);
          }
        });
      }
    });

    // Calculate scores and sort
    const scoredResults = validDeals.map(dealId => ({
      id: dealId,
      score: calculateRecommendationScore(userId, dealId, userInterests)
    }));

    // Sort by score (descending) and get top recommendations
    const topRecommendations = scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, numRecommendations);

    // Create a subgraph manually
    const subgraph = new Graph();
    topRecommendations.forEach(rec => {
      subgraph.addNode(rec.id, dealGraph.getNodeAttributes(rec.id));
    });
    topRecommendations.forEach(rec => {
      dealGraph.forEachEdge(rec.id, (edge, attributes, source, target) => {
        if (subgraph.hasNode(target)) {
          subgraph.addEdgeWithKey(edge, source, target, attributes);
        }
      });
    });

    // Use degree centrality to refine the recommendations
    const centrality = calculateDegreeCentrality(subgraph);

    // Adjust scores based on centrality
    const adjustedRecommendations = topRecommendations.map(rec => ({
      ...rec,
      score: rec.score * (1 + (centrality.get(rec.id) || 0) / 10) // Adjust weight as needed
    }));

    return adjustedRecommendations
      .sort((a, b) => b.score - a.score)
      .map(rec => rec.id);
  }

  function calculateRecommendationScore(userId: string, dealId: string, userInterests: string[]): number {
    let score = 0;
    const currentDate = new Date();
    const expirationDate = new Date(dealGraph.getNodeAttribute(dealId, 'expirationDate'));

    // Interest match score
    const dealCategories: string[] = [];
    dealGraph.forEachOutNeighbor(dealId, (category, attributes) => {
      if (attributes.type === 'belongs_to') {
        dealCategories.push(category);
      }
    });
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

    // Time relevance score
    const daysUntilExpiration = Math.max(0, (expirationDate.getTime() - currentDate.getTime()) / (1000 * 3600 * 24));
    const timeRelevanceScore = Math.min(1, daysUntilExpiration / 30);
    score += timeRelevanceScore;

    // Add betweenness centrality score
    const betweenness = calculateBetweennessCentrality(dealGraph);
    const betweennessScore = betweenness.get(dealId) || 0;
    score += betweennessScore * 2; // Adjust the weight as needed

    // Add vector similarity score
    const dealVector = dealGraph.getNodeAttribute(dealId, 'vector');
    const userVector = getUserVector(userId);
    if (dealVector && userVector) {
      const similarityScore = calculateVectorSimilarity(dealVector, userVector);
      score += similarityScore * 2; // Adjust weight as needed
    }

    // Add score based on similar deals
    dealGraph.forEachOutNeighbor(dealId, (similarDealId, attributes) => {
      if (attributes.type === 'similar') {
        if (interactionGraph.hasEdge(userId, similarDealId)) {
          score += attributes.weight * 0.5; // Adjust weight as needed
        }
      }
    });

    // Add score based on common user interactions
    dealGraph.forEachOutNeighbor(userId, (similarUserId, attributes) => {
      if (attributes.type === 'common_interests') {
        if (dealGraph.hasEdge(similarUserId, dealId)) {
          score += attributes.weight * 0.3; // Adjust weight as needed
        }
      }
    });

    return score;
  }

  function getUserVector(userId: string): number[] | null {
    if (dealGraph.hasNode(userId)) {
      return dealGraph.getNodeAttribute(userId, 'vector') || null;
    }
    return null;
  }

  function addGeolocationToGraph(userId: string, geolocationData: any, geoVector: number[]) {
    if (dealGraph.hasNode(userId)) {
      dealGraph.setNodeAttribute(userId, 'geolocation', geolocationData);
      dealGraph.setNodeAttribute(userId, 'geoVector', geoVector);
    } else {
      console.warn(`Attempted to add geolocation to non-existent user: ${userId}`);
    }
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
