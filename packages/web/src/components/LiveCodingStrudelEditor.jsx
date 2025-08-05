import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';
import '@strudel/repl';

const LiveCodingStrudelEditor = ({ 
  unitId, 
  initialCode, 
  onCodeChange, 
  onEditorReady,
  sync = true,
  solo = false
}) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCode, setCurrentCode] = useState(initialCode || 'sound("bd hh sd oh")');

  // Initialize Strudel editor
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const editor = document.createElement('strudel-editor');
      editor.setAttribute('code', currentCode);
      editor.sync = sync;
      editor.solo = solo;
      
      // Add editor to container
      containerRef.current.appendChild(editor);
      editorRef.current = editor;
      
      // Wait for editor to be ready and notify parent
      const checkReady = () => {
        if (editor.editor && editor.editor.repl) {
          console.log(`LiveCodingStrudelEditor ready for unit ${unitId}`);
          if (onEditorReady) {
            onEditorReady(editor.editor);
          }
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      setTimeout(checkReady, 100);
    }

    // Cleanup on unmount
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      editorRef.current = null;
    };
  }, []);

  // Update sync/solo when props change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.sync = sync;
      editorRef.current.solo = solo;
    }
  }, [sync, solo]);

  // Update code when initialCode changes
  useEffect(() => {
    if (editorRef.current?.editor && initialCode !== currentCode) {
      setCurrentCode(initialCode);
      editorRef.current.editor.setCode(initialCode);
    }
  }, [initialCode]);

  const handleToggle = () => {
    if (editorRef.current?.editor?.repl) {
      editorRef.current.editor.toggle();
      setIsPlaying(prev => !prev);
    }
  };

  const handleStop = () => {
    if (editorRef.current?.editor?.repl) {
      editorRef.current.editor.repl.stop();
      setIsPlaying(false);
    }
  };

  const handleUpdate = () => {
    if (editorRef.current?.editor?.repl) {
      const code = editorRef.current.editor.code;
      setCurrentCode(code);
      
      if (onCodeChange) {
        onCodeChange(code);
      }
      
      editorRef.current.editor.repl.evaluate(code);
    }
  };

  return (
    <div className="space-y-2">
      {/* Control buttons */}
      <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded">
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-sm flex items-center gap-1 text-xs"
        >
          <RefreshCw size={12} />
          Update & Run
        </button>
        
        <div className="flex-1" />

        <button
          onClick={handleToggle}
          className={`p-1.5 rounded-sm text-white ${
            isPlaying
              ? 'bg-yellow-600 hover:bg-yellow-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isPlaying ? <Square size={14} /> : <Play size={14} />}
        </button>
        
        <button
          onClick={handleStop}
          className="p-1.5 bg-red-600 text-white rounded-sm hover:bg-red-700"
        >
          <Square size={14} />
        </button>
      </div>

      {/* Strudel editor container */}
      <div 
        ref={containerRef} 
        className="border border-gray-600 rounded-sm min-h-[200px] bg-gray-900"
      />
      
      {/* Info display */}
      <div className="text-xs text-gray-400 flex justify-between">
        <span>Unit: {unitId}</span>
        <span>
          Sync: {sync ? 'On' : 'Off'} | Solo: {solo ? 'On' : 'Off'}
        </span>
      </div>
    </div>
  );
};

export default LiveCodingStrudelEditor;
