import React, { useEffect, useRef } from 'react';
import '@strudel/repl';
import { UNIT_TYPES } from '../constants';
import { useUnits } from '../UnitsContext';

/**
 * This component creates hidden REPL instances for all LiveCodingUnits
 * immediately when they're created, similar to how StrudelReplTest.jsx works.
 * This ensures proper isolation and immediate initialization.
 */
const LiveCodingInitializer = ({ units }) => {
  const containerRef = useRef(null);
  const replsRef = useRef(new Map()); // Map of unitId -> repl element
  const { unitsRef } = useUnits();

  useEffect(() => {
    if (!containerRef.current) return;

    // Find all LiveCodingUnits
    const liveCodingUnits = units.filter(unit => unit.type === UNIT_TYPES.LIVE_CODING);
    
    // Create REPL instances for new LiveCodingUnits
    liveCodingUnits.forEach(unit => {
      if (!replsRef.current.has(unit.id)) {
        console.log(`LiveCodingInitializer: Creating REPL for unit ${unit.id}`);
        
        // Create editor exactly like StrudelReplTest.jsx
        const editor = document.createElement('strudel-editor');
        editor.setAttribute('code', unit.strudelCode || '// Waiting for evolutionary sounds...');
        editor.sync = unit.sync !== undefined ? unit.sync : true;
        editor.solo = unit.solo !== undefined ? unit.solo : false;
        
        // Hide the editor but keep it functional
        editor.style.display = 'none';
        editor.setAttribute('data-unit-id', unit.id);
        
        containerRef.current.appendChild(editor);
        replsRef.current.set(unit.id, editor);
        
        // Wait for REPL to be ready and connect to unit instance
        const checkReady = () => {
          if (editor.editor && editor.editor.repl) {
            console.log(`LiveCodingInitializer: REPL ready for unit ${unit.id}`);
            
            // Connect to unit instance
            const unitInstance = unitsRef.current?.get(unit.id);
            if (unitInstance && unitInstance.setReplInstance) {
              unitInstance.setReplInstance(editor.editor);
              console.log(`LiveCodingInitializer: Connected REPL to unit ${unit.id}`);
            }
          } else {
            setTimeout(checkReady, 100);
          }
        };
        
        setTimeout(checkReady, 100);
      }
    });

    // Clean up REPL instances for removed LiveCodingUnits
    const currentUnitIds = new Set(liveCodingUnits.map(u => u.id));
    for (const [unitId, replElement] of replsRef.current.entries()) {
      if (!currentUnitIds.has(unitId)) {
        console.log(`LiveCodingInitializer: Cleaning up REPL for removed unit ${unitId}`);
        
        // Stop the REPL
        if (replElement.editor?.repl) {
          try {
            replElement.editor.repl.stop();
          } catch (err) {
            console.warn(`Error stopping REPL for unit ${unitId}:`, err);
          }
        }
        
        // Remove from DOM
        if (replElement.parentNode) {
          replElement.parentNode.removeChild(replElement);
        }
        
        replsRef.current.delete(unitId);
      }
    }
  }, [units, unitsRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('LiveCodingInitializer: Cleaning up all hidden REPLs');
      for (const [unitId, replElement] of replsRef.current.entries()) {
        if (replElement.editor?.repl) {
          try {
            replElement.editor.repl.stop();
          } catch (err) {
            console.warn(`Error stopping REPL for unit ${unitId} during cleanup:`, err);
          }
        }
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      replsRef.current.clear();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ display: 'none' }}
      data-testid="live-coding-initializer"
    />
  );
};

export default LiveCodingInitializer;
