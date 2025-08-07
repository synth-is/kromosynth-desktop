import { UNIT_TYPES } from '../constants';
import { BaseUnit } from './BaseUnit';
import SoundRenderer from '../utils/SoundRenderer';

export class LiveCodingUnit extends BaseUnit {
  constructor(id) {
    super(id, UNIT_TYPES.LIVE_CODING);
    
    // Strudel REPL instance (will be set when editor is ready)
    this.replInstance = null;
    this.editorInstance = null;
    
    // Sample bank management
    this.sampleBank = new Map(); // genomeId -> { name, blobUrl, metadata }
    this.sampleCounter = 0; // For generating unique sample names
    
    // Code generation settings
    this.autoGenerateCode = true;
    this.basePattern = '// Waiting for evolutionary sounds...\n// Double-click sounds in the tree to add them here'; // Default pattern
    this.currentCode = this.basePattern;
    
    // Sync/solo attributes (like in StrudelReplTest)
    this.sync = true;
    this.solo = false;
    
    // Playback state
    this.isPlaying = false;
    
    // Audio buffer to blob URL conversion cache
    this.blobUrlCache = new Map(); // genomeId-params -> blobUrl
    
    // Callback for when code changes (to notify editor)
    this.onCodeChange = null;
    
    console.log(`LiveCodingUnit ${this.id} initialized`);
  }

  async initialize() {
    try {
      console.log(`Initializing LiveCodingUnit ${this.id}`);
      await super.initialize();
      
      console.log(`LiveCodingUnit ${this.id} initialized successfully`);
      return true;
    } catch (err) {
      console.error(`LiveCodingUnit ${this.id} initialization error:`, err);
      return false;
    }
  }

  /**
   * Set the Strudel REPL instance when the editor is ready
   */
  async setReplInstance(editor, onCodeChangeCallback = null) {
    this.editorInstance = editor;
    this.replInstance = editor?.repl;
    
    // Set up the code change callback
    if (onCodeChangeCallback) {
      this.onCodeChange = onCodeChangeCallback;
      console.log(`LiveCodingUnit ${this.id}: onCodeChange callback set up`);
    }
    
    if (this.replInstance) {
      // Configure sync and solo
      if (this.editorInstance.sync !== undefined) {
        this.editorInstance.sync = this.sync;
      }
      if (this.editorInstance.solo !== undefined) {
        this.editorInstance.solo = this.solo;
      }
      
      console.log(`LiveCodingUnit ${this.id}: REPL instance connected`, {
        sync: this.sync,
        solo: this.solo,
        existingSamples: this.sampleBank.size,
        hasPendingSamples: this.hasPendingSamples
      });
      
      // Register any pending global samples first
      if (window.__pendingStrudelSamples && Object.keys(window.__pendingStrudelSamples).length > 0) {
        console.log(`LiveCodingUnit ${this.id}: Found pending global samples to register`);
        try {
          // Try different approaches to register pending samples
          let registered = false;
          
          if (this.replInstance.context?.samples) {
            await this.replInstance.context.samples(window.__pendingStrudelSamples);
            registered = true;
            console.log('✅ Registered pending samples via repl.context.samples()');
          } else if (window.samples) {
            await window.samples(window.__pendingStrudelSamples);
            registered = true;
            console.log('✅ Registered pending samples via window.samples()');
          }
          
          if (registered) {
            // Clear pending samples after successful registration
            window.__pendingStrudelSamples = {};
          }
        } catch (error) {
          console.error(`❌ Error registering pending samples:`, error);
        }
      }
      
      // Register any existing samples with Strudel now that REPL is available
      if (this.sampleBank.size > 0 || this.hasPendingSamples) {
        console.log(`LiveCodingUnit ${this.id}: Registering ${this.sampleBank.size} existing samples with Strudel`);
        const registered = await this.updateStrudelSampleBank();
        
        if (registered) {
          this.hasPendingSamples = false;
          // Auto-generate code if we have samples and auto-generate is enabled
          if (this.autoGenerateCode && this.sampleBank.size > 0) {
            const sampleNames = Array.from(this.sampleBank.values()).map(s => s.name);
            // Generate code with the last added sample (this will include all samples in the pattern)
            this.generateCodeWithNewSample(sampleNames[sampleNames.length - 1]);
            console.log(`LiveCodingUnit ${this.id}: Generated code for ${sampleNames.length} samples after registration`);
          }
        }
      }
      
      // Set initial code (or updated code if samples were just registered)
      this.setCode(this.currentCode); // Use setCode to ensure proper notification
    }
  }

