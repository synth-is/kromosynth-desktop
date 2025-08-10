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
    this.pendingSamples = {}; // Unit-specific pending samples (avoid global pollution)
    this.hasPendingSamples = false;
    this.pendingCode = null; // Store code updates when REPL is not ready
    
    // Code generation settings
    this.autoGenerateCode = true;
    this.basePattern = `// Live coding unit ${this.id}\n// Waiting for evolutionary sounds...\n// Double-click sounds in the tree to add them here`; // Unit-specific default pattern
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
    
    // Queue for sync/solo updates when element not yet attached
    this._pendingUiFlags = {};
    
    console.log(`LiveCodingUnit ${this.id} initialized`);
  }

  // Wait until REPL context is fully ready (context + samples function)
  async _waitForReplReady(timeoutMs = 2000, intervalMs = 40) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ctx = this.replInstance?.context;
      if (ctx && typeof ctx.samples === 'function') return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return !!(this.replInstance?.context);
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
   * Simple connection - no complex bridging needed
   */
  async setReplInstance(editor, strudelElement = null) {
    console.log(`LiveCodingUnit ${this.id}: setReplInstance called with strudelElement:`, !!strudelElement);
    // Determine if element changed (reattach)
    const prevElement = this.strudelElement;
    const elementChanged = prevElement && strudelElement && prevElement !== strudelElement;

    // Update references
    this.replInstance = editor?.repl;
    this.editorInstance = editor;
    this.strudelElement = strudelElement; // Store reference to strudel-editor for sync/solo

    // Apply any pending sync/solo flags now that we have the element
    try {
      if (this.strudelElement && this._pendingUiFlags) {
        if (this._pendingUiFlags.sync !== undefined) this.strudelElement.sync = this._pendingUiFlags.sync;
        if (this._pendingUiFlags.solo !== undefined) this.strudelElement.solo = this._pendingUiFlags.solo;
        this._pendingUiFlags = {};
      }
    } catch {}

    // Simple persistence on blur for unit switching
    if (this.strudelElement) {
      this.strudelElement.addEventListener('blur', () => {
        try {
          const code = this.getCurrentCode();
          const updateEvent = new CustomEvent('updateUnitConfig', {
            detail: { unitId: this.id, config: { strudelCode: code }, source: 'LiveCodingUnit.blur' }
          });
          document.dispatchEvent(updateEvent);
        } catch {}
      });
    }

    
    // Handle any pending samples and code now that REPL is ready
    if (this.replInstance && this.editorInstance) {
      console.log(`LiveCodingUnit ${this.id}: REPL ready - processing pending items`);
      // Always sync current code into the editor to avoid adopting stale/default code
      try {
        if (this.currentCode) {
          this.editorInstance.setCode(this.currentCode);
          this.strudelElement?.setAttribute('code', this.currentCode);
        }
      } catch (e) {
        console.warn(`LiveCodingUnit ${this.id}: Failed to apply currentCode on attach`, e);
      }

  // Do not auto-stop on attach; respect current playback state
      
      // Register samples on attach if there are pending OR any unregistered in our bank
    const needsRegistration = this.hasPendingSamples || (this.sampleBank && this.sampleBank.size > 0);
      if (needsRegistration) {
        console.log(`LiveCodingUnit ${this.id}: Registering samples on attach`);
        try {
      // Ensure REPL is actually ready to accept samples()
      await this._waitForReplReady(1500);
          await this.updateStrudelSampleBank();
          this.hasPendingSamples = false;
        } catch (e) {
          console.warn(`LiveCodingUnit ${this.id}: Sample registration on attach failed`, e);
        }
      }
      
      // Apply pending code if any
      if (this.pendingCode) {
        console.log(`LiveCodingUnit ${this.id}: Setting pending code:`, this.pendingCode);
        this.setCode(this.pendingCode);
        this.pendingCode = null;
      }

      // If we reattached to a different element and we were playing, rebind UI by re-evaluating + starting
  if (this.isPlaying) {
        try {
          // Small debounce to let editor settle
          setTimeout(async () => {
            try { await this.ensureSamplesForCode(this.currentCode); } catch {}
    try { await this.evaluate(); } catch {}
    // Do not force start if already playing; evaluate restores highlighting
    if (elementChanged) { try { this.play(); } catch {} }
          }, 30);
        } catch {}
      }
    }
  }

  /**
   * Check if the unit is ready to receive sounds
   */
  isReadyForSounds() {
    return !!(this.replInstance && this.editorInstance);
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

    // Create a unique sample name with unit ID to ensure no conflicts
    const sampleName = `unit${this.id}_evo_${this.sampleCounter++}`;
    
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

  // Note: Skipping experimental raw data registration to keep REPL context stable on first use

      // Always generate code if auto-generate is enabled, regardless of registration status
      // The code will be applied when the editor opens if not registered yet
      if (this.autoGenerateCode) {
        await this.generateCodeWithNewSample(sampleName);
        // If not ready, code will apply on attach
        if (!strudelRegistered) {
          console.log(`LiveCodingUnit ${this.id}: Code generated for future use when editor opens`);
        }
        // Safety: ensure we have a non-empty, valid pattern to avoid first-eval issues
        const code = (this.currentCode || '').trim();
        if (!code || (!code.includes('s(') && !code.includes('sound('))) {
          this.setCode(`s("${sampleName}").gain(0.8)`);
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
  if (this.replInstance && this.replInstance.evaluate) {
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

  await this.replInstance.evaluate(registrationCode);
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
      const sampleName = `unit${this.id}_test_${this.sampleCounter++}`;
      
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
        await this.generateCodeWithNewSample(sampleName);
      }
      
      console.log('✅ Test sample added successfully:', sampleName);
      return sampleName;
      
    } catch (err) {
      console.error('❌ Failed to add test sample:', err);
    }
  }

  /**
   * Update Strudel's sample bank with current samples (unit-specific registration)
   */
  async updateStrudelSampleBank() {
    // Create sample map for Strudel (use blob URLs; let Strudel decode internally)
    const sampleMap = {};
    this.sampleBank.forEach((sampleData) => {
      sampleMap[sampleData.name] = sampleData.blobUrl;
    });

    if (Object.keys(sampleMap).length === 0) {
      console.log(`LiveCodingUnit ${this.id}: No samples to register`);
      return true;
    }

    console.log(`LiveCodingUnit ${this.id}: Registering samples to THIS unit's REPL context only:`, {
      sampleCount: Object.keys(sampleMap).length,
      sampleNames: Object.keys(sampleMap),
      unitId: this.id
    });

  // CRITICAL: Only register samples with THIS unit's REPL instance, not globally
  if (this.replInstance && this.replInstance.context) {
      try {
        console.log(`LiveCodingUnit ${this.id}: Registering samples to unit's own REPL context (incremental)...`);

        // Ensure we have a per-unit set of what was registered already
        if (!this._registeredSamples) this._registeredSamples = new Set();

        // Compute delta to avoid re-registering
        const delta = {};
        Object.entries(sampleMap).forEach(([name, url]) => {
          if (!this._registeredSamples.has(name)) {
            delta[name] = url;
          }
        });

        const deltaNames = Object.keys(delta);
        if (deltaNames.length === 0) {
          console.log(`ℹ️ LiveCodingUnit ${this.id}: No new samples to register (already registered: ${this._registeredSamples.size})`);
          return true;
        }

        // Prefer direct context registration (loads URLs and resolves when decoded)
        if (typeof this.replInstance.context.samples === 'function') {
          await this.replInstance.context.samples(delta);
        } else {
          // Fallback: store under context._samples (not ideal, but avoids losing references)
          if (!this.replInstance.context._samples) this.replInstance.context._samples = {};
          Object.assign(this.replInstance.context._samples, delta);
        }
  // Compatibility: also register globally if available (names are unit-prefixed, so no collisions)
        try {
          if (typeof window !== 'undefined' && typeof window.samples === 'function') {
            await window.samples(delta);
          } else if (typeof window !== 'undefined') {
            // Fallback global map
            window.sampleMaps = window.sampleMaps || {};
            Object.assign(window.sampleMaps, delta);
          }
        } catch (e) {
          console.warn(`LiveCodingUnit ${this.id}: Global samples registration failed or unavailable`, e);
        }

  // Mark as registered
        deltaNames.forEach(n => this._registeredSamples.add(n));
  this._lastRegistrationAt = Date.now();
        console.log(`✅ LiveCodingUnit ${this.id}: Registered ${deltaNames.length} new sample(s)`, deltaNames);
        return true;

      } catch (error) {
        console.error(`LiveCodingUnit ${this.id}: ❌ Error registering samples with unit's REPL:`, error);
        return false;
      }
    }

    // Fallback: Store in unit-specific pending samples (avoid global pollution)
    if (!this.pendingSamples) {
      this.pendingSamples = {};
    }
    Object.assign(this.pendingSamples, sampleMap);
    
    console.log(`LiveCodingUnit ${this.id}: 📦 Samples stored in unit for deferred registration`);
    this.hasPendingSamples = true;
    
    console.warn(`LiveCodingUnit ${this.id}: ⚠️ REPL not ready. Samples stored for later registration.`);
    return false;
  }

  /**
   * Generate new Strudel code that incorporates a newly added sample
   * @param {string} sampleName - Name of the newly added sample
   */
  async generateCodeWithNewSample(sampleName) {
    // Get all sample names 
  const existingSampleNames = Array.from(this.sampleBank.values()).map(s => s.name);
    
    console.log('🧪 TESTING: Using simple pattern code (samples registered programmatically)');
    
    // Generate simple pattern code - samples are registered separately via updateStrudelSampleBank()
    if (existingSampleNames.length === 1) {
      // First sample - create a simple pattern
      const only = sampleName || existingSampleNames[0];
      this.currentCode = `s("${only}").gain(0.8)`;
    } else if (existingSampleNames.length === 2) {
      // Two samples - create an alternating pattern (space-separated, not comma-separated)
      this.currentCode = `s("${existingSampleNames.join(' ')}").gain(0.8)`;
    } else {
      // Multiple samples - create a more complex pattern
      // Pick last 4 samples for manageable pattern (space-separated inside brackets)
      const recentSamples = existingSampleNames.slice(-4);
      this.currentCode = `s("[${recentSamples.join(' ')}]").gain(0.8)`;
    }

    // Update the editor with new code
    this.setCode(this.currentCode); // Use setCode to trigger notifications
    
  // Ensure referenced sample(s) are registered before auto-start
  try { await this.ensureSamplesForCode(this.currentCode); } catch {}

  // Automatically start playback when REPL context is ready (even if registration finishes a moment later)
    if (this.replInstance && this.isReadyForSounds()) {
      console.log(`LiveCodingUnit ${this.id}: Auto-starting new code for immediate playback`);
      try {
        // Ensure the new sample is actually in the registered set before starting
        const startWhenReady = (tries = 0) => {
          // Start as soon as REPL is ready; a re-evaluate will occur if registration happens shortly after
          if (tries > 10) {
            try { this.play(); } catch (e) { console.error(e); }
          } else {
            setTimeout(() => startWhenReady(tries + 1), 30);
          }
        };
        startWhenReady();
      } catch (err) {
        console.error(`LiveCodingUnit ${this.id}: Auto-start failed:`, err);
      }
    } else {
      console.log(`LiveCodingUnit ${this.id}: Skipping auto-start - REPL not ready or no instance`);
      console.log('REPL instance exists:', !!this.replInstance);
      console.log('Ready for sounds:', this.isReadyForSounds());
    }
    
    console.log(`LiveCodingUnit ${this.id}: Generated and auto-evaluated simple pattern code`);
    console.log('Generated pattern code:');
    console.log(this.currentCode);
  }

  /**
   * Manually set the Strudel code (isolated unit-specific approach)
   * @param {string} code - Strudel code to set
   */
  setCode(code) {
    console.log(`LiveCodingUnit ${this.id}: setCode called with:`, code);
    this.currentCode = code;
    
    // Keep the DOM element's attribute in sync to avoid web component resetting code on re-attach
    try {
      if (this.strudelElement) {
        this.strudelElement.setAttribute('code', code);
      }
    } catch (e) {
      console.warn(`LiveCodingUnit ${this.id}: failed to sync strudel element code attribute`, e);
    }
    
    // CRITICAL: Persist code to unit config so it survives unit switching
    // Find the unit in the UnitsPanel and update its strudelCode
    try {
      // Try to update the unit config through the DOM
      const unitElement = document.querySelector(`[data-unit-id="${this.id}"]`);
      if (unitElement) {
        // Trigger a custom event to update the unit config
        const updateEvent = new CustomEvent('updateUnitConfig', {
          detail: { 
            unitId: this.id, 
            config: { strudelCode: code },
            source: 'LiveCodingUnit.setCode'
          }
        });
        document.dispatchEvent(updateEvent);
        console.log(`LiveCodingUnit ${this.id}: Dispatched config update event for code persistence`);
      }
    } catch (error) {
      console.warn(`LiveCodingUnit ${this.id}: Could not dispatch config update:`, error);
    }
    
    // First priority: Use direct REPL instance if available
    if (this.editorInstance) {
      console.log(`LiveCodingUnit ${this.id}: Updating REPL via direct editor instance`);
      try { this.editorInstance.setCode(code); } catch {}
      // Also sync attribute for good measure
      try { this.strudelElement?.setAttribute('code', code); } catch {}
      return;
    }
    
    // Second priority: Use the unit-specific global method
    const updateMethod = window[`updateUnit${this.id}`];
    if (updateMethod) {
      console.log(`LiveCodingUnit ${this.id}: Updating REPL via unit-specific global method`);
      updateMethod(code);
  // Ensure attribute reflects the latest code
  try { this.strudelElement?.setAttribute('code', code); } catch {}
    } else {
      console.log(`LiveCodingUnit ${this.id}: No update method available - storing code for later`);
      // Store code for when the REPL becomes available
      this.pendingCode = code;
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

    // Check if unit is ready to receive sounds
    if (!this.isReadyForSounds()) {
      console.log(`LiveCodingUnit ${this.id}: Not ready for sounds - no REPL instance available`);
      return;
    }
    
    // ISOLATION FIX: Prevent cross-contamination by checking if this is the selected unit
    const selectedUnitId = window.debugGetSelectedUnitId?.();
    if (selectedUnitId && selectedUnitId !== this.id) {
      console.log(`LiveCodingUnit ${this.id}: Ignoring hover - not the selected unit (selected: ${selectedUnitId})`);
      return;
    }

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
    if (!this.replInstance) return;

    // Get the current code from the editor (including manual edits)
    const code = this.getCurrentCode().trim();
    console.log(`LiveCodingUnit ${this.id}: Playing with code:`, code?.substring(0, 60) + '...');
    
    if (!code || code === 'silence') {
      this.stop();
      return;
    }

  const waitForSamples = async (timeoutMs = 300, intervalMs = 20) => {
      const codeStr = code.trim(); // Use the fresh code, not this.currentCode
      const m = codeStr.match(/s\((['\"])(.*?)\1\)/);
      if (!m) return;
      const inner = m[2];
      const names = inner.startsWith('[') && inner.endsWith(']')
        ? inner.slice(1, -1).split(/\s+/).filter(Boolean)
        : inner.split(/\s+/).filter(Boolean);
      if (!names.length) return;
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs) {
    const have = (n) => (this._registeredSamples && this._registeredSamples.has(n));
        if (names.every(have)) return; // ready
        await new Promise(r => setTimeout(r, intervalMs));
      }
    };

    // Always stop first to clear any existing pattern
    this.stop();
    
    const start = async () => {
      try {
        await waitForSamples();
        
        // Use the Strudel element's start method when available
        if (this.strudelElement && typeof this.strudelElement.start === 'function') {
          this.strudelElement.start();
        } else if (this.replInstance && typeof this.replInstance.start === 'function') {
          this.replInstance.start();
        }
        
        this.isPlaying = true;
        console.log(`LiveCodingUnit ${this.id}: Started playback`);
      } catch (err) {
        console.error(`LiveCodingUnit ${this.id}: start() failed`, err);
      }
    };
    
    // Always evaluate the current code before starting
    
    this.evaluate()
      .then(() => {
        // Small delay to ensure evaluation is processed
        setTimeout(start, 50);
      })
      .catch((e) => {
        console.error(`LiveCodingUnit ${this.id}: evaluate before start failed`, e);
      });
  }

  /**
   * Stop the current pattern
   */
  stop() {
    if (this.replInstance) {
      try {
        // Stop using all available methods
        this.strudelElement?.stop?.();
        this.replInstance?.stop?.();
        this.replInstance?.hush?.(); // Immediately stop all sounds
      } catch (err) {
        console.error(`LiveCodingUnit ${this.id}: Error stopping playback:`, err);
      }
      this.isPlaying = false;
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
    if (!this.replInstance || !this.editorInstance) {
      console.warn(`LiveCodingUnit ${this.id}: Cannot evaluate - missing replInstance or editorInstance`);
      return;
    }

    // Get the current code using the helper method
    let code = this.getCurrentCode();
    console.log(`LiveCodingUnit ${this.id}: Evaluating:`, code?.substring(0, 60) + '...');
    
    try {
      // Normalize empty code to silence
      if (!code || code.trim().length === 0) {
        code = 'silence';
      }

      // Ensure samples referenced by the code are registered
      try { 
        await this.ensureSamplesForCode(code); 
      } catch (e) { 
        console.warn('ensureSamplesForCode failed', e); 
      }

      // Stop any currently playing pattern before evaluating new code
      this.replInstance?.stop?.();
      
      // Evaluate the new pattern
      await Promise.resolve(this.replInstance.evaluate(code));
      
      // Store as "last known good" code
      this.currentCode = code;
      console.log(`LiveCodingUnit ${this.id}: Evaluation successful`);
      
    } catch (err) {
      console.error(`LiveCodingUnit ${this.id}: Error during evaluation:`, err);
      console.error('Problem code was:', code);
      
      // If evaluation fails, try a simple fallback pattern
      if (code !== 'silence') {
        console.log(`LiveCodingUnit ${this.id}: Attempting fallback to silence pattern`);
        try {
          await Promise.resolve(this.replInstance.evaluate('silence'));
        } catch (fallbackErr) {
          console.error(`LiveCodingUnit ${this.id}: Even fallback pattern failed:`, fallbackErr);
        }
      }
    }
  }

  // Parse the code for s("...") and ensure those samples are registered before evaluating
  async ensureSamplesForCode(code) {
    try {
      const match = code.match(/s\((['\"])(.*?)\1\)/);
      if (!match) return;
      const inner = match[2];
      let names = [];
      if (inner.startsWith('[') && inner.endsWith(']')) {
        const content = inner.slice(1, -1);
        names = content.split(/\s+/).filter(Boolean);
      } else {
        names = inner.split(/\s+/).filter(Boolean);
      }
      if (!names.length) return;

      // Build name->resource map from our bank (use blob URLs)
      const nameToResource = {};
      this.sampleBank.forEach((data) => {
        nameToResource[data.name] = data.blobUrl;
      });

      // Determine which names need registration
      if (!this._registeredSamples) this._registeredSamples = new Set();
      const need = names.filter(n => !this._registeredSamples.has(n));
      if (need.length === 0) return;

  const delta = {};
  need.forEach(n => { if (nameToResource[n]) delta[n] = nameToResource[n]; });
      const deltaNames = Object.keys(delta);
      if (deltaNames.length === 0) return;

      // Register directly via the REPL context when available
      if (this.replInstance && this.replInstance.context && typeof this.replInstance.context.samples === 'function') {
        await this.replInstance.context.samples(delta);
      } else if (typeof window !== 'undefined' && typeof window.samples === 'function') {
        // Fallback to global samples()
        await window.samples(delta);
      } else if (this.replInstance && this.replInstance.context) {
        // Last-resort local stash
        if (!this.replInstance.context._samples) this.replInstance.context._samples = {};
        Object.assign(this.replInstance.context._samples, delta);
      }

      // Mark as registered and timestamp for race avoidance
      deltaNames.forEach(n => this._registeredSamples.add(n));
      this._lastRegistrationAt = Date.now();
      console.log(`✅ LiveCodingUnit ${this.id}: ensureSamplesForCode registered`, deltaNames);
    } catch (e) {
      console.warn('ensureSamplesForCode error', e);
    }
  }

  /**
   * Update unit configuration
   */
  updateConfig(config) {
    console.log(`LiveCodingUnit ${this.id}: updateConfig called with:`, config);
    
    Object.assign(this, config);
    
    // Update REPL instance if available
    if (this.strudelElement) {
      // Use the stored strudel-editor element reference
      if (config.sync !== undefined) {
        this.strudelElement.sync = config.sync;
        console.log(`LiveCodingUnit ${this.id}: Updated REPL sync to:`, config.sync);
      }
      if (config.solo !== undefined) {
        this.strudelElement.solo = config.solo;
        console.log(`LiveCodingUnit ${this.id}: Updated REPL solo to:`, config.solo);
        
        // CRITICAL: If this unit is being soloed, make sure other units are not soloed
        if (config.solo === true) {
          console.log(`LiveCodingUnit ${this.id}: Soloing - will disable solo on other units`);
          // Dispatch event to unsolo other units
          document.dispatchEvent(new CustomEvent('soloLiveCodingUnit', {
            detail: { unitId: this.id }
          }));
        }
      }
    } else {
      // Cache flags for later when the element is attached
      if (config.sync !== undefined) this._pendingUiFlags.sync = config.sync;
      if (config.solo !== undefined) this._pendingUiFlags.solo = config.solo;
      console.debug(`LiveCodingUnit ${this.id}: Queued sync/solo for later attach`, this._pendingUiFlags);
    }
    
    // CRITICAL: Update current code if strudelCode is provided AND different
    // This is essential for maintaining code when switching between units
    if (config.strudelCode !== undefined && config.strudelCode !== this.currentCode) {
      console.log(`LiveCodingUnit ${this.id}: Updating code from config:`, config.strudelCode);
      this.setCode(config.strudelCode);
    } else if (config.strudelCode === undefined && this.currentCode !== this.basePattern) {
      // If no strudelCode in config but unit has custom code, preserve it
      console.log(`LiveCodingUnit ${this.id}: Preserving existing code:`, this.currentCode);
    }
    
    console.log(`LiveCodingUnit ${this.id}: Config updated, current code:`, this.currentCode);
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
  this._registeredSamples = new Set();
    this.sampleCounter = 0;
    
    console.log(`LiveCodingUnit ${this.id}: Sample bank cleared`);
  }

  /**
   * Debug method to check unit isolation
   * @returns {Object} - Debug information about this unit's state
   */
  getIsolationDebugInfo() {
    return {
      unitId: this.id,
      hasReplInstance: !!this.replInstance,
      hasEditorInstance: !!this.editorInstance,
      sampleBankSize: this.sampleBank.size,
      sampleNames: Array.from(this.sampleBank.values()).map(s => s.name),
      currentCode: this.currentCode,
      hasPendingSamples: this.hasPendingSamples,
      hasPendingCode: !!this.pendingCode,
      isReadyForSounds: this.isReadyForSounds(),
      isPlaying: this.isPlaying,
      contextSamples: this.replInstance?.context ? Object.keys(this.replInstance.context._samples || {}) : [],
      globalUpdateMethod: `updateUnit${this.id}` in window
    };
  }

  /**
   * Get current code from CodeMirror editor
   */
  getCurrentCode() {
    // Get from CodeMirror directly (the only reliable source for manual edits)
    if (this.strudelElement) {
      const cmElement = this.strudelElement.querySelector('.CodeMirror');
      if (cmElement && cmElement.CodeMirror && typeof cmElement.CodeMirror.getValue === 'function') {
        const code = cmElement.CodeMirror.getValue();
        console.log(`LiveCodingUnit ${this.id}: Got code from DOM CodeMirror:`, code?.substring(0, 50));
        return code;
      }
    }
    
    // Fallback to editor instance
    if (this.editorInstance && this.editorInstance.cm && typeof this.editorInstance.cm.getValue === 'function') {
      const code = this.editorInstance.cm.getValue();
      console.log(`LiveCodingUnit ${this.id}: Got code from editorInstance.cm:`, code?.substring(0, 50));
      return code;
    }
    
    // Try alternative references
    if (this.strudelElement && this.strudelElement.editor) {
      const editor = this.strudelElement.editor;
      if (editor.cm && typeof editor.cm.getValue === 'function') {
        const code = editor.cm.getValue();
        console.log(`LiveCodingUnit ${this.id}: Got code from strudelElement.editor.cm:`, code?.substring(0, 50));
        return code;
      }
      if (typeof editor.getCode === 'function') {
        const code = editor.getCode();
        console.log(`LiveCodingUnit ${this.id}: Got code from editor.getCode():`, code?.substring(0, 50));
        return code;
      }
      if (editor.code !== undefined) {
        console.log(`LiveCodingUnit ${this.id}: Got code from editor.code (might be stale):`, editor.code?.substring(0, 50));
        return editor.code;
      }
    }
    
    // Debug: log what we checked
    console.log(`LiveCodingUnit ${this.id}: getCurrentCode fallback paths:`, {
      hasStrudelElement: !!this.strudelElement,
      hasCodeMirrorElement: !!this.strudelElement?.querySelector('.CodeMirror'),
      hasCodeMirrorInstance: !!this.strudelElement?.querySelector('.CodeMirror')?.CodeMirror,
      hasEditorInstance: !!this.editorInstance,
      hasEditorCm: !!this.editorInstance?.cm,
      hasStrudelEditor: !!this.strudelElement?.editor
    });
    
    // Last resort: use stored code or base pattern
    console.log(`LiveCodingUnit ${this.id}: Using fallback currentCode:`, this.currentCode?.substring(0, 50));
    return this.currentCode || this.basePattern;
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
    
    // Clear REPL instance references
    this.replInstance = null;
    this.editorInstance = null;
    this.uiReplInstance = null;
    this.uiEditorInstance = null;
    this.strudelElement = null;
    
    // Clear pending items
    this.pendingSamples = {};
    this.hasPendingSamples = false;
    this.pendingCode = null;
    
    // Clean up global update method
    delete window[`updateUnit${this.id}`];
    
    // Call parent cleanup
    super.cleanup();
    
    console.log(`LiveCodingUnit ${this.id}: Cleanup completed`);
  }
}
