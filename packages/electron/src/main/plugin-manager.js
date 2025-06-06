const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const extract = require('extract-zip');

class PluginManager {
  constructor() {
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.registryUrl = 'https://raw.githubusercontent.com/your-org/plugin-registry/main/registry.json';
    this.registryCachePath = path.join(app.getPath('userData'), 'registry-cache.json');
    this.registryCacheTime = 3600000; // 1 hour in milliseconds
    this.runningServices = new Map();
    this.ensurePluginDirectory();
  }

  ensurePluginDirectory() {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  // Helper method for HTTP requests using dynamic import
  async fetch(url, options = {}) {
    try {
      const { default: fetch } = await import('node-fetch');
      return await fetch(url, options);
    } catch (error) {
      console.error('Error with fetch:', error);
      throw error;
    }
  }

  async getAvailablePlugins(forceRefresh = false) {
    try {
      // For demo purposes, return mock data
      // In a real implementation, you would fetch from your registry URL
      return {
        schemaVersion: 1,
        lastUpdated: new Date().toISOString(),
        plugins: [
          {
            id: "map-elites-sim",
            name: "MAP-Elites Simulator",
            description: "Quality diversity algorithm using Multi-dimensional Archive of Phenotypic Elites",
            version: "1.0.0",
            author: "Your Organization",
            tags: ["simulation", "quality-diversity", "evolutionary"],
            downloadUrl: "https://example.com/plugins/map-elites-plugin.zip",
            pythonVersion: ">=3.8,<3.12",
            dependencies: ["numpy>=1.20.0", "scikit-learn>=1.0.0"],
            interfaces: ["websocket"]
          },
          {
            id: "nslc-sim",
            name: "Novelty Search with Local Competition",
            description: "Quality diversity algorithm using novelty search with local competition",
            version: "0.9.0",
            author: "Your Organization",
            tags: ["simulation", "quality-diversity", "evolutionary"],
            downloadUrl: "https://example.com/plugins/nslc-plugin.zip",
            pythonVersion: ">=3.8,<3.12",
            dependencies: ["numpy>=1.20.0", "scipy>=1.7.0"],
            interfaces: ["websocket"]
          }
        ]
      };
    } catch (error) {
      console.error('Error fetching plugin registry:', error);
      return { plugins: [] };
    }
  }

  async getInstalledPlugins() {
    try {
      const dirs = await fs.promises.readdir(this.pluginsDir);
      const installedPlugins = [];

      for (const dir of dirs) {
        const pluginDir = path.join(this.pluginsDir, dir);
        const stat = await fs.promises.stat(pluginDir);
        
        if (stat.isDirectory()) {
          const configPath = path.join(pluginDir, 'plugin.json');
          
          if (fs.existsSync(configPath)) {
            try {
              const config = JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
              installedPlugins.push({
                id: dir,
                ...config
              });
            } catch (err) {
              console.error(`Error reading plugin config for ${dir}:`, err);
            }
          }
        }
      }
      
      return installedPlugins;
    } catch (error) {
      console.error('Error getting installed plugins:', error);
      return [];
    }
  }

  async installPlugin(pluginId) {
    const plugins = await this.getAvailablePlugins();
    const plugin = plugins.plugins.find(p => p.id === pluginId);
    
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    
    // This is a simplified mock implementation
    // In a real implementation, you would:
    // 1. Download the plugin ZIP
    // 2. Extract it to the plugins directory
    // 3. Set up a virtual environment
    // 4. Install dependencies
    
    console.log(`Installing plugin ${pluginId}...`);
    
    // Create a mock installation
    const pluginDir = path.join(this.pluginsDir, pluginId);
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }
    
    // Write a mock plugin.json file
    await fs.promises.writeFile(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify(plugin, null, 2)
    );
    
    return { success: true, pluginDir };
  }

  async startPluginService(pluginId) {
    if (this.runningServices.has(pluginId)) {
      return this.runningServices.get(pluginId);
    }
    
    // This is a simplified mock implementation
    // In a real implementation, you would:
    // 1. Launch the Python service in its virtual environment
    // 2. Pass the correct port
    // 3. Set up proper communication
    
    console.log(`Starting plugin service ${pluginId}...`);
    
    // For demo purposes, just return a mock port
    const serviceInfo = { process: null, port: 8765 + Math.floor(Math.random() * 100) };
    this.runningServices.set(pluginId, serviceInfo);
    
    return serviceInfo;
  }

  async stopPluginService(pluginId) {
    const serviceInfo = this.runningServices.get(pluginId);
    if (serviceInfo && serviceInfo.process) {
      serviceInfo.process.kill();
    }
    
    this.runningServices.delete(pluginId);
    return { success: true };
  }

  async refreshRegistry() {
    return this.getAvailablePlugins(true);
  }

  // Mock method for finding an available port
  async findAvailablePort() {
    return 8765 + Math.floor(Math.random() * 100);
  }
}

module.exports = new PluginManager();