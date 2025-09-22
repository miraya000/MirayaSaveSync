// main.js
const { app, BrowserWindow, shell, Tray, Menu, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store");
const dropbox = require("./core/dropbox");
const { decideAndSync } = require("./core/sync");
const { walkLocalFiles } = require("./core/fsutil");
const { registerIpcHandlers } = require("./core/ipc");

const CLIENT_ID = "rl4xeesddx8nesy";
const CLIENT_SECRET = "f6ilzo5vjj2y1ls";
const REDIRECT_URI = "http://localhost:4567/auth/callback";

const store = new Store({ name: "MirayaSaveSync" });
let tray = null;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log("Another instance is already running. Exiting...");
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (windows.mainWindow) {
      if (windows.mainWindow.isMinimized()) windows.mainWindow.restore();
      windows.mainWindow.focus();
    }
  });
}

// Export tray for access from other modules
module.exports = { tray: () => tray };

const windows = {
  mainWindow: null,
};

function createWindow() {
  console.log("Creating main window...");
  if (windows.mainWindow) {
    if (windows.mainWindow.isMinimized()) windows.mainWindow.restore();
    windows.mainWindow.focus();
    return;
  }
  windows.mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    title: "MIRAYA SAVE SYNC", // New title for the window
    frame: false, // Hide the default window frame
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "core", "preload.js"),
      webSecurity: false, // Move webSecurity inside webPreferences
    },
    show: false, // Don't show window until ready
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'ui/dist/index.html')}`;
  windows.mainWindow.loadURL(startUrl);

  // Show window when ready to prevent flash
  windows.mainWindow.once('ready-to-show', () => {
    windows.mainWindow.show();
  });

  // Modifikasi event 'close'
  windows.mainWindow.on("close", (event) => {
    // Jika app.isQuitting diset (dari close button atau menu tray), biarkan jendela tertutup.
    if (app.isQuitting) {
      console.log("App is quitting, allowing window to close...");
      return;
    }
    // Jika tidak, sembunyikan jendela ke tray.
    event.preventDefault();
    windows.mainWindow?.hide();
  });

  windows.mainWindow.on("closed", () => {
    console.log("Main window closed");
    windows.mainWindow = null;
    // Jika jendela utama benar-benar ditutup, hapus juga tray icon
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
    }
  });

  // Restore focus to the web contents when the window is focused.
  windows.mainWindow.on("focus", () => {
    windows.mainWindow.webContents.focus();
  });
}

app.whenReady().then(() => {
  console.log("[Main] App ready, registering IPC handlers...");
  
    // Register IPC handlers FIRST
    registerIpcHandlers({
      store,
      dropbox,
      windows,
      decideAndSync,
      walkLocalFiles,
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI,
    });
    
    console.log("[Main] IPC handlers registered, creating window...");
    createWindow();

    // Buat Tray Icon
    // Pastikan Anda memiliki file icon 'icon.ico' atau 'icon.png' di root project
    // Path ini akan bekerja baik di development maupun setelah di-build.
    let iconPath;
    if (app.isPackaged) {
      // In production, use the icon from resources
      iconPath = path.join(process.resourcesPath, 'icon.png');
    } else {
      // In development, use the icon from app path
      iconPath = path.join(app.getAppPath(), 'icon.png');
    }
    
    // Fallback to a system icon if our icon doesn't exist
    if (!require('fs').existsSync(iconPath)) {
      iconPath = path.join(__dirname, 'icon.png');
    }
    
    tray = new Tray(iconPath);

    // Menampilkan kembali jendela saat ikon tray di-klik
    tray.on('click', () => {
      windows.mainWindow?.show();
    });

    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Show App', 
        click: () => {
          windows.mainWindow?.show();
        } 
      },
      { 
        label: 'Quit', 
        click: () => {
          // Tandai bahwa aplikasi akan keluar, lalu panggil app.quit()
          app.isQuitting = true; // Tandai bahwa kita benar-benar ingin keluar
          app.quit();
        } 
      }
    ]);
    tray.setToolTip('Miraya Save Sync');
    tray.setContextMenu(contextMenu);

  // Handler untuk tombol "Hide to Tray" dari UI
  ipcMain.on('hide-to-tray', () => {
    windows.mainWindow?.hide();
  });
});

app.on("activate", () => {
  // Pada macOS, klik ikon di dock akan membuka kembali jendela
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    windows.mainWindow?.show();
  }
});

app.on("window-all-closed", () => {
  console.log("[Main] All windows closed, cleaning up...");
  
  // Cleanup tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
  
  // Force quit the application
  app.quit();
});

app.on("before-quit", (event) => {
  console.log("[Main] Application is about to quit, cleaning up...");
  
  // Cleanup tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
  
  // Close main window if it exists
  if (windows.mainWindow && !windows.mainWindow.isDestroyed()) {
    windows.mainWindow.destroy();
    windows.mainWindow = null;
  }
});

// Inisialisasi dropbox dengan fungsi getAccessToken
dropbox.init(() => store.get("access_token"));