  /**
   * Add a sound from evolutionary discovery to the sample bank
   * @param {Object} cellData - Cell data from phylogenetic tree
   * @param {Object} renderParams - Render parameters (duration, pitch, velocity)
   * @returns {Promise<string>} - Promise that resolves with the sample name
   */
  async addSoundToBank(cellData, renderParams = {}) {
    const { genomeId } = cellData;
    if (!genomeId) {
      throw new Error('Missing genomeId in cellData');
    }

    // Create a unique sample name
    const sampleName = `evo_${this.sampleCounter++}`;
    
    // Default render parameters
    const finalRenderParams = {
      duration: renderParams.duration || cellData.duration || 4,
      pitch: renderParams.pitch || cellData.noteDelta || cellData.pitch || 0,
      velocity: renderParams.velocity || cellData.velocity || 1
    };

    console.log(`LiveCodingUnit ${this.id}: Adding sound to bank`, {
      genomeId,
      sampleName,
      renderParams: finalRenderParams,
      hasDirectUrl: !!cellData.genomeUrl
    });

    try {
      // Create cache key for this specific render combination
      const cacheKey = `${genomeId}-${finalRenderParams.duration}_${finalRenderParams.pitch}_${finalRenderParams.velocity}`;
      
      // Check if we already have a blob URL for this exact combination
      if (this.blobUrlCache.has(cacheKey)) {
        const existingBlobUrl = this.blobUrlCache.get(cacheKey);
        console.log(`Using cached blob URL for ${cacheKey}`);
        
        // Add to sample bank with existing blob URL
        this.sampleBank.set(genomeId, {
          name: sampleName,
          blobUrl: existingBlobUrl,
          metadata: {
            genomeId,
            ...finalRenderParams,
            experiment: cellData.experiment,
            evoRunId: cellData.evoRunId
          }
        });
        
        await this.updateStrudelSampleBank();
        return { sampleName, strudelRegistered: !!this.replInstance };
      }

      // Determine how to get the audio data
      let renderResult;
      
      if (cellData.genomeUrl) {
        // Use direct genome URL with SoundRenderer.renderGenome
        console.log(`Using direct genome URL: ${cellData.genomeUrl}`);
        
        renderResult = await new Promise((resolve, reject) => {
          SoundRenderer.renderGenome(
            cellData.genomeUrl,
            finalRenderParams,
            (result) => {
              if (result.success && result.audioBuffer) {
                resolve(result);
              } else {
                reject(new Error(result.error || 'Render failed'));
              }
            },
            (progress) => {
              console.log(`Rendering progress for ${sampleName}: ${progress.progress}%`);
            }
          );
        });
      } else {
        // Use the standard SoundRenderer.renderSound method
        console.log('Using standard sound rendering pipeline');
        
        renderResult = await new Promise((resolve, reject) => {
          SoundRenderer.renderSound(
            {
              genomeId,
              experiment: cellData.experiment || 'unknown',
              evoRunId: cellData.evoRunId || 'unknown'
            },
            finalRenderParams,
            (result) => {
              if (result.success && result.audioBuffer) {
                resolve(result);
              } else {
                reject(new Error(result.error || 'Render failed'));
              }
            },
            (progress) => {
              console.log(`Rendering progress for ${sampleName}: ${progress.progress}%`);
            }
          );
        });
      }

      // Convert AudioBuffer to blob URL
      const blobUrl = await this.audioBufferToBlobUrl(renderResult.audioBuffer);
      
      // Cache the blob URL
      this.blobUrlCache.set(cacheKey, blobUrl);

      // Add to sample bank
      this.sampleBank.set(genomeId, {
        name: sampleName,
        blobUrl,
        metadata: {
          genomeId,
          ...finalRenderParams,
          experiment: cellData.experiment,
          evoRunId: cellData.evoRunId,
          audioBuffer: renderResult.audioBuffer // Keep reference for potential future use
        }
      });

      // Update Strudel's sample bank
      const strudelRegistered = await this.updateStrudelSampleBank();

      // Also try the raw data registration approach as an additional test
      if (renderResult.audioBuffer) {
        console.log(`🧪 LiveCodingUnit ${this.id}: Also trying raw data registration for ${sampleName}...`);
        await this.registerSampleRawData(sampleName, renderResult.audioBuffer);
      }

      // Always generate code if auto-generate is enabled, regardless of registration status
      // The code will be applied when the editor opens if not registered yet
      if (this.autoGenerateCode) {
        this.generateCodeWithNewSample(sampleName);
        
        // If Strudel is ready and registered, the code is already set in generateCodeWithNewSample
        // If not ready, the code will be applied when the editor opens via setReplInstance
        if (!strudelRegistered) {
          console.log(`LiveCodingUnit ${this.id}: Code generated for future use when editor opens`);
        }
      }

      console.log(`LiveCodingUnit ${this.id}: Successfully added sound to bank`, {
        sampleName,
        genomeId,
        blobUrl: blobUrl.substring(0, 50) + '...',
        strudelRegistered
      });

      return { sampleName, strudelRegistered };
    } catch (error) {
      console.error(`LiveCodingUnit ${this.id}: Error adding sound to bank:`, error);
      throw error;
    }
  }

