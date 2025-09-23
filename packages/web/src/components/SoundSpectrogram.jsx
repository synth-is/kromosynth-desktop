/**
 * Sound Spectrogram component for visualizing audio frequency content
 */

import React, { useState, useEffect } from 'react';

const SoundSpectrogram = ({ soundId, width = 300, height = 80 }) => {
  const [spectrogramData, setSpectrogramData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // For now, generate a mock spectrogram
    // In production, this would fetch actual spectrogram data from the backend
    generateMockSpectrogram();
  }, [soundId]);

  const generateMockSpectrogram = () => {
    setIsLoading(true);
    
    // Simulate loading delay
    setTimeout(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;

      // Create a gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#1f2937'); // gray-800
      gradient.addColorStop(1, '#111827'); // gray-900
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Generate mock frequency data based on soundId
      const seed = soundId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const random = (x) => (Math.sin(seed * x * 0.1) * 0.5 + 0.5);

      // Draw frequency bars
      const barCount = Math.floor(width / 2);
      const barWidth = width / barCount;
      
      for (let i = 0; i < barCount; i++) {
        const intensity = random(i) * random(i * 2) * random(i * 0.5);
        const barHeight = intensity * height * 0.8;
        
        // Color based on frequency (blue to green to yellow to red)
        const hue = 240 - (intensity * 180); // Blue to red spectrum
        const saturation = 70 + (intensity * 30);
        const lightness = 30 + (intensity * 40);
        
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }

      // Add some harmonic patterns
      for (let i = 0; i < barCount; i += 5) {
        const harmonic = random(i * 0.3) * 0.3;
        const barHeight = harmonic * height;
        
        ctx.fillStyle = `rgba(59, 130, 246, ${harmonic})`; // blue-500 with alpha
        ctx.fillRect(i * barWidth, height - barHeight, barWidth * 2, 2);
      }

      setSpectrogramData(canvas.toDataURL());
      setIsLoading(false);
      setError(null);
    }, 200 + Math.random() * 300); // Random delay to simulate real loading
  };

  if (isLoading) {
    return (
      <div 
        className="bg-gray-800 rounded border border-gray-700 flex items-center justify-center"
        style={{ width, height }}
      >
        <div className="text-xs text-gray-500">Loading spectrogram...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="bg-gray-800 rounded border border-gray-700 flex items-center justify-center"
        style={{ width, height }}
      >
        <div className="text-xs text-red-400">Spectrogram unavailable</div>
      </div>
    );
  }

  return (
    <div className="relative rounded overflow-hidden border border-gray-700">
      <img
        src={spectrogramData}
        alt={`Spectrogram for sound ${soundId}`}
        className="w-full h-full object-cover"
        style={{ width, height }}
      />
      
      {/* Overlay with frequency labels */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Low frequency indicator */}
        <div className="absolute bottom-1 left-1 text-xs text-gray-400 bg-black/50 px-1 rounded">
          Low
        </div>
        
        {/* High frequency indicator */}
        <div className="absolute top-1 left-1 text-xs text-gray-400 bg-black/50 px-1 rounded">
          High
        </div>
        
        {/* Time indicator */}
        <div className="absolute bottom-1 right-1 text-xs text-gray-400 bg-black/50 px-1 rounded">
          Time →
        </div>
      </div>
    </div>
  );
};

export default SoundSpectrogram;
