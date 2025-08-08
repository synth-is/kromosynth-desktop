import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';
import '@strudel/repl';

/**
 * UnitStrudelRepl - Dead simple REPL for each unit
 * No complex state management, no bridging - just works like StrudelReplTest.jsx
 */
const UnitStrudelRepl = ({ unitId }) => {
  // Completely independent state - no sharing, no complex sync
  const replRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCode, setCurrentCode] = useState(`// Unit ${unitId}\nsound("bd hh sd oh")`);
  const initializedRef = useRef(false);

  console.log(`UnitStrudelRepl: Component rendered for unit ${unitId}`);

  // Initialize REPL - exactly like StrudelReplTest, no dependencies
  useEffect(() => {
    if (containerRef.current && !replRef.current && !initializedRef.current) {
      console.log(`UnitStrudelRepl: Initializing REPL for unit ${unitId}`);
      initializedRef.current = true;
      
      const repl = document.createElement('strudel-editor');
      repl.setAttribute('code', currentCode);
      // CRITICAL: Each unit should have isolated sync/solo settings
      // Default: sync=false for isolation, solo=false for allowing multiple units
      repl.sync = false; // Changed from true to prevent global sync interference
      repl.solo = false;
      
      containerRef.current.appendChild(repl);
      replRef.current = repl;
      
      console.log(`UnitStrudelRepl: REPL created for unit ${unitId}`);
      
      // Wait for editor to be ready and then notify the LiveCodingUnit
      const checkReady = setInterval(() => {
        if (repl.editor?.repl) {
          clearInterval(checkReady);
          console.log(`UnitStrudelRepl: REPL ready for unit ${unitId}`);
          
          // Notify the LiveCodingUnit that the REPL is ready
          const unit = window.getUnitInstance?.(unitId);
          if (unit && unit.type === 'LIVE_CODING') {
            console.log(`UnitStrudelRepl: Setting up ISOLATED LiveCodingUnit ${unitId} instances`);
            
            // Apply unit-specific sync/solo settings
            if (unit.sync !== undefined) {
              repl.sync = unit.sync;
              console.log(`UnitStrudelRepl: Applied sync setting for unit ${unitId}:`, unit.sync);
            }
            if (unit.solo !== undefined) {
              repl.solo = unit.solo;
              console.log(`UnitStrudelRepl: Applied solo setting for unit ${unitId}:`, unit.solo);
            }
            
            // Use the enhanced setReplInstance method that handles pending items
            // Store reference to the strudel-editor element for sync/solo updates
            unit.setReplInstance(repl.editor, repl);
            
            console.log(`UnitStrudelRepl: LiveCodingUnit ${unitId} is now ready and isolated with sync=${repl.sync}, solo=${repl.solo}`);
          } else {
            console.log(`UnitStrudelRepl: Could not find LiveCodingUnit ${unitId}`, unit?.type);
          }
          
          // Register UNIT-SPECIFIC global method for external code updates (hover interactions)
          const primaryUpdateMethod = (newCode) => {
            console.log(`UnitStrudelRepl: PRIMARY external code update for UNIT ${unitId} ONLY:`, newCode);
            
            // Double-check we're updating the right unit's REPL
            if (replRef.current?.editor && replRef.current === repl) {
              console.log(`UnitStrudelRepl: PRIMARY confirmed - updating code for unit ${unitId}`);
              replRef.current.editor.setCode(newCode);
              setCurrentCode(newCode);
            } else {
              console.error(`UnitStrudelRepl: PRIMARY ISOLATION ERROR - replRef mismatch for unit ${unitId}`);
            }
          };
          
          window[`updateUnit${unitId}`] = primaryUpdateMethod;
          console.log(`UnitStrudelRepl: Registered PRIMARY ISOLATED global method updateUnit${unitId}`);
        }
      }, 100);
      
      // Store interval for cleanup
      repl._readyInterval = checkReady;
    }

    // Cleanup
    return () => {
      console.log(`UnitStrudelRepl: Cleaning up unit ${unitId}`);
      initializedRef.current = false;
      
      // Clean up global method
      delete window[`updateUnit${unitId}`];
      
      if (replRef.current?._readyInterval) {
        clearInterval(replRef.current._readyInterval);
      }
      if (replRef.current?.editor?.repl) {
        replRef.current.editor.repl.stop();
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      replRef.current = null;
    };
  }, []);

  // Simple controls
  const handlePlay = (e) => {
    e?.stopPropagation(); // Prevent unit deselection
    if (replRef.current?.editor?.repl) {
      console.log(`UnitStrudelRepl: Playing unit ${unitId}`);
      replRef.current.editor.repl.stop(); // Stop first
      setTimeout(() => {
        const code = replRef.current.editor.code;
        replRef.current.editor.repl.evaluate(code);
        setIsPlaying(true);
        setCurrentCode(code);
      }, 50);
    }
  };

  const handleStop = (e) => {
    e?.stopPropagation(); // Prevent unit deselection
    if (replRef.current?.editor?.repl) {
      console.log(`UnitStrudelRepl: Stopping unit ${unitId}`);
      replRef.current.editor.repl.stop();
      setIsPlaying(false);
    }
  };

  const handleToggle = (e) => {
    e?.stopPropagation(); // Prevent unit deselection
    if (isPlaying) {
      handleStop(e);
    } else {
      handlePlay(e);
    }
  };

  // Simple method to update code from hover (called directly, no complex bridging)
  const updateCode = (newCode) => {
    console.log(`UnitStrudelRepl: Updating code for unit ${unitId}:`, newCode);
    if (replRef.current?.editor) {
      // Stop current pattern
      if (replRef.current.editor.repl) {
        replRef.current.editor.repl.stop();
        setIsPlaying(false);
      }
      
      // Set new code
      replRef.current.editor.setCode(newCode);
      setCurrentCode(newCode);
      
      // Auto-play the new pattern
      setTimeout(() => {
        if (replRef.current?.editor?.repl) {
          replRef.current.editor.repl.evaluate(newCode);
          setIsPlaying(true);
        }
      }, 100);
    }
  };

  // ALWAYS ensure global method is available (robust registration)
  useEffect(() => {
    console.log(`UnitStrudelRepl: Ensuring updateUnit${unitId} is always available`);
    // Always register/re-register to ensure method is available
    window[`updateUnit${unitId}`] = updateCode;
    
    // Verify registration immediately
    const isRegistered = `updateUnit${unitId}` in window;
    console.log(`UnitStrudelRepl: Verified registration for unit ${unitId}:`, isRegistered);
    
    if (!isRegistered) {
      console.error(`UnitStrudelRepl: FAILED to register updateUnit${unitId}!`);
    }
    
    return () => {
      console.log(`UnitStrudelRepl: Cleaning up updateUnit${unitId}`);
      delete window[`updateUnit${unitId}`];
    };
  }, [unitId, updateCode]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded">
        <button
          onClick={handlePlay}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-sm flex items-center gap-1 text-xs"
        >
          <RefreshCw size={12} />
          Play
        </button>
        
        <button
          onClick={handleToggle}
          className={`px-3 py-1.5 rounded-sm flex items-center gap-1 text-xs ${
            isPlaying ? 'bg-yellow-600' : 'bg-green-600'
          } text-white`}
        >
          {isPlaying ? <Square size={12} /> : <Play size={12} />}
          {isPlaying ? 'Pause' : 'Start'}
        </button>
        
        <button
          onClick={handleStop}
          className="px-3 py-1.5 bg-red-600 text-white rounded-sm flex items-center gap-1 text-xs"
        >
          <Square size={12} />
          Stop
        </button>
        
        <span className="text-xs text-gray-400 ml-2">Unit {unitId}</span>
        <span className="text-xs text-gray-500 ml-2">{isPlaying ? '🔊' : '🔇'}</span>
      </div>

      <div 
        ref={containerRef} 
        className="border border-gray-600 rounded bg-gray-900 min-h-[300px]"
      />
    </div>
  );
};

export default UnitStrudelRepl;
