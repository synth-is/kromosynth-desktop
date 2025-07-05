import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Play } from 'lucide-react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useSearchParams,
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider
} from 'react-router-dom';
import PhylogeneticViewer from './components/PhylogeneticViewer';
import PhylogeneticViewerSVG from './components/PhylogeneticViewerSVG';
import UnitsPanel from './components/UnitsPanel';
import UnitConfigPanel from './components/UnitConfigPanel';
import ViewSwitcher from './components/ViewSwitcher';
import HeatmapViewer from './components/HeatmapViewer';
import StrudelReplTest from './components/StrudelReplTest';
import { StrudelPatternProvider } from './components/strudelPatternContext';
import { DEFAULT_STRUDEL_CODE, LINEAGE_SOUNDS_BUCKET_HOST, UNIT_TYPES, DEFAULT_UNIT_CONFIGS, getRestServiceHost, REST_ENDPOINTS } from './constants';
import { UnitsProvider, useUnits } from './UnitsContext';

const TopBar = ({ 
  showUnits, 
  setShowUnits, 
  selectedRun, 
  handleRunChange, 
  selectedIndex, 
  handleIndexChange,
  showSettings,
  setShowSettings,
  runs,
  evorunsSummary,
  steps 
}) => {
  const [showRunSelector, setShowRunSelector] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const dropdownRef = useRef(null);

  // Initialize expanded groups to show the latest group by default
  useEffect(() => {
    if (evorunsSummary?.groups && Object.keys(expandedGroups).length === 0) {
      const dateKeys = Object.keys(evorunsSummary.groups).sort().reverse();
      if (dateKeys.length > 0) {
        setExpandedGroups({ [dateKeys[0]]: true });
      }
    }
  }, [evorunsSummary, expandedGroups]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowRunSelector(false);
      }
    };

    if (showRunSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRunSelector]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const selectRun = (folderName) => {
    // Find the experiment class and step index for this specific evorun
    let experimentClass = null;
    let stepIndex = 0;
    
    if (evorunsSummary?.groups) {
      // Search through all groups to find the experiment class containing this evorun
      for (const dateGroup of Object.values(evorunsSummary.groups)) {
        for (const [experimentKey, experiments] of Object.entries(dateGroup)) {
          const runIndex = experiments.findIndex(exp => exp.folderName === folderName);
          if (runIndex !== -1) {
            experimentClass = experimentKey;
            stepIndex = runIndex;
            break;
          }
        }
        if (experimentClass) break;
      }
    }
    
    if (experimentClass) {
      // Update both the run (to experiment class) and step (to index within that class)
      handleRunChange(experimentClass);
      handleIndexChange(stepIndex);
    } else {
      // Fallback to old behavior if we can't find the experiment class
      handleRunChange(folderName);
    }
    
    setShowRunSelector(false);
  };

  // Find the display name for the selected run
  const getSelectedRunDisplayName = () => {
    if (!selectedRun) return 'Select Run';
    
    // If we have evorunsSummary, try to show the specific evorun name within the experiment class
    if (evorunsSummary?.groups && selectedIndex !== undefined) {
      for (const dateGroup of Object.values(evorunsSummary.groups)) {
        if (dateGroup[selectedRun] && dateGroup[selectedRun][selectedIndex]) {
          const specificRun = dateGroup[selectedRun][selectedIndex];
          return `${selectedRun.replace(/_/g, ' ')} - ${specificRun.ulid}`;
        }
      }
    }
    
    // Fallback to just showing the experiment class name
    return selectedRun.replace(/_/g, ' ');
  };

  return (
    <div className="p-2 bg-gray-900/80 backdrop-blur relative z-50">
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setShowUnits(!showUnits)}
          className="p-2 rounded hover:bg-gray-800 text-gray-400 transition-colors"
        >
          <Play size={16} />
        </button>

        <div className="flex-1 relative" ref={dropdownRef}>
          {/* Custom dropdown for grouped runs */}
          <button
            onClick={() => setShowRunSelector(!showRunSelector)}
            className="w-full bg-gray-800 text-white p-2 rounded border border-gray-700 text-sm text-left flex justify-between items-center"
          >
            <span className="truncate">{getSelectedRunDisplayName()}</span>
            <span className="ml-2 text-gray-400">▼</span>
          </button>
          
          {showRunSelector && evorunsSummary?.groups && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded max-h-96 overflow-y-auto z-[9999] shadow-xl">
              {Object.entries(evorunsSummary.groups)
                .sort(([a], [b]) => b.localeCompare(a)) // Sort dates descending (newest first)
                .map(([dateKey, dateGroup]) => (
                  <div key={dateKey}>
                    <button
                      onClick={() => toggleGroup(dateKey)}
                      className="w-full p-2 text-left hover:bg-gray-700 text-gray-300 font-medium border-b border-gray-700 flex justify-between items-center"
                    >
                      <span>{dateKey}</span>
                      <span className="text-gray-500">
                        {expandedGroups[dateKey] ? '▲' : '▼'}
                      </span>
                    </button>
                    
                    {expandedGroups[dateKey] && (
                      <div className="bg-gray-850">
                        {Object.entries(dateGroup)
                          .sort(([a], [b]) => a.localeCompare(b)) // Sort experiment names alphabetically
                          .map(([experimentKey, experiments]) => (
                            <div key={experimentKey}>
                              <div className="px-4 py-1 text-xs text-gray-400 bg-gray-900">
                                {experimentKey.replace(/_/g, ' ')}
                              </div>
                              {experiments
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort by timestamp descending
                                .map((evorun) => (
                                  <button
                                    key={evorun.folderName}
                                    onClick={() => selectRun(evorun.folderName)}
                                    className={`w-full p-2 text-left hover:bg-gray-700 text-sm pl-6 ${
                                      selectedRun === evorun.folderName 
                                        ? 'bg-blue-600 text-white' 
                                        : 'text-gray-300'
                                    }`}
                                  >
                                    <div className="truncate">
                                      {evorun.ulid}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(evorun.timestamp).toLocaleString()}
                                    </div>
                                  </button>
                                ))}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
          
          {/* Fallback to simple dropdown if no grouped data */}
          {showRunSelector && !evorunsSummary?.groups && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded max-h-96 overflow-y-auto z-[9999] shadow-xl">
              {runs.map(run => (
                <button
                  key={run}
                  onClick={() => selectRun(run)}
                  className={`w-full p-2 text-left hover:bg-gray-700 text-sm ${
                    selectedRun === run 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-300'
                  }`}
                >
                  {run.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={selectedIndex}
            onChange={(e) => handleIndexChange(Number(e.target.value))}
            className="w-40 bg-gray-800 text-white p-2 rounded border border-gray-700 text-sm"
          >
            {Array.from({length: steps}, (_, i) => (
              <option key={i} value={i}>
                Step {i + 1}
              </option>
            ))}
          </select>
          
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded hover:bg-gray-800 text-gray-400 transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

function MainContent({ 
  lineageTreesIndex, 
  evorunsSummary,
  treeData,
  soundSourceError,
  selectedUnitId,
  handleCellHover,
  ...props 
}) {
  // Show a persistent error banner at the bottom if soundSourceError, but keep all UI accessible
  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950">
      {/* TopBar always at the top */}
      <div>
        <TopBar {...props} runs={Object.keys(lineageTreesIndex || {})} evorunsSummary={evorunsSummary} steps={lineageTreesIndex ? lineageTreesIndex[props.selectedRun]?.length || 0 : 0} />
      </div>
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          {props.currentView === 'tree' ? (
            <PhylogeneticViewer 
              treeData={treeData}
              experiment={props.selectedRun}
              evoRunId={getEvoRunIdFromSelectedStep(lineageTreesIndex?.[props.selectedRun]?.[props.selectedIndex])}
              showSettings={props.showSettings}
              setShowSettings={props.setShowSettings}
              hasAudioInteraction={props.hasAudioInteraction}
              onAudioInteraction={() => props.setHasAudioInteraction(true)}
              onCellHover={handleCellHover}
            />
          ) : props.currentView === 'treeSVG' ? (
            <PhylogeneticViewerSVG 
              treeData={treeData}
              experiment={props.selectedRun}
              evoRunId={getEvoRunIdFromSelectedStep(lineageTreesIndex?.[props.selectedRun]?.[props.selectedIndex])}
              showSettings={props.showSettings}
              setShowSettings={props.setShowSettings}
              hasAudioInteraction={props.hasAudioInteraction}
              onAudioInteraction={() => props.setHasAudioInteraction(true)}
              onCellHover={handleCellHover}
            />
          ) : (
            <HeatmapViewer 
              showSettings={props.showSettings}
              setShowSettings={props.setShowSettings}
              experiment={props.selectedRun}
              evoRunId={getEvoRunIdFromSelectedStep(lineageTreesIndex?.[props.selectedRun]?.[props.selectedIndex])}
              matrixUrls={getMatrixUrlFromTreePath(lineageTreesIndex?.[props.selectedRun]?.[props.selectedIndex])}
              hasAudioInteraction={props.hasAudioInteraction}
              onAudioInteraction={() => props.setHasAudioInteraction(true)}
              onCellHover={handleCellHover}
            />
          )}
        </div>
        {props.showUnits && (
          <div className="fixed left-4 top-16 z-40">
            <UnitsPanel
              units={props.units}
              onPlaybackChange={props.handleUnitPlaybackChange}
              selectedUnitId={selectedUnitId}
              onSelectUnit={props.handleSelectUnit}
              onAddUnit={props.handleAddUnit}
              onRemoveUnit={props.handleRemoveUnit}
              onToggleState={props.handleToggleState}
              onUpdateVolume={props.handleUpdateVolume}
              onUpdateUnit={props.handleUpdateUnit}
              onCellHover={props.lastHoverData}
              treeData={treeData}
            />
            {selectedUnitId && (
              <UnitConfigPanel
                unit={props.units.find(u => u.id === selectedUnitId)}
                units={props.units}
                onClose={() => props.handleSelectUnit(null)}
                onUpdateUnit={props.handleUpdateUnit}
                onPlaybackChange={props.handleUnitPlaybackChange}
                treeData={treeData}
                unitInstance={(() => {
                  const { getUnitInstance, unitsRef } = useUnits();
                  const selectedUnitInstance = selectedUnitId ? getUnitInstance(selectedUnitId) : null;
                  return selectedUnitInstance || (window.getUnitInstance && selectedUnitId ? window.getUnitInstance(selectedUnitId) : null);
                })()}
              />
            )}
          </div>
        )}
      </div>
      {soundSourceError && (
        <div className="w-full bg-red-700 text-white text-center py-2 z-50 fixed bottom-0 left-0">
          <span className="font-semibold">{soundSourceError}</span>
          <span className="ml-2 text-white/80">You can change the sound source in the settings panel.</span>
        </div>
      )}
    </div>
  );
}

function MainApp() {
  console.log('MainApp component starting...');
  
  const [searchParams, setSearchParams] = useSearchParams();
  console.log('useSearchParams hook successful');

  // Initialize hasAudioInteraction based on view type
  const initialView = searchParams.get('view') || 'tree';
  const [hasAudioInteraction, setHasAudioInteraction] = useState(() => 
    initialView === 'heatmap' // Heatmap doesn't need initial audio interaction
  );
  console.log('hasAudioInteraction state initialized');

  // Add loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [soundSourceError, setSoundSourceError] = useState(null);
  console.log('Loading and error states initialized');

  // Group all useState calls together
  const [selectedRun, setSelectedRun] = useState(() => 
    searchParams.get('run') || 'evoConf_singleMap_refSingleEmbeddings_mfcc-statistics_pca_retrainIncr50_zscoreNSynthTrain_TE-AudioSubregions_XConSimFoc'
  );
  const [selectedIndex, setSelectedIndex] = useState(() => 
    parseInt(searchParams.get('step')) || 0
  );
  const [currentView, setCurrentView] = useState(() => 
    searchParams.get('view') || 'tree'
  );
  const [treeData, setTreeData] = useState(null);
  const [lineageTreesIndex, setLineageTreesIndex] = useState(null);
  const [evorunsSummary, setEvorunsSummary] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showUnits, setShowUnits] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState(1); // Default to first unit
  const [lastHoverData, setLastHoverData] = useState(null);  // Add this state
  const [units, setUnits] = useState(() => [{
    id: 1,
    type: UNIT_TYPES.TRAJECTORY,
    ...DEFAULT_UNIT_CONFIGS[UNIT_TYPES.TRAJECTORY]
  }]);
  const [playingUnits, setPlayingUnits] = useState(new Set());
  console.log('All useState hooks successful');

  // Group all useRef calls together
  const fetchedTreesRef = useRef(new Set());
  const fetchedIndexRef = useRef(false);
  console.log('useRef hooks successful');

  const handleCellHover = useCallback((cellData) => {
    if (selectedUnitId && showUnits) {
      console.log('MainApp: cell hover received:', { selectedUnitId, cellData });
      setLastHoverData(cellData);  // Store the hover data
      setUnits(prevUnits => 
        prevUnits.map(unit => 
          unit.id === selectedUnitId 
            ? { ...unit, lastHoverData: cellData }
            : unit
        )
      );
      return cellData;
    }
    return null;
  }, [selectedUnitId, showUnits]);

  // Group all useEffect calls together
  useEffect(() => {
    if (fetchedIndexRef.current) return;
    
    const restServiceHost = getRestServiceHost();
    fetch(`${restServiceHost}${REST_ENDPOINTS.EVORUNS_SUMMARY}`)
      .then(response => {
        if (!response.ok) throw new Error('REST service unreachable');
        return response.json();
      })
      .then(summary => {
        // Transform the REST response to match the expected lineageTreesIndex format
        const index = {};
        
        // Handle the new grouped structure
        if (summary.groups) {
          // Group runs by experiment type for the lineageTreesIndex format
          Object.values(summary.groups).forEach(dateGroup => {
            Object.entries(dateGroup).forEach(([experimentKey, experimentRuns]) => {
              // Use the experiment key as the run name and map each evorun as a step
              if (!index[experimentKey]) {
                index[experimentKey] = [];
              }
              // Add each evorun as a step, using folderName/ulid format for tree path
              experimentRuns.forEach(evorun => {
                index[experimentKey].push(`${evorun.folderName}/${evorun.ulid}`);
              });
            });
          });
        } else {
          // Handle the old array format as fallback
          summary.forEach(evorun => {
            const runName = evorun.folderName;
            index[runName] = evorun.steps ? evorun.steps.map(step => `${runName}/${step.stepName}`) : [];
          });
        }
        
        setLineageTreesIndex(index);
        // Store the raw summary for use in the grouped dropdown
        setEvorunsSummary(summary);
        fetchedIndexRef.current = true;
      })
      .catch(error => {
        // Fallback to static file serving if REST service is unavailable
        console.warn('REST service unavailable, falling back to static files:', error);
        fetch(`${LINEAGE_SOUNDS_BUCKET_HOST}/lineage-trees-metadata/evolution-runs-overview.json`)
          .then(response => {
            if (!response.ok) throw new Error('Sound source unreachable');
            return response.json();
          })
          .then(index => {
            setLineageTreesIndex(index);
            fetchedIndexRef.current = true;
          })
          .catch(fallbackError => {
            setSoundSourceError('Neither REST service nor static file source can be reached. Please check your settings or choose another source.');
            console.error('Error loading index from both sources:', { restError: error, staticError: fallbackError });
          });
      });
  }, []);

  useEffect(() => {
    if (!lineageTreesIndex) return;
    const treePath = lineageTreesIndex[selectedRun]?.[selectedIndex];
    if (!treePath) return;
    if (fetchedTreesRef.current.has(treePath)) return;
    
    const restServiceHost = getRestServiceHost();
    // Extract folderName and ulid from treePath
    const pathParts = treePath.split('/');
    const folderName = pathParts[0];
    const ulid = pathParts[1];
    
    // Construct the correct file path for the tree JSON (gzipped version)
    const treeFilePath = `analysisResults/trees/tree_${folderName}_all.json.gz`;
    
    fetch(`${restServiceHost}${REST_ENDPOINTS.FILES(folderName, treeFilePath)}`)
      .then(response => {
        if (!response.ok) throw new Error('REST service unreachable');
        return response.arrayBuffer();
      })
      .then(buffer => {
        // Decompress the gzipped data
        const decompressed = new DecompressionStream('gzip');
        const stream = new Response(buffer).body.pipeThrough(decompressed);
        return new Response(stream).text();
      })
      .then(jsonText => {
        return JSON.parse(jsonText);
      })
      .then(treeJson => {
        setTreeData(treeJson);
        fetchedTreesRef.current.add(treePath);
      })
      .catch(error => {
        // Fallback to static file serving if REST service is unavailable
        console.warn('REST service unavailable for tree data, falling back to static files:', error);
        fetch(`${LINEAGE_SOUNDS_BUCKET_HOST}/lineage-trees/tree_${treePath}_all.json`)
          .then(response => {
            if (!response.ok) throw new Error('Sound source unreachable');
            return response.json();
          })
          .then(treeJson => {
            setTreeData(treeJson);
            fetchedTreesRef.current.add(treePath);
          })
          .catch(fallbackError => {
            setSoundSourceError('Neither REST service nor static file source can be reached for tree data. Please check your settings or choose another source.');
            console.error('Error loading tree from both sources:', { restError: error, staticError: fallbackError });
          });
      });
  }, [lineageTreesIndex, selectedRun, selectedIndex]);

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('run', selectedRun);
    newParams.set('step', selectedIndex.toString());
    newParams.set('view', currentView);
    setSearchParams(newParams, { replace: true });
  }, [selectedRun, selectedIndex, currentView, setSearchParams]);

  // Simplify the data fetching effect
  useEffect(() => {
    if (!lineageTreesIndex || !selectedRun || selectedIndex === undefined) return;
    const treePath = lineageTreesIndex[selectedRun][selectedIndex];
    
    setTreeData(null); // Clear current data before fetching
    
    const restServiceHost = getRestServiceHost();
    // Extract folderName and construct file path
    const pathParts = treePath.split('/');
    const folderName = pathParts[0];
    const treeFileName = pathParts[pathParts.length - 1];
    const treeFilePath = `analysisResults/${treeFileName}`;
    
    fetch(`${restServiceHost}${REST_ENDPOINTS.FILES(folderName, treeFilePath)}`)
      .then(response => {
        if (!response.ok) throw new Error('REST service unreachable');
        return response.json();
      })
      .then(treeJson => {
        console.log('Tree data loaded from REST service');
        setTreeData(treeJson);
      })
      .catch(error => {
        // Fallback to static file serving if REST service is unavailable
        console.warn('REST service unavailable for tree data, falling back to static files:', error);
        fetch(`${LINEAGE_SOUNDS_BUCKET_HOST}/lineage-trees/tree_${treePath}_all.json`)
          .then(response => response.json())
          .then(treeJson => {
            console.log('Tree data loaded from fallback URL');
            setTreeData(treeJson);
          })
          .catch(fallbackError => {
            console.error('Error loading tree from both sources:', { restError: error, staticError: fallbackError });
          });
      });
  }, [lineageTreesIndex, selectedRun, selectedIndex]);

  // Add effect to handle audio interaction state when view changes
  useEffect(() => {
    if (currentView === 'heatmap') {
      setHasAudioInteraction(true);
    }
  }, [currentView]);

  // Add handler functions
  const handleRunChange = (run) => {
    fetchedTreesRef.current.clear(); // Clear cache when manually changing run
    setTreeData(null);
    setSelectedRun(run);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('run', run);
    setSearchParams(newParams, { replace: true });
  };

  const handleIndexChange = (index) => {
    setTreeData(null);
    setSelectedIndex(index);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('step', index.toString());
    setSearchParams(newParams, { replace: true });
  };

  // Update handleViewChange to handle audio interaction
  const handleViewChange = (view) => {
    setCurrentView(view);
    if (view === 'heatmap') {
      setHasAudioInteraction(true);
    }
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', view);
    setSearchParams(newParams, { replace: true });
  };

  const handleUnitPlaybackChange = (unitId, isPlaying) => {
    setPlayingUnits(prev => {
      const next = new Set(prev);
      if (isPlaying) {
        next.add(unitId);
      } else {
        next.delete(unitId);
      }
      return next;
    });
  };

  const handleSelectUnit = (id) => {
    setSelectedUnitId(id === selectedUnitId ? null : id);
  };

  const handleAddUnit = (unitType) => {
    const newUnit = {
      id: Date.now(), // Use timestamp for unique IDs
      type: unitType,
      ...DEFAULT_UNIT_CONFIGS[unitType]
    };
    setUnits([...units, newUnit]);
    setSelectedUnitId(newUnit.id);
  };

  const handleRemoveUnit = (id) => {
    console.log('App: handleRemoveUnit called:', {
      unitToRemove: id,
      currentUnits: units.map(u => ({ id: u.id, type: u.type })),
      selectedUnitId
    });

    setUnits(prevUnits => {
      // Simply filter out the removed unit, no reindexing
      const remainingUnits = prevUnits.filter(unit => unit.id !== id);
      
      // Update selected unit ID if we removed the selected unit
      if (selectedUnitId === id) {
        setSelectedUnitId(remainingUnits.length > 0 ? remainingUnits[0].id : null);
      }
      
      return remainingUnits;
    });
  };

  const handleToggleState = (id, state) => {
    setUnits(prevUnits => {
      const newUnits = prevUnits.map(unit => {
        if (unit.id === id) {
          return { ...unit, [state]: !unit[state] };
        }
        // If toggling solo, un-solo other units
        if (state === 'soloed' && unit.id !== id) {
          return { ...unit, soloed: false };
        }
        return unit;
      });
      return newUnits;
    });
  };

  const handleUpdateVolume = (id, volume) => {
    setUnits(prevUnits => 
      prevUnits.map(unit => {
        if (unit.id === id) {
          return { ...unit, volume };
        }
        return unit;
      })
    );
  };

  const handleUpdateUnit = (id, updatedUnit) => {
    console.log('handleUpdateUnit called:', { id, updatedUnit });
    setUnits(prevUnits =>
      prevUnits.map(unit => unit.id === id ? updatedUnit : unit)
    );
  };


  return <MainContent 
    lineageTreesIndex={lineageTreesIndex}
    evorunsSummary={evorunsSummary}
    treeData={treeData}
    soundSourceError={soundSourceError}
    showUnits={showUnits}
    setShowUnits={setShowUnits}
    selectedRun={selectedRun}
    handleRunChange={handleRunChange}
    selectedIndex={selectedIndex}
    handleIndexChange={handleIndexChange}
    showSettings={showSettings}
    setShowSettings={setShowSettings}
    currentView={currentView}
    handleViewChange={handleViewChange}
    units={units}
    playingUnits={playingUnits}
    handleUnitPlaybackChange={handleUnitPlaybackChange}
    selectedUnitId={selectedUnitId}
    handleSelectUnit={handleSelectUnit}
    handleAddUnit={handleAddUnit}
    handleRemoveUnit={handleRemoveUnit}
    handleToggleState={handleToggleState}
    handleUpdateVolume={handleUpdateVolume}
    handleUpdateUnit={handleUpdateUnit}
    hasAudioInteraction={hasAudioInteraction}
    setHasAudioInteraction={setHasAudioInteraction}
  />;
}

// Create router with future flags
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/strudel-repl-test" element={<StrudelReplTest />} />
      <Route path="/" element={<MainApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  ),
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true
    },
    basename: import.meta.env.BASE_URL // Add this line
  }
);

function App() {
  return (
    <StrudelPatternProvider>
      <UnitsProvider>
        <RouterProvider router={router} />
      </UnitsProvider>
    </StrudelPatternProvider>
  );
}

function getEvoRunIdFromSelectedStep(treeJSONfilePath) {
  if (!treeJSONfilePath || typeof treeJSONfilePath !== 'string') {
    return '';
  }
  const treeJSONfilePathParts = treeJSONfilePath.split('/');
  const selectedStep = treeJSONfilePathParts[treeJSONfilePathParts.length - 1];
  let suffixIndex;
  if (selectedStep.includes("_all.json")) {
    suffixIndex = selectedStep.indexOf("_all.json");
  } else if (selectedStep.includes("_musical.json")) {
    suffixIndex = selectedStep.indexOf("_musical.json");
  } else if (selectedStep.includes("_nonmusical.json")) {
    suffixIndex = selectedStep.indexOf("_nonmusical.json");
  }
  console.log("Selected step:", selectedStep);
  console.log("Suffix index:", suffixIndex);
  // const evoRunId = selectedStep.substring(selectedStep.indexOf("tree_")+5, suffixIndex);
  const evoRunId = selectedStep;
  console.log("Evo run ID:", evoRunId);
  return evoRunId;
}

function getMatrixUrlFromTreePath(treePath) {
  if (!treePath) return null;
  
  const treePathParts = treePath.split('/');
  const folderName = treePathParts[0];
  const ulid = treePathParts[1];
  
  // For REST service, construct the matrix endpoint using the MATRIX endpoint
  const restServiceHost = getRestServiceHost();
  const restUrl = `${restServiceHost}${REST_ENDPOINTS.MATRIX(folderName, ulid)}`;
  
  // For fallback, construct the matrix filename based on the ULID
  const matrixFileName = `matrix_${folderName}_${ulid}.json`;
  const fallbackUrl = `${LINEAGE_SOUNDS_BUCKET_HOST}/lineage-matrices/${matrixFileName}`;
  
  console.log("Matrix URLs:", { restUrl, fallbackUrl, treePath, folderName, ulid, matrixFileName });
  
  // Return the REST URL with fallback handling in the component
  return { restUrl, fallbackUrl };
}

export default App;