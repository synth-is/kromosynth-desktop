/**
 * Navigation component for switching between main views
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TreePine, Heart, Sparkles, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

const NavigationBar = ({ className = '' }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  const navigationItems = [
    {
      path: '/',
      label: 'Sound Feed',
      icon: Sparkles,
      description: 'Discover new sounds',
      requiresAuth: true
    },
    {
      path: '/garden',
      label: 'Sound Garden',
      icon: Heart,
      description: 'Your liked sounds collection',
      requiresAuth: true
    },
    {
      path: '/tree',
      label: 'Biomes',
      icon: TreePine,
      description: 'Explore evolutionary sound lineages'
    }
  ];

  const isCurrentPath = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/feed');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className={`w-full flex items-center justify-between gap-1 ${className}`}>
      {/* App Title */}
      <div className="flex items-center gap-2 md:gap-4">
        <h1 className="text-lg md:text-xl font-bold text-white">
          🎵 <span className="hidden sm:inline">Kromosynth</span>
        </h1>
        
        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isCurrent = isCurrentPath(item.path);
            const isDisabled = item.requiresAuth && !isAuthenticated;
            
            if (isDisabled) {
              return (
                <div
                  key={item.path}
                  className="flex items-center gap-2 px-2 md:px-4 py-2 rounded text-gray-500 cursor-not-allowed"
                  title={`${item.description} (Sign in required)`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline text-sm">{item.label}</span>
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-2 md:px-4 py-2 rounded transition-colors text-sm font-medium ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                title={item.description}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
      
      {/* User info */}
      {isAuthenticated && user && (
        <div className="ml-2 md:ml-4 flex items-center gap-2 px-2 md:px-3 py-2 bg-gray-800 rounded">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
            {user.displayName?.[0] || user.username?.[0] || 'U'}
          </div>
          <span className="hidden md:inline text-sm text-gray-300">{user.displayName || user.username}</span>
          {user.subscriptionTier && user.subscriptionTier !== 'free' && (
            <span className="hidden lg:inline text-xs bg-gold-600 text-gold-100 px-2 py-0.5 rounded uppercase">
              {user.subscriptionTier}
            </span>
          )}
        </div>
      )}
      
      {!isAuthenticated && (
        <div className="hidden md:block ml-4 text-sm text-gray-400">
          <span>Sign in for personalized features</span>
        </div>
      )}
    </nav>
  );
};

export default NavigationBar;
