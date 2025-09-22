const { BrowserWindow } = require("electron");
const path = require("path");

function createWindow(mainWindow, preloadPath, startUrl) {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: preloadPath,
    },
    webSecurity: false,
  });

  mainWindow.loadURL(startUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

module.exports = { createWindow };