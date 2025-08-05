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
    this.basePattern = 'sound("bd sd hh oh")'; // Default pattern
    this.currentCode = this.basePattern;
    
    // Sync/solo attributes (like in StrudelReplTest)
    this.sync = true;
    this.solo = false;
    
    // Playback state
    this.isPlaying = false;
    
    // Audio buffer to blob URL conversion cache
    this.blobUrlCache = new Map(); // genomeId-params -> blobUrl
    
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
  setReplInstance(editor) {
    this.editorInstance = editor;
    this.replInstance = editor?.repl;
    
    if (this.replInstance) {
      // Configure sync and solo
      if (this.editorInstance.sync !== undefined) {
        this.editorInstance.sync = this.sync;
      }
      if (this.editorInstance.solo !== undefined) {
        this.editorInstance.solo = this.solo;
      }
      
      // Set initial code
      this.replInstance.setCode(this.currentCode);
      
      console.log(`LiveCodingUnit ${this.id}: REPL instance connected`, {
        sync: this.sync,
        solo: this.solo,
        initialCode: this.currentCode,
        existingSamples: this.sampleBank.size
      });
      
      // Register any existing samples with Strudel now that REPL is available
      if (this.sampleBank.size > 0) {
        console.log(`LiveCodingUnit ${this.id}: Registering ${this.sampleBank.size} existing samples with Strudel`);
        this.updateStrudelSampleBank();
      }
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

      // Optionally auto-generate new code incorporating this sample
      if (this.autoGenerateCode && strudelRegistered) {
        this.generateCodeWithNewSample(sampleName);
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
   * Convert AudioBuffer to blob URL for use with Strudel
   * @param {AudioBuffer} audioBuffer - AudioBuffer to convert
   * @returns {Promise<string>} - Promise that resolves with blob URL
   */
  async audioBufferToBlobUrl(audioBuffer) {
    // Convert AudioBuffer to WAV blob
    const wavArrayBuffer = this.audioBufferToWav(audioBuffer);
    const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
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
   * Update Strudel's sample bank with current samples
   */
  async updateStrudelSampleBank() {
    if (!this.replInstance) {
      console.warn(`LiveCodingUnit ${this.id}: REPL not initialized yet. Samples stored in unit but not registered with Strudel. Open config panel to initialize Strudel editor.`);
      return false; // Return false to indicate samples not yet registered
    }

    // Create sample map for Strudel
    const sampleMap = {};
    this.sampleBank.forEach((sampleData, genomeId) => {
      sampleMap[sampleData.name] = sampleData.blobUrl;
    });

    if (Object.keys(sampleMap).length === 0) {
      console.log(`LiveCodingUnit ${this.id}: No samples to register`);
      return true;
    }

    try {
      console.log(`LiveCodingUnit ${this.id}: Registering samples with Strudel:`, {
        sampleCount: Object.keys(sampleMap).length,
        sampleNames: Object.keys(sampleMap),
        sampleMap
      });

      // Use the global samples function directly instead of evaluate()
      // This avoids the mini notation parser
      if (typeof window !== 'undefined' && window.samples) {
        await window.samples(sampleMap);
        console.log(`LiveCodingUnit ${this.id}: Samples registered via global function`);
      } else if (this.replInstance.samples) {
        await this.replInstance.samples(sampleMap);
        console.log(`LiveCodingUnit ${this.id}: Samples registered via REPL function`);
      } else {
        // Fallback: try to access samples through the strudel context
        const samplesCode = `Object.assign(window.strudelSamples || {}, ${JSON.stringify(sampleMap)}); if(window.samples) window.samples(${JSON.stringify(sampleMap)});`;
        
        // Execute as JavaScript, not as Strudel pattern
        if (this.replInstance.evaluate) {
          // Try executing raw JavaScript instead of pattern
          await new Function(samplesCode)();
          console.log(`LiveCodingUnit ${this.id}: Samples registered via JavaScript execution`);
        }
      }
      
      console.log(`LiveCodingUnit ${this.id}: Sample bank updated successfully`);
      return true;
    } catch (error) {
      console.error(`LiveCodingUnit ${this.id}: Error updating Strudel sample bank:`, error);
      // Even if registration fails, the samples are still in our bank
      console.log(`LiveCodingUnit ${this.id}: Samples stored locally even though Strudel registration failed`);
      return false;
    }
  }

  /**
   * Generate new Strudel code that incorporates a newly added sample
   * @param {string} sampleName - Name of the newly added sample
   */
  generateCodeWithNewSample(sampleName) {
    // Simple code generation strategy - add the new sample to a pattern
    // This is a basic implementation; more sophisticated generation could be added
    
    const existingSampleNames = Array.from(this.sampleBank.values()).map(s => s.name);
    
    if (existingSampleNames.length === 1) {
      // First sample - create a simple pattern
      this.currentCode = `sound("${sampleName}")`;
    } else {
      // Multiple samples - create a more complex pattern
      const sampleList = existingSampleNames.join(' ');
      this.currentCode = `sound("${sampleList}").slow(2)`;
    }

    // Update the editor with new code
    if (this.replInstance) {
      this.replInstance.setCode(this.currentCode);
      console.log(`LiveCodingUnit ${this.id}: Generated new code: ${this.currentCode}`);
    }
  }

  /**
   * Manually set the Strudel code
   * @param {string} code - Strudel code to set
   */
  setCode(code) {
    this.currentCode = code;
    if (this.replInstance) {
      this.replInstance.setCode(code);
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
  evaluate() {
    if (this.replInstance) {
      const code = this.replInstance.getCode();
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
