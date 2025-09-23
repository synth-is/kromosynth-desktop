/**
 * Mock Authentication Service
 * In production, this would integrate with kromosynth-auth
 */

const AUTH_SERVICE_BASE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:3002';

export class AuthService {
  constructor() {
    this.baseURL = AUTH_SERVICE_BASE_URL;
    this.currentUser = null;
    this.initialized = false;
  }

  /**
   * Initialize auth service and check for existing session
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Try to restore session from localStorage
      const token = localStorage.getItem('kromosynth_token');
      const userData = localStorage.getItem('kromosynth_user');

      if (token && userData) {
        this.currentUser = JSON.parse(userData);
        // In production, we would validate the token with the auth service
        console.log('Restored user session:', this.currentUser);
      } else {
        // For development, create a mock user
        this.currentUser = this.createMockUser();
        this.saveSession();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing auth service:', error);
      // Fallback to mock user
      this.currentUser = this.createMockUser();
      this.saveSession();
      this.initialized = true;
    }
  }

  /**
   * Create a mock user for development
   */
  createMockUser() {
    return {
      id: 'mock-user-123',
      username: 'demo_user',
      email: 'demo@kromosynth.com',
      displayName: 'Demo User',
      subscriptionTier: 'pro',
      joinDate: new Date('2024-01-01').toISOString(),
      lastActive: new Date().toISOString(),
      preferences: {
        preferredGenres: ['experimental', 'ambient'],
        preferredSynthesisTypes: ['granular', 'fm'],
        discoveryTolerance: 0.7,
        recommendationFrequency: 'moderate'
      },
      stats: {
        soundsLiked: 42,
        soundsAdopted: 15,
        sessionsCount: 28,
        totalPlayTime: 3600, // seconds
        soundsDiscovered: 156
      }
    };
  }

  /**
   * Save current session to localStorage
   */
  saveSession() {
    if (this.currentUser) {
      localStorage.setItem('kromosynth_token', 'mock-jwt-token-' + Date.now());
      localStorage.setItem('kromosynth_user', JSON.stringify(this.currentUser));
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * Mock login (in production this would call kromosynth-auth)
   */
  async login(username, password) {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // For development, accept any credentials
      this.currentUser = {
        ...this.createMockUser(),
        username: username || 'demo_user',
        email: `${username || 'demo'}@kromosynth.com`,
        displayName: username || 'Demo User'
      };

      this.saveSession();

      return {
        success: true,
        user: this.currentUser,
        token: localStorage.getItem('kromosynth_token')
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  /**
   * Mock logout
   */
  async logout() {
    this.currentUser = null;
    localStorage.removeItem('kromosynth_token');
    localStorage.removeItem('kromosynth_user');
    
    return { success: true };
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences) {
    if (!this.currentUser) {
      throw new Error('No authenticated user');
    }

    this.currentUser.preferences = {
      ...this.currentUser.preferences,
      ...preferences
    };

    this.saveSession();

    return {
      success: true,
      user: this.currentUser
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    if (!this.currentUser) {
      throw new Error('No authenticated user');
    }

    // In production, this would fetch from the auth service
    return {
      success: true,
      stats: this.currentUser.stats
    };
  }

  /**
   * Update user statistics (for tracking usage)
   */
  updateStats(statUpdates) {
    if (!this.currentUser) return;

    this.currentUser.stats = {
      ...this.currentUser.stats,
      ...statUpdates,
      lastActive: new Date().toISOString()
    };

    this.saveSession();
  }

  /**
   * Get auth headers for API requests
   */
  getAuthHeaders() {
    const token = localStorage.getItem('kromosynth_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
}

// Singleton instance
export const authService = new AuthService();
export default authService;
