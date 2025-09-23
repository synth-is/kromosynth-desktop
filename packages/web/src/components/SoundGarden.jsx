/**
 * Personal Sound Garden component for managing liked sounds
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Heart, 
  Play, 
  Pause, 
  Download, 
  Filter, 
  Search, 
  TreePine, 
  BarChart3, 
  Calendar,
  Music,
  Trash2,
  Share
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { soundGardenService } from '../services/SoundGardenService.js';
import SoundSpectrogram from './SoundSpectrogram.jsx';
import SoundPlayer from './SoundPlayer.jsx';

const GardenSoundCard = ({ sound, onPlay, onRemove, onViewLineage, isPlaying }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart size={14} className="text-red-400" fill="currentColor" />
          <span className="text-sm text-gray-300">
            Liked {new Date(sound.likedAt).toLocaleDateString()}
          </span>
          {sound.playCount > 0 && (
            <>
              <div className="h-1 w-1 bg-gray-500 rounded-full"></div>
              <span className="text-xs text-gray-500">
                Played {sound.playCount} times
              </span>
            </>
          )}
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-1 rounded hover:bg-gray-700 text-gray-400"
        >
          <BarChart3 size={16} />
        </button>
      </div>

      {/* Sound Info */}
      <div className="mb-4">
        <h3 className="text-white font-medium mb-1">
          Sound #{sound.soundId.slice(-6)}
        </h3>
        
        <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-2">
          {sound.metadata?.synthesisType && (
            <span className="bg-gray-700 px-2 py-1 rounded">
              {sound.metadata.synthesisType}
            </span>
          )}
          {sound.metadata?.duration && (
            <span className="bg-gray-700 px-2 py-1 rounded">
              {sound.metadata.duration.toFixed(1)}s
            </span>
          )}
          {sound.metadata?.generation !== undefined && (
            <span className="bg-gray-700 px-2 py-1 rounded">
              Gen {sound.metadata.generation}
            </span>
          )}
        </div>

        {sound.metadata?.tags && sound.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {sound.metadata.tags.map((tag, index) => (
              <span
                key={index}
                className="text-xs bg-green-900/30 text-green-300 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Spectrogram */}
      <div className="mb-4">
        <SoundSpectrogram soundId={sound.soundId} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SoundPlayer
            soundId={sound.soundId}
            metadata={sound.metadata}
            onPlay={onPlay}
            isPlaying={isPlaying}
          />
          
          {sound.metadata?.simulationId && (
            <button
              onClick={() => onViewLineage(sound)}
              className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-green-400 transition-colors"
              title="View in phylogenetic tree"
            >
              <TreePine size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRemove(sound)}
            className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
            title="Remove from garden"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="text-gray-300 font-medium mb-2">Usage Stats</h4>
              <div className="space-y-1 text-gray-400">
                <div>Play count: {sound.playCount || 0}</div>
                {sound.lastPlayed && (
                  <div>Last played: {new Date(sound.lastPlayed).toLocaleString()}</div>
                )}
                <div>Added: {new Date(sound.likedAt).toLocaleString()}</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-gray-300 font-medium mb-2">Source</h4>
              <div className="text-gray-400 text-xs">
                {sound.metadata?.simulationId && (
                  <div>From simulation: {sound.metadata.simulationId}</div>
                )}
                {sound.metadata?.fitness && (
                  <div>Fitness: {sound.metadata.fitness.toFixed(3)}</div>
                )}
                {sound.feedEntryId && (
                  <div>Via feed entry: {sound.feedEntryId.slice(-6)}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const GardenStats = ({ stats }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <BarChart3 size={18} />
        Garden Statistics
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{stats.totalSounds}</div>
          <div className="text-sm text-gray-400">Total Sounds</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">
            {Math.round(stats.totalPlayTime / 60)}m
          </div>
          <div className="text-sm text-gray-400">Play Time</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">
            {stats.mostPlayedSound?.playCount || 0}
          </div>
          <div className="text-sm text-gray-400">Most Played</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-400">
            {Object.keys(stats.synthesisTypeDistribution).length}
          </div>
          <div className="text-sm text-gray-400">Synthesis Types</div>
        </div>
      </div>

      {/* Synthesis Type Distribution */}
      {Object.keys(stats.synthesisTypeDistribution).length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Synthesis Types</h4>
          <div className="space-y-2">
            {Object.entries(stats.synthesisTypeDistribution).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-gray-400 capitalize">{type}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${(count / stats.totalSounds) * 100}%`
                      }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500 w-8">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats.recentlyLiked.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Recently Liked</h4>
          <div className="space-y-1">
            {stats.recentlyLiked.slice(0, 3).map((sound, index) => (
              <div key={sound.soundId} className="text-sm text-gray-400">
                Sound #{sound.soundId.slice(-6)} - {new Date(sound.likedAt).toLocaleDateString()}
              </div>
            ))}
          </div>
        </div>
      )}
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
   * Load garden data
   */
  const loadGarden = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Ensure sound garden service is initialized
      await soundGardenService.initialize();
      
      // Get all liked sounds
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
        sound.metadata?.synthesisType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sound.metadata?.tags?.some(tag => 
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        )
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
        case 'popular':
          filtered = filtered.filter(sound => (sound.playCount || 0) > 0)
                           .sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
          break;
        case 'granular':
        case 'fm':
        case 'additive':
          filtered = filtered.filter(sound => 
            sound.metadata?.synthesisType === selectedFilter
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
      await soundGardenService.unlikeSound(sound.soundId);
      await loadGarden(); // Reload to update stats
    } catch (error) {
      console.error('Error removing sound:', error);
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
      soundGardenService.recordSoundPlay(soundId);
      // Update stats after play
      setTimeout(() => {
        const newStats = soundGardenService.getGardenStats();
        setStats(newStats);
      }, 100);
    }
  };

  /**
   * Handle view lineage action
   */
  const handleViewLineage = (sound) => {
    if (onNavigateToTree && sound.metadata?.simulationId) {
      onNavigateToTree(sound.metadata.simulationId, sound.soundId);
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
      {/* Header - Scrolls with content */}
      <div className="w-full px-2 md:px-4 py-4 border-b border-gray-800">
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <Heart className="text-red-400" fill="currentColor" />
              <span className="hidden sm:inline">Sound Garden</span>
              <span className="sm:hidden">Garden</span>
            </h1>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowStats(!showStats)}
                className="px-2 md:px-3 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 text-sm"
              >
                <BarChart3 size={16} className="inline mr-1" />
                <span className="hidden sm:inline">{showStats ? 'Hide' : 'Show'} Stats</span>
                <span className="sm:hidden">Stats</span>
              </button>
              
              {sounds.length > 0 && (
                <button
                  onClick={handleExport}
                  className="px-2 md:px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  <Download size={16} className="inline mr-1" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search your sounds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Sounds</option>
              <option value="recent">Recent (7 days)</option>
              <option value="popular">Most Played</option>
              <option value="granular">Granular</option>
              <option value="fm">FM</option>
              <option value="additive">Additive</option>
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
          <div className="w-full px-2 md:px-4 py-4">
            {/* Statistics */}
            <div className="w-full max-w-6xl mx-auto">
              {showStats && stats && (
                <div className="mb-6">
                  <GardenStats stats={stats} />
                </div>
              )}

              {/* Results Info */}
              <div className="mb-4 text-sm text-gray-400">
                Showing {filteredSounds.length} of {sounds.length} sounds
              </div>

              {/* Sound Grid */}
              {filteredSounds.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredSounds.map((sound) => (
                    <GardenSoundCard
                      key={sound.soundId}
                      sound={sound}
                      onPlay={handlePlay}
                      onRemove={handleRemoveSound}
                      onViewLineage={handleViewLineage}
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
