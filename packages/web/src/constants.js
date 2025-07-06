export const DEFAULT_STRUDEL_CODE = `
note("c2 <eb2 <g2 g1>>".fast(2))
.sound("<sawtooth square triangle sine>").delay(1)
._scope()
`.trim();

// Default host URL for lineage sounds (legacy static file server)
export const DEFAULT_LINEAGE_SOUNDS_BUCKET_HOST = "https://ns9648k.web.sigma2.no";

// Default REST service configuration
export const DEFAULT_REST_SERVICE_HOST = "http://localhost:3004";

// Get the current host URL (custom from localStorage or default)
export const getLineageSoundsBucketHost = () => {
  const customUrl = localStorage.getItem('CUSTOM_LINEAGE_SOUNDS_URL');
  return customUrl || DEFAULT_LINEAGE_SOUNDS_BUCKET_HOST;
};

// Get the REST service host URL (custom from localStorage or default)
export const getRestServiceHost = () => {
  const customUrl = localStorage.getItem('CUSTOM_REST_SERVICE_URL');
  return customUrl || DEFAULT_REST_SERVICE_HOST;
};

// For compatibility with existing code
export const LINEAGE_SOUNDS_BUCKET_HOST = getLineageSoundsBucketHost();

// REST service endpoints
export const REST_ENDPOINTS = {
  EVORUNS_SUMMARY: '/evoruns/summary',
  GENOME: (folderName, ulid) => `/evoruns/${folderName}/genome/${ulid}`,
  FEATURES: (folderName, ulid) => `/evoruns/${folderName}/features/${ulid}`,
  MATRIX: (folderName, stepName) => `/files/${folderName}/analysisResults/score-and-genome-matrices_${folderName}_step-500.json.gz`,
  FILES: (folderName, filePath) => `/files/${folderName}/${filePath}`,
  RENDER_AUDIO: (folderName, ulid, duration, pitch, velocity) => `/evorenders/${folderName}/${ulid}/${duration}/${pitch}/${velocity}`,
  RENDER_FILES: (folderName) => `/evorenders/${folderName}/files`
};

export const UNIT_TYPES = {
  TRAJECTORY: 'TRAJECTORY',
  SEQUENCING: 'SEQUENCING',
  LOOPING: 'LOOPING'  // Add new unit type
};

export const DEFAULT_UNIT_CONFIGS = {
  [UNIT_TYPES.TRAJECTORY]: {
    speed: 1,
    radius: 50,
    direction: 'clockwise',
    volume: -10,
    active: true,
    muted: false,
    soloed: false,
    maxVoices: 4
  },
  [UNIT_TYPES.SEQUENCING]: {
    active: true,
    muted: false,
    soloed: false,
    volume: -10,
    bars: 1,        // Set default to 1 bar
    bpm: 120,
    startOffset: 0
  },
  [UNIT_TYPES.LIVE_CODE]: {
    strudelCode: DEFAULT_STRUDEL_CODE,
    liveCodeEngine: 'Strudel',
    volume: -10,
    active: true,
    muted: false,
    soloed: false
  },
  [UNIT_TYPES.LOOPING]: {
    volume: -10,
    active: true,
    muted: false,
    soloed: false,
    maxVoices: 4,
    pitch: 0,
    syncEnabled: false  // Add this line to initialize syncEnabled
  }
};