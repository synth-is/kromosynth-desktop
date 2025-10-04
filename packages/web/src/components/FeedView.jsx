/**
 * Feed component for discovering sounds
 * Two tabs: "For You" (personalized) and "Discover" (all community activity)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Heart, 
  Play, 
  Pause, 
  Users, 
  Sparkles,
  Music2,
  UserPlus,
  TreePine,
  Clock,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { soundGardenService } from '../services/SoundGardenService.js';
import SoundRenderer from '../utils/SoundRenderer';
import { getRestServiceHost, REST_ENDPOINTS } from '../constants';
import { useNavigate } from 'react-router-dom';

const RECOMMEND_SERVICE_URL = import.meta.env.VITE_RECOMMEND_SERVICE_URL || 'http://localhost:3004';

/**
 * Format relative time (e.g., "2h ago", "3d ago")
 */
const getRelativeTime = (dateString) => {
  if (!dateString) return null;
  
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  
  if (diffYear > 0) return `${diffYear}y ago`;
  if (diffMonth > 0) return `${diffMonth}mo ago`;
  if (diffWeek > 0) return `${diffWeek}w ago`;
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'just now';
};

/**
 * Modal to show all users who liked a sound
 */
const AdoptersModal = ({ isOpen, onClose, adopters, soundName, onUserClick }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Who liked "{soundName}"
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Adopters List */}
        <div className="overflow-y-auto max-h-[60vh]">
          {adopters && adopters.length > 0 ? (
            <div className="p-4 space-y-3">
              {adopters.map((userId, index) => (
                <div
                  key={userId}
                  className="flex items-center gap-3 p-3 bg-gray-700/50 rounded hover:bg-gray-700 transition-colors cursor-pointer"
                  onClick={() => {
                    onUserClick(userId);
                    onClose();
                  }}
                >
                  {/* Avatar */}
                  <div 
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0"
                  >
                    {index + 1}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">
                      User {userId.slice(0, 8)}
                    </div>
                    <div className="text-sm text-gray-400 truncate">
                      {userId}
                    </div>
                  </div>

                  {/* View Profile Arrow */}
                  <div className="text-gray-400">
                    →
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              No users have liked this sound yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Empty state for "For You" tab when user doesn't follow anyone
 */
const EmptyForYouState = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md px-4">
        <UserPlus size={64} className="mx-auto text-gray-600 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-3">Your Personal Feed Awaits</h2>
        <p className="text-gray-400 mb-6">
          Follow users to see their discoveries, likes, and activity here. 
          Start by exploring sounds in the <span className="text-blue-400">Discover</span> tab 
          and follow users whose taste you appreciate.
        </p>
        <div className="bg-gray-800/50 rounded-lg p-4 text-left">
          <h3 className="text-white font-medium mb-2">Coming soon:</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• See when users you follow adopt new sounds</li>
            <li>• Get notified about QD run discoveries</li>
            <li>• Track mutation and evolution activity</li>
            <li>• Build your personalized discovery network</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * Sound card component for discover tab
 */
const SoundCard = ({ sound, onPlay, isPlaying, onLike, isLiked, onViewBiome, onViewAdopters, onUserClick }) => {
  const [renderingProgress, setRenderingProgress] = useState(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        onPlay(null);
        return;
      }

      setRenderingProgress(0);
      onPlay(sound.id);

      // Construct genome URL from sound data
      const restHost = getRestServiceHost();
      const evoRunId = sound.origin_evolution_run_id?.split('/').pop() || sound.origin_evolution_run_id;
      const genomeUrl = `${restHost}${REST_ENDPOINTS.GENOME(evoRunId, sound.id)}`;

      // Render the sound
      await SoundRenderer.renderGenome(
        genomeUrl,
        {
          duration: sound.duration || 1.0,
          pitch: sound.note_delta || 0,
          velocity: sound.velocity || 0.5
        },
        (result) => {
          if (result.success) {
            // Play the sound
            const audioContext = new AudioContext();
            const source = audioContext.createBufferSource();
            source.buffer = result.audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            
            source.onended = () => {
              onPlay(null);
              setRenderingProgress(null);
            };
          } else {
            console.error('Sound rendering failed:', result.error);
            onPlay(null);
            setRenderingProgress(null);
          }
        },
        (progress) => {
          setRenderingProgress(progress.progress);
        }
      );

    } catch (err) {
      console.error('Error playing sound:', err);
      onPlay(null);
      setRenderingProgress(null);
    }
  };

  const handleLike = async () => {
    setIsInteracting(true);
    try {
      await onLike(sound);
    } finally {
      setIsInteracting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Sound Info */}
      <div className="mb-3">
        <h3 className="text-white font-medium mb-1 truncate">
          {sound.class || sound.name}
        </h3>
        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
          <span className="bg-gray-700 px-2 py-1 rounded">
            Gen {sound.generation_number || 0}
          </span>
          <span className="bg-gray-700 px-2 py-1 rounded">
            {sound.duration?.toFixed(1) || '?'}s
          </span>
          {sound.creation_date && (
            <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded flex items-center gap-1">
              <Clock size={10} />
              {getRelativeTime(sound.creation_date)}
            </span>
          )}
        </div>
      </div>

      {/* Waveform Placeholder */}
      <div className="mb-3 h-16 bg-gray-900 rounded flex items-center justify-center">
        {renderingProgress !== null && !isPlaying ? (
          <div className="w-full px-4">
            <div className="h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${renderingProgress}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 text-center mt-1">
              Rendering... {Math.round(renderingProgress)}%
            </div>
          </div>
        ) : (
          <Music2 size={24} className="text-gray-600" />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlay}
            disabled={renderingProgress !== null && !isPlaying}
            className="p-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={isPlaying ? 'Playing...' : 'Play sound'}
          >
            {isPlaying ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
          </button>

          {/* Biome/Tree Button */}
          {sound.origin_evolution_run_id && (
            <button
              onClick={() => onViewBiome(sound)}
              className="p-2 rounded bg-gray-700/30 hover:bg-gray-700 text-gray-400 hover:text-green-400 transition-colors"
              title="View in biome"
            >
              <TreePine size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Adopters Display - Overlapping Avatars */}
          {sound.sample_adopter_ids && sound.sample_adopter_ids.length > 0 && (
            <button
              onClick={() => onViewAdopters(sound)}
              className="flex items-center gap-1 bg-transparent hover:opacity-80 transition-opacity"
              title={`${sound.adoption_count} user(s) liked this`}
            >
              {/* Overlapping avatar circles */}
              <div className="flex items-center -space-x-2">
                {sound.sample_adopter_ids.slice(0, 3).map((userId, idx) => (
                  <div
                    key={userId}
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold border-2 border-gray-800 hover:z-10 transition-all"
                    style={{ zIndex: 3 - idx }}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
              
              {/* Show "+N more" if there are more than 3 adopters */}
              {sound.adoption_count > 3 && (
                <span className="text-xs text-gray-400 ml-1">
                  +{sound.adoption_count - 3}
                </span>
              )}
            </button>
          )}

          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={isInteracting}
            className={`p-2 rounded transition-colors disabled:opacity-50 ${
              isLiked
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'hover:bg-gray-700 text-gray-400 hover:text-red-400'
            }`}
            title={isLiked ? 'Remove from garden' : 'Add to garden'}
          >
            <Heart
              size={16}
              fill={isLiked ? 'currentColor' : 'none'}
              className="transition-transform hover:scale-110"
            />
          </button>
        </div>
      </div>


    </div>
  );
};

/**
 * Main Feed View Component
 */
const FeedView = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('discover'); // Default to discover
  const [sounds, setSounds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [likedSounds, setLikedSounds] = useState(new Set());
  const [adoptersModalOpen, setAdoptersModalOpen] = useState(false);
  const [selectedSound, setSelectedSound] = useState(null);

  /**
   * Navigate to user profile
   */
  const handleUserClick = (userId) => {
    navigate(`/user/${userId}`);
  };

  /**
   * Get auth headers (optional - endpoints are public)
   */
  const getAuthHeaders = () => {
    const token = localStorage.getItem('kromosynth_token');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  };

  /**
   * Load discovered sounds from community
   */
  const loadDiscoverSounds = useCallback(async (offset = 0, append = false) => {
    try {
      if (offset === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const limit = 20; // Load 20 at a time
      const response = await fetch(
        `${RECOMMEND_SERVICE_URL}/api/exploration/adopted-sounds?limit=${limit}&offset=${offset}&sortBy=${sortBy}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to load sounds');
      }

      const data = await response.json();
      
      if (data.success) {
        const newSounds = data.data;
        
        if (append) {
          // Deduplicate by sound ID when appending
          setSounds(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNewSounds = newSounds.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNewSounds];
          });
        } else {
          setSounds(newSounds);
        }
        
        // Check if there are more items to load
        setHasMore(newSounds.length === limit);
        
        // Load liked status for new sounds - use functional update to avoid dependency
        setLikedSounds(prevLiked => {
          const likedSet = new Set(prevLiked);
          for (const sound of newSounds) {
            if (soundGardenService.isSoundLiked(sound.id)) {
              likedSet.add(sound.id);
            }
          }
          return likedSet;
        });
      } else {
        setError('Failed to load sounds');
      }
    } catch (err) {
      console.error('Error loading discover sounds:', err);
      setError('Failed to load sounds. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [sortBy]);

  /**
   * Load personalized feed (for users you follow)
   */
  const loadForYouFeed = useCallback(async () => {
    // TODO: Implement when following system is ready
    setIsLoading(false);
  }, []);

  /**
   * Load data when tab or sort changes
   */
  useEffect(() => {
    if (activeTab === 'discover') {
      // Reset and load from beginning when sort changes
      setSounds([]);
      setHasMore(true);
      loadDiscoverSounds(0, false);
    } else {
      loadForYouFeed();
    }
  }, [activeTab, sortBy, loadDiscoverSounds, loadForYouFeed]);

  /**
   * Handle like action
   */
  const handleLike = async (sound) => {
    try {
      const isCurrentlyLiked = likedSounds.has(sound.id);
      
      if (isCurrentlyLiked) {
        // Unlike
        await soundGardenService.unlikeSound(sound.id);
        setLikedSounds(prev => {
          const newSet = new Set(prev);
          newSet.delete(sound.id);
          return newSet;
        });
      } else {
        // Like - add to garden
        await soundGardenService.likeSound(sound.id, {
          sound_id: sound.id,
          metadata: {
            class: sound.class,
            name: sound.name,
            score: sound.score,
            generation_number: sound.generation_number,
            duration: sound.duration,
            note_delta: sound.note_delta,
            velocity: sound.velocity,
            origin_evolution_run_id: sound.origin_evolution_run_id
          }
        });
        setLikedSounds(prev => new Set([...prev, sound.id]));
      }
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  /**
   * Handle view biome action
   */
  const handleViewBiome = (sound) => {
    const evoRunId = sound.origin_evolution_run_id?.split('/').pop() || sound.origin_evolution_run_id;
    const params = new URLSearchParams();
    params.set('run', evoRunId);
    params.set('view', 'tree');
    params.set('highlight', sound.id);
    window.location.href = '/tree?' + params.toString();
  };

  /**
   * Handle view adopters action
   */
  const handleViewAdopters = (sound) => {
    setSelectedSound(sound);
    setAdoptersModalOpen(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Sign in to explore</h2>
          <p className="text-gray-400">
            Discover sounds from the community and build your personal sound garden.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="w-full px-4 py-4 border-b border-gray-800">
        <div className="w-full max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-4">Sound Feed</h1>
          
          {/* Tabs and Sort Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('for-you')}
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  activeTab === 'for-you'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Users size={16} />
                For You
              </button>
              <button
                onClick={() => setActiveTab('discover')}
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  activeTab === 'discover'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Sparkles size={16} />
                Discover
              </button>
            </div>

            {/* Sort Controls - Only show for Discover tab */}
            {activeTab === 'discover' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                >
                  <option value="recent">Most Recent</option>
                  <option value="popular">Most Popular</option>
                  <option value="quality">Highest Quality</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'for-you' ? (
          <EmptyForYouState />
        ) : (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading sounds...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-red-400 mb-2">{error}</p>
                  <button
                    onClick={loadDiscoverSounds}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full px-4 py-4">
                <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sounds.map((sound) => (
                    <SoundCard
                      key={sound.id}
                      sound={sound}
                      onPlay={setCurrentlyPlaying}
                      isPlaying={currentlyPlaying === sound.id}
                      onLike={handleLike}
                      isLiked={likedSounds.has(sound.id)}
                      onViewBiome={handleViewBiome}
                      onViewAdopters={handleViewAdopters}
                      onUserClick={handleUserClick}
                    />
                  ))}
                </div>

                {/* Load More Button */}
                {hasMore && sounds.length > 0 && (
                  <div className="text-center py-8">
                    <button
                      onClick={() => loadDiscoverSounds(sounds.length, true)}
                      disabled={isLoadingMore}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {isLoadingMore ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Loading...
                        </span>
                      ) : (
                        `Load More Sounds (${sounds.length} loaded)`
                      )}
                    </button>
                  </div>
                )}

                {/* End of results */}
                {!hasMore && sounds.length > 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-400">You've reached the end! ({sounds.length} sounds total)</p>
                  </div>
                )}

                {/* Empty State */}
                {sounds.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <Music2 size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">No sounds available</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Adopters Modal */}
      <AdoptersModal
        isOpen={adoptersModalOpen}
        onClose={() => setAdoptersModalOpen(false)}
        adopters={selectedSound?.sample_adopter_ids || []}
        soundName={selectedSound?.class || selectedSound?.name || 'this sound'}
        onUserClick={handleUserClick}
      />
    </div>
  );
};

export default FeedView;
