/**
 * Authentication Service - kromosynth-auth integration
 * Connects to the kromosynth-auth microservice for user management
 */

const AUTH_SERVICE_BASE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://127.0.0.1:3002';

export class AuthService {
  constructor() {
    this.baseURL = AUTH_SERVICE_BASE_URL;
    this.currentUser = null;
    this.token = null;
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
      const tokenExpiry = localStorage.getItem('kromosynth_token_expiry');

      if (token && userData) {
        this.token = token;
        this.currentUser = JSON.parse(userData);
        
        // Check if token is expired
        const now = Date.now();
        const expiry = tokenExpiry ? parseInt(tokenExpiry) : 0;
        
        if (expiry > now) {
          // Token still valid, try to use it
          try {
            const profile = await this.getProfile();
            this.currentUser = profile.user;
            this.saveSession();
            console.log('Session restored:', this.currentUser.username);
          } catch (error) {
            console.warn('Stored token validation failed, trying refresh');
            // Try to refresh the token
            const refreshed = await this.refreshToken();
            if (!refreshed.success) {
              console.warn('Token refresh failed, creating new anonymous user');
              await this.createAnonymousUser();
            } else {
              console.log('Token refreshed successfully');
            }
          }
        } else {
          console.warn('Token expired, creating new anonymous user');
          await this.createAnonymousUser();
        }
      } else {
        // No existing session - create anonymous user
        await this.createAnonymousUser();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing auth service:', error);
      // Fallback: still create anonymous user
      try {
        await this.createAnonymousUser();
      } catch (fallbackError) {
        console.error('Could not create anonymous user:', fallbackError);
      }
      this.initialized = true;
    }
  }

  /**
   * Create anonymous user for instant access
   */
  async createAnonymousUser() {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        this.token = result.data.token;
        this.currentUser = result.data.user;
        this.saveSession();
        console.log('Anonymous user created:', this.currentUser.username);
        return result.data;
      } else {
        throw new Error(result.error || 'Anonymous user creation failed');
      }
    } catch (error) {
      console.error('Create anonymous user error:', error);
      throw error;
    }
  }

  /**
   * Get current user profile from auth service
   */
  async getProfile() {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/profile`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Get profile failed');
      }
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }

  /**
   * Save current session to localStorage
   */
  saveSession() {
    if (this.currentUser && this.token) {
      localStorage.setItem('kromosynth_token', this.token);
      localStorage.setItem('kromosynth_user', JSON.stringify(this.currentUser));
      // Store token expiry (24 hours from now by default)
      const expiry = Date.now() + (24 * 60 * 60 * 1000);
      localStorage.setItem('kromosynth_token_expiry', expiry.toString());
    }
  }

  /**
   * Clear session from localStorage
   */
  clearSession() {
    localStorage.removeItem('kromosynth_token');
    localStorage.removeItem('kromosynth_user');
    localStorage.removeItem('kromosynth_token_expiry');
    this.token = null;
    this.currentUser = null;
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
    return !!this.currentUser && !!this.token;
  }

  /**
   * Check if current user is anonymous
   */
  isAnonymous() {
    return this.currentUser?.isAnonymous === true;
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.token = result.data.token;
        this.currentUser = result.data.user;
        this.saveSession();
        return {
          success: true,
          user: this.currentUser,
          token: this.token
        };
      } else {
        return {
          success: false,
          error: result.error || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }

  /**
   * Register new user account
   */
  async register(email, password, username, displayName) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username, displayName })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.token = result.data.token;
        this.currentUser = result.data.user;
        this.saveSession();
        return {
          success: true,
          user: this.currentUser,
          token: this.token
        };
      } else {
        return {
          success: false,
          error: result.error || result.message || 'Registration failed'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  }

  /**
   * Convert anonymous user to registered account
   */
  async convertAnonymous(email, password, username, displayName) {
    try {
      if (!this.isAnonymous()) {
        return {
          success: false,
          error: 'User is not anonymous'
        };
      }

      const response = await fetch(`${this.baseURL}/api/auth/convert`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email, password, username, displayName })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.token = result.data.token;
        this.currentUser = result.data.user;
        this.saveSession();
        console.log('Anonymous user converted to registered account');
        return {
          success: true,
          user: this.currentUser,
          token: this.token
        };
      } else {
        return {
          success: false,
          error: result.error || result.message || 'Conversion failed'
        };
      }
    } catch (error) {
      console.error('Conversion error:', error);
      return {
        success: false,
        error: error.message || 'Conversion failed'
      };
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      if (this.token) {
        await fetch(`${this.baseURL}/api/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders()
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearSession();
      // Create new anonymous user after logout
      await this.createAnonymousUser();
    }

    return { success: true };
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences) {
    if (!this.currentUser) {
      throw new Error('No authenticated user');
    }

    try {
      const response = await fetch(`${this.baseURL}/api/auth/preferences`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ preferences })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.currentUser.preferences = result.data.preferences;
        this.saveSession();
        return {
          success: true,
          user: this.currentUser
        };
      } else {
        throw new Error(result.error || 'Update preferences failed');
      }
    } catch (error) {
      console.error('Update preferences error:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    if (!this.currentUser) {
      throw new Error('No authenticated user');
    }

    return {
      success: true,
      stats: this.currentUser.stats
    };
  }

  /**
   * Update user statistics (for tracking usage)
   */
  async updateStats(statUpdates) {
    if (!this.currentUser) return;

    try {
      const updatedStats = {
        ...this.currentUser.stats,
        ...statUpdates
      };

      const response = await fetch(`${this.baseURL}/api/auth/stats`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ stats: updatedStats })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.currentUser.stats = result.data.stats;
        this.saveSession();
      }
    } catch (error) {
      console.error('Update stats error:', error);
      // Don't throw - stats updates are non-critical
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken() {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.token = result.data.token;
        this.currentUser = result.data.user;
        this.saveSession();
        return { success: true };
      } else {
        throw new Error(result.error || 'Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      // If token refresh fails, clear session and create new anonymous user
      this.clearSession();
      await this.createAnonymousUser();
      return { success: false };
    }
  }

  /**
   * Get auth headers for API requests
   */
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generate a creative username suggestion
   */
  async generateUsername() {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/generate-username`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        return result.data.username;
      } else {
        throw new Error(result.error || 'Username generation failed');
      }
    } catch (error) {
      console.error('Generate username error:', error);
      // Fallback to simple username
      return `User${Math.floor(Math.random() * 9999)}`;
    }
  }
}

// Singleton instance
export const authService = new AuthService();
export default authService;
