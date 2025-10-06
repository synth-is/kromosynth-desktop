/**
 * Service for managing the personal sound garden (liked sounds)
 * Always fetches from backend - single source of truth
 */

import { recommendationService } from './RecommendationService.js';
import { authService } from './AuthService.js';

const RECOMMEND_SERVICE_BASE_URL = import.meta.env.VITE_RECOMMEND_SERVICE_URL || 'http://localhost:3004';

export class SoundGardenService {
  constructor() {
    this.likedSounds = new Map(); // In-memory cache for current session
    this.baseURL = RECOMMEND_SERVICE_BASE_URL;
  }

  /**
   * Get JWT token from auth service
   */
  getToken() {
    return localStorage.getItem('kromosynth_token') || null;
  }

  /**
   * Get headers for authenticated requests
   */
  getAuthHeaders() {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Load liked sounds from backend
   * This is the ONLY source of truth
   */
  async loadFromBackend() {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser || currentUser.isAnonymous) {
        console.log('Cannot load garden: user not authenticated');
        this.likedSounds.clear();
        return;
      }

      const response = await fetch(`${this.baseURL}/api/user/garden`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch garden: ${response.statusText}`);
      }

      const result = await response.json();
      const sounds = result.data || [];

      // Update in-memory cache
      this.likedSounds.clear();
      for (const sound of sounds) {
        this.likedSounds.set(sound.soundId, sound);
      }

      console.log(`Loaded ${this.likedSounds.size} liked sounds from backend`);
    } catch (error) {
      console.error('Error loading sound garden from backend:', error);
      throw error;
    }
  }

  /**
   * Like a sound (add to garden)
   * Goes directly to backend
   */
  async likeSound(soundId, soundData, feedEntryId = null) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser || currentUser.isAnonymous) {
        throw new Error('Must be authenticated to like sounds');
      }

      // Optimistically add to in-memory cache for instant UI feedback
      const optimisticSound = {
        ...soundData,
        soundId,
        likedAt: new Date().toISOString(),
        feedEntryId
      };
      this.likedSounds.set(soundId, optimisticSound);

      // Record interaction with recommendation service (this also saves to backend)
      if (feedEntryId) {
        await recommendationService.recordInteraction(feedEntryId, 'like', {
          soundId,
          context: 'feed'
        });
      } else {
        // If no feedEntryId, we need to sync directly
        const likedSound = {
          soundId,
          likedAt: optimisticSound.likedAt,
          metadata: soundData.metadata
        };

        await fetch(`${this.baseURL}/api/user/garden/sync`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ likedSounds: [likedSound] })
        });
      }

      // Update user stats
      if (currentUser) {
        authService.updateStats({
          soundsLiked: currentUser.stats.soundsLiked + 1
        });
      }

      console.log(`Liked sound: ${soundId}`);
      return { success: true, sound: optimisticSound };
    } catch (error) {
      // Revert optimistic update on failure
      this.likedSounds.delete(soundId);
      console.error('Error liking sound:', error);
      throw error;
    }
  }

  /**
   * Unlike a sound (remove from garden)
   * Goes directly to backend
   */
  async unlikeSound(soundId, feedEntryId = null) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser || currentUser.isAnonymous) {
        throw new Error('Must be authenticated to unlike sounds');
      }

      const wasLiked = this.likedSounds.has(soundId);

      // Optimistically remove from cache
      this.likedSounds.delete(soundId);

      // Call DELETE endpoint to remove from backend
      const response = await fetch(`${this.baseURL}/api/user/garden/${soundId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to unlike sound: ${response.statusText}`);
      }

      // Update user stats
      if (currentUser && currentUser.stats.soundsLiked > 0) {
        authService.updateStats({
          soundsLiked: currentUser.stats.soundsLiked - 1
        });
      }

      console.log(`Unliked sound: ${soundId}`);
      return { success: true, wasLiked };
    } catch (error) {
      console.error('Error unliking sound:', error);
      throw error;
    }
  }

  /**
   * Check if a sound is liked
   * Uses in-memory cache (must call loadFromBackend first)
   */
  isSoundLiked(soundId) {
    return this.likedSounds.has(soundId);
  }

  /**
   * Get a liked sound by ID
   */
  getLikedSound(soundId) {
    return this.likedSounds.get(soundId);
  }

  /**
   * Get all liked sounds (from cache)
   * Call loadFromBackend() first to ensure fresh data
   */
  getAllLikedSounds() {
    return Array.from(this.likedSounds.values()).sort((a, b) => 
      new Date(b.likedAt) - new Date(a.likedAt)
    );
  }

  /**
   * Get liked sounds with pagination
   * Call loadFromBackend() first to ensure fresh data
   */
  getLikedSounds(limit = 20, offset = 0) {
    const allSounds = this.getAllLikedSounds();
    const sounds = allSounds.slice(offset, offset + limit);
    
    return {
      sounds,
      total: allSounds.length,
      limit,
      offset,
      hasMore: offset + limit < allSounds.length
    };
  }

  /**
   * Get liked sounds by category/filter
   */
  getLikedSoundsByFilter(filter = {}) {
    const allSounds = this.getAllLikedSounds();
    
    let filtered = allSounds;

    // Filter by synthesis type
    if (filter.synthesisType) {
      filtered = filtered.filter(sound => 
        sound.metadata?.synthesisType === filter.synthesisType
      );
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(sound => 
        sound.metadata?.tags?.some(tag => filter.tags.includes(tag))
      );
    }

    // Filter by time range
    if (filter.timeRange) {
      const now = new Date();
      const cutoff = new Date();
      
      switch (filter.timeRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter(sound => 
        new Date(sound.likedAt) >= cutoff
      );
    }

    return filtered;
  }

  /**
   * Get sound garden statistics
   */
  getGardenStats() {
    const sounds = this.getAllLikedSounds();
    
    if (sounds.length === 0) {
      return {
        totalSounds: 0,
        recentlyLiked: [],
        synthesisTypeDistribution: {},
        tagsDistribution: {}
      };
    }

    const recentlyLiked = sounds.slice(0, 5);

    // Synthesis type distribution
    const synthesisTypeDistribution = {};
    sounds.forEach(sound => {
      const type = sound.metadata?.synthesisType || 'unknown';
      synthesisTypeDistribution[type] = (synthesisTypeDistribution[type] || 0) + 1;
    });

    // Tags distribution
    const tagsDistribution = {};
    sounds.forEach(sound => {
      if (sound.metadata?.tags) {
        sound.metadata.tags.forEach(tag => {
          tagsDistribution[tag] = (tagsDistribution[tag] || 0) + 1;
        });
      }
    });

    return {
      totalSounds: sounds.length,
      recentlyLiked,
      synthesisTypeDistribution,
      tagsDistribution
    };
  }

  /**
   * Export garden data
   */
  exportGarden() {
    const sounds = this.getAllLikedSounds();
    const stats = this.getGardenStats();
    const user = authService.getCurrentUser();

    return {
      exportedAt: new Date().toISOString(),
      user: user ? {
        id: user.id,
        username: user.username,
        displayName: user.displayName
      } : null,
      sounds,
      stats,
      totalCount: sounds.length
    };
  }

  /**
   * Clear all liked sounds (for admin/testing)
   * This only clears the cache - backend data persists
   */
  clearCache() {
    this.likedSounds.clear();
    return { success: true };
  }
}

// Singleton instance
export const soundGardenService = new SoundGardenService();
export default soundGardenService;
