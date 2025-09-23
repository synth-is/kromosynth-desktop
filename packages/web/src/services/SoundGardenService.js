/**
 * Service for managing the personal sound garden (liked sounds)
 */

import { recommendationService } from './RecommendationService.js';
import { authService } from './AuthService.js';

export class SoundGardenService {
  constructor() {
    this.likedSounds = new Map(); // soundId -> sound data
    this.initialized = false;
  }

  /**
   * Initialize the sound garden from localStorage
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const savedGarden = localStorage.getItem('kromosynth_sound_garden');
      if (savedGarden) {
        const gardenData = JSON.parse(savedGarden);
        this.likedSounds = new Map(gardenData);
        console.log(`Loaded ${this.likedSounds.size} liked sounds from storage`);
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing sound garden:', error);
      this.likedSounds = new Map();
      this.initialized = true;
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

      // Update user stats
      const currentUser = authService.getCurrentUser();
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
