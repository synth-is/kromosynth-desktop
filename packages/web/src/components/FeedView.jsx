/**
 * Feed component for displaying sound recommendations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Play, Pause, MoreHorizontal, TreePine, TrendingUp, Sparkles, Volume2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { recommendationService } from '../services/RecommendationService.js';
import { soundGardenService } from '../services/SoundGardenService.js';
import SoundSpectrogram from './SoundSpectrogram.jsx';
import SoundPlayer from './SoundPlayer.jsx';

const FeedEntry = ({ entry, onLike, onDislike, onPlay, onViewLineage, isPlaying, isLiked }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [interactionLoading, setInteractionLoading] = useState(false);

  const handleLike = async () => {
    if (interactionLoading) return;
    
    setInteractionLoading(true);
    try {
      await onLike(entry);
    } finally {
      setInteractionLoading(false);
    }
  };

  const handleDislike = async () => {
    if (interactionLoading) return;
    
    setInteractionLoading(true);
    try {
      await onDislike(entry);
    } finally {
      setInteractionLoading(false);
    }
  };

  const getRecommendationIcon = (type) => {
    switch (type) {
      case 'trending_evolution':
        return <TrendingUp size={14} className="text-orange-400" />;
      case 'similarity_match':
        return <Heart size={14} className="text-pink-400" />;
      case 'evolution_discovery':
        return <Sparkles size={14} className="text-blue-400" />;
      default:
        return <Volume2 size={14} className="text-gray-400" />;
    }
  };

  const getRecommendationLabel = (type) => {
    switch (type) {
      case 'trending_evolution':
        return 'Trending';
      case 'similarity_match':
        return 'Similar to your taste';
      case 'evolution_discovery':
        return 'Fresh discovery';
      default:
        return 'Recommended';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getRecommendationIcon(entry.recommendation_type)}
          <span className="text-sm text-gray-300">
            {getRecommendationLabel(entry.recommendation_type)}
          </span>
          <div className="h-1 w-1 bg-gray-500 rounded-full"></div>
          <span className="text-xs text-gray-500">
            Confidence: {Math.round(entry.confidence_score * 100)}%
          </span>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-1 rounded hover:bg-gray-700 text-gray-400"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Sound Info */}
      <div className="mb-4">
        <h3 className="text-white font-medium mb-1">
          Sound #{entry.sound_id.slice(-6)}
        </h3>
        
        <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-2">
          {entry.metadata?.synthesisType && (
            <span className="bg-gray-700 px-2 py-1 rounded">
              {entry.metadata.synthesisType}
            </span>
          )}
          {entry.metadata?.duration && (
            <span className="bg-gray-700 px-2 py-1 rounded">
              {entry.metadata.duration.toFixed(1)}s
            </span>
          )}
          {entry.metadata?.generation !== undefined && (
            <span className="bg-gray-700 px-2 py-1 rounded">
              Gen {entry.metadata.generation}
            </span>
          )}
        </div>

        {entry.metadata?.tags && entry.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {entry.metadata.tags.map((tag, index) => (
              <span
                key={index}
                className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Spectrogram placeholder */}
      <div className="mb-4">
        <SoundSpectrogram soundId={entry.sound_id} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SoundPlayer
            soundId={entry.sound_id}
            metadata={entry.metadata}
            onPlay={onPlay}
            isPlaying={isPlaying}
          />
          
          {entry.metadata?.simulationId && (
            <button
              onClick={() => onViewLineage(entry)}
              className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-green-400 transition-colors"
              title="View in phylogenetic tree"
            >
              <TreePine size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDislike}
            disabled={interactionLoading}
            className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Not interested"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="transition-transform hover:scale-110"
            >
              <path d="M7 10l5 5 5-5" />
              <path d="M7 14l5-5 5 5" />
            </svg>
          </button>
          
          <button
            onClick={handleLike}
            disabled={interactionLoading}
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

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="text-gray-300 font-medium mb-2">Technical Info</h4>
              <div className="space-y-1 text-gray-400">
                {entry.metadata?.fitness && (
                  <div>Fitness: {entry.metadata.fitness.toFixed(3)}</div>
                )}
                {entry.metadata?.simulationId && (
                  <div>Simulation: {entry.metadata.simulationId}</div>
                )}
                <div>Priority: {entry.priority_score.toFixed(2)}</div>
                <div>Created: {new Date(entry.created_at).toLocaleString()}</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-gray-300 font-medium mb-2">Lineage</h4>
              <div className="text-gray-400 text-xs">
                {entry.metadata?.generation !== undefined ? (
                  <div>
                    Generation {entry.metadata.generation} of evolution run
                    {entry.metadata?.simulationId && (
                      <div className="mt-1">in {entry.metadata.simulationId}</div>
                    )}
                  </div>
                ) : (
                  <div>Lineage information not available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FeedView = ({ onNavigateToTree }) => {
  const { user, isAuthenticated } = useAuth();
  const [feedEntries, setFeedEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [likedSounds, setLikedSounds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('feed');
  const [hasMore, setHasMore] = useState(true);

  /**
   * Load feed entries
   */
  const loadFeed = useCallback(async (offset = 0, limit = 20) => {
    try {
      setError(null);
      
      let result;
      switch (activeTab) {
        case 'trending':
          result = await recommendationService.getTrendingRecommendations('24h', limit);
          break;
        case 'discoveries':
          result = await recommendationService.getDiscoveryRecommendations(limit);
          break;
        default:
          result = await recommendationService.getUserFeed(limit, offset);
          break;
      }

      if (result.success) {
        if (offset === 0) {
          setFeedEntries(result.data);
        } else {
          setFeedEntries(prev => [...prev, ...result.data]);
        }
        
        setHasMore(result.data.length === limit);
        
        // Load liked status for all sounds
        const likedSet = new Set();
        for (const entry of result.data) {
          if (soundGardenService.isSoundLiked(entry.sound_id)) {
            likedSet.add(entry.sound_id);
          }
        }
        setLikedSounds(prev => new Set([...prev, ...likedSet]));
        
      } else {
        setError('Failed to load feed');
      }
    } catch (err) {
      console.error('Error loading feed:', err);
      setError('Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  /**
   * Initial load
   */
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      loadFeed(0);
    }
  }, [isAuthenticated, activeTab, loadFeed]);

  /**
   * Handle like action
   */
  const handleLike = async (entry) => {
    try {
      const isCurrentlyLiked = likedSounds.has(entry.sound_id);
      
      if (isCurrentlyLiked) {
        // Unlike
        await soundGardenService.unlikeSound(entry.sound_id, entry.id);
        setLikedSounds(prev => {
          const newSet = new Set(prev);
          newSet.delete(entry.sound_id);
          return newSet;
        });
      } else {
        // Like
        await soundGardenService.likeSound(entry.sound_id, entry, entry.id);
        setLikedSounds(prev => new Set([...prev, entry.sound_id]));
      }
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  /**
   * Handle dislike action
   */
  const handleDislike = async (entry) => {
    try {
      // Record dislike interaction
      await recommendationService.recordInteraction(entry.id, 'dismiss', {
        soundId: entry.sound_id,
        context: 'feed'
      });

      // Remove from current feed view
      setFeedEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (error) {
      console.error('Error handling dislike:', error);
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
      
      // Record interaction
      const entry = feedEntries.find(e => e.sound_id === soundId);
      if (entry) {
        recommendationService.recordInteraction(entry.id, 'play', {
          soundId,
          context: 'feed'
        });
      }
    }
  };

  /**
   * Handle view lineage action
   */
  const handleViewLineage = (entry) => {
    // Navigate to tree view with this sound's context
    if (onNavigateToTree && entry.metadata?.simulationId) {
      onNavigateToTree(entry.metadata.simulationId, entry.sound_id);
    }
  };

  /**
   * Load more entries
   */
  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadFeed(feedEntries.length);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Sign in required</h2>
          <p className="text-gray-400">Please sign in to view your personalized sound feed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-950">
      {/* Header - Scrolls with content */}
      <div className="w-full px-2 md:px-4 py-4 border-b border-gray-800">
        <div className="w-full max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-4">Sound Feed</h1>
          
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto">
            {[
              { id: 'feed', label: 'Personal Feed', icon: Heart },
              { id: 'trending', label: 'Trending', icon: TrendingUp },
              { id: 'discoveries', label: 'Fresh Discoveries', icon: Sparkles }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && feedEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading your sound feed...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-400 mb-2">Failed to load feed</p>
              <button
                onClick={() => loadFeed(0)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full px-2 md:px-4 py-4">
            <div className="w-full max-w-6xl mx-auto space-y-4">
              {feedEntries.map((entry) => (
                <FeedEntry
                  key={entry.id}
                  entry={entry}
                  onLike={handleLike}
                  onDislike={handleDislike}
                  onPlay={handlePlay}
                  onViewLineage={handleViewLineage}
                  isPlaying={currentlyPlaying === entry.sound_id}
                  isLiked={likedSounds.has(entry.sound_id)}
                />
              ))}
            </div>

            {/* Load More */}
            <div className="w-full max-w-6xl mx-auto">
              {hasMore && (
                <div className="text-center mt-6">
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="px-6 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}

              {!hasMore && feedEntries.length > 0 && (
                <div className="text-center mt-6 text-gray-500">
                  <p>You've reached the end of your feed</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedView;
