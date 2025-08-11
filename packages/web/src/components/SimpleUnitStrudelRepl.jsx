import React, { useEffect, useRef } from 'react';
import '@strudel/repl';

// GLOBAL VISUAL FEEDBACK RESTORATION
// This mimics the manual testVisualFeedbackPreservation() logic automatically.
// It batches rapid mount/reconnect events and then:
// 1. Aggregates each unit's sampleBank and registers samples in its own REPL context
// 2. Falls back to window.samples(allSamples) if available (legacy/global path)
// 3. Re-evaluates each unit's currentCode to restore Mini Notation highlighting
// Safeguards: debounced scheduling + minimum interval between full restores.
if (typeof window !== 'undefined' && !window._scheduleGlobalLiveCodingVisualRestore) {
  window._scheduleGlobalLiveCodingVisualRestore = () => {
    try {
      // Debounce
      if (window._globalVisualRestoreTimer) clearTimeout(window._globalVisualRestoreTimer);
      window._globalVisualRestoreTimer = setTimeout(() => {
        const now = Date.now();
        if (window._lastGlobalVisualRestore && (now - window._lastGlobalVisualRestore) < 400) {
          // Too soon; skip (another call already handled it)
          return;
        }
        window._lastGlobalVisualRestore = now;

        const unitsMap = window._liveCodingUnits;
        if (!unitsMap || unitsMap.size === 0) return;

        console.log('🎨 Auto visual feedback restore: scanning units...');

        // Global aggregate (optional) – some contexts may still look at window.samples
        const globalSamples = {};

        unitsMap.forEach((unit) => {
          if (unit?.sampleBank?.size > 0) {
            unit.sampleBank.forEach(sampleData => {
              if (sampleData?.name && sampleData?.blobUrl) {
                globalSamples[sampleData.name] = sampleData.blobUrl;
              }
            });
          }
        });

        // Optional global registration (non-fatal if absent)
        try {
          if (Object.keys(globalSamples).length && typeof window.samples === 'function') {
            window.samples(globalSamples);
            console.log('📦 Global samples registered for fallback path');
          }
        } catch (e) {
          console.log('⚠️ Global samples registration failed (continuing per-unit):', e.message);
        }

  let restoredCount = 0;
  unitsMap.forEach((unit) => {
          try {
            const element = unit?.strudelElement;
            const editor = element?.editor;
            const repl = editor?.repl;
            const code = unit?.currentCode;
            if (!repl || !code || !code.trim() || code.startsWith('// Live coding unit')) return;

            // Ensure this unit's samples are registered in its own isolated context
            if (unit.sampleBank?.size && unit.replInstance?.context?.samples) {
              const perUnitMap = {};
              unit.sampleBank.forEach(sampleData => {
                if (sampleData?.name && sampleData?.blobUrl) perUnitMap[sampleData.name] = sampleData.blobUrl;
              });
              if (Object.keys(perUnitMap).length) {
                try {
                  unit.replInstance.context.samples(perUnitMap);
                } catch (err) {
                  console.log(`⚠️ Unit ${unit.id} per-unit sample registration failed:`, err.message);
                }
              }
            }

            // Re-evaluate to restore highlighting (and audio if running)
            const attemptEval = (tag='primary') => {
              try {
                // Prefer unit.replInstance.evaluate if available (sometimes wraps extra logic)
                if (unit.replInstance && typeof unit.replInstance.evaluate === 'function') {
                  unit.replInstance.evaluate(code);
                } else if (repl && typeof repl.evaluate === 'function') {
                  repl.evaluate(code);
                } else if (editor && typeof editor.evaluate === 'function') {
                  editor.evaluate(code);
                }
                console.log(`✅ Visual feedback restore (${tag}) for unit ${unit.id}`);
                return true;
              } catch (errEval) {
                console.log(`❌ Visual restore (${tag}) failed for unit ${unit.id}:`, errEval.message);
                return false;
              }
            };

            const successPrimary = attemptEval('primary');
            if (successPrimary) restoredCount++;

            // Schedule a second pass to catch late sample registrations / rendering inactivity
            if (!unit._scheduledSecondaryVisualRestore) {
              unit._scheduledSecondaryVisualRestore = true;
              setTimeout(() => {
                attemptEval('second-pass');
                unit._scheduledSecondaryVisualRestore = false;
              }, 320);
            }
          } catch (inner) {
            console.log('⚠️ Visual restore inner error:', inner.message);
          }
        });

        console.log(`🎨 Auto visual restore complete (${restoredCount} unit(s) refreshed)`);
      }, 180); // debounce delay
    } catch (err) {
      console.log('❌ Scheduling global visual restore failed:', err.message);
    }
  };
}

