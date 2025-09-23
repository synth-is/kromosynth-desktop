/**
 * Sound Player component for playing audio in the feed and garden
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

const SoundPlayer = ({ soundId, metadata = {}, onPlay, isPlaying, className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(metadata.duration || 0);
  const audioRef = useRef(null);

  /**
   * Initialize audio element
   */
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'none';
      
      // Set up event listeners
      audioRef.current.addEventListener('loadstart', () => setIsLoading(true));
      audioRef.current.addEventListener('canplay', () => setIsLoading(false));
      audioRef.current.addEventListener('error', (e) => {
        setError('Failed to load audio');
        setIsLoading(false);
        console.error('Audio error:', e);
      });
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current.currentTime);
      });
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current.duration);
      });
      audioRef.current.addEventListener('ended', () => {
        onPlay && onPlay(null); // Notify parent that playback ended
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [onPlay]);

  /**
   * Handle play/pause state changes
   */
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      // Load and play audio
      if (!audioRef.current.src) {
        // For development, use a mock audio URL or generate audio
        // In production, this would come from the audio service
        audioRef.current.src = generateMockAudioUrl(soundId, metadata);
      }
      
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.play().catch(err => {
        setError('Playback failed');
        console.error('Playback error:', err);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, soundId, metadata, volume, isMuted]);

  /**
   * Generate mock audio URL for development
   * In production, this would fetch from the audio service
   */
  const generateMockAudioUrl = (soundId, metadata) => {
    // For development, use a placeholder audio file or generated tone
    // This could be a Web Audio API generated tone based on the sound parameters
    
    // Option 1: Use a placeholder audio file
    const placeholderAudio = '/WIDEHALL-1.wav'; // Use existing audio file
    
    // Option 2: Generate a tone using Web Audio API (more complex)
    // We'll use the placeholder for now
    return placeholderAudio;
  };

  /**
   * Handle play button click
   */
  const handlePlayClick = () => {
    if (onPlay) {
      onPlay(isPlaying ? null : soundId);
    }
  };

  /**
   * Handle volume change
   */
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : newVolume;
    }
  };

  /**
   * Toggle mute
   */
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.volume = !isMuted ? 0 : volume;
    }
  };

  /**
   * Handle seek
   */
  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  /**
   * Format time display
   */
  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Play/Pause Button */}
      <button
        onClick={handlePlayClick}
        disabled={isLoading}
        className={`p-2 rounded transition-colors ${
          isPlaying
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
        ) : isPlaying ? (
          <Pause size={16} />
        ) : (
          <Play size={16} />
        )}
      </button>

      {/* Progress Bar */}
      {(isPlaying || currentTime > 0) && duration > 0 && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {formatTime(currentTime)}
          </span>
          
          <div
            className="flex-1 h-2 bg-gray-700 rounded cursor-pointer relative"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-blue-500 rounded"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            ></div>
          </div>
          
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Volume Control */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleMute}
          className="p-1 rounded hover:bg-gray-700 text-gray-400"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-16 h-1 bg-gray-700 rounded appearance-none cursor-pointer volume-slider"
          title="Volume"
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="text-xs text-red-400" title={error}>
          ⚠️
        </div>
      )}

      <style jsx>{`
        .volume-slider::-webkit-slider-thumb {
          appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        
        .volume-slider::-moz-range-thumb {
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default SoundPlayer;
