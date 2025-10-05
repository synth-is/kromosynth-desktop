/**
 * Service for managing the personal sound garden (liked sounds)
 * Syncs between localStorage and backend for authenticated users
 */

import { recommendationService } from './RecommendationService.js';
import { authService } from './AuthService.js';

const RECOMMEND_SERVICE_BASE_URL = import.meta.env.VITE_RECOMMEND_SERVICE_URL || 'http://localhost:3004';

export class SoundGardenService {
  constructor() {
    this.likedSounds = new Map(); // soundId -> sound data
    this.initialized = false;
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
   * Initialize the sound garden
   * Loads from localStorage first, then syncs with backend if authenticated
   */
  async initialize(forceReload = false) {
    if (this.initialized && !forceReload) return;

    try {
      // First load from localStorage
      const savedGarden = localStorage.getItem('kromosynth_sound_garden');
      if (savedGarden) {
        const gardenData = JSON.parse(savedGarden);
        this.likedSounds = new Map(gardenData);
        console.log(`Loaded ${this.likedSounds.size} liked sounds from localStorage`);
      }

      // If authenticated, sync with backend
      const currentUser = authService.getCurrentUser();
      if (currentUser && !currentUser.isAnonymous) {
        await this.syncWithBackend();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing sound garden:', error);
      this.likedSounds = new Map();
      this.initialized = true;
    }
  }

  /**
   * Sync with backend: upload local likes and download backend likes
   */
  async syncWithBackend() {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser || currentUser.isAnonymous) {
        console.log('Not syncing: user is anonymous');
        return;
      }

      // First, upload any local liked sounds that aren't in the backend yet
      if (this.likedSounds.size > 0) {
        const localSounds = Array.from(this.likedSounds.values());
        await this.uploadLikedSounds(localSounds);
      }

      // Then download all liked sounds from backend
      const backendSounds = await this.downloadLikedSounds();
      
      // Merge backend sounds into local map
      for (const sound of backendSounds) {
        if (!this.likedSounds.has(sound.soundId)) {
          this.likedSounds.set(sound.soundId, {
            ...sound,
            playCount: 0,
            lastPlayed: null
          });
        }
      }

      this.saveToStorage();
      console.log(`Synced with backend: now have ${this.likedSounds.size} liked sounds`);
    } catch (error) {
      console.error('Error syncing with backend:', error);
      // Continue with local data if sync fails
    }
  }

  /**
   * Download liked sounds from backend
   */
  async downloadLikedSounds() {
    try {
      const response = await fetch(`${this.baseURL}/api/user/garden`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch garden: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error downloading liked sounds:', error);
      return [];
    }
  }

  /**
   * Upload liked sounds to backend
   */
  async uploadLikedSounds(likedSounds) {
    try {
      const response = await fetch(`${this.baseURL}/api/user/garden/sync`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ likedSounds })
      });

      if (!response.ok) {
        throw new Error(`Failed to sync garden: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Uploaded ${result.data.syncedCount} sounds to backend`);
      return result.data;
    } catch (error) {
      console.error('Error uploading liked sounds:', error);
      throw error;
    }
  }

  /**
   * Save garden to localStorage
   */
  saveToStorage() {
    try {
      const gardenData = Array.from(this.likedSounds.entries());
      localStorage.setItem('kromosynth_sound_garden', JSON.stringify(gardenData));
    } catch (error) {
      console.error('Error saving sound garden:', error);
    }
  }

  /**
   * Like a sound (add to garden)
   */
  async likeSound(soundId, soundData, feedEntryId = null) {
    try {
      // Add to local garden
      const likedSound = {
        ...soundData,
        soundId,
        likedAt: new Date().toISOString(),
        feedEntryId,
        playCount: 0,
        lastPlayed: null
      };

      this.likedSounds.set(soundId, likedSound);
      this.saveToStorage();

      // Record interaction with recommendation service
      if (feedEntryId) {
        await recommendationService.recordInteraction(feedEntryId, 'like', {
          soundId,
          context: 'feed'
        });
      }

      // If authenticated, also sync this like to backend immediately
      const currentUser = authService.getCurrentUser();
      if (currentUser && !currentUser.isAnonymous) {
        try {
          await this.uploadLikedSounds([likedSound]);
        } catch (error) {
          console.warn('Failed to sync like to backend, will retry on next sync:', error);
        }
      }

      // Update user stats
      if (currentUser) {
        authService.updateStats({
          soundsLiked: currentUser.stats.soundsLiked + 1
        });
      }

      console.log(`Liked sound: ${soundId}`);
      return { success: true, sound: likedSound };
    } catch (error) {
      console.error('Error liking sound:', error);
      throw error;
    }
  }

  /**
   * Unlike a sound (remove from garden)
   */
  async unlikeSound(soundId, feedEntryId = null) {
    try {
      const wasLiked = this.likedSounds.has(soundId);
      
      if (wasLiked) {
        this.likedSounds.delete(soundId);
        this.saveToStorage();

        // Record interaction with recommendation service
        if (feedEntryId) {
          await recommendationService.recordInteraction(feedEntryId, 'unlike', {
            soundId,
            context: 'garden'
          });
        }

        // Update user stats
        const currentUser = authService.getCurrentUser();
        if (currentUser && currentUser.stats.soundsLiked > 0) {
          authService.updateStats({
            soundsLiked: currentUser.stats.soundsLiked - 1
          });
        }

        console.log(`Unliked sound: ${soundId}`);
      }

      return { success: true, wasLiked };
    } catch (error) {
      console.error('Error unliking sound:', error);
      throw error;
    }
  }

  /**
   * Check if a sound is liked
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
   * Get all liked sounds
   */
  getAllLikedSounds() {
    return Array.from(this.likedSounds.values()).sort((a, b) => 
      new Date(b.likedAt) - new Date(a.likedAt)
    );
  }

  /**
   * Get liked sounds with pagination
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
   * Record sound play
   */
  recordSoundPlay(soundId) {
    const sound = this.likedSounds.get(soundId);
    if (sound) {
      sound.playCount = (sound.playCount || 0) + 1;
      sound.lastPlayed = new Date().toISOString();
      this.likedSounds.set(soundId, sound);
      this.saveToStorage();

      // Update user stats
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        authService.updateStats({
          totalPlayTime: currentUser.stats.totalPlayTime + (sound.metadata?.duration || 3)
        });
      }
    }
  }

  /**
   * Get sound garden statistics
   */
  getGardenStats() {
    const sounds = this.getAllLikedSounds();
    
    if (sounds.length === 0) {
      return {
        totalSounds: 0,
        totalPlayTime: 0,
        mostPlayedSound: null,
        recentlyLiked: [],
        synthesisTypeDistribution: {},
        tagsDistribution: {}
      };
    }

    // Calculate statistics
    const totalPlayTime = sounds.reduce((acc, sound) => 
      acc + ((sound.metadata?.duration || 3) * (sound.playCount || 0)), 0
    );

    const mostPlayedSound = sounds.reduce((max, sound) => 
      (sound.playCount || 0) > (max.playCount || 0) ? sound : max
    );

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
      totalPlayTime,
      mostPlayedSound,
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
   * Clear all liked sounds
   */
  clearGarden() {
    this.likedSounds.clear();
    this.saveToStorage();
    
    // Reset user stats
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      authService.updateStats({
        soundsLiked: 0
      });
    }

    return { success: true };
  }
}

// Singleton instance
export const soundGardenService = new SoundGardenService();
export default soundGardenService;
