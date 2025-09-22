﻿﻿﻿import { useState } from "react";
import "./LoginPage.css";
import Threads from "./Threads";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function login() {
    setIsLoading(true);
    setError(null);
    if (!window.electronAPI?.startAuth) {
      setError("Electron API tidak tersedia");
      setIsLoading(false);
      return;
    }
    window.electronAPI.startAuth();
  }

  return (
    <div className="login-page" style={{ paddingTop: '94px' }}>
      <Threads
        className="login-bg-threads"
        color={[0.23, 0.51, 0.96]}
        amplitude={0.6}
        distance={0.3}
        enableMouseInteraction={true}
      />
      <div className="glow glow-a"></div>
      <div className="glow glow-b"></div>
      <div className="login-container">
        <div className="login-brand">
          <div className="login-logo"></div>
          <h1 className="login-title">MIRAYA SAVE SYNC</h1>
          <p className="login-subtitle">Game Library</p>
        </div>
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}
        <button className="login-button" onClick={login} disabled={isLoading}>
          {isLoading ? (
            <>
              <div className="spinner"></div>
              <span>Connecting...</span>
            </>
          ) : (
            <span>Login with Dropbox</span>
          )}
        </button>
      </div>
    </div>
  );
}
