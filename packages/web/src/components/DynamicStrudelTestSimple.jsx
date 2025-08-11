import React, { useEffect, useRef, useState } from 'react';
import '@strudel/repl';

/**
 * DynamicStrudelTest - Simplified version following StrudelReplTest.jsx pattern exactly
 */
const DynamicStrudelTest = () => {
  const [replInstances, setReplInstances] = useState([]);
  const [nextId, setNextId] = useState(1);

  // Mock patterns for testing - only built-in sounds from Strudel docs
  const mockPatterns = [
    'sound("bd hh")',
    'sound("sd oh")',
    'sound("bd hh sd oh")',
    'sound("bd sd rim hh")',
    'sound("bd").every(4, x => x.speed(2))',
    'sound("hh").fast(4)',
    'sound("bd sd").slow(2)',
    'sound("casio").gain(0.8)',
    'sound("metal").delay(0.2)',
    'sound("bd hh sd hh")',
    'sound("bd hh sd oh").bank("RolandTR808")',
    'sound("bd hh sd oh").bank("RolandTR909")',
    'sound("jazz metal casio")',
    'sound("bd*4, hh*8")',
    'sound("insect wind")',
    'sound("bd rim oh")',
    'note("c e g").sound("piano")',
    'note("48 52 55 59").sound("sawtooth")',
    'sound("numbers:1 numbers:2")',
    'sound("bd sd, hh*4")'
  ];

  const logger = (haps, t) => {
    haps.forEach(hap => {
      console.log('Hap:', hap.value, "time:", t);
    });
  };

  useEffect(() => {
    if (window) {
      window.kromosynthblink = logger;
    }
  }, []);

  // Create a new REPL instance - with minimal interruption
  const createRepl = () => {
    const id = nextId;
    setNextId(prev => prev + 1);
    
    const randomPattern = mockPatterns[Math.floor(Math.random() * mockPatterns.length)];
    
    // IMPORTANT: Briefly stop all playing REPLs during creation to prevent state conflicts
    // But remember which ones were playing so we can restart them
    console.log(`DynamicStrudelTest: Temporarily stopping REPLs during creation of REPL ${id}`);
    
    // Get list of currently playing REPLs before stopping them
    const currentlyPlayingREPLs = [];
    if (window.strudelGlobalGetPlayingStates) {
      currentlyPlayingREPLs.push(...window.strudelGlobalGetPlayingStates());
    }
    
    stopAllActiveREPLs();
    
    const newInstance = {
      id,
      pattern: randomPattern,
      sync: true,
      solo: false
    };
    
    setReplInstances(prev => [...prev, newInstance]);
    console.log(`DynamicStrudelTest: Created REPL ${id} with pattern: ${randomPattern}`);
    
    // Restart the previously playing REPLs after a short delay
    setTimeout(() => {
      console.log(`DynamicStrudelTest: Restarting previously playing REPLs:`, currentlyPlayingREPLs);
      if (window.strudelGlobalRestartSpecific) {
        window.strudelGlobalRestartSpecific(currentlyPlayingREPLs);
      }
    }, 200);
  };

  // Remove a REPL instance
  const removeRepl = (id) => {
    setReplInstances(prev => prev.filter(instance => instance.id !== id));
    console.log(`DynamicStrudelTest: Removed REPL ${id}`);
  };

  // Stop all REPLs - actually stops all active instances
  const stopAll = () => {
    stopAllActiveREPLs();
  };

  // Start all REPLs - like in StrudelReplTest
  const startAll = () => {
    console.log('Starting all REPLs...');
    if (window.strudelGlobalStartAll) {
      window.strudelGlobalStartAll();
    }
  };

  // Function to actually stop all playing REPLs across all instances
  const stopAllActiveREPLs = () => {
    console.log('Stopping all active REPLs to prevent state conflicts...');
    // We'll need to access the refs from the instances
    // This will be implemented by triggering a global stop event
    if (window.strudelGlobalStop) {
      window.strudelGlobalStop();
    }
  };

  // Individual REPL component - with global stop coordination
  const ReplInstance = ({ instance, onRemove }) => {
    const replRef = useRef(null);
    const containerRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentPattern, setCurrentPattern] = useState(instance.pattern);
  const [isSolo, setIsSolo] = useState(false);

    // Initialize REPL - exactly like StrudelReplTest
  useEffect(() => {
      if (containerRef.current && !replRef.current) {
        console.log(`ReplInstance: Initializing REPL ${instance.id}`);
        
        const repl = document.createElement('strudel-editor');
        repl.setAttribute('code', currentPattern);
        repl.sync = instance.sync;
        repl.solo = instance.solo;
        containerRef.current.appendChild(repl);
        replRef.current = repl;

    // Register globally for solo coordination
    if (!window._dynamicStrudelRepls) window._dynamicStrudelRepls = new Map();
    window._dynamicStrudelRepls.set(instance.id, replRef);
        
        console.log(`ReplInstance: REPL ${instance.id} initialized`);
      }

      // Cleanup - exactly like StrudelReplTest
      return () => {
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
    if (window._dynamicStrudelRepls) window._dynamicStrudelRepls.delete(instance.id);
        replRef.current = null;
      };
    }, []); // Empty dependency array like StrudelReplTest

    // Register this instance for global coordination
    useEffect(() => {
      const stopThisREPL = () => {
        if (replRef.current?.editor?.repl) {
          console.log(`ReplInstance: Global stop triggered for REPL ${instance.id}`);
          replRef.current.editor.repl.stop();
          setIsPlaying(false);
        }
      };

      const startThisREPL = () => {
        if (replRef.current?.editor?.repl && !isPlaying) {
          console.log(`ReplInstance: Global start triggered for REPL ${instance.id}`);
          // Prefer explicit start() if available to avoid unintended stop
          if (replRef.current.editor.repl.start) {
            try { replRef.current.editor.repl.start(); } catch {}
          } else if (replRef.current.editor.toggle) {
            replRef.current.editor.toggle();
          }
          setIsPlaying(true);
        } else if (isPlaying) {
          // Already playing; ensure internal flag reflects it
          setIsPlaying(true);
        }
      };

      const getPlayingState = () => {
        return { id: instance.id, isPlaying };
      };

      const restartIfWasPlaying = (playingStates) => {
        const wasPlaying = playingStates.find(state => state.id === instance.id && state.isPlaying);
        if (wasPlaying && replRef.current?.editor?.repl && !isPlaying) {
          console.log(`ReplInstance: Restarting REPL ${instance.id} as it was playing before`);
          replRef.current.editor.toggle();
          setIsPlaying(true);
        }
      };

      // Register global stop function
      if (!window.strudelGlobalStopFunctions) {
        window.strudelGlobalStopFunctions = new Set();
      }
      window.strudelGlobalStopFunctions.add(stopThisREPL);

  // Map id -> stop/start for targeted external control (solo logic)
  if (!window._dynamicReplStopFns) window._dynamicReplStopFns = {};
  if (!window._dynamicReplStartFns) window._dynamicReplStartFns = {};
  if (!window._dynamicReplMarkPlayingFns) window._dynamicReplMarkPlayingFns = {};
  window._dynamicReplStopFns[instance.id] = stopThisREPL;
  window._dynamicReplStartFns[instance.id] = startThisREPL;
  window._dynamicReplMarkPlayingFns[instance.id] = () => setIsPlaying(true);

      // Register global start function
      if (!window.strudelGlobalStartFunctions) {
        window.strudelGlobalStartFunctions = new Set();
      }
      window.strudelGlobalStartFunctions.add(startThisREPL);

      // Register playing state getter
      if (!window.strudelGlobalPlayingStateGetters) {
        window.strudelGlobalPlayingStateGetters = new Set();
      }
      window.strudelGlobalPlayingStateGetters.add(getPlayingState);

      // Register restart function
      if (!window.strudelGlobalRestartFunctions) {
        window.strudelGlobalRestartFunctions = new Set();
      }
      window.strudelGlobalRestartFunctions.add(restartIfWasPlaying);

      // Create global stop coordinator if it doesn't exist
      if (!window.strudelGlobalStop) {
        window.strudelGlobalStop = () => {
          console.log('Executing global stop for all REPL instances');
          if (window.strudelGlobalStopFunctions) {
            window.strudelGlobalStopFunctions.forEach(stopFn => {
              try {
                stopFn();
              } catch (error) {
                console.log('Error in global stop function:', error);
              }
            });
          }
        };
      }

      // Create global start coordinator if it doesn't exist
      if (!window.strudelGlobalStartAll) {
        window.strudelGlobalStartAll = () => {
          console.log('Executing global start for all REPL instances');
          if (window.strudelGlobalStartFunctions) {
            window.strudelGlobalStartFunctions.forEach(startFn => {
              try {
                startFn();
              } catch (error) {
                console.log('Error in global start function:', error);
              }
            });
          }
        };
      }

      // Create global playing state getter if it doesn't exist
      if (!window.strudelGlobalGetPlayingStates) {
        window.strudelGlobalGetPlayingStates = () => {
          const states = [];
          if (window.strudelGlobalPlayingStateGetters) {
            window.strudelGlobalPlayingStateGetters.forEach(getter => {
              try {
                states.push(getter());
              } catch (error) {
                console.log('Error getting playing state:', error);
              }
            });
          }
          return states;
        };
      }

      // Create global restart specific function if it doesn't exist
      if (!window.strudelGlobalRestartSpecific) {
        window.strudelGlobalRestartSpecific = (playingStates) => {
          console.log('Executing global restart for specific REPL instances');
          if (window.strudelGlobalRestartFunctions) {
            window.strudelGlobalRestartFunctions.forEach(restartFn => {
              try {
                restartFn(playingStates);
              } catch (error) {
                console.log('Error in global restart function:', error);
              }
            });
          }
        };
      }

      // Cleanup: remove this function from global registry
      return () => {
        if (window.strudelGlobalStopFunctions) {
          window.strudelGlobalStopFunctions.delete(stopThisREPL);
        }
        if (window.strudelGlobalStartFunctions) {
          window.strudelGlobalStartFunctions.delete(startThisREPL);
        }
        if (window.strudelGlobalPlayingStateGetters) {
          window.strudelGlobalPlayingStateGetters.delete(getPlayingState);
        }
        if (window.strudelGlobalRestartFunctions) {
          window.strudelGlobalRestartFunctions.delete(restartIfWasPlaying);
        }
  if (window._dynamicReplStopFns) delete window._dynamicReplStopFns[instance.id];
  if (window._dynamicReplStartFns) delete window._dynamicReplStartFns[instance.id];
  if (window._dynamicReplMarkPlayingFns) delete window._dynamicReplMarkPlayingFns[instance.id];
      };
    }, [instance.id, isPlaying]);

    // Handle functions - exactly like StrudelReplTest (no exclusive playback)
    const handleToggle = () => {
      if (replRef.current?.editor?.repl) {
        replRef.current.editor.toggle();
        setIsPlaying(prev => !prev);
        console.log(`DynamicStrudelTest: Toggled REPL ${instance.id}`);
      }
    };

    const handleStop = () => {
      if (replRef.current?.editor?.repl) {
        replRef.current.editor.repl.stop();
        setIsPlaying(false);
        console.log(`DynamicStrudelTest: Stopped REPL ${instance.id}`);
      }
    };

    const handleSolo = () => {
      const newSolo = !isSolo;
      if (newSolo) {
        // Record and stop others
        // Prefer authoritative global playing states if available
        let prevStates = [];
        if (window.strudelGlobalGetPlayingStates) {
          try { prevStates = window.strudelGlobalGetPlayingStates(); } catch {}
        }
        const recorded = [];
        if (window._dynamicStrudelRepls) {
          window._dynamicStrudelRepls.forEach((otherRef, otherId) => {
            if (otherId === instance.id) return;
            const el = otherRef.current;
            if (!el) return;
            const state = prevStates.find(s => s.id === otherId);
            const wasPlaying = state ? !!state.isPlaying : !!el.editor?.repl?.isPlaying;
            recorded.push({ id: otherId, wasPlaying });
            if (wasPlaying) {
              // Prefer mapped stop fn to also update React state
              try {
                if (window._dynamicReplStopFns && window._dynamicReplStopFns[otherId]) {
                  window._dynamicReplStopFns[otherId]();
                } else {
                  el.editor?.repl?.stop?.();
                }
              } catch {}
            }
            el.solo = false;
            if (el.editor?.repl) {
              try { el.editor.repl.solo = false; } catch {}
            }
          });
        }
        // Store the correctly shaped recorded states (with wasPlaying) for restoration
        replRef.current._prevStates = recorded;
        console.log('[Solo] Stored previous states for restore:', recorded);
        window._dynamicSoloReplId = instance.id;
      } else {
        // Restore others if we have previous states
        if (replRef.current?._prevStates && window._dynamicStrudelRepls) {
          // Build current playing map to avoid double toggles
            let currentStates = [];
            if (window.strudelGlobalGetPlayingStates) {
              try { currentStates = window.strudelGlobalGetPlayingStates(); } catch {}
            }
            console.log('[SoloRestore] Stored prevStates to process:', replRef.current._prevStates);
            replRef.current._prevStates.forEach((entry) => {
              const id = entry.id;
              const wasPlaying = entry.wasPlaying !== undefined ? entry.wasPlaying : entry.isPlaying;
              const otherRef = window._dynamicStrudelRepls.get(id);
              const el = otherRef?.current;
              if (!el) return;
              el.solo = false;
              // Determine current playing via live repl object, not cached state list that may be stale
              const isCurrentlyPlaying = !!el.editor?.repl?.isPlaying;
              console.log(`[SoloRestore] REPL ${id} wasPlaying=${wasPlaying} isCurrentlyPlaying=${isCurrentlyPlaying}`);
              if (wasPlaying && !isCurrentlyPlaying) {
                console.log(`[SoloRestore] Attempting restart for REPL ${id}`);
                let started = false;
                try {
                  if (el.editor?.repl?.start) {
                    el.editor.repl.start();
                    started = true;
                    console.log(`[SoloRestore] start() used for REPL ${id}`);
                    try { window._dynamicReplMarkPlayingFns && window._dynamicReplMarkPlayingFns[id] && window._dynamicReplMarkPlayingFns[id](); } catch {}
                  }
                } catch (e) {
                  console.warn(`[SoloRestore] start() failed for REPL ${id}:`, e.message);
                }
                if (!started) {
                  try {
                    if (el.editor?.toggle) {
                      el.editor.toggle();
                      started = true;
                      console.log(`[SoloRestore] toggle() fallback used for REPL ${id}`);
                      try { window._dynamicReplMarkPlayingFns && window._dynamicReplMarkPlayingFns[id] && window._dynamicReplMarkPlayingFns[id](); } catch {}
                    }
                  } catch (e) {
                    console.warn(`[SoloRestore] toggle() failed for REPL ${id}:`, e.message);
                  }
                }
                if (!started) {
                  // Last resort: re-evaluate code then try start again after a tick
                  try {
                    const code = el.editor?.code || el.getAttribute('code');
                    if (code && el.editor?.repl?.evaluate) {
                      el.editor.repl.evaluate(code);
                      console.log(`[SoloRestore] evaluate() fallback for REPL ${id}`);
                    }
                    setTimeout(() => {
                      try {
                        if (el.editor?.repl?.start) {
                          el.editor.repl.start();
                          console.log(`[SoloRestore] delayed start() succeeded for REPL ${id}`);
                          try { window._dynamicReplMarkPlayingFns && window._dynamicReplMarkPlayingFns[id] && window._dynamicReplMarkPlayingFns[id](); } catch {}
                        } else if (el.editor?.toggle) {
                          el.editor.toggle();
                          console.log(`[SoloRestore] delayed toggle() succeeded for REPL ${id}`);
                          try { window._dynamicReplMarkPlayingFns && window._dynamicReplMarkPlayingFns[id] && window._dynamicReplMarkPlayingFns[id](); } catch {}
                        }
                      } catch (e2) {
                        console.warn(`[SoloRestore] delayed restart failed for REPL ${id}:`, e2.message);
                      }
                    }, 120);
                  } catch (e) {
                    console.warn(`[SoloRestore] evaluate+delayed start fallback failed for REPL ${id}:`, e.message);
                  }
                }
              }
              if (el.editor?.repl) {
                try { el.editor.repl.solo = false; } catch {}
              }
            });
          }
        replRef.current._prevStates = null;
        window._dynamicSoloReplId = null;
      }
      setIsSolo(newSolo);
      if (replRef.current) {
        replRef.current.solo = newSolo;
        try { replRef.current.editor?.repl && (replRef.current.editor.repl.solo = newSolo); } catch {}
      }
      console.log(`DynamicStrudelTest: REPL ${instance.id} solo =>`, newSolo);
    };

    const applyRandomPattern = () => {
      const randomPattern = mockPatterns[Math.floor(Math.random() * mockPatterns.length)];
      if (replRef.current?.editor) {
        replRef.current.editor.setCode(randomPattern);
        setCurrentPattern(randomPattern);
        console.log(`DynamicStrudelTest: Applied random pattern to REPL ${instance.id}: ${randomPattern}`);
      }
    };

    return (
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">REPL {instance.id}</h3>
          <button
            onClick={() => onRemove(instance.id)}
            className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            Remove
          </button>
        </div>
        
        <div className="text-sm text-gray-600 font-mono bg-gray-100 p-2 rounded">
          {currentPattern}
        </div>
        
        <div 
          ref={containerRef}
          className="border border-gray-300 rounded p-2 min-h-[150px] bg-gray-50"
        />
        
        <div className="flex gap-2">
          <button
            onClick={handleSolo}
            className={`px-3 py-1 rounded text-sm font-semibold ${
              isSolo ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
            title="Solo"
          >
            S
          </button>
          <button
            onClick={handleToggle}
            className={`px-3 py-1 rounded text-sm ${
              isPlaying
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <button
            onClick={handleStop}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            Stop
          </button>
          
          <button
            onClick={applyRandomPattern}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Random Pattern
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Dynamic Strudel REPL Test (Simplified)</h1>
        <p className="text-gray-600 mb-6">
          Following StrudelReplTest.jsx pattern exactly - no complex state management
        </p>
      </div>
      
      {/* Global Controls */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Global Controls</h2>
        <div className="flex gap-3">
          <button
            onClick={createRepl}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Add New REPL
          </button>
          
          <button
            onClick={startAll}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Start All
          </button>
          
          <button
            onClick={stopAll}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Stop All
          </button>
          
          <div className="ml-auto text-sm text-gray-600 flex items-center">
            Active REPLs: {replInstances.length}
          </div>
        </div>
      </div>

      {/* REPL Instances */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {replInstances.map(instance => (
          <ReplInstance 
            key={instance.id} 
            instance={instance} 
            onRemove={removeRepl}
          />
        ))}
      </div>
      
      {replInstances.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-4">No REPLs created yet</p>
          <button
            onClick={createRepl}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Create Your First REPL
          </button>
        </div>
      )}
      
      {/* Instructions */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Testing Instructions:</h3>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• <strong>UNINTERRUPTED PLAYBACK:</strong> Creating new REPLs will briefly pause others but automatically restart them</li>
          <li>• Create multiple REPLs and start them playing</li>
          <li>• Add a new REPL while others are playing - they should resume automatically</li>
          <li>• <strong>Check Visual Feedback:</strong> Each REPL should maintain its own highlighting when playing</li>
          <li>• Test individual start/stop controls for each REPL</li>
          <li>• Use "Start All" and "Stop All" for global control</li>
          <li>• <strong>Sync/Solo:</strong> sync=true means REPLs play in time together, solo=false means all are audible</li>
          <li>• <strong>Smart Creation:</strong> REPLs remember their playing state and resume after creation conflicts</li>
        </ul>
      </div>
    </div>
  );
};

export default DynamicStrudelTest;
