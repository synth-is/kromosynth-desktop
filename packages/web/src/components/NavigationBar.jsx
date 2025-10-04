/**
 * Navigation component for switching between main views
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TreePine, Heart, Sparkles, Compass, UserPlus, User, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import ConvertAccountModal from './ConvertAccountModal.jsx';
import LoginModal from './LoginModal.jsx';

const NavigationBar = ({ className = '' }) => {
  const location = useLocation();
  const { isAuthenticated, user, isAnonymous, convertAnonymous, register, login, logout } = useAuth();
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigationItems = [
    {
      path: '/',
      label: 'Sound Feed',
      icon: Sparkles,
      description: 'Discover sounds from the community',
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

  const handleConvertAccount = async (email, password, username, displayName) => {
    // If anonymous user, convert to keep data
    // If no user (logged out), register new account
    if (user && isAnonymous()) {
      const result = await convertAnonymous(email, password, username, displayName);
      if (result.success) {
        setShowConvertModal(false);
        console.log('Account created successfully!');
      }
      return result;
    } else {
      // No user or not anonymous - register new account
      const result = await register(email, password, username, displayName);
      if (result.success) {
        setShowConvertModal(false);
        console.log('Account registered successfully!');
      }
      return result;
    }
  };

  const handleLogin = async (email, password) => {
    const result = await login(email, password);
    
    if (result.success) {
      setShowLoginModal(false);
      console.log('Login successful!');
    }
    
    return result;
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  return (
    <>
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
        
        {/* User Section */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            {/* User Info with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-2 md:px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
              >
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                  {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm text-gray-300">
                    {user.displayName || user.username}
                  </span>
                  {isAnonymous() && (
                    <span className="text-xs text-gray-500">Guest</span>
                  )}
                </div>
                {user.subscriptionTier && user.subscriptionTier !== 'free' && (
                  <span className="hidden lg:inline text-xs bg-yellow-600 text-yellow-100 px-2 py-0.5 rounded uppercase font-semibold">
                    {user.subscriptionTier}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-700">
                    <p className="text-sm font-medium text-white truncate">
                      {user.displayName || user.username}
                    </p>
                    {user.email && (
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    )}
                  </div>

                  {isAnonymous() && (
                    <>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowLoginModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-gray-700 transition-colors"
                      >
                        <LogIn size={16} />
                        <span>Sign In</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowConvertModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-400 hover:bg-gray-700 transition-colors"
                      >
                        <UserPlus size={16} />
                        <span>Create Account</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* No user - show Sign In and Create Account buttons */
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">Sign In</span>
            </button>
            <button
              onClick={() => setShowConvertModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <UserPlus size={16} />
              <span className="hidden sm:inline">Create Account</span>
            </button>
          </div>
        )}
      </nav>

      {/* Convert Account Modal */}
      <ConvertAccountModal
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        onConvert={handleConvertAccount}
        username={user?.username || 'User'}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
      />

      {/* Click outside to close user menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </>
  );
};

export default NavigationBar;
