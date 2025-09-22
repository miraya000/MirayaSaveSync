import { useEffect, useState } from "react";
import GameLibrary from "./GameLibrary";
import GameDetail from "./GameDetail";
import LoginPage from "./LoginPage";
import WindowControls from "./WindowControls"; // Import WindowControls
import Copyright from "./Copyright";
import "./WindowControls.css"; // Import WindowControls styles

export default function App() {
  const [token, setToken] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if electronAPI is available (running in Electron)
    console.log("[App] useEffect started. Checking for token...");
    if (window.electronAPI) {
      // Check existing token on startup
      window.electronAPI.getToken().then((t) => {
        console.log("[App] getToken resolved with:", t ? "a token" : "null");
        setToken(t);
        setIsCheckingAuth(false);
      }).catch(() => {
        console.error("[App] getToken rejected. Assuming no token.");
        setIsCheckingAuth(false);
      });
      
      // Listen for new tokens
      const cleanup = window.electronAPI.onAccessToken((t) => {
        console.log("[App] onAccessToken received:", t ? "a token" : "null");
        setToken(t);
        setIsCheckingAuth(false);
      });
      
      return () => {
        if (typeof cleanup === "function") cleanup();
      };
    } else {
      console.warn("[App] Electron API not found. Running in browser mode.");
      // Running in browser - set a dummy token for development
      setToken("browser-dev-token");
      setIsCheckingAuth(false);
    }
  }, []);

  const handleLoginSuccess = (newToken) => {
    console.log("[App] Login successful.");
    setToken(newToken);
    setIsCheckingAuth(false);
  };

  const handleLogout = () => {
    if (window.electronAPI) {
      window.electronAPI.clearToken();
    }
    console.log("[App] Logout initiated.");
    setToken(null);
    setSelectedGame(null); // Reset selected game on logout
  };

  // Show loading while checking authentication
  console.log(`[App] Rendering: isCheckingAuth=${isCheckingAuth}, token=${!!token}, selectedGame=${!!selectedGame}`);
  if (isCheckingAuth) {
    return (
      <div className="app-container" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <WindowControls /> {/* Render WindowControls */}
        <Copyright />
        <div style={{ color: 'white', fontSize: '18px' }}>Loading...</div>
      </div>
    );
  }

  let content;
  if (!token) {
    content = <LoginPage onLoginSuccess={handleLoginSuccess} />;
  } else if (selectedGame) {
    content = (
      <GameDetail
        key={selectedGame.name} // force fresh mount
        initialGame={selectedGame}
        onBack={() => setSelectedGame(null)}
      />
    );
  } else {
    content = (
      <GameLibrary
        onSelectGame={(g) => setSelectedGame({ ...g })} // pass a clean object
        isActive={!selectedGame}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="app-container">
      <WindowControls />
      <Copyright />
      {content}
    </div>
  );
}
