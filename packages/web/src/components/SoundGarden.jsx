/**
 * Personal Sound Garden component for managing liked sounds
 * Uses the same sound rendering approach as Feed for consistency
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Heart, 
  Play, 
  Pause, 
  Download, 
  Search, 
  TreePine, 
  BarChart3,
  Music2,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { soundGardenService } from '../services/SoundGardenService.js';
import SoundRenderer from '../utils/SoundRenderer';
import { getRestServiceHost, REST_ENDPOINTS } from '../constants';

const GardenSoundCard = ({ sound, onPlay, onRemove, onViewBiome, isPlaying }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [renderingProgress, setRenderingProgress] = useState(null);

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        onPlay(null);
        return;
      }

      setRenderingProgress(0);
      onPlay(sound.soundId);

      // Construct genome URL from sound data
      const restHost = getRestServiceHost();
      const evoRunId = sound.metadata?.origin_evolution_run_id?.split('/').pop() || sound.metadata?.origin_evolution_run_id;
      const genomeUrl = `${restHost}${REST_ENDPOINTS.GENOME(evoRunId, sound.soundId)}`;

      // Render the sound
      await SoundRenderer.renderGenome(
        genomeUrl,
        {
          duration: sound.metadata?.duration || 1.0,
          pitch: sound.metadata?.note_delta || 0,
          velocity: sound.metadata?.velocity || 0.5
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

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart size={14} className="text-red-400" fill="currentColor" />
          <span className="text-sm text-gray-300">
            {new Date(sound.likedAt).toLocaleDateString()}
          </span>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-1 rounded hover:bg-gray-700 text-gray-400"
          title="Show details"
        >
          <BarChart3 size={16} />
        </button>
      </div>

      {/* Sound Info */}
      <div className="mb-3">
        <h3 className="text-white font-medium mb-1 truncate">
          {sound.metadata?.class || sound.metadata?.name || `Sound #${sound.soundId.slice(-6)}`}
        </h3>
        
        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
          {sound.metadata?.generation_number !== undefined && (
            <span className="bg-gray-700 px-2 py-1 rounded">
              Gen {sound.metadata.generation_number}
            </span>
          )}
          {sound.metadata?.duration && (
            <span className="bg-gray-700 px-2 py-1 rounded">
              {sound.metadata.duration.toFixed(1)}s
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
                className="h-full bg-green-500 transition-all duration-200"
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
            className="p-2 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={isPlaying ? 'Playing...' : 'Play sound'}
          >
            {isPlaying ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
          </button>

          {/* Biome/Tree Button */}
          {sound.metadata?.origin_evolution_run_id && (
            <button
              onClick={() => onViewBiome(sound)}
              className="p-2 rounded bg-gray-700/30 hover:bg-gray-700 text-gray-400 hover:text-green-400 transition-colors"
              title="View in biome"
            >
              <TreePine size={16} />
            </button>
          )}
        </div>

        <button
          onClick={() => onRemove(sound)}
          className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
          title="Remove from garden"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="text-gray-300 font-medium mb-2">Info</h4>
              <div className="space-y-1 text-gray-400 text-xs">
                <div>Added: {new Date(sound.likedAt).toLocaleDateString()}</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-gray-300 font-medium mb-2">Source</h4>
              <div className="text-gray-400 text-xs truncate">
                {sound.metadata?.origin_evolution_run_id && (
                  <div className="truncate" title={sound.metadata.origin_evolution_run_id}>
                    {sound.metadata.origin_evolution_run_id.split('_').slice(1).join(' ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const GardenStats = ({ stats, sounds }) => {
  // Calculate actual "this week" count
  const thisWeekCount = sounds.filter(sound => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(sound.likedAt) >= weekAgo;
  }).length;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <BarChart3 size={18} />
        Garden Statistics
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{stats.totalSounds}</div>
          <div className="text-sm text-gray-400">Sounds</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-400">
            {thisWeekCount}
          </div>
          <div className="text-sm text-gray-400">This Week</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">
            {Object.keys(stats.synthesisTypeDistribution || {}).length}
          </div>
          <div className="text-sm text-gray-400">Types</div>
        </div>
      </div>
    </div>
  );
};

const SoundGarden = ({ onNavigateToTree }) => {
  const { user, isAuthenticated } = useAuth();
  const [sounds, setSounds] = useState([]);
  const [filteredSounds, setFilteredSounds] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showStats, setShowStats] = useState(true);

  /**
   * Load garden data from backend
   */
  const loadGarden = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load from backend (single source of truth)
      await soundGardenService.loadFromBackend();
      
      // Get all liked sounds from the loaded cache
      const likedSounds = soundGardenService.getAllLikedSounds();
      setSounds(likedSounds);
      
      // Get garden statistics
      const gardenStats = soundGardenService.getGardenStats();
      setStats(gardenStats);
      
    } catch (error) {
      console.error('Error loading garden:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Apply filters and search
   */
  useEffect(() => {
    let filtered = [...sounds];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(sound =>
        sound.soundId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sound.metadata?.class?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sound.metadata?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedFilter !== 'all') {
      switch (selectedFilter) {
        case 'recent':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(sound => 
            new Date(sound.likedAt) >= weekAgo
          );
          break;
      }
    }

    setFilteredSounds(filtered);
  }, [sounds, searchTerm, selectedFilter]);

  /**
   * Load garden on mount
   */
  useEffect(() => {
    if (isAuthenticated) {
      loadGarden();
    }
  }, [isAuthenticated, loadGarden]);

  /**
   * Handle sound removal
   */
  const handleRemoveSound = async (sound) => {
    try {
      // Optimistic update
      setSounds(prev => prev.filter(s => s.soundId !== sound.soundId));
      
      await soundGardenService.unlikeSound(sound.soundId);
      
      // Reload from backend to get fresh data
      await loadGarden();
    } catch (error) {
      console.error('Error removing sound:', error);
      // Reload on error to restore correct state
      await loadGarden();
    }
  };

  /**
   * Handle play action
   */
  const handlePlay = (soundId) => {
    if (currentlyPlaying === soundId) {
      setCurrentlyPlaying(null);
    } else {
      setCurrentlyPlaying(soundId);
    }
  };

  /**
   * Handle view biome action
   */
  const handleViewBiome = (sound) => {
    const evoRunId = sound.metadata?.origin_evolution_run_id?.split('/').pop() || sound.metadata?.origin_evolution_run_id;
    if (evoRunId) {
      const params = new URLSearchParams();
      params.set('run', evoRunId);
      params.set('view', 'tree');
      params.set('highlight', sound.soundId);
      window.location.href = '/tree?' + params.toString();
    }
  };

  /**
   * Export garden data
   */
  const handleExport = () => {
    const exportData = soundGardenService.exportGarden();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kromosynth-garden-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Sign in required</h2>
          <p className="text-gray-400">Please sign in to view your personal sound garden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="w-full px-4 py-4 border-b border-gray-800">
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Heart className="text-red-400" fill="currentColor" />
              Sound Garden
            </h1>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowStats(!showStats)}
                className="px-3 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 text-sm"
              >
                <BarChart3 size={16} className="inline mr-1" />
                {showStats ? 'Hide' : 'Show'} Stats
              </button>
              
              {sounds.length > 0 && (
                <button
                  onClick={handleExport}
                  className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  <Download size={16} className="inline mr-1" />
                  Export
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search your sounds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
              />
            </div>
            
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-green-500"
            >
              <option value="all">All Sounds</option>
              <option value="recent">Recent (7 days)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading your garden...</p>
            </div>
          </div>
        ) : sounds.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Heart size={48} className="text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Your garden is empty</h2>
              <p className="text-gray-400 mb-4">
                Start exploring the feed and like sounds to grow your personal collection.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full px-4 py-4">
            <div className="w-full max-w-6xl mx-auto">
              {/* Statistics */}
              {showStats && stats && (
                <div className="mb-6">
                  <GardenStats stats={stats} sounds={sounds} />
                </div>
              )}

              {/* Results Info */}
              <div className="mb-4 text-sm text-gray-400">
                Showing {filteredSounds.length} of {sounds.length} sounds
              </div>

              {/* Sound Grid */}
              {filteredSounds.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSounds.map((sound) => (
                    <GardenSoundCard
                      key={sound.soundId}
                      sound={sound}
                      onPlay={handlePlay}
                      onRemove={handleRemoveSound}
                      onViewBiome={handleViewBiome}
                      isPlaying={currentlyPlaying === sound.soundId}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No sounds match your current filters.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoundGarden;
