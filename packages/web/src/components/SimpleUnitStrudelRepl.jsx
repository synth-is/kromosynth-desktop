import React, { useEffect, useRef } from 'react';
import '@strudel/repl';

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
        
        // AUTO-RESTORE VISUAL FEEDBACK: Re-evaluate if unit has code (regardless of playing state)
        if (unit.currentCode && unit.currentCode.trim() && unit.currentCode !== `// Live coding unit ${unitId}`) {
          console.log(`SimpleUnitStrudelRepl ${unitId}: Auto-restoring visual feedback for existing code`);
          setTimeout(() => {
            try {
              // Re-evaluate to restore visual feedback - this preserves Mini Notation highlighting
              strudelElement.editor.repl.evaluate(unit.currentCode);
              console.log(`✅ Visual feedback auto-restored for unit ${unitId}`);
            } catch (error) {
              console.log(`❌ Auto-restore failed for unit ${unitId}:`, error.message);
            }
          }, 100); // Small delay to ensure element is ready
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
              
              // AUTO-RESTORE VISUAL FEEDBACK for new elements too
              if (unit.currentCode.trim() && unit.currentCode !== `// Live coding unit ${unitId}`) {
                console.log(`SimpleUnitStrudelRepl ${unitId}: Auto-restoring visual feedback for new element`);
                setTimeout(() => {
                  try {
                    // Re-evaluate to restore visual feedback - this preserves Mini Notation highlighting
                    strudelElement.editor.repl.evaluate(unit.currentCode);
                    console.log(`✅ Visual feedback auto-restored for new unit ${unitId}`);
                  } catch (error) {
                    console.log(`❌ Auto-restore failed for new unit ${unitId}:`, error.message);
                  }
                }, 200); // Slightly longer delay for new elements
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
