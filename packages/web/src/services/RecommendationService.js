/**
 * Service for communicating with kromosynth-recommend API
 */

const RECOMMEND_SERVICE_BASE_URL = import.meta.env.VITE_RECOMMEND_SERVICE_URL || 'http://localhost:3004';

export class RecommendationService {
  constructor() {
    this.baseURL = RECOMMEND_SERVICE_BASE_URL;
  }

  /**
   * Get JWT token from local storage or mock
   */
  getToken() {
    // For now, return a mock token - in production this would come from kromosynth-auth
    return localStorage.getItem('kromosynth_token') || 'mock-jwt-token';
  }

  /**
   * Get headers for authenticated requests
   */
  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    };
  }

  /**
   * Get personalized feed for authenticated user
   */
  async getUserFeed(limit = 20, offset = 0) {
    try {
      const response = await fetch(`${this.baseURL}/api/user/feed?limit=${limit}&offset=${offset}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user feed:', error);
      // Return mock data for development
      return this.getMockFeed(limit, offset);
    }
  }

  /**
   * Record user interaction with feed item
   */
  async recordInteraction(feedEntryId, interactionType, metadata = {}) {
    try {
      const response = await fetch(`${this.baseURL}/api/user/interactions`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          feedEntryId,
          interactionType,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            deviceType: 'desktop'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to record interaction: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error recording interaction:', error);
      // For development, just log the interaction
      console.log('Mock interaction recorded:', { feedEntryId, interactionType, metadata });
      return { success: true, mocked: true };
    }
  }

  /**
   * Get discovery recommendations (latest from evolution)
   */
  async getDiscoveryRecommendations(count = 20) {
    try {
      const response = await fetch(`${this.baseURL}/api/user/discover?count=${count}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch discoveries: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching discovery recommendations:', error);
      // Return mock data for development
      return this.getMockDiscoveries(count);
    }
  }

  /**
   * Get trending sounds
   */
  async getTrendingRecommendations(timeframe = '24h', count = 15) {
    try {
      const response = await fetch(`${this.baseURL}/api/user/trending?timeframe=${timeframe}&count=${count}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch trending: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching trending recommendations:', error);
      // Return mock data for development
      return this.getMockTrending(count);
    }
  }

  /**
   * Mock feed data for development
   */
  getMockFeed(limit = 20, offset = 0) {
    const mockEntries = [];
    
    for (let i = 0; i < limit; i++) {
      const entryId = `mock-feed-${offset + i}`;
      const soundId = `mock-sound-${offset + i}`;
      
      mockEntries.push({
        id: entryId,
        sound_id: soundId,
        recommendation_type: ['similarity_match', 'evolution_discovery', 'trending_evolution'][i % 3],
        priority_score: 0.3 + (Math.random() * 0.7),
        confidence_score: 0.5 + (Math.random() * 0.5),
        created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        scheduled_for: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        metadata: {
          generation: Math.floor(Math.random() * 100),
          fitness: Math.random(),
          simulationId: `sim-${Math.floor(Math.random() * 10)}`,
          synthesisType: ['granular', 'fm', 'additive'][Math.floor(Math.random() * 3)],
          duration: 1 + Math.random() * 4,
          tags: ['experimental', 'ambient', 'rhythmic', 'melodic'].filter(() => Math.random() > 0.6)
        }
      });
    }

    return {
      success: true,
      data: mockEntries,
      pagination: {
        limit,
        offset,
        count: mockEntries.length
      },
      mocked: true
    };
  }

  /**
   * Mock discovery data for development
   */
  getMockDiscoveries(count = 20) {
    const discoveries = [];
    
    for (let i = 0; i < count; i++) {
      discoveries.push({
        id: `discovery-${i}`,
        sound_id: `discovery-sound-${i}`,
        recommendation_type: 'evolution_discovery',
        confidence_score: 0.7 + Math.random() * 0.3,
        priority_score: 0.5 + Math.random() * 0.5,
        created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        scheduled_for: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        metadata: {
          generation: Math.floor(Math.random() * 50),
          fitness: Math.random(),
          simulationId: `sim-discovery-${Math.floor(Math.random() * 5)}`,
          synthesisType: ['granular', 'fm', 'additive'][Math.floor(Math.random() * 3)],
          duration: 0.5 + Math.random() * 3,
          tags: ['experimental', 'ambient', 'rhythmic', 'melodic'].filter(() => Math.random() > 0.7)
        }
      });
    }

    return {
      success: true,
      data: discoveries,
      mocked: true
    };
  }

  /**
   * Mock trending data for development
   */
  getMockTrending(count = 15) {
    const trending = [];
    
    for (let i = 0; i < count; i++) {
      trending.push({
        id: `trending-${i}`,
        sound_id: `trending-sound-${i}`,
        recommendation_type: 'trending_evolution',
        confidence_score: 0.8 + Math.random() * 0.2,
        priority_score: 0.6 + Math.random() * 0.4,
        created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        scheduled_for: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        metadata: {
          generation: Math.floor(Math.random() * 30),
          fitness: 0.7 + Math.random() * 0.3,
          simulationId: `sim-trending-${Math.floor(Math.random() * 3)}`,
          synthesisType: ['granular', 'fm', 'additive'][Math.floor(Math.random() * 3)],
          duration: 1 + Math.random() * 2,
          popularity: Math.floor(Math.random() * 100),
          timeframe: '24h',
          tags: ['experimental', 'ambient', 'rhythmic', 'melodic'].filter(() => Math.random() > 0.6)
        }
      });
    }

    return {
      success: true,
      data: trending,
      mocked: true
    };
  }
}

// Singleton instance
export const recommendationService = new RecommendationService();
export default recommendationService;
