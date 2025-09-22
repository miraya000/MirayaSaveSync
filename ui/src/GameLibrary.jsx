import { useEffect, useRef, useState, useMemo } from "react";
import "./GameLibrary.css";
import StarBorder from "./StarBorder";

const RAWG_KEY = "138aaa5a2609466da35619046c387b2f";

export default function GameLibrary({ onSelectGame, onLogout, isActive }) {
  const [games, setGames] = useState([]);
  const [newGameName, setNewGameName] = useState("");
  const [adding, setAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [gridCols, setGridCols] = useState(() => {
    const saved = Number(localStorage.getItem("gridCols") || 5);
    return Math.min(10, Math.max(2, isNaN(saved) ? 5 : saved));
  });
  const inputRef = useRef(null);
  const [user, setUser] = useState(null);

  const maskForDisplay = (p) =>
    !p
      ? ""
      : String(p)
          .replace(/^%USERPROFILE%/i, "C:\\Users\\<username>")
          .replace(/^%ONEDRIVE%/i, "C:\\Users\\<username>\\OneDrive");

  const normalized = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");
  const isValidGame = (g) =>
    g && typeof g === "object" && typeof g.name === "string" && g.name.trim() !== "";

  // Load + sanitasi dari store
  useEffect(() => {
    let alive = true;

    async function loadUser() {
      if (window.electronAPI?.getDropboxUser) {
        const userInfo = await window.electronAPI.getDropboxUser();
        if (alive) {
          setUser(userInfo);
        }
      }
    }

    async function loadGames() {
      if (!window.electronAPI) {
        // Running in browser - use mock data for testing
        const mockGames = [
          { name: "Test Game 1", cover: "/cover_placeholder.png", localFolder: "%USERPROFILE%/Documents/My Games/Test Game 1", gameFolder: "C:/Program Files/Test Game 1", gameExe: "TestGame1.exe", remoteBase: "/test-game-1", lastPlayed: Date.now() - 86400000, totalMinutes: 120 },
          { name: "Test Game 2", cover: "/cover_placeholder.png", localFolder: "%USERPROFILE%/Documents/My Games/Test Game 2", gameFolder: "C:/Program Files/Test Game 2", gameExe: "TestGame2.exe", remoteBase: "/test-game-2", lastPlayed: Date.now() - 172800000, totalMinutes: 240 }
        ];
        setGames(mockGames);
        setLoaded(true);
        return;
      }
      
      const saved = await window.electronAPI.getGames();
      if (!alive) return;

      const raw = Array.isArray(saved) ? saved : [];
      const cleaned = raw
        .filter(isValidGame)
        .map((g) => ({
          name: g.name.trim(),
          cover: g.cover && typeof g.cover === "string" && g.cover.trim() !== "" ? g.cover : "/cover_placeholder.png",
          localFolder: g.localFolder || "",
          remoteBase: g.remoteBase || "",
          gameFolder: g.gameFolder || "",
          gameExe: g.gameExe || "",
          lastPlayed: g.lastPlayed || null,
          totalMinutes: typeof g.totalMinutes === "number" ? g.totalMinutes : 0,
          lastSync: g.lastSync || null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setGames(cleaned);
      setLoaded(true);

      if (JSON.stringify(raw) !== JSON.stringify(cleaned)) {
        if (window.electronAPI) {
          window.electronAPI.setGames(cleaned);
        }
      }
    }

    function handleFocus() {
      inputRef.current?.focus(); // Focus the input
      loadGames(); // And reload games
    }

    handleFocus(); // Initial load and focus
    loadUser();
    window.addEventListener("focus", handleFocus);

    return () => {
      alive = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      // Use a short timeout to ensure the focus is set after any other
      // potential focus-stealing events have completed.
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  async function addGame(nameRaw) {
    const name = nameRaw.trim();
    if (!name) return;

    // Cegah duplikat (case-insensitive)
    if (games.some((g) => normalized(g.name) === normalized(name))) {
      setNewGameName("");
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    setAdding(true);
    try {
      const res = await fetch(
        `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(name)}`
      );
      const data = await res.json();

      let cover = "/cover_placeholder.png";
      if (data?.results?.length > 0) {
        cover = data.results[0]?.background_image || cover;
      }

      const next = [
        ...games,
        {
          name,
          cover,
          localFolder: "",
          remoteBase: "",
          gameFolder: "",
          gameExe: "",
          lastPlayed: null,
          totalMinutes: 0,
        },
      ].sort((a, b) => a.name.localeCompare(b.name));
      setGames(next);
      if (loaded) {
        if (window.electronAPI) {
          window.electronAPI.setGames(next);
        }
      }
    } catch {
      const next = [
        ...games,
        {
          name,
          cover: "/cover_placeholder.png",
          localFolder: "",
          remoteBase: "",
          gameFolder: "",
          gameExe: "",
          lastPlayed: null,
          totalMinutes: 0,
        },
      ].sort((a, b) => a.name.localeCompare(b.name));
      setGames(next);
      if (loaded) {
        if (window.electronAPI) {
          window.electronAPI.setGames(next);
        }
      }
    } finally {
      setNewGameName("");
      setAdding(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!adding) addGame(newGameName);
  }

  // ▶ Jalankan game langsung dari Library (ikon play di cover)
  async function runGame(game) {
    if (!window.electronAPI?.runGameExe) return;
    try {
      await window.electronAPI.runGameExe(game.name);
    } catch (e) {
      alert("Run game error: " + e.message);
    }
  }

  // Grid stepper
  function setCols(n) {
    const v = Math.min(10, Math.max(2, Number(n) || 5));
    setGridCols(v);
    localStorage.setItem("gridCols", String(v));
  }
  const incCols = () => setCols(gridCols + 1);
  const decCols = () => setCols(gridCols - 1);

  // Tooltip kartu
  const titleFor = useMemo(
    () => (g) =>
      `${g.name}${
        g.localFolder
          ? `\nSave: ${maskForDisplay(g.localFolder)}`
          : "\nSave folder belum diset"
      }`,
    []
  );

  return (
    <div className="library-theme">
      <div className="glow glow-a"></div>
      <div className="glow glow-b"></div>
      <header className="lib-header glass">
        <div className="brand">
          <span className="brand-logo"></span>
          <div className="brand-text">
            <div className="brand-top">Game Library</div>
            {/*<div className="brand-sub">Game Library</div>*/}
          </div>
        </div>

        {/* FORM ADD */}
        <form className="add-form" onSubmit={onSubmit}>
          <div className="input-pill">
            <svg viewBox="0 0 24 24" className="ic" aria-hidden="true">
              <path d="M21 21l-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
            </svg>
            <input
              ref={inputRef}
              className="add-input"
              type="text"
              placeholder="Add game… (Ctrl+N)"
              value={newGameName}
              onChange={(e) => setNewGameName(e.target.value)}
              disabled={adding}
              autoFocus
            />
            <button
              className="pill-btn"
              type="submit"
              disabled={adding || !newGameName.trim()}
              title="Add game"
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
        </form>

        <div className="toolbar">
          <div className="grid-stepper" role="group" aria-label="Grid per baris">
            <span className="label">Grid</span>
            <button
              type="button"
              className="step"
              title="Kurangi kolom (Ctrl -)"
              onClick={decCols}
              disabled={gridCols <= 2}
            >
              –
            </button>
            <div className="value" title="Jumlah kolom">
              {gridCols}
            </div>
            <button
              type="button"
              className="step"
              title="Add column (Ctrl +)"
              onClick={incCols}
              disabled={gridCols >= 10}
            >
              +
            </button>
          </div>

          <div className="login-badge">
            <span className="login-badge-main">Logged As</span>
            <span className="login-badge-sub" title={user?.email}>
              {user?.email || "..."}
            </span>
          </div>
          <button className="btn-ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main
        className="game-grid"
        style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
      >
        {/* Kartu Add */}
        <div
          className="game-card add-card glass"
          onClick={() => inputRef.current?.focus()}
          role="button"
          tabIndex={0}
          title="Add game"
        >
          <div className="add-mark">＋</div>
          <div className="game-title">Add Game</div>
        </div>

        {games.length === 0 ? (
          <div className="empty-state glass">
            <div className="empty-emoji">📁</div>
            <div className="empty-title">No games yet</div>
            <div className="empty-sub">Add games from the column above.</div>
          </div>
        ) : (
          games.map((g, idx) => (
            <StarBorder
              key={`${g.name}-${idx}`}
              as="button"
              className={`game-card card-neo fade-in`}
              color="cyan"
              speed="5s"
              style={{
                "--ac": `hsl(${(idx * 37) % 360} 82% 58%)`,
                animationDelay: `${idx * 60}ms`
              }}
              onClick={() => onSelectGame(g)}
              title={titleFor(g)}
            >
              {/* Nama game di atas cover */}
              <div className="game-title-on-cover">{g.name}</div>
              <div className="card-media no-bg">
                <img
                  src={g.cover || "/cover_placeholder.png"}
                  alt={g.name}
                  className="media-img full"
                  onError={(e) => (e.currentTarget.src = "/cover_placeholder.png")}
                />
                <span
                  className={`status-dot ${g.localFolder ? "ok" : "muted"}`}
                  title={g.localFolder ? "Save folder set" : "Save folder belum diset"}
                />
              </div>
            </StarBorder>
          ))
        )}
      </main>
    </div>
  );
}