  /**
   * Alternative approach: Register sample using raw audio data
   * @param {string} sampleName - Name to register the sample under
   * @param {AudioBuffer} audioBuffer - Audio buffer to register
   */
  async registerSampleRawData(sampleName, audioBuffer) {
    console.log('🧪 Attempting raw PCM data registration...');
    
    try {
      // Get the raw audio data
      const channelData = audioBuffer.getChannelData(0); // Get first channel
      
      // Try to register this directly with Strudel
      if (this.strudelRepl && this.strudelRepl.evaluate) {
        const registrationCode = `
          console.log('🧪 Registering raw audio data for ${sampleName}...');
          // Try to set the sample directly in the sample bank
          const sampleData = new Float32Array([${Array.from(channelData).slice(0, 1000).join(',')}]); // Limit size for eval
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const buffer = audioCtx.createBuffer(${audioBuffer.numberOfChannels}, ${Math.min(audioBuffer.length, 1000)}, ${audioBuffer.sampleRate});
          buffer.getChannelData(0).set(sampleData);
          
          // Register with samples function
          samples({
            '${sampleName}': buffer
          }, '');
          console.log('✅ Raw audio data registration completed for ${sampleName}');
        `;
        
        await this.strudelRepl.evaluate(registrationCode);
        console.log('✅ Raw PCM data registration attempted');
      }
    } catch (err) {
      console.error('❌ Raw PCM data registration failed:', err);
    }
  }

  /**
   * Convert AudioBuffer to blob URL for use with Strudel
   * @param {AudioBuffer} audioBuffer - AudioBuffer to convert
   * @returns {Promise<string>} - Promise that resolves with blob URL
   */
  async audioBufferToBlobUrl(audioBuffer) {
    // First, analyze the audio content to verify it contains sound
    const audioAnalysis = this.analyzeAudioContent(audioBuffer);
    if (!audioAnalysis.containsSound) {
      console.warn('⚠️ Audio buffer appears to contain no sound data - this may explain why playback is silent');
    }
    
    // Debug: Test if the original AudioBuffer is playable
    console.log('🧪 Testing AudioBuffer playability directly...');
    try {
      // Create a simple test by playing the AudioBuffer directly via Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Test playback for 100ms to verify the buffer has audio
      const testGain = audioContext.createGain();
      testGain.gain.setValueAtTime(0.3, audioContext.currentTime); // Slightly higher volume test
      source.connect(testGain);
      testGain.connect(audioContext.destination);
      
      source.start(audioContext.currentTime);
      source.stop(audioContext.currentTime + 0.2); // Slightly longer test
      
      console.log('✅ AudioBuffer direct playback test started (you should hear a brief sound)');
    } catch (err) {
      console.error('❌ AudioBuffer direct playback test failed:', err);
    }
    
    // Try alternative approach: Use OfflineAudioContext to create better quality WAV
    console.log('🧪 Creating high-quality WAV with OfflineAudioContext...');
    try {
      // Create offline context with same properties as source
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      // Create source in offline context
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      
      // Render the audio
      const renderedBuffer = await offlineContext.startRendering();
      
      // Convert rendered buffer to WAV
      const wavArrayBuffer = this.audioBufferToWav(renderedBuffer);
      const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      
      // Test the new blob URL
      console.log('🧪 Testing offline-rendered blob URL...');
      const audio = new Audio(blobUrl);
      audio.volume = 0.3;
      audio.addEventListener('loadeddata', () => {
        console.log(`✅ Offline-rendered blob URL loaded (duration: ${audio.duration}s)`);
        // Quick test
        audio.currentTime = 0;
        audio.play().then(() => {
          console.log('✅ Offline-rendered blob URL playback started');
          setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
          }, 200);
        }).catch(err => {
          console.error('❌ Offline-rendered blob URL playback failed:', err);
        });
      });
      audio.addEventListener('error', (err) => {
        console.error(`❌ Offline-rendered blob URL loading failed:`, err);
      });
      audio.load();
      
