/**
 * ExplorationView - Component for exploring migrated favorites from KuzuDB
 * Shows sounds that were liked by users, allows clicking through to see
 * user profiles and their other liked sounds (graph exploration)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Heart, 
  Play, 
  Pause, 
  Users, 
  Search,
  ChevronRight,
  TrendingUp,
  Clock,
  Star,
  UserCircle2,
  Music2,
  Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import SoundRenderer from '../utils/SoundRenderer';
import { getRestServiceHost, REST_ENDPOINTS } from '../constants';

const RECOMMEND_SERVICE_URL = import.meta.env.VITE_RECOMMEND_SERVICE_URL || 'http://localhost:3004';

const ExplorationView = () => {
  const { user, isAuthenticated } = useAuth();
  const [sounds, setSounds] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSounds, setUserSounds] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('sounds'); // 'sounds' | 'user-detail'
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [renderingProgress, setRenderingProgress] = useState({});

  /**
   * Get auth headers (optional - endpoints are public)
   */
  const getAuthHeaders = () => {
    const token = localStorage.getItem('kromosynth_token');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Only add auth header if we have a token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  };

  /**
   * Load adopted sounds from migrated data
   */
  const loadAdoptedSounds = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${RECOMMEND_SERVICE_URL}/api/exploration/adopted-sounds?limit=50&sortBy=${sortBy}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to load adopted sounds');
      }

      const data = await response.json();
      
      if (data.success) {
        setSounds(data.data);
      } else {
        setError('Failed to load sounds');
      }
    } catch (err) {
      console.error('Error loading adopted sounds:', err);
      setError('Failed to load adopted sounds. Using mock data for development.');
      // Mock data for development
      setSounds(generateMockSounds());
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  /**
   * Load statistics
   */
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(
        `${RECOMMEND_SERVICE_URL}/api/exploration/stats`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, []);

  /**
   * Load user's adopted sounds
   */
  const loadUserSounds = useCallback(async (userId) => {
    try {
      setIsLoading(true);

      const response = await fetch(
        `${RECOMMEND_SERVICE_URL}/api/exploration/users/${userId}/adopted-sounds?limit=50`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to load user sounds');
      }

      const data = await response.json();
      
      if (data.success) {
        setSelectedUser(data.data.user);
        setUserSounds(data.data.sounds);
        setView('user-detail');
      }
    } catch (err) {
      console.error('Error loading user sounds:', err);
      setError('Failed to load user sounds');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Search sounds
   */
  const handleSearch = useCallback(async () => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      loadAdoptedSounds();
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        `${RECOMMEND_SERVICE_URL}/api/exploration/search?query=${encodeURIComponent(searchQuery)}&limit=50`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      
      if (data.success) {
        setSounds(data.data);
      }
    } catch (err) {
      console.error('Error searching sounds:', err);
      setError('Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, loadAdoptedSounds]);

  /**
   * Handle sound playback
   */
  const handlePlaySound = async (sound) => {
    try {
      // Stop currently playing sound
      if (currentlyPlaying && currentlyPlaying !== sound.id) {
        setCurrentlyPlaying(null);
      }

      // Toggle play/pause
      if (currentlyPlaying === sound.id) {
        setCurrentlyPlaying(null);
        return;
      }

      setCurrentlyPlaying(sound.id);
      setRenderingProgress(prev => ({ ...prev, [sound.id]: 0 }));

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
            console.log('Sound rendered successfully:', sound.id);
            // Play the sound
            const audioContext = new AudioContext();
            const source = audioContext.createBufferSource();
            source.buffer = result.audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            
            source.onended = () => {
              setCurrentlyPlaying(null);
              setRenderingProgress(prev => {
                const updated = { ...prev };
                delete updated[sound.id];
                return updated;
              });
            };
          } else {
            console.error('Sound rendering failed:', result.error);
            setCurrentlyPlaying(null);
          }
        },
        (progress) => {
          setRenderingProgress(prev => ({
            ...prev,
            [sound.id]: progress.progress
          }));
        }
      );

    } catch (err) {
      console.error('Error playing sound:', err);
      setCurrentlyPlaying(null);
    }
  };

  /**
   * Initial load
   */
  useEffect(() => {
    // Load data regardless of auth status (public discovery)
    loadAdoptedSounds();
    loadStats();
  }, [loadAdoptedSounds, loadStats]);

  /**
   * Handle sort change
   */
  useEffect(() => {
    if (view === 'sounds') {
      loadAdoptedSounds();
    }
  }, [sortBy, view, loadAdoptedSounds]);

  // Remove auth check - this is now a public discovery feature
  // Users can browse without signing in

  return (
    <div className="h-full w-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="w-full px-4 py-4 border-b border-gray-800">
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                {view === 'sounds' ? 'Explore Favorites' : `${selectedUser?.display_name}'s Favorites`}
              </h1>
              <p className="text-sm text-gray-400">
                {view === 'sounds' 
                  ? 'Discover sounds liked by the community' 
                  : 'Sounds adopted by this user'}
              </p>
            </div>
            
            {view === 'user-detail' && (
              <button
                onClick={() => {
                  setView('sounds');
                  setSelectedUser(null);
                  setUserSounds([]);
                }}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
              >
                Back to All Sounds
              </button>
            )}
          </div>

          {/* Stats Bar */}
          {stats && view === 'sounds' && (
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-800/50 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Music2 size={16} className="text-blue-400" />
                  <span className="text-xs text-gray-400">Sounds</span>
                </div>
                <div className="text-xl font-semibold text-white">
                  {stats.total_sounds || 0}
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={16} className="text-green-400" />
                  <span className="text-xs text-gray-400">Users</span>
                </div>
                <div className="text-xl font-semibold text-white">
                  {stats.total_users || 0}
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Heart size={16} className="text-red-400" />
                  <span className="text-xs text-gray-400">Total Likes</span>
                </div>
                <div className="text-xl font-semibold text-white">
                  {stats.total_adoptions || 0}
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-purple-400" />
                  <span className="text-xs text-gray-400">Avg per User</span>
                </div>
                <div className="text-xl font-semibold text-white">
                  {stats.avg_adoptions_per_user?.toFixed(1) || 0}
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          {view === 'sounds' && (
            <div className="flex gap-2">
              {/* Search */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by class or name..."
                  className="w-full px-4 py-2 pl-10 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              </div>

              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Search
              </button>

              {/* Sort Filter */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                <option value="quality">Highest Quality</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (view === 'sounds' ? sounds.length === 0 : userSounds.length === 0) ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading sounds...</p>
            </div>
          </div>
        ) : error && sounds.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-400 mb-2">{error}</p>
              <button
                onClick={loadAdoptedSounds}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full px-4 py-4">
            <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(view === 'sounds' ? sounds : userSounds).map((sound) => (
                <div
                  key={sound.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                >
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
                      {sound.score !== undefined && (
                        <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded flex items-center gap-1">
                          <Star size={12} />
                          {(sound.score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Waveform Placeholder */}
                  <div className="mb-3 h-16 bg-gray-900 rounded flex items-center justify-center">
                    <Music2 size={24} className="text-gray-600" />
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handlePlaySound(sound)}
                      disabled={renderingProgress[sound.id] !== undefined && currentlyPlaying !== sound.id}
                      className="p-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      title={currentlyPlaying === sound.id ? 'Playing...' : 'Play sound'}
                    >
                      {currentlyPlaying === sound.id ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>

                    {/* Rendering Progress */}
                    {renderingProgress[sound.id] !== undefined && currentlyPlaying !== sound.id && (
                      <div className="flex-1 mx-3">
                        <div className="h-2 bg-gray-700 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-200"
                            style={{ width: `${renderingProgress[sound.id]}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Adopters */}
                    {sound.adoption_count > 0 && view === 'sounds' && (
                      <button
                        onClick={() => {
                          // For now, just show the count
                          // In a full implementation, this would show a list of adopters
                          console.log('Show adopters for sound:', sound.id);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700 text-gray-400"
                        title={`${sound.adoption_count} user(s) liked this`}
                      >
                        <Heart size={14} className="text-red-400" />
                        <span className="text-xs">{sound.adoption_count}</span>
                      </button>
                    )}

                    {/* Sample Adopters - Click to view their profile */}
                    {sound.sample_adopter_ids && sound.sample_adopter_ids.length > 0 && view === 'sounds' && (
                      <div className="flex items-center gap-1">
                        {sound.sample_adopter_ids.slice(0, 3).map((userId, idx) => (
                          <button
                            key={userId}
                            onClick={() => loadUserSounds(userId)}
                            className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs hover:ring-2 hover:ring-blue-400"
                            title="View this user's favorites"
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Additional Info */}
                  <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
                    <div className="truncate" title={sound.origin_evolution_run_id}>
                      {sound.origin_evolution_run_id?.split('/').pop() || 'Unknown run'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {(view === 'sounds' ? sounds : userSounds).length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Music2 size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">
                  {searchQuery ? 'No sounds found matching your search' : 'No sounds available'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Generate mock sounds for development
 */
function generateMockSounds() {
  const classes = [
    'Aircraft', 'Bell', 'Drum', 'Guitar', 'Piano', 'Synth', 'Vocal', 
    'Ambient', 'Percussion', 'Bass'
  ];
  
  const evolutionRuns = [
    '01HG4JE6P0AP2DKPBWF4E37S43_classScoringVariationsAsContainerDimensions_5dur-1ndelt-1vel',
    '01HG8HECFSAJ10GB17662HJHQZ_classScoringVariationsAsContainerDimensions_5dur-1ndelt-1vel',
    '01J36C4N993C11EY54VJ1DWXTJ_classScoringVariationsAsContainerDimensions_noOsc_5dur-1ndelt-1vel'
  ];

  return Array.from({ length: 30 }, (_, i) => ({
    id: `mock-sound-${i}`,
    name: `Sound ${i}`,
    class: classes[Math.floor(Math.random() * classes.length)],
    score: Math.random(),
    generation_number: Math.floor(Math.random() * 100),
    duration: 1 + Math.random() * 4,
    note_delta: Math.floor(Math.random() * 24) - 12,
    velocity: 0.3 + Math.random() * 0.7,
    creation_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    origin_evolution_run_id: evolutionRuns[Math.floor(Math.random() * evolutionRuns.length)],
    quality_score: Math.random(),
    adoption_count: Math.floor(Math.random() * 10),
    sample_adopter_ids: Array.from(
      { length: Math.floor(Math.random() * 3) + 1 }, 
      (_, j) => `user-${j}`
    )
  }));
}

export default ExplorationView;
