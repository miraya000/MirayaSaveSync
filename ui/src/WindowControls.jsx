import React, { useState, useEffect } from 'react';
import './WindowControls.css';

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Optional: Listen for window maximize/unmaximize events to update button icon
    // This would require additional IPC from main process to renderer
    // For now, we'll assume the button toggles correctly.
  }, []);

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximizeRestore = () => {
    if (window.electronAPI) {
      window.electronAPI.maximizeRestoreWindow();
      // In a real app, you'd get the actual state from main process
      setIsMaximized(!isMaximized); 
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  };

  const handleHideToTray = () => {
    if (window.electronAPI) {
      window.electronAPI.hideToTray();
    }
  };

  return (
    <div className="window-controls-container">
      <div className="window-title">Miraya Save Sync</div>
      <div className="window-buttons">
        <button onClick={handleHideToTray} className="window-control-button hide-button" title="Hide to Tray">
          <svg viewBox="0 0 10 10"><path d="M 0,5 10,5 10,6 0,6 Z" transform="rotate(90 5 5)" /></svg>
        </button>
        <button onClick={handleMinimize} className="window-control-button minimize-button">
          <svg viewBox="0 0 10 10"><path d="M0,5 L10,5 L10,6 L0,6 Z" /></svg>
        </button>
        <button onClick={handleMaximizeRestore} className="window-control-button maximize-restore-button" title={isMaximized ? "Restore" : "Maximize"}>
          {isMaximized ? 
            <svg viewBox="0 0 10 10"><path d="m 2,1e-5 0,2 -2,0 0,8 8,0 0,-2 2,0 0,-8 z m 1,1 6,0 0,6 -1,0 0,-5 -5,0 z m -2,2 6,0 0,6 -6,0 z" /></svg> : 
            <svg viewBox="0 0 10 10"><path d="M 0,0 0,10 10,10 10,0 Z M 1,1 9,1 9,9 1,9 Z" /></svg>
          }
        </button>
        <button onClick={handleClose} className="window-control-button close-button" title="Close">
          <svg viewBox="0 0 10 10">
            <polygon points="10.2,0.7 9.5,0 5.1,4.4 0.7,0 0,0.7 4.4,5.1 0,9.5 0.7,10.2 5.1,5.8 9.5,10.2 10.2,9.5 5.8,5.1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default WindowControls;