      console.log('Offline-rendered blob creation details:', {
        originalLength: audioBuffer.length,
        renderedLength: renderedBuffer.length,
        sampleRate: renderedBuffer.sampleRate,
        channels: renderedBuffer.numberOfChannels,
        wavSize: wavArrayBuffer.byteLength,
        blobSize: blob.size,
        blobUrl: blobUrl.substring(0, 80) + '...'
      });
      
      return blobUrl;
      
    } catch (err) {
      console.error('❌ OfflineAudioContext approach failed:', err);
      
      // Fallback to original method
      const wavArrayBuffer = this.audioBufferToWav(audioBuffer);
      const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      
      console.log('Fallback blob creation details:', {
        audioBufferLength: audioBuffer.length,
        audioBufferSampleRate: audioBuffer.sampleRate,
        audioBufferChannels: audioBuffer.numberOfChannels,
        wavArrayBufferSize: wavArrayBuffer.byteLength,
        blobSize: blob.size,
        blobType: blob.type,
        blobUrl: blobUrl.substring(0, 80) + '...'
      });
      
      return blobUrl;
    }
  }

  /**
   * Convert AudioBuffer to WAV ArrayBuffer
   * Based on: https://github.com/Jam3/audiobuffer-to-wav
   */
  audioBufferToWav(buffer) {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  }

  /**
   * Analyze AudioBuffer to verify it contains actual audio data
   * @param {AudioBuffer} audioBuffer - AudioBuffer to analyze
   * @returns {Object} - Analysis results
   */
  analyzeAudioContent(audioBuffer) {
    console.log('🔍 Analyzing audio content...');
    
    try {
      const channelData = audioBuffer.getChannelData(0); // Analyze first channel
      const length = channelData.length;
      
      // Calculate basic statistics
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      let sumSquares = 0;
      let nonZeroSamples = 0;
      let maxAbsValue = 0;
      
      for (let i = 0; i < length; i++) {
        const sample = channelData[i];
        min = Math.min(min, sample);
        max = Math.max(max, sample);
        sum += sample;
        sumSquares += sample * sample;
        
        if (sample !== 0) {
          nonZeroSamples++;
        }
        
        maxAbsValue = Math.max(maxAbsValue, Math.abs(sample));
      }
      
      const mean = sum / length;
      const variance = (sumSquares / length) - (mean * mean);
      const rms = Math.sqrt(sumSquares / length);
      const nonZeroPercent = (nonZeroSamples / length) * 100;
      
      // Check for peaks (values > 10% of max)
      const peakThreshold = maxAbsValue * 0.1;
      let peakCount = 0;
      for (let i = 0; i < length; i++) {
        if (Math.abs(channelData[i]) > peakThreshold) {
          peakCount++;
        }
      }
      
      const analysis = {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        length: length,
        min: min,
        max: max,
        mean: mean,
        rms: rms,
        variance: variance,
        maxAbsValue: maxAbsValue,
        nonZeroSamples: nonZeroSamples,
        nonZeroPercent: nonZeroPercent.toFixed(2),
        peakCount: peakCount,
        peakPercent: (peakCount / length * 100).toFixed(2),
        containsSound: nonZeroSamples > 0 && maxAbsValue > 0.001, // Threshold for "actual sound"
        signalStrength: rms > 0.01 ? 'Strong' : rms > 0.001 ? 'Weak' : 'Very Weak/Silent'
      };
      
      console.log('📊 Audio Content Analysis:', analysis);
      
      // Additional diagnostic info
      if (analysis.containsSound) {
        console.log('✅ Audio contains sound data');
        console.log(`📈 Signal strength: ${analysis.signalStrength} (RMS: ${rms.toFixed(6)})`);
        console.log(`📊 ${analysis.nonZeroPercent}% non-zero samples, ${analysis.peakPercent}% peaks`);
        
        // Show first few samples for inspection
        const firstSamples = Array.from(channelData.slice(0, 10)).map(s => s.toFixed(6));
        console.log('🔍 First 10 samples:', firstSamples);
        
        // Show some middle samples
        const midStart = Math.floor(length / 2);
        const middleSamples = Array.from(channelData.slice(midStart, midStart + 10)).map(s => s.toFixed(6));
        console.log('🔍 Middle 10 samples:', middleSamples);
      } else {
        console.log('❌ Audio appears to be silent or contains no meaningful sound data');
        console.log(`📉 Max absolute value: ${maxAbsValue.toFixed(8)}`);
        console.log(`📉 RMS: ${rms.toFixed(8)}`);
      }
      
      return analysis;
      
    } catch (err) {
      console.error('❌ Audio content analysis failed:', err);
      return { error: err.message, containsSound: false };
    }
  }

  /**
   * Generate a test tone AudioBuffer for testing purposes
   * @param {number} frequency - Frequency in Hz (default: 440)
   * @param {number} duration - Duration in seconds (default: 1)
   * @param {number} sampleRate - Sample rate (default: 44100)
   * @returns {AudioBuffer} - Generated test tone
   */
  generateTestTone(frequency = 440, duration = 1, sampleRate = 44100) {
    console.log(`🧪 Generating test tone: ${frequency}Hz, ${duration}s`);
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    // Generate sine wave
    for (let i = 0; i < channelData.length; i++) {
      const t = i / sampleRate;
      channelData[i] = 0.3 * Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 2); // Exponential decay
    }
    
    console.log('✅ Test tone generated');
    return audioBuffer;
  }

  /**
   * Add a test sample for debugging purposes
   */
  async addTestSample() {
    console.log('🧪 Adding test sample with known audio content...');
    
    try {
      // Generate a test tone
      const testAudioBuffer = this.generateTestTone(440, 1); // 440Hz for 1 second
      
      // Analyze the test audio to verify it contains sound
      const analysis = this.analyzeAudioContent(testAudioBuffer);
      if (!analysis.containsSound) {
        console.error('❌ Generated test tone contains no sound - this indicates a problem with audio generation');
        return;
      }
      
      // Convert to blob URL
      const blobUrl = await this.audioBufferToBlobUrl(testAudioBuffer);
      
      // Add to sample bank with fake genome ID
      const testGenomeId = 'test_tone_' + Date.now();
      const sampleName = `test_${this.sampleCounter++}`;
      
      this.sampleBank.set(testGenomeId, {
        name: sampleName,
        blobUrl,
        metadata: {
          genomeId: testGenomeId,
          type: 'test_tone',
          frequency: 440,
          duration: 1,
          audioBuffer: testAudioBuffer
        }
      });
      
      // Register with Strudel
      await this.updateStrudelSampleBank();
      
      // Generate code using the test sample
      if (this.autoGenerateCode) {
        this.generateCodeWithNewSample(sampleName);
      }
      
      console.log('✅ Test sample added successfully:', sampleName);
      return sampleName;
      
    } catch (err) {
      console.error('❌ Failed to add test sample:', err);
    }
  }

  /**
   * Update Strudel's sample bank with current samples
   */
  async updateStrudelSampleBank() {
    // Create sample map for Strudel
    const sampleMap = {};
    this.sampleBank.forEach((sampleData, genomeId) => {
      sampleMap[sampleData.name] = sampleData.blobUrl;
    });

    if (Object.keys(sampleMap).length === 0) {
      console.log(`LiveCodingUnit ${this.id}: No samples to register`);
      return true;
    }

    console.log(`LiveCodingUnit ${this.id}: Preparing to register samples:`, {
      sampleCount: Object.keys(sampleMap).length,
      sampleNames: Object.keys(sampleMap),
      sampleUrls: Object.values(sampleMap).map(url => url.substring(0, 50) + '...')
    });

    // Try direct registration if REPL is available
    if (this.replInstance) {
      try {
        console.log(`LiveCodingUnit ${this.id}: Attempting Strudel samples() registration...`);

        // Method 1: Use the samples() function from multiple possible contexts
        let samplesFunction = null;
        let registrationMethod = '';
        
        if (this.replInstance.context?.samples) {
          samplesFunction = this.replInstance.context.samples;
          registrationMethod = 'repl.context.samples()';
        } else if (this.replInstance.samples) {
          samplesFunction = this.replInstance.samples;
          registrationMethod = 'repl.samples()';
        } else if (window.samples) {
          samplesFunction = window.samples;
          registrationMethod = 'window.samples()';
        }
        
        if (samplesFunction) {
          // Call the samples function with our sample map
          await samplesFunction(sampleMap);
          console.log(`LiveCodingUnit ${this.id}: ✅ Samples registered successfully via ${registrationMethod}!`);
          console.log('Sample map sent to Strudel:', sampleMap);
          
          // Also try to register samples directly in the REPL evaluation context
          // This ensures they're available when patterns are evaluated
          if (this.replInstance.context) {
            try {
              // Method 2: Direct assignment to context
              if (!this.replInstance.context.sampleMaps) {
                this.replInstance.context.sampleMaps = {};
              }
              Object.assign(this.replInstance.context.sampleMaps, sampleMap);
              console.log('✅ Also registered samples in REPL context.sampleMaps');
              
              // Method 3: Direct assignment to _samples (internal Strudel property)
              if (!this.replInstance.context._samples) {
                this.replInstance.context._samples = {};
              }
              Object.assign(this.replInstance.context._samples, sampleMap);
              console.log('✅ Also registered samples in REPL context._samples');
              
              // Method 4: Try to register via the context's samples function if it exists
              if (typeof this.replInstance.context.samples === 'function') {
                await this.replInstance.context.samples(sampleMap);
                console.log('✅ Also registered via REPL context.samples() function');
              }
              
              // Method 5: Force registration by setting samples in multiple known locations
              const contextKeys = ['samples', '_samples', 'sampleMaps', 'sampleMap'];
              contextKeys.forEach(key => {
                if (!this.replInstance.context[key]) {
                  this.replInstance.context[key] = {};
                }
                if (typeof this.replInstance.context[key] === 'object') {
                  Object.assign(this.replInstance.context[key], sampleMap);
                  console.log(`✅ Force-registered in context.${key}`);
                }
              });
              
            } catch (err) {
              console.warn('Could not register in REPL context directly:', err);
            }
          }
          
          // Method 4: Also ensure samples are available globally for immediate access
          if (typeof window !== 'undefined') {
            if (!window.sampleMaps) {
              window.sampleMaps = {};
            }
            Object.assign(window.sampleMaps, sampleMap);
            console.log('✅ Also registered samples in window.sampleMaps');
            
            // Test if blob URLs are actually playable
            console.log('🧪 Testing blob URL playability...');
            Object.entries(sampleMap).forEach(([name, blobUrl]) => {
              const audio = new Audio(blobUrl);
              audio.addEventListener('loadeddata', () => {
                console.log(`✅ Audio ${name} loaded successfully (duration: ${audio.duration}s)`);
              });
              audio.addEventListener('error', (err) => {
                console.error(`❌ Audio ${name} loading failed:`, err);
              });
              audio.load();
            });
          }
          
          return true;
        } else {
          console.warn(`LiveCodingUnit ${this.id}: ❌ Could not find samples() function in any context`);
          console.log('Available context properties:', Object.keys(this.replInstance.context || {}));
          console.log('Available REPL properties:', Object.keys(this.replInstance || {}));
        }
      } catch (error) {
        console.error(`LiveCodingUnit ${this.id}: ❌ Error registering samples with Strudel:`, error);
      }
    }

    // Fallback: Store in global window object for later registration
    if (typeof window !== 'undefined') {
      // Store samples globally for Strudel to pick up
      window.__pendingStrudelSamples = window.__pendingStrudelSamples || {};
      Object.assign(window.__pendingStrudelSamples, sampleMap);
      
      console.log(`LiveCodingUnit ${this.id}: 📦 Samples stored globally for deferred registration`);
      
      // Mark that we have pending samples to register
      this.hasPendingSamples = true;
      
      console.warn(`LiveCodingUnit ${this.id}: ⚠️ REPL not ready. Samples stored for later registration. Open Live Code tab to complete setup.`);
      return false;
    }
    
    return false;
  }

  /**
   * Generate new Strudel code that incorporates a newly added sample
   * @param {string} sampleName - Name of the newly added sample
   */
  generateCodeWithNewSample(sampleName) {
    // Get all sample names 
    const existingSampleNames = Array.from(this.sampleBank.values()).map(s => s.name);
    
    console.log('🧪 TESTING: Using simple pattern code (samples registered programmatically)');
    
    // Generate simple pattern code - samples are registered separately via updateStrudelSampleBank()
    if (existingSampleNames.length === 1) {
      // First sample - create a simple pattern
      this.currentCode = `s("${sampleName}").gain(0.8)`;
    } else if (existingSampleNames.length === 2) {
      // Two samples - create an alternating pattern
      this.currentCode = `s("${existingSampleNames.join(' ')}").gain(0.8)`;
    } else {
      // Multiple samples - create a more complex pattern
      // Pick last 4 samples for manageable pattern
      const recentSamples = existingSampleNames.slice(-4);
      this.currentCode = `s("[${recentSamples.join(', ')}]").gain(0.8)`;
    }

    // Update the editor with new code
    this.setCode(this.currentCode); // Use setCode to trigger notifications
    console.log(`LiveCodingUnit ${this.id}: Generated simple pattern code (samples registered programmatically)`);
    console.log('Generated pattern code:');
    console.log(this.currentCode);
  }

  /**
   * Manually set the Strudel code
   * @param {string} code - Strudel code to set
   */
  setCode(code) {
    console.log(`LiveCodingUnit ${this.id}: setCode called with:`, code);
    console.log(`LiveCodingUnit ${this.id}: replInstance exists:`, !!this.replInstance);
    console.log(`LiveCodingUnit ${this.id}: onCodeChange callback exists:`, !!this.onCodeChange);
    
    this.currentCode = code;
    if (this.replInstance) {
      console.log(`LiveCodingUnit ${this.id}: Calling replInstance.setCode()`);
      
      // Debug: Check sample availability when setting code
      if (code.includes('s(')) {
        console.log('Code includes samples - checking availability:');
        console.log('- window.samples exists:', typeof window.samples === 'function');
        console.log('- window.sampleMaps:', Object.keys(window.sampleMaps || {}));
        console.log('- repl.context.sampleMaps:', Object.keys(this.replInstance.context?.sampleMaps || {}));
        console.log('- repl.context._samples:', Object.keys(this.replInstance.context?._samples || {}));
        
        // Show current sample bank
        const currentSamples = Array.from(this.sampleBank.values()).map(s => ({ name: s.name, url: s.blobUrl.substring(0, 30) + '...' }));
        console.log('- LiveCodingUnit sample bank:', currentSamples);
      }
      
      this.replInstance.setCode(code);
    }
    
    // Notify editor if callback is registered
    if (this.onCodeChange) {
      console.log(`LiveCodingUnit ${this.id}: Calling onCodeChange callback`);
      this.onCodeChange(code);
    }
  }

  /**
   * Handle cell hover events from phylogenetic tree (similar to LoopingUnit)
   * This makes hovering nodes automatically add sounds to the sample bank
   * @param {Object} cellData - Cell data from hover event
   */
  async handleCellHover(cellData) {
    console.log('LiveCodingUnit handleCellHover:', cellData);
    if (!this.active || this.muted || !cellData) return;

    const { genomeId } = cellData;
    if (!genomeId) return;

    try {
      // Check if we already have this sound in our sample bank
      if (this.sampleBank.has(genomeId)) {
        console.log(`LiveCodingUnit ${this.id}: Sound ${genomeId} already in sample bank`);
        return;
      }

      // Add sound to sample bank with render parameters from hover
      const result = await this.addSoundToBank(cellData, {
        duration: cellData.duration || 4,
        pitch: cellData.noteDelta || 0,
        velocity: cellData.velocity || 1
      });

      console.log(`LiveCodingUnit ${this.id}: Successfully added sound from hover: ${result.sampleName}`);

      // Trigger any loop state callback if provided (for consistency with other units)
      if (cellData.config?.onLoopStateChanged) {
        cellData.config.onLoopStateChanged(true);
      }

    } catch (error) {
      console.error(`LiveCodingUnit ${this.id}: Error handling hover:`, error);
      
      // Trigger error callback if provided
      if (cellData.config?.onLoopStateChanged) {
        cellData.config.onLoopStateChanged(false);
      }
    }
  }

  /**
   * Get the current Strudel code
   * @returns {string} - Current code
   */
  getCode() {
    if (this.replInstance) {
      return this.replInstance.getCode();
    }
    return this.currentCode;
  }

  /**
   * Play the current pattern
   */
  play() {
    if (this.replInstance) {
      this.replInstance.start();
      this.isPlaying = true;
      console.log(`LiveCodingUnit ${this.id}: Started playback`);
    }
  }

  /**
   * Stop the current pattern
   */
  stop() {
    if (this.replInstance) {
      this.replInstance.stop();
      this.isPlaying = false;
      console.log(`LiveCodingUnit ${this.id}: Stopped playback`);
    }
  }

  /**
   * Toggle playback
   */
  toggle() {
    if (this.replInstance) {
      if (this.isPlaying) {
        this.stop();
      } else {
        this.play();
      }
    }
  }

  /**
   * Evaluate the current code
   */
  async evaluate() {
    if (this.replInstance) {
      const code = this.replInstance.getCode();
      
      // Debug: Check sample availability before evaluation
      console.log(`LiveCodingUnit ${this.id}: About to evaluate code: ${code}`);
      console.log('Sample availability check:');
      console.log('- window.samples exists:', typeof window.samples === 'function');
      console.log('- window.sampleMaps:', Object.keys(window.sampleMaps || {}));
      console.log('- repl.context.sampleMaps:', Object.keys(this.replInstance.context?.sampleMaps || {}));
      console.log('- repl.context._samples:', Object.keys(this.replInstance.context?._samples || {}));
      
      // Try to manually register samples again right before evaluation
      const sampleMap = {};
      this.sampleBank.forEach((sampleData, genomeId) => {
        sampleMap[sampleData.name] = sampleData.blobUrl;
      });
      
      if (Object.keys(sampleMap).length > 0) {
        console.log(`LiveCodingUnit ${this.id}: Re-registering samples before evaluation:`, sampleMap);
        
        // Try multiple registration methods again - be very aggressive
        const registrationMethods = [
          async () => this.replInstance.context?.samples?.(sampleMap),
          async () => window.samples?.(sampleMap),
          async () => {
            if (this.replInstance.context) {
              // Force multiple context registrations
              const contextKeys = ['samples', '_samples', 'sampleMaps', 'sampleMap'];
              contextKeys.forEach(key => {
                if (!this.replInstance.context[key]) {
                  this.replInstance.context[key] = {};
                }
                if (typeof this.replInstance.context[key] === 'object') {
                  Object.assign(this.replInstance.context[key], sampleMap);
                }
              });
            }
          }
        ];
        
        for (const method of registrationMethods) {
          try {
            await method();
            console.log('✅ Re-registration method succeeded');
          } catch (err) {
            console.warn('❌ Re-registration method failed:', err);
          }
        }
        
        // Final debug check after re-registration
        console.log('After re-registration:');
        console.log('- repl.context.sampleMaps:', Object.keys(this.replInstance.context?.sampleMaps || {}));
        console.log('- repl.context._samples:', Object.keys(this.replInstance.context?._samples || {}));
        console.log('- repl.context.samples function exists:', typeof this.replInstance.context?.samples === 'function');
      }
      
      this.replInstance.evaluate(code);
      this.currentCode = code;
      console.log(`LiveCodingUnit ${this.id}: Evaluated code: ${code}`);
    }
  }

  /**
   * Update unit configuration
   */
  updateConfig(config) {
    Object.assign(this, config);
    
    // Update REPL instance if available
    if (this.editorInstance) {
      if (config.sync !== undefined) {
        this.editorInstance.sync = config.sync;
      }
      if (config.solo !== undefined) {
        this.editorInstance.solo = config.solo;
      }
    }
    
    // Update current code if strudelCode is provided
    if (config.strudelCode !== undefined && config.strudelCode !== this.currentCode) {
      this.setCode(config.strudelCode);
    }
    
    console.log(`LiveCodingUnit ${this.id}: Config updated`, config);
  }

  /**
   * Get information about the current sample bank
   */
  getSampleBankInfo() {
    return {
      sampleCount: this.sampleBank.size,
      samples: Array.from(this.sampleBank.entries()).map(([genomeId, data]) => ({
        genomeId,
        name: data.name,
        metadata: data.metadata
      }))
    };
  }

  /**
   * Remove a sample from the bank
   * @param {string} genomeId - Genome ID to remove
   */
  removeSample(genomeId) {
    const sampleData = this.sampleBank.get(genomeId);
    if (sampleData) {
      // Revoke the blob URL to free memory
      URL.revokeObjectURL(sampleData.blobUrl);
      this.sampleBank.delete(genomeId);
      
      // Update Strudel sample bank
      this.updateStrudelSampleBank();
      
      console.log(`LiveCodingUnit ${this.id}: Removed sample for genome ${genomeId}`);
    }
  }

  /**
   * Clear all samples from the bank
   */
  clearSampleBank() {
    // Revoke all blob URLs
    this.sampleBank.forEach((sampleData) => {
      URL.revokeObjectURL(sampleData.blobUrl);
    });
    
    this.sampleBank.clear();
    this.blobUrlCache.clear();
    this.sampleCounter = 0;
    
    console.log(`LiveCodingUnit ${this.id}: Sample bank cleared`);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    console.log(`LiveCodingUnit ${this.id}: Starting cleanup`);
    
    // Stop playback
    this.stop();
    
    // Clear sample bank (this will revoke blob URLs)
    this.clearSampleBank();
    
    // Clear REPL instance
    this.replInstance = null;
    this.editorInstance = null;
    
    // Call parent cleanup
    super.cleanup();
    
    console.log(`LiveCodingUnit ${this.id}: Cleanup completed`);
  }
}
