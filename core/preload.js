const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Auth
  startAuth: () => ipcRenderer.send("start-auth-server"),
  getToken: () => ipcRenderer.invoke("get-token"),
  clearToken: () => ipcRenderer.send("clear-token"),
  onAccessToken: (cb) => ipcRenderer.on("access-token", (_e, token) => cb(token)),
  getDropboxUser: () => ipcRenderer.invoke("get-dropbox-user"),

  // Games
  getGames: () => ipcRenderer.invoke("get-games"),
  setGames: (games) => ipcRenderer.send("set-games", games),
  getGameDetails: (gameName) => ipcRenderer.invoke("get-game-details", gameName),

  // Folders & Paths
  setLocalFolderForGame: (gameName) => ipcRenderer.invoke("set-local-folder-for-game", gameName),
  setGameFolderForGame: (gameName) => ipcRenderer.invoke("set-game-folder-for-game", gameName),
  pickGameExeForGame: (gameName, startDir) => ipcRenderer.invoke("pick-game-exe-for-game", gameName, startDir),
  openLocalFolder: (gameName) => ipcRenderer.invoke("open-local-folder", gameName),
  openGameFolder: (gameName) => ipcRenderer.invoke("open-game-folder", gameName),
  openDropboxFolder: (gameName) => ipcRenderer.invoke("open-dropbox-folder", gameName),

  // Sync
  syncGame: (game) => ipcRenderer.invoke("sync-game", game),
  onSyncLog: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("sync-log", handler);
    return () => ipcRenderer.removeListener("sync-log", handler);
  },
  onSyncProgress: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("sync-progress", handler);
    return () => ipcRenderer.removeListener("sync-progress", handler);
  },

  // Logs
  getLogs: (gameName) => ipcRenderer.invoke("get-logs", gameName),
  clearLogs: (gameName) => ipcRenderer.invoke("clear-logs", gameName),
  exportLogs: (gameName) => ipcRenderer.invoke("export-logs", gameName), // <-- FUNGSI YANG DITAMBAHKAN

  // Game Process
  runGameExe: (gameName) => ipcRenderer.invoke("run-game-exe", gameName),
  forceCloseGame: (gameName) => ipcRenderer.invoke("force-close-game", gameName),
  getRunningState: (gameName) => ipcRenderer.invoke("get-running-state", gameName),
  onGameProcess: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("game-process", handler);
    return () => ipcRenderer.removeListener("game-process", handler);
  },

  // Window Controls
  minimizeWindow: () => {
    console.log("[Preload] Minimize window called");
    ipcRenderer.send("minimize-window");
  },
  maximizeRestoreWindow: () => {
    console.log("[Preload] Maximize/restore window called");
    ipcRenderer.send("maximize-restore-window");
  },
  closeWindow: () => {
    console.log("[Preload] Close window called");
    ipcRenderer.send("close-window");
  },
  hideToTray: () => {
    console.log("[Preload] Hide to tray called");
    ipcRenderer.send("hide-to-tray");
  },
});