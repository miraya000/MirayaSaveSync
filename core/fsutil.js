// core/fsutil.js
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

function canonicalKey(rel) {
  return String(rel).replace(/\\/g, "/").replace(/\/+/g, "/").toLowerCase();
}

async function walkLocalFiles(baseDir) {
  const result = [];
  async function recur(dir) {
    const items = await fsp.readdir(dir, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) await recur(full);
      else result.push(full);
    }
  }
  await recur(baseDir);
  return result;
}

async function computeDropboxContentHashLocal(filePath) {
  const CHUNK = 4 * 1024 * 1024; // 4 MB
  return await new Promise((resolve, reject) => {
    const rs = fs.createReadStream(filePath, { highWaterMark: CHUNK });
    const blocks = [];
    rs.on("data", (buf) => {
      const h = crypto.createHash("sha256");
      h.update(buf);
      blocks.push(h.digest());
    });
    rs.on("end", () => {
      const final = crypto.createHash("sha256")
        .update(Buffer.concat(blocks))
        .digest("hex");
      resolve(final);
    });
    rs.on("error", reject);
  });
}

module.exports = {
  canonicalKey,
  walkLocalFiles,
  computeDropboxContentHashLocal,
};
