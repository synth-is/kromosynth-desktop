/**
 * User Profile component showing a user's public sound garden
 * Reuses sound card UI from Feed for consistency
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Heart, 
  Play, 
  Pause, 
  Music2,
  TreePine,
  Calendar,
  UserCircle2,
  ArrowLeft
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { soundGardenService } from '../services/SoundGardenService.js';
import SoundRenderer from '../utils/SoundRenderer';
import { getRestServiceHost, REST_ENDPOINTS } from '../constants';

const RECOMMEND_SERVICE_URL = import.meta.env.VITE_RECOMMEND_SERVICE_URL || 'http://localhost:3004';

/**
 * Sound card component for user profile (read-only view of someone else's garden)
 */
const ProfileSoundCard = ({ sound, onPlay, isPlaying, onLike, isLiked, onViewBiome, isOwnProfile }) => {
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
          {sound.adoption_date && (
            <span className="bg-gray-700 px-2 py-1 rounded flex items-center gap-1">
              <Heart size={10} className="text-red-400" fill="currentColor" />
              {new Date(sound.adoption_date).toLocaleDateString()}
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
      <div className="flex items-center justify-between">
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

        {/* Like Button - Only show if not viewing own profile */}
        {!isOwnProfile && (
          <button
            onClick={handleLike}
            disabled={isInteracting}
            className={`p-2 rounded transition-colors disabled:opacity-50 ${
              isLiked
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'hover:bg-gray-700 text-gray-400 hover:text-red-400'
            }`}
            title={isLiked ? 'Remove from your garden' : 'Add to your garden'}
          >
            <Heart
              size={16}
              fill={isLiked ? 'currentColor' : 'none'}
              className="transition-transform hover:scale-110"
            />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * User Profile View
 */
const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState(null);
  const [sounds, setSounds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [likedSounds, setLikedSounds] = useState(new Set());

  // Check if this is the current user's own profile
  const isOwnProfile = currentUser?.id === userId;

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
   * Load user profile and their sounds
   */
  const loadUserProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${RECOMMEND_SERVICE_URL}/api/exploration/users/${userId}/adopted-sounds?limit=100`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found');
        }
        throw new Error('Failed to load user profile');
      }

      const data = await response.json();
      
      if (data.success) {
        setUserData(data.data.user);
        setSounds(data.data.sounds);
        
        // Load liked status for sounds (to show if current user already has them)
        const likedSet = new Set();
        for (const sound of data.data.sounds) {
          if (soundGardenService.isSoundLiked(sound.id)) {
            likedSet.add(sound.id);
          }
        }
        setLikedSounds(likedSet);
      } else {
        setError('Failed to load user profile');
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      setError(err.message || 'Failed to load user profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Load profile on mount or when userId changes
   */
  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  /**
   * Handle like action (add to current user's garden)
   */
  const handleLike = async (sound) => {
    if (!isAuthenticated) {
      return;
    }

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
        // Like - add to current user's garden
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

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Sign in to view profiles</h2>
          <p className="text-gray-400">
            Sign in to explore user profiles and discover sounds.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="w-full px-4 py-4 border-b border-gray-800">
        <div className="w-full max-w-6xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          {/* User Info */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {userData?.display_name?.[0]?.toUpperCase() || userData?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                {userData?.display_name || userData?.username || 'User'}
                {isOwnProfile && (
                  <span className="ml-2 text-sm text-gray-400">(You)</span>
                )}
              </h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                {userData?.join_date && (
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    Joined {new Date(userData.join_date).toLocaleDateString()}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Heart size={14} className="text-red-400" />
                  {sounds.length} liked sounds
                </span>
              </div>
            </div>

            {/* Future: Follow button for other users */}
            {!isOwnProfile && (
              <button
                disabled
                className="px-4 py-2 bg-gray-700 text-gray-500 rounded cursor-not-allowed"
                title="Following feature coming soon"
              >
                Follow (Soon)
              </button>
            )}
          </div>

          <div className="text-sm text-gray-400">
            {isOwnProfile ? (
              <p>This is your public profile. Other users see this when they view your sound garden.</p>
            ) : (
              <p>Browse {userData?.display_name || userData?.username}'s liked sounds and add them to your own garden.</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-4 py-4">
          <div className="w-full max-w-6xl mx-auto">
            {sounds.length === 0 ? (
              <div className="text-center py-12">
                <Music2 size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">
                  {isOwnProfile 
                    ? "You haven't liked any sounds yet. Start exploring!" 
                    : "This user hasn't liked any sounds yet."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sounds.map((sound) => (
                  <ProfileSoundCard
                    key={sound.id}
                    sound={sound}
                    onPlay={setCurrentlyPlaying}
                    isPlaying={currentlyPlaying === sound.id}
                    onLike={handleLike}
                    isLiked={likedSounds.has(sound.id)}
                    onViewBiome={handleViewBiome}
                    isOwnProfile={isOwnProfile}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