// Immediate synchronous-style restore that mimics the original manual testVisualFeedbackPreservation()
// Use this when we need restoration BEFORE monitoring scripts time out.
if (typeof window !== 'undefined' && !window.forceImmediateVisualFeedbackRestore) {
  window.forceImmediateVisualFeedbackRestore = (options = {}) => {
    try {
      const unitsMap = window._liveCodingUnits;
      if (!unitsMap || unitsMap.size === 0) return;
      const { onlyUnitId = null, includeSamples = true } = options;

      // 1. Aggregate samples (global) like the test function
      if (includeSamples && typeof window.samples === 'function') {
        const allSamples = {};
        unitsMap.forEach(unit => {
          if (onlyUnitId && unit.id !== onlyUnitId) return; // filter if requested
            unit?.sampleBank?.forEach(sampleData => {
              if (sampleData?.name && sampleData?.blobUrl) {
                allSamples[sampleData.name] = sampleData.blobUrl;
              }
            });
        });
        if (Object.keys(allSamples).length) {
          try { window.samples(allSamples); } catch { /* ignore */ }
        }
      }

      // 2. Evaluate code for each unit (or targeted unit)
      unitsMap.forEach(unit => {
        if (onlyUnitId && unit.id !== onlyUnitId) return;
        const element = unit?.strudelElement;
        const repl = element?.editor?.repl;
        const code = unit?.currentCode;
        if (!repl || !code || !code.trim() || code.startsWith('// Live coding unit')) return;
        try {
          repl.evaluate(code);
          // Dispatch a custom event for monitoring tools
          window.dispatchEvent(new CustomEvent('visual-feedback-restored', { detail: { unitId: unit.id, mode: 'immediate' } }));
        } catch (err) {
          // Second attempt after a short frame if first fails
          requestAnimationFrame(() => {
            try {
              repl.evaluate(code);
              window.dispatchEvent(new CustomEvent('visual-feedback-restored', { detail: { unitId: unit.id, mode: 'immediate-rAF' } }));
            } catch {}
          });
        }
      });
    } catch (e) {
      console.log('forceImmediateVisualFeedbackRestore error:', e.message);
    }
  };
}

/**
 * Simple UnitStrudelRepl with stable DOM positioning for visual feedback
 * Keeps elements in fixed positions instead of moving them around
 */
const SimpleUnitStrudelRepl = ({ unitId }) => {
  const containerRef = useRef(null);
  const strudelElementRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    console.log(`SimpleUnitStrudelRepl ${unitId}: Setting up stable editor`);
    
    // Check for existing persistent element
    const persistentKey = `simple-strudel-${unitId}`;
    let strudelElement = window[persistentKey];
    
    if (strudelElement) {
      console.log(`SimpleUnitStrudelRepl ${unitId}: Using existing stable element`);
      
      // Don't move the element! Just show it and ensure it's connected
      strudelElement.style.display = 'block';
      
      // Make sure it's in our container (but only if it's not already there)
      if (strudelElement.parentNode !== containerRef.current) {
        containerRef.current.appendChild(strudelElement);
      }
      
      strudelElementRef.current = strudelElement;
      
      // CRITICAL: Reconnect to LiveCoding unit
      const unit = window.getUnitInstance?.(unitId);
      if (unit && unit.type === 'LIVE_CODING' && strudelElement.editor?.repl) {
        console.log(`SimpleUnitStrudelRepl ${unitId}: Reconnecting stable element to unit`);
        unit.setReplInstance(strudelElement.editor, strudelElement);
        
        // Restore unit's current code
        if (unit.currentCode && unit.currentCode !== strudelElement.getAttribute('code')) {
          console.log(`SimpleUnitStrudelRepl ${unitId}: Restoring unit code`);
          strudelElement.editor.setCode(unit.currentCode);
          strudelElement.setAttribute('code', unit.currentCode);
        }
        
        // AUTO-RESTORE VISUAL FEEDBACK: schedule global restoration (handles samples + evaluation)
        if (unit.currentCode && unit.currentCode.trim() && unit.currentCode !== `// Live coding unit ${unitId}`) {
          // Immediate first to satisfy fast monitors, then global batched
          window.forceImmediateVisualFeedbackRestore?.({ onlyUnitId: unitId });
          window._scheduleGlobalLiveCodingVisualRestore?.();
        }
      }
      
    } else {
      console.log(`SimpleUnitStrudelRepl ${unitId}: Creating new stable element`);
      
      // Clear container first
      containerRef.current.innerHTML = '';
      
      // Create new strudel-editor
      strudelElement = document.createElement('strudel-editor');
      strudelElement.setAttribute('code', `// Live coding unit ${unitId}`);
      strudelElement.sync = true;
      strudelElement.solo = false;
      strudelElement.setAttribute('data-unit-id', unitId);
      
      // Style for stable positioning
      strudelElement.style.width = '100%';
      strudelElement.style.height = '100%';
      strudelElement.style.display = 'block';
      
      containerRef.current.appendChild(strudelElement);
      strudelElementRef.current = strudelElement;
      
      // Store globally for persistence
      window[persistentKey] = strudelElement;

      // Wait for initialization and connect to unit
      const checkReady = () => {
        if (strudelElement.editor?.repl) {
          console.log(`SimpleUnitStrudelRepl ${unitId}: Stable editor ready, connecting to unit`);
          
          // Connect to LiveCoding unit
          const unit = window.getUnitInstance?.(unitId);
          if (unit && unit.type === 'LIVE_CODING') {
            unit.setReplInstance(strudelElement.editor, strudelElement);
            
            // Set unit's current code if it exists
            if (unit.currentCode) {
              strudelElement.editor.setCode(unit.currentCode);
              strudelElement.setAttribute('code', unit.currentCode);
              
              // AUTO-RESTORE VISUAL FEEDBACK for new elements too (global batched approach)
              if (unit.currentCode.trim() && unit.currentCode !== `// Live coding unit ${unitId}`) {
                // Immediate + scheduled
                window.forceImmediateVisualFeedbackRestore?.({ onlyUnitId: unitId });
                window._scheduleGlobalLiveCodingVisualRestore?.();
              }
            }
          }
          return;
        }
        setTimeout(checkReady, 100);
      };
      checkReady();
    }

    // Cleanup - hide instead of removing
    return () => {
      if (strudelElementRef.current) {
        // Hide the element but keep it in the DOM for visual feedback continuity
        strudelElementRef.current.style.display = 'none';
        console.log(`SimpleUnitStrudelRepl ${unitId}: Hidden editor (keeping for visual feedback)`);
      }
    };
  }, [unitId]);

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400 px-2">
          Stable Unit {unitId}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-[240px]" />
    </div>
  );
};

export default SimpleUnitStrudelRepl;
