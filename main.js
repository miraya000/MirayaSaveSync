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
    },
    webSecurity: false,
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'ui/dist/index.html')}`;
  windows.mainWindow.loadURL(startUrl);

  // Modifikasi event 'close'
  windows.mainWindow.on("close", (event) => {
    // Jika app.isQuitting diset (dari menu tray), biarkan jendela tertutup.
    if (app.isQuitting) {
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

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (windows.mainWindow) {
      if (windows.mainWindow.isMinimized()) windows.mainWindow.restore();
      windows.mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    console.log("App is ready");
    createWindow();

    // Buat Tray Icon
    // Pastikan Anda memiliki file icon 'icon.ico' atau 'icon.png' di root project
    // Path ini akan bekerja baik di development maupun setelah di-build.
    const iconPath = path.join(app.getAppPath(), 'icon.png');
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
    // Logika ini sekarang hanya relevan untuk macOS jika Anda ingin
    // aplikasi tetap berjalan tanpa jendela. Untuk Windows/Linux,
    // aplikasi akan tetap berjalan di tray.
    if (process.platform !== "darwin") return;
  });

  // Handler untuk tombol "Hide to Tray" dari UI
  ipcMain.on('hide-to-tray', () => {
    windows.mainWindow?.hide();
  });
}

// Inisialisasi dropbox dengan fungsi getAccessToken
dropbox.init(() => store.get("access_token"));
