const fs = require("fs");
const path = require("path");

function getGameStatsPath(app) {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "game-stats.json");
}

function loadGameStats(app) {
  try {
    const statsPath = getGameStatsPath(app);
    if (fs.existsSync(statsPath)) {
      const data = fs.readFileSync(statsPath, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("[Stats] Error loading game stats:", e.message);
  }
  return {};
}

module.exports = {
  getGameStatsPath,
  loadGameStats,
  // Tambahkan fungsi lain seperti saveGameStatsToJson, upload/download JSON, dll
};