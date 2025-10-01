/**
 * Authentication Context for managing user state
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/AuthService.js';
import { soundGardenService } from '../services/SoundGardenService.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /**
   * Initialize authentication on app startup
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // Initialize auth service
        await authService.initialize();
        
        // Initialize sound garden service
        await soundGardenService.initialize();
        
        // Get current user
        const currentUser = authService.getCurrentUser();
        
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
          console.log('User authenticated:', currentUser.username);
        } else {
          console.log('No authenticated user found');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Login user
   */
  const login = async (username, password) => {
    try {
      setIsLoading(true);
      
      const result = await authService.login(username, password);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        
        // Initialize sound garden for the user
        await soundGardenService.initialize();
        
        return { success: true, user: result.user };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register new user
   */
  const register = async (email, password, username, displayName) => {
    try {
      setIsLoading(true);
      
      const result = await authService.register(email, password, username, displayName);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        
        // Initialize sound garden for the user
        await soundGardenService.initialize();
        
        console.log('User registration successful');
        return { success: true, user: result.user };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Convert anonymous user to registered account
   */
  const convertAnonymous = async (email, password, username, displayName) => {
    try {
      setIsLoading(true);
      
      const result = await authService.convertAnonymous(email, password, username, displayName);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        
        console.log('Anonymous user converted to registered account');
        return { success: true, user: result.user };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Conversion error:', error);
      return { success: false, error: 'Conversion failed' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      await authService.logout();
      
      // Clear user state - don't create new anonymous user
      setUser(null);
      setIsAuthenticated(false);
      
      // Clear sound garden
      soundGardenService.clearGarden();
      
      console.log('User logged out');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  };

  /**
   * Update user preferences
   */
  const updatePreferences = async (preferences) => {
    try {
      const result = await authService.updatePreferences(preferences);
      
      if (result.success) {
        setUser(result.user);
        return { success: true, user: result.user };
      } else {
        return { success: false, error: 'Failed to update preferences' };
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Get user statistics
   */
  const getUserStats = async () => {
    try {
      const result = await authService.getUserStats();
      return result;
    } catch (error) {
      console.error('Error getting user stats:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Refresh user data
   */
  const refreshUser = () => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  };

  const value = {
    // State
    user,
    isLoading,
    isAuthenticated,
    
    // Actions
    login,
    register,  // Add register function
    logout,
    convertAnonymous,
    updatePreferences,
    getUserStats,
    refreshUser,
    
    // Helper functions
    isUser: () => isAuthenticated && user,
    isAnonymous: () => user?.isAnonymous === true,  // ADD THIS - check if user is anonymous
    getUserId: () => user?.id,
    getUsername: () => user?.username,
    getSubscriptionTier: () => user?.subscriptionTier || 'free',
    
    // Quick access to common user data
    userPreferences: user?.preferences || {},
    userStats: user?.stats || {}
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
