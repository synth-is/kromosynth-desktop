const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Add comprehensive error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize PluginManager safely
let PluginManager = null;
try {
  PluginManager = require('./plugin-manager');
  console.log('PluginManager loaded successfully');
} catch (error) {
  console.error('Error loading PluginManager:', error);
}

function createWindow() {
  try {
    console.log('Creating browser window...');
    
    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'kromosynth',
      icon: path.join(__dirname, '../../resources/kromosynth-icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: false, // Disable context isolation for easier audio API access
        nodeIntegration: true,   // Enable node integration for audio libraries
        enableRemoteModule: true, // Enable remote module access
        webSecurity: false,      // Disable web security for audio and file access
        allowRunningInsecureContent: true, // Allow insecure content
        experimentalFeatures: true, // Enable experimental web features
        // Additional permissions for audio
        permissions: ['audioCapture', 'microphone'],
        // Disable sandbox for full API access
        sandbox: false
      }
    });

    console.log('Browser window created successfully');

    // Determine the URL to load
    // In development: load from dev server
    // In production: load from built files
    const startUrl = process.env.ELECTRON_START_URL || url.format({
      pathname: path.join(__dirname, '../../app/web-build/index.html'),
      protocol: 'file:',
      slashes: true
    });

    console.log('Loading URL:', startUrl);

    // Load the URL
    mainWindow.loadURL(startUrl).catch(error => {
      console.error('Error loading URL:', error);
    });

    // Add error handling for loading issues
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Page finished loading');
      // Log any console messages from the renderer
      mainWindow.webContents.executeJavaScript(`
        window.addEventListener('error', (e) => {
          console.error('Renderer error:', e.error, e.message, e.filename, e.lineno);
        });
        window.addEventListener('unhandledrejection', (e) => {
          console.error('Unhandled promise rejection:', e.reason);
        });
        console.log('Error handlers attached');
      `).catch(err => console.error('Failed to execute JS:', err));
    });

    mainWindow.webContents.on('dom-ready', () => {
      console.log('DOM is ready');
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
      console.error('Renderer process gone:', details);
      console.error('Reason:', details.reason);
      console.error('Exit code:', details.exitCode);
    });

    mainWindow.webContents.on('unresponsive', () => {
      console.warn('Renderer process became unresponsive');
    });

    mainWindow.webContents.on('responsive', () => {
      console.log('Renderer process became responsive again');
    });

    // Open DevTools in development mode
    if (process.env.ELECTRON_START_URL) {
      mainWindow.webContents.openDevTools();
    }

    // Handle window being closed
    mainWindow.on('closed', () => {
      console.log('Main window closed');
      mainWindow = null;
    });

    // Prevent window from being closed unexpectedly in development
    mainWindow.on('close', (event) => {
      console.log('Window close event triggered');
      // Temporarily disable close prevention to debug
      // if (process.env.ELECTRON_START_URL) {
      //   console.log('Preventing window close for debugging');
      //   event.preventDefault();
      //   setTimeout(() => {
      //     console.log('Allowing window to close after 5 seconds');
      //     mainWindow.destroy();
      //   }, 5000);
      // }
    });

  } catch (error) {
    console.error('Error creating window:', error);
  }
}

// Create window when Electron is ready
app.whenReady().then(async () => {
  try {
    console.log('Electron app ready, creating window...');
    
    // Set app name
    app.setName('kromosynth');
    
    // Set app permissions for audio
    if (app.setAsDefaultProtocolClient) {
      app.setAsDefaultProtocolClient('kromosynth');
    }
    
    // Enable media access permissions
    if (process.platform === 'darwin') {
      // Request microphone access on macOS (might be needed for some audio APIs)
      try {
        await require('electron').systemPreferences.askForMediaAccess('microphone');
      } catch (error) {
        console.log('Could not request microphone access:', error);
      }
    }
    
    createWindow();
    
    // Set up IPC handlers for plugin management only if PluginManager is available
    if (PluginManager) {
      setupIpcHandlers();
    } else {
      console.warn('PluginManager not available, skipping IPC handler setup');
    }
  } catch (error) {
    console.error('Error during app initialization:', error);
  }
}).catch(error => {
  console.error('Error in app.whenReady():', error);
});

// Handle certificate errors in development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (process.env.ELECTRON_START_URL) {
    // In development, ignore certificate errors for localhost
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Recreate window when dock icon is clicked (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Set up IPC handlers for communication with renderer process
function setupIpcHandlers() {
  if (!PluginManager) {
    console.warn('PluginManager not available, cannot set up IPC handlers');
    return;
  }

  try {
    ipcMain.handle('get-available-plugins', async () => {
      try {
        return await PluginManager.getAvailablePlugins();
      } catch (error) {
        console.error('Error getting available plugins:', error);
        return { plugins: [] };
      }
    });
    
    ipcMain.handle('get-installed-plugins', async () => {
      try {
        return await PluginManager.getInstalledPlugins();
      } catch (error) {
        console.error('Error getting installed plugins:', error);
        return { plugins: [] };
      }
    });

    ipcMain.handle('install-plugin', async (_, pluginId) => {
      try {
        return await PluginManager.installPlugin(pluginId);
      } catch (error) {
        console.error('Error installing plugin:', error);
        return { success: false, error: error.message };
      }
    });
    
    ipcMain.handle('start-plugin-service', async (_, pluginId) => {
      try {
        const serviceInfo = await PluginManager.startPluginService(pluginId);
        return serviceInfo.port;
      } catch (error) {
        console.error('Error starting plugin service:', error);
        return null;
      }
    });
    
    ipcMain.handle('stop-plugin-service', async (_, pluginId) => {
      try {
        return await PluginManager.stopPluginService(pluginId);
      } catch (error) {
        console.error('Error stopping plugin service:', error);
        return { success: false, error: error.message };
      }
    });
    
    ipcMain.handle('refresh-registry', async () => {
      try {
        return await PluginManager.refreshRegistry();
      } catch (error) {
        console.error('Error refreshing registry:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('IPC handlers set up successfully');
    
    // Add error logging handler
    ipcMain.handle('log-error', async (_, errorData) => {
      console.error('Renderer error received:', errorData);
      return { success: true };
    });
    
  } catch (error) {
    console.error('Error setting up IPC handlers:', error);
  }
}