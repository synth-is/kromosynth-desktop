const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// Since we're disabling context isolation, we can also expose Node.js APIs directly
// This is less secure but necessary for audio libraries that need direct access

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
if (typeof window !== 'undefined') {
  // With contextIsolation disabled, we can set properties directly on window
  window.electronAPI = {
    // Plugin management
    getAvailablePlugins: () => ipcRenderer.invoke('get-available-plugins'),
    getInstalledPlugins: () => ipcRenderer.invoke('get-installed-plugins'),
    installPlugin: (pluginId) => ipcRenderer.invoke('install-plugin', pluginId),
    startPluginService: (pluginId) => ipcRenderer.invoke('start-plugin-service', pluginId),
    stopPluginService: (pluginId) => ipcRenderer.invoke('stop-plugin-service', pluginId),
    refreshRegistry: () => ipcRenderer.invoke('refresh-registry'),
    
    // Error logging
    logError: (errorData) => ipcRenderer.invoke('log-error', errorData),
    
    // File system access for audio files
    path: path,
    fs: fs,
    
    // Environment detection
    isElectron: true,
    platform: process.platform,
    versions: process.versions
  };

  // Expose require for libraries that need it
  window.require = require;
  
  // Expose process for environment detection
  window.process = process;
  
  console.log('Preload script executed, APIs exposed to renderer');
} else {
  // Fallback for context isolation (though we've disabled it)
  try {
    contextBridge.exposeInMainWorld('electronAPI', {
      // Plugin management
      getAvailablePlugins: () => ipcRenderer.invoke('get-available-plugins'),
      getInstalledPlugins: () => ipcRenderer.invoke('get-installed-plugins'),
      installPlugin: (pluginId) => ipcRenderer.invoke('install-plugin', pluginId),
      startPluginService: (pluginId) => ipcRenderer.invoke('start-plugin-service', pluginId),
      stopPluginService: (pluginId) => ipcRenderer.invoke('stop-plugin-service', pluginId),
      refreshRegistry: () => ipcRenderer.invoke('refresh-registry'),
      
      // Error logging
      logError: (errorData) => ipcRenderer.invoke('log-error', errorData),
      
      // Environment detection
      isElectron: true,
      platform: process.platform,
      versions: process.versions
    });
  } catch (error) {
    console.error('Failed to expose APIs via contextBridge:', error);
  }
}