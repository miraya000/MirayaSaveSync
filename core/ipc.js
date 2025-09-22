const { ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const fetch = require("node-fetch");
const { spawn } = require("child_process");

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getDropboxGameFolder(gameName) {
  return `/${slugify(gameName)}/saved-data`;
}

// =================================================================
// STATS FILE HANDLING (Per-Game JSON)
// =================================================================


function registerIpcHandlers({ store, dropbox, windows, decideAndSync, walkLocalFiles, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI }) {
  let authServer = null;
  const running = new Map();

  function appendLog(gameName, line) {
    const key = `logs_${slugify(gameName)}`;
    const entry = { ts: Date.now(), line: String(line) };
    const arr = store.get(key) || [];
    arr.push(entry);
    if (arr.length > 3000) arr.splice(0, arr.length - 3000);
    store.set(key, arr);
    windows.mainWindow?.webContents.send("sync-log", { game: gameName, ...entry });
  }

  function emitProgress(game, current, total, action, file, done = false) {
    windows.mainWindow?.webContents.send("sync-progress", {
      game,
      current,
      total,
      action,
      file,
      done,
    });
  }

  function notifyProcess(gameName, runningState) {
    windows.mainWindow?.webContents.send("game-process", { game: gameName, running: runningState });
  }

  // --- Stat File Helpers (Dropbox-based) ---
  function getDropboxGameStatFilePath(gameName) {
    const gameSlug = slugify(gameName);
    return `/${gameSlug}/${gameSlug}-game-stat.json`;
  }

  async function readGameStatFile(gameName) {
    const statFilePath = getDropboxGameStatFilePath(gameName);
    try {
      const buffer = await dropbox.download(statFilePath);
      return JSON.parse(buffer.toString('utf8'));
    } catch (e) {
      // If file not found or other error, return empty object
      // console.error(`[Stats] Could not read remote stat file for ${gameName}:`, e.message);
      return {};
    }
  }

  async function writeGameStatFile(gameName, statsData) {
    const statFilePath = getDropboxGameStatFilePath(gameName);
    const content = {
      gameName: gameName,
      ...statsData,
    };
    try {
      const buffer = Buffer.from(JSON.stringify(content, null, 2), 'utf8');
      await dropbox.uploadSmall(statFilePath, buffer);
    } catch (e) {
      console.error(`[Stats] Error saving remote game stats for ${gameName}:`, e);
    }
  }


  async function onGameStopped(gameName, startTs, exitCode = 0) {
    const endTs = Date.now();
    const durMin = Math.max(0, Math.round((endTs - startTs) / 60000));
    
    const games = store.get("games") || [];
    const gameIndex = games.findIndex((g) => g.name === gameName);

    const existingStats = await readGameStatFile(gameName);
    const oldTotalMinutes = existingStats.totalMinutes || 0;

    const newTotalMinutes = oldTotalMinutes + durMin;
    const newSessions = existingStats.sessions || [];
    if (durMin > 0) {
      newSessions.push({
        startTime: startTs,
        endTime: endTs,
        duration: durMin,
      });
    }

    await writeGameStatFile(gameName, {
      ...existingStats,
      totalMinutes: newTotalMinutes,
      lastPlayed: endTs,
      sessions: newSessions.slice(-100),
    });

    if (gameIndex !== -1) {
      games[gameIndex].totalMinutes = newTotalMinutes;
      games[gameIndex].lastPlayed = endTs;
      store.set("games", games);
    }

    appendLog(gameName, `[META] GAME CLOSED (code ${exitCode}) • session ${durMin}m`);
    notifyProcess(gameName, false);
  }

  // ========== IPC HANDLERS =========

  // --- Auth ---
  ipcMain.handle("get-token", () => store.get("access_token") || null);
  ipcMain.on("clear-token", () => {
    store.delete("access_token");
    store.delete("refresh_token");
    store.delete("expires_at");
  });

  ipcMain.handle("get-dropbox-user", async () => {
    const token = store.get("access_token");
    if (!token) return null;

    try {
      const res = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        console.error("Failed to get Dropbox user, status:", res.status);
        return null;
      }
      const data = await res.json();
      return { email: data.email, name: data.name.display_name };
    } catch (e) {
      console.error("Exception while getting Dropbox user:", e);
      return null;
    }
  });

  // --- Games ---
  ipcMain.handle("get-games", () => store.get("games") || []);
  ipcMain.on("set-games", (_e, games) => store.set("games", games));

  ipcMain.handle("get-game-details", async (_e, gameName) => {
    const games = store.get("games") || [];
    const mainGameData = games.find((g) => g.name === gameName);
    if (!mainGameData) throw new Error("Game not found in main store");    
    const statsData = await readGameStatFile(gameName);
    // Return combined data, cover is now always the one from the main game data.
    return { ...mainGameData, ...statsData };
  });

  // --- Logs ---
  ipcMain.handle("get-logs", (_e, gameName) => store.get(`logs_${slugify(gameName)}`) || []);
  ipcMain.handle("clear-logs", (_e, gameName) => {
    store.set(`logs_${slugify(gameName)}`, []);
    return true;
  });

  ipcMain.handle("export-logs", async (_e, gameName) => {
    const logs = store.get(`logs_${slugify(gameName)}`) || [];
    if (logs.length === 0) {
      // Tidak perlu throw error, cukup kembalikan status
      return { success: false, error: "No logs to export." };
    }

    const { canceled, filePath } = await dialog.showSaveDialog(windows.mainWindow, {
      title: `Export Logs for ${gameName}`,
      defaultPath: `${slugify(gameName)}-sync-log-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: "Text Files", extensions: ["txt"] }],
    });

    if (canceled || !filePath) {
      return { success: false, error: "Export canceled." };
    }

    const logContent = logs
      .map(l => `[${new Date(l.ts).toISOString()}] ${l.line}`)
      .join('\n');

    await fs.promises.writeFile(filePath, logContent, 'utf8');
    shell.showItemInFolder(filePath); // Otomatis membuka folder tempat file disimpan
    return { success: true, filePath };
  });

  // --- Window Controls ---
  ipcMain.on("minimize-window", () => {
    windows.mainWindow?.minimize();
  });

  ipcMain.on("maximize-restore-window", () => {
    if (windows.mainWindow?.isMaximized()) {
      windows.mainWindow.restore();
    } else {
      windows.mainWindow?.maximize();
    }
  });

  ipcMain.on("close-window", () => {
    windows.mainWindow?.close();
  });

  // --- Folders & Paths ---
  ipcMain.handle("set-local-folder-for-game", async (_e, gameName) => {
    const games = store.get("games") || [];
    const idx = games.findIndex((g) => g.name === gameName);
    const prev = idx >= 0 && games[idx].localFolder ? games[idx].localFolder : require("electron").app.getPath("documents");
    const { canceled, filePaths } = await dialog.showOpenDialog(windows.mainWindow, {
      title: `Select save folder for: ${gameName}`,
      defaultPath: prev,
      properties: ["openDirectory", "createDirectory"],
    });
    if (canceled || !filePaths || !filePaths[0]) return null;
    const localFolder = filePaths[0];
    if (idx >= 0) {
      games[idx].localFolder = localFolder;
      store.set("games", games);
      return { localFolder };
    }
    return null;
  });

  ipcMain.handle("set-game-folder-for-game", async (_e, gameName) => {
    const games = store.get("games") || [];
    const idx = games.findIndex((g) => g.name === gameName);
    const prev = idx >= 0 && games[idx].gameFolder ? games[idx].gameFolder : require("electron").app.getPath("home");
    const { canceled, filePaths } = await dialog.showOpenDialog(windows.mainWindow, {
      title: `Select local game folder: ${gameName}`,
      defaultPath: prev,
      properties: ["openDirectory", "createDirectory"],
    });
    if (canceled || !filePaths || !filePaths[0]) return null;
    const gameFolder = filePaths[0];
    if (idx >= 0) {
      games[idx].gameFolder = gameFolder;
      store.set("games", games);
    }
    return { gameFolder };
  });

  ipcMain.handle("pick-game-exe-for-game", async (_e, gameName, startDir) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(windows.mainWindow, {
      title: `Select .exe file for ${gameName}`,
      defaultPath: startDir || undefined,
      properties: ["openFile"],
      filters: [{ name: "Windows Executable", extensions: ["exe"] }],
    });
    if (canceled || !filePaths || !filePaths[0]) return null;
    const exe = filePaths[0];
    const games = store.get("games") || [];
    const idx = games.findIndex((g) => g.name === gameName);
    if (idx >= 0) {
      games[idx].gameExe = exe;
      store.set("games", games);
    }
    return { exe };
  });

  ipcMain.handle("open-local-folder", async (_e, gameName) => {
    const games = store.get("games") || [];
    const g = games.find((x) => x.name === gameName);
    if (!g?.localFolder) throw new Error("Local folder not set");
    shell.openPath(g.localFolder);
    return true;
  });

  ipcMain.handle("open-game-folder", async (_e, gameName) => {
    const games = store.get("games") || [];
    const g = games.find((x) => x.name === gameName);
    if (!g?.gameFolder) throw new Error("Game folder not set");
    shell.openPath(g.gameFolder);
    return true;
  });

  ipcMain.handle("open-dropbox-folder", async (_e, gameName) => {
    if (!gameName) return false;
    const folderPath = getDropboxGameFolder(gameName);
    // The app name in Dropbox is determined by the productName in package.json
    const url = `https://www.dropbox.com/home/Apps/MirayaSaveSync${folderPath}`;
    shell.openExternal(url);
    return true;
  });

  // --- Game Process ---
  ipcMain.handle("get-running-state", (_e, gameName) => !!running.get(gameName));

  // Fungsi untuk memantau proses berdasarkan nama EXE
  async function monitorProcessByExeName(gameName, exeName, startTs) {
    // FIX: Dynamically import ps-list as it's an ESM module
    const { default: psList } = await import('ps-list');
    const checkInterval = 5000; // Cek setiap 5 detik
    let foundProcess = null;

    // Coba temukan proses selama 30 detik pertama
    for (let i = 0; i < 6; i++) {
      const processes = await psList({ all: false });
      foundProcess = processes.find(p => p.name.toLowerCase() === exeName.toLowerCase());
      if (foundProcess) {
        appendLog(gameName, `[MONITOR] Found and attached to process: ${exeName} (PID: ${foundProcess.pid})`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    if (!foundProcess) {
      appendLog(gameName, `[WARN] Could not find running process for ${exeName} after 30s. Auto-sync on close might not work.`);
      // Hentikan pemantauan jika proses tidak ditemukan
      running.delete(gameName);
      notifyProcess(gameName, false);
      return;
    }

    // Setelah ditemukan, pantau terus sampai prosesnya hilang
    const monitorHandle = setInterval(async () => {
      const currentProcesses = await psList({ all: false });
      const isStillRunning = currentProcesses.some(p => p.pid === foundProcess.pid);

      if (!isStillRunning) {
        appendLog(gameName, `[MONITOR] Process ${exeName} (PID: ${foundProcess.pid}) has exited.`);
        clearInterval(monitorHandle);
        onGameStopped(gameName, startTs, 0); // Asumsikan exit code 0
        running.delete(gameName);
      }
    }, checkInterval);

    // Simpan handle interval agar bisa dibersihkan jika perlu
    const runningEntry = running.get(gameName);
    if (runningEntry) {
      runningEntry.monitorHandle = monitorHandle;
    }
  }

  ipcMain.handle("run-game-exe", async (_e, gameName) => {
    const games = store.get("games") || [];
    const game = games.find((g) => g.name === gameName);
    if (!game) throw new Error("Game not found");
    if (!game.gameExe) throw new Error("No EXE selected");
    if (running.has(gameName)) return { exe: game.gameExe, already: true };

    appendLog(gameName, `[LAUNCH] Using shell to run: "${game.gameExe}"`);
    shell.openPath(game.gameExe);
    
    const startTs = Date.now();
    running.set(gameName, { startTs, process: null, monitorHandle: null });
    notifyProcess(gameName, true);
    appendLog(gameName, `[MONITOR] Starting to monitor for process...`);

    // Jalankan pemantauan di latar belakang tanpa menunggu
    monitorProcessByExeName(gameName, path.basename(game.gameExe), startTs);

    return { success: true, exe: game.gameExe };
  });

  ipcMain.handle("force-close-game", async (_e, gameName) => {
    const rec = running.get(gameName);
    if (!rec) return false;
 
    // Hentikan pemantauan jika ada
    if (rec.monitorHandle) {
      clearInterval(rec.monitorHandle);
    }

    // Logika lama untuk kill proses (jika ada) atau panggil onGameStopped
    if (rec.process && !rec.process.killed) {
      rec.process.kill(); // Ini akan memicu event 'close' yang sudah kita set
    } else {
      // Untuk Steam URL atau jika proses sudah mati, panggil secara manual
      onGameStopped(gameName, rec.startTs, 0); // Asumsikan exit code 0 untuk penutupan manual
    }
    running.delete(gameName);
    return { success: true };
  });

  // --- Sync ---
  ipcMain.handle("sync-game", async (_e, game) => {
    if (!game?.name) throw new Error("Invalid game");
    const localBase = game.localFolder;
    if (!localBase) throw new Error(`Set local folder first for "${game.name}"`);

    const result = await decideAndSync({
      game,
      gameName: game.name,
      localBase,
      remoteBase: getDropboxGameFolder(game.name),
      dropbox,
      store,
      appendLog,
      emitProgress,
    });

    if (result && !result.error) {
      const now = Date.now(); // Corrected from Date.Now()
      const games = store.get("games") || [];
      const gameIndex = games.findIndex(g => g.name === game.name);
      if (gameIndex !== -1) {
        games[gameIndex].lastSync = now;
        store.set("games", games);
      }
      const existingStats = await readGameStatFile(game.name);
      await writeGameStatFile(game.name, { ...existingStats, lastSync: now });
    }

    return result;
  });

  // --- Auth Server ---
  function startAuthServer() {
    // If a server is already running, close it first
    if (authServer && authServer.listening) {
      authServer.close(() => {
        console.log("[Auth] Previous auth server closed.");
        _startNewAuthServer();
      });
    } else {
      _startNewAuthServer();
    }
  }

  function _startNewAuthServer() {
    authServer = http.createServer(async (req, res) => {
      const { url } = req;
      if (url?.startsWith("/auth/callback")) {
        const query = new URLSearchParams(url.split("?")[1]);
        const code = query.get("code");
        if (code) {
          try {
            const tokenResponse = await fetch("https://api.dropboxapi.com/oauth2/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ code, grant_type: "authorization_code", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI }),
            });
            const tokenData = await tokenResponse.json();
            if (tokenResponse.ok) {
              store.set("access_token", tokenData.access_token);
              store.set("refresh_token", tokenData.refresh_token);
              store.set("expires_at", Date.now() + tokenData.expires_in * 1000);
              if (windows.mainWindow) {
                windows.mainWindow.webContents.send("access-token", tokenData.access_token);
              }
              res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
              res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Authentication Successful</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; color: #333; }
                    h1 { color: #4CAF50; }
                    p { color: #555; }
                  </style>
                </head>
                <body>
                  <h1>Authentication successful!</h1>
                  <p>This window will close automatically in 3 seconds.</p>
                </body>
                </html>
              `);
              // Server's job is done, close it.
              authServer.close(() => {
                console.log('[Auth] Server closed after successful authentication.');
              });
            } else {
              console.error("[Auth] Error getting token:", tokenData);
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end("<h1>Error during authentication. Please try again.</h1>");
              authServer.close();
            }
          } catch (e) {
            console.error("[Auth] Exception:", e);
            res.writeHead(500, { "Content-Type": "text/html" });
            res.end("<h1>Internal server error. Please try again later.</h1>");
            authServer.close();
          }
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>Invalid request. Please try again.</h1>");
          authServer.close();
        }
      } else {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>Not found</h1>");
        authServer.close();
      }
    });

    authServer.listen(4567, "127.0.0.1", () => {
      const authUrl = `https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&token_access_type=offline&force_reapprove=true`;
      shell.openExternal(authUrl);
    });
  }

  ipcMain.on("start-auth-server", () => startAuthServer());
}

module.exports = { registerIpcHandlers };
