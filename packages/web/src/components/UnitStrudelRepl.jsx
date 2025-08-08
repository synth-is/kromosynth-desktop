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

  // Initialize or attach to existing hidden REPL for this unit
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    // Try to locate a hidden editor created by LiveCodingInitializer
    const hiddenEditor = document.querySelector(`strudel-editor[data-unit-id="${unitId}"]`);
    if (hiddenEditor) {
      console.log(`UnitStrudelRepl: Attaching existing hidden REPL for unit ${unitId}`);
      // Move the existing editor into our visible container
      containerRef.current.appendChild(hiddenEditor);
      hiddenEditor.style.display = '';
      replRef.current = hiddenEditor;

      // Sync local state from the unit’s authoritative current code if available
      try {
        const unit = window.getUnitInstance?.(unitId);
        const unitCode = unit?.currentCode;
        const liveCode = unitCode || hiddenEditor.editor?.code || hiddenEditor.getAttribute('code') || currentCode;
        if (unitCode && hiddenEditor.editor) {
          hiddenEditor.editor.setCode(unitCode);
          try { hiddenEditor.setAttribute('code', unitCode); } catch {}
        }
        setCurrentCode(liveCode);
      } catch {}

      // Ensure unit linkage is established
      const unit = window.getUnitInstance?.(unitId);
      if (unit && unit.type === 'LIVE_CODING' && hiddenEditor.editor) {
        unit.setReplInstance(hiddenEditor.editor, hiddenEditor);
      }

      // Register unit-specific updater
      window[`updateUnit${unitId}`] = (newCode) => {
        if (replRef.current?.editor) {
          replRef.current.editor.setCode(newCode);
          try { replRef.current.setAttribute('code', newCode); } catch {}
          setCurrentCode(newCode);
        }
      };
      return () => {
        // On unmount, don't destroy the editor; move it back to the hidden container if available
        delete window[`updateUnit${unitId}`];
        const initializerContainer = document.querySelector('[data-testid="live-coding-initializer"]');
        if (initializerContainer && replRef.current) {
          replRef.current.style.display = 'none';
          initializerContainer.appendChild(replRef.current);
        }
        replRef.current = null;
        initializedRef.current = false;
      };
    }

    // Fallback removed: wait briefly for initializer to create the editor to avoid duplicates
    console.log(`UnitStrudelRepl: No hidden REPL found yet for unit ${unitId}, waiting for initializer...`);
    const waitUntil = Date.now() + 3000; // up to 3s
    const poll = setInterval(() => {
      const found = document.querySelector(`strudel-editor[data-unit-id="${unitId}"]`);
      if (found || Date.now() > waitUntil) {
        clearInterval(poll);
        if (found && containerRef.current && !replRef.current) {
          containerRef.current.appendChild(found);
          found.style.display = '';
          replRef.current = found;
          const unit = window.getUnitInstance?.(unitId);
          if (unit && unit.type === 'LIVE_CODING' && found.editor) {
            unit.setReplInstance(found.editor, found);
          }
          window[`updateUnit${unitId}`] = (newCode) => {
            if (replRef.current?.editor) {
              replRef.current.editor.setCode(newCode);
              try { replRef.current.setAttribute('code', newCode); } catch {}
              setCurrentCode(newCode);
            }
          };
        }
      }
    }, 100);

    return () => {
      delete window[`updateUnit${unitId}`];
      clearInterval(poll);
      // Move back to initializer if present
      const initializerContainer = document.querySelector('[data-testid="live-coding-initializer"]');
      if (initializerContainer && replRef.current) {
        replRef.current.style.display = 'none';
        initializerContainer.appendChild(replRef.current);
      }
      replRef.current = null;
      initializedRef.current = false;
    };
  }, [unitId]);

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
