import { useEffect, useMemo, useState, useCallback } from "react";
import "./GameDetail.css";
import CircularLoader from "./CircularLoader";
import ConfirmModal from "./ConfirmModal";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// Helper outside component if it doesn't depend on component state
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function GameDetail({ initialGame, onBack }) {
  const [gameData, setGameData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, action: "", file: "", done: false });
  const [accent, setAccent] = useState("#7b5eff");
  const [isRunning, setIsRunning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [syncAfterRun, setSyncAfterRun] = useState(false);

  const gameName = initialGame.name; // Keep name stable for hooks

  const refreshData = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const data = await window.electronAPI.getGameDetails(gameName);
      setGameData(data);
    } catch (e) {
      console.error("Failed to fetch game details:", e);
      alert("Error fetching game details: " + e.message);
    }
  }, [gameName]);

  const doSync = useCallback(async () => {
    if (!window.electronAPI || !gameData) return false;
    setBusy(true);
    setSummary(null);
    setProgress({ current: 0, total: 0, action: "", file: "", done: false });
    try {
      const res = await window.electronAPI.syncGame(gameData);
      setSummary(res);
      await refreshData();
      return true;
    } catch (e) {
      alert("Sync error: " + e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [gameData, refreshData]);

  useEffect(() => {
    refreshData();
    let mounted = true;

    (async () => {
      if (!window.electronAPI) return;
      const saved = await window.electronAPI.getLogs(gameName);
      if (mounted) setLogs(Array.isArray(saved) ? saved : []);
    })();

    const unsubLog = window.electronAPI?.onSyncLog?.((payload) => {
      if (payload?.game !== gameName) return;
      setLogs(prev => [...prev, { ts: payload.ts, line: payload.line }].slice(-3000));
    });

    return () => {
      mounted = false;
      if (unsubLog) unsubLog();
    };
  }, [gameName]);

  // Separate effect for progress bar, as it doesn't depend on refreshData
  useEffect(() => {
    if (!window.electronAPI?.onSyncProgress) return;
    const unsubProgress = window.electronAPI.onSyncProgress((payload) => {
      if (payload?.game !== gameName) return;
      setProgress({
        current: payload.current ?? 0,
        total: payload.total ?? 0,
        action: payload.action || "",
        file: payload.file || "",
        done: !!payload.done
      });
    });
    return () => { if (unsubProgress) unsubProgress(); };
  }, [gameName]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!window.electronAPI) return;
      try {
        const r = await window.electronAPI.getRunningState(gameName);
        if (mounted) setIsRunning(!!r);
      } catch {}
    })();

    const off = window.electronAPI?.onGameProcess?.(async (p) => {
      if (p?.game !== gameName) return;
      setIsRunning(!!p.running);
      if (!p.running) {
        await refreshData();
        if (syncAfterRun) {
          setSyncAfterRun(false);
          doSync();
        }
      }
    });

    return () => { mounted = false; if (off) off(); };
  }, [gameName, syncAfterRun, doSync, refreshData]);

  useEffect(() => {
    const url = gameData?.cover || "/cover_placeholder.png";
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 32; c.height = 32;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const R = data[i], G = data[i + 1], B = data[i + 2];
          const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
          if (lum < 30 || lum > 235) continue;
          r += R; g += G; b += B; count++;
        }
        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          setAccent(`rgb(${r}, ${g}, ${b})`);
          return;
        }
      } catch {}
      const h = hashHue(gameData?.name || '');
      setAccent(`hsl(${h} 82% 58%)`);
    };
    img.onerror = () => {
      const h = hashHue(gameData?.name || '');
      setAccent(`hsl(${h} 82% 58%)`);
    };
    img.src = url;
  }, [gameData?.cover, gameData?.name]);

  function hashHue(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  const summaryText = useMemo(() => {
    if (!summary) return "—";
    const { uploaded = 0, downloaded = 0, skipped = 0, deletedRemote = 0 } = summary;
    return `↑${uploaded} ↓${downloaded} ~${skipped} ␡${deletedRemote}`;
  }, [summary]);

  async function runOrClose() {
    if (!gameData) return;
    if (!isRunning) {
      if (busy) return;
      if (!gameData.localFolder) {
        alert("Please set local save folder first before running the game.");
        return;
      }
      setSyncAfterRun(true); // Set flag untuk sync setelah game ditutup
      const synced = await doSync();
      if (!synced) {
        setSyncAfterRun(false); // Batalkan jika sync awal gagal
        return;
      }
      try {
        await window.electronAPI.runGameExe(gameName);
      } catch (e) {
        setSyncAfterRun(false);
        alert("Run game error: " + e.message);
      }
    } else {
      // Ini sekarang berfungsi sebagai "Saya Selesai Bermain"
      // atau "Force Quit" jika game macet.
      await window.electronAPI.forceCloseGame(gameName); // Ini akan memicu event 'close' di backend
    }
  }

  async function handleConfirmDelete() {
    if (!gameData) return;
    await window.electronAPI.setGames((await window.electronAPI.getGames()).filter(g => g.name !== gameName));
    await window.electronAPI.clearLogs(gameName);
    onBack();
  }

  async function copyLogs() {
    if (logs.length === 0) return;
    const textToCopy = logs
      .map(l => `[${new Date(l.ts).toLocaleTimeString()}] ${l.line}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(textToCopy);
      // Optional: Beri notifikasi singkat bahwa copy berhasil
    } catch (err) {
      console.error('Failed to copy logs: ', err);
    }
  }

  function deleteGame() {
    setShowDeleteConfirm(true);
  }

  async function exportLogs() {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.exportLogs(gameName);
    } catch (e) {
      alert('Error exporting logs: ' + e.message);
    }
  }

  if (!gameData) {
    return <CircularLoader />;
  }

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return format(new Date(dateString), "d MMM yyyy, HH:mm:ss", { locale: id });
  };

  const computedRemote = `/${slugify(gameData.name)}/saved-data`;
  const maskForDisplay = (p) => !p ? "—" : String(p).replace(/^%USERPROFILE%/i, "C:\\Users\\<username>").replace(/^%ONEDRIVE%/i, "C:\\Users\\<username>\\OneDrive");

  return (
    <div className="detail detail-theme" style={{ "--ac": accent, paddingTop: '50px' }}>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={`Delete "${gameName}"?`}
        message="This will only remove the game from the library. Your local and Dropbox save files will not be deleted."
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Delete"
      />

      <header className="detail-header glass">
        <button className="btn-ghost back" onClick={onBack} title="Back"> ← Back </button>
        <div className="head-title"> <div className="name">{gameData.name}</div> </div>
        <div className="head-actions"> <span className="badge" title="Last Sync Summary">{summaryText}</span> </div>
      </header>

      <main className="detail-main">
        <section className="hero glass">
          <div className="cover-wrap card-neo">
            <img
              className="cover-img"
              src={gameData.cover || "/cover_placeholder.png"}
              alt={gameData.name}
              onError={(e) => (e.currentTarget.src = "/cover_placeholder.png")}
            />
          </div>
          <div className="meta">
            <div className="meta-line">
              <span className="label">Save Folder</span>
              <div className="value-group">
                <div className="value ellipsis" title={maskForDisplay(gameData.localFolder)}>{maskForDisplay(gameData.localFolder)}</div>
                <div className="meta-actions">
                  <button className="btn-secondary sm" onClick={() => window.electronAPI.setLocalFolderForGame(gameName).then(refreshData)}>Change</button>
                  <button className="btn-ghost sm" onClick={() => window.electronAPI.openLocalFolder(gameName)}>Open</button>
                  <button className="btn-ghost sm" onClick={() => window.electronAPI.openDropboxFolder(gameName)}>Dropbox</button>
                </div>
              </div>
            </div>
            <div className="meta-line">
              <span className="label">Game Folder</span>
              <div className="value-group">
                <div className="value ellipsis" title={maskForDisplay(gameData.gameFolder)}>{maskForDisplay(gameData.gameFolder) || "Not Set"}</div>
                <div className="meta-actions">
                  <button className="btn-secondary sm" onClick={() => window.electronAPI.setGameFolderForGame(gameName).then(refreshData)}>Change</button>
                  <button className="btn-ghost sm" onClick={() => window.electronAPI.openGameFolder(gameName)}>Open</button>
                </div>
              </div>
            </div>
            <div className="meta-line">
              <span className="label">Game EXE</span>
              <div className="value-group">
                <div className="value ellipsis" title={maskForDisplay(gameData.gameExe)}>{maskForDisplay(gameData.gameExe) || "Not Set"}</div>
                <div className="meta-actions">
                  <button className="btn-secondary sm" onClick={() => window.electronAPI.pickGameExeForGame(gameName, gameData.gameFolder).then(refreshData)}>Change</button>
                </div>
              </div>
            </div>
            <div className="meta-line"> <span className="label">Last Played</span> <div className="value"> {formatDate(gameData.lastPlayed)} </div> </div>
            <div className="meta-line"> <span className="label">Total Play</span> <div className="value"> {gameData.totalMinutes || 0} minutes </div> </div>
            <div className="meta-line"> <span className="label">Last Sync</span> <div className="value">{formatDate(gameData.lastSync)}</div> </div>
          </div>
        </section>

        <section className="quick-actions glass">
          <div className="qa-grid">
            <button className={isRunning ? "qa-btn close" : "qa-btn primary"} onClick={runOrClose} disabled={!isRunning && busy}>{isRunning ? "GAME ON" : busy ? "Syncing..." : "RUN GAME"}</button>
            <button className="qa-btn" onClick={doSync} disabled={busy || !gameData.localFolder}>{busy ? "Syncing..." : "Sync"}</button>
            <button className="qa-btn" onClick={exportLogs}>Export Log</button>
            <button className="qa-btn danger" onClick={deleteGame}>Delete Game</button>
          </div>
        </section>

        <section className="console glass">
          <div className="console-head">
            <div className="title">Sync Console</div>
            <div className="actions">
              <button className="btn-ghost sm" onClick={copyLogs}>Copy</button>
              <button className="btn-ghost sm" onClick={() => window.electronAPI.clearLogs(gameName).then(() => setLogs([]))}>Clear</button>
            </div>
          </div>
          <div className="console-body">
            {logs.length === 0 ? (
              <div className="console-empty">No logs yet…</div>
            ) : (
              [...logs].reverse().map((l, i) => (
                <div key={i} className="line">
                  <span className="ts">[{new Date(l.ts).toLocaleTimeString()}]</span> <span className="msg">{l.line}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="progress glass">
          <div className="progress-info">
            {progress.done ? "Sync complete" : progress.total > 0 ? `${progress.action || "…"} ${progress.current}/${progress.total}` : "Idle"}
            {progress.file ? <span className="file"> {progress.file}</span> : null}
          </div>
          <div className="bar">
            <div className="fill" style={{ width: progress.total > 0 ? `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%` : "0%" }} />
          </div>
        </section>
      </main>
    </div>
  );
}
