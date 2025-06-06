// Utility to detect Electron environment
export const isElectronEnvironment = () => {
  return window?.electronAPI?.isElectron === true;
};

// Utility to get plugin API (with web fallback)
export const getPluginAPI = () => {
  if (isElectronEnvironment()) {
    return window.electronAPI;
  }
  
  // For web environment, provide a fallback API
  return {
    getAvailablePlugins: async () => {
      // In web context, maybe fetch from a remote API instead
      console.log('Web environment: Fetching plugins from remote API');
      // Simulate API call in web environment
      return {
        plugins: [
          {
            id: "map-elites-sim",
            name: "MAP-Elites Simulator (Web Version)",
            description: "Limited web version of the QD algorithm",
            version: "1.0.0-web"
          }
        ]
      };
    },
    getInstalledPlugins: async () => {
      return [];
    },
    installPlugin: async () => {
      throw new Error('Plugin installation not available in web version');
    },
    startPluginService: async () => {
      throw new Error('Plugin services not available in web version');
    },
    isElectron: false
  };
};