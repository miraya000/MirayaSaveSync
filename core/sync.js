// core/sync.js
const path = require("path");
const fs = require("fs");
const { canonicalKey, walkLocalFiles, computeDropboxContentHashLocal } = require("./fsutil");

/* ---------------- Helpers ---------------- */
function posixJoin(...segs) {
  return segs
    .filter((s) => s !== undefined && s !== null && s !== "")
    .map((s) => String(s).replace(/\\/g, "/"))
    .join("/")
    .replace(/\/+/g, "/");
}

async function fsSafeWrite(full, buf) {
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, buf);
}
async function touchMtime(full, mtimeMs) {
  const d = new Date(mtimeMs);
  await fs.promises.utimes(full, d, d);
}

/** snapshot helpers (key disimpan dlm canonical lower) */
function getSnap(store, gameName) {
  const slug = gameName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return store.get(`snap_${slug}`) || { ts: 0, files: {} };
}
function saveSnap(store, gameName, filesMap) {
  const slug = gameName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const files = {};
  for (const [k, v] of filesMap) files[k] = { hash: v.content_hash, size: v.size || 0 };
  store.set(`snap_${slug}`, { ts: Date.now(), files });
}

/* --------------- Synchronization (local → remote) --------------- */
/**
 * Aturan:
 * - File ada di lokal tapi tidak identik di remote → UPLOAD (overwrite).
 * - File ada di remote tapi tidak ada di lokal → DELETE di remote.
 * - Identik (hash & size sama) → SKIP.
 */
async function syncOneDirection({ gameName, localBase, remoteBase, dropbox, store, appendLog, emitProgress }) {
  appendLog(gameName, `▶ SYNC START`);
  appendLog(gameName, `  local='${localBase}'  remote='${remoteBase}'`);

  // Scan lokal
  const localList = await (async () => {
    try { return await walkLocalFiles(localBase); } catch { return []; }
  })();

  // Scan remote (aktif saja, tanpa deleted)
  const { files: remoteMap } = await dropbox.listRecursive(remoteBase);

  // Build peta lokal
  const localMap = new Map(); // keyLower -> { relOrig, full, size, hash }
  for (const full of localList) {
    const relOrig = path.relative(localBase, full).replace(/\\/g, "/");
    const st = await fs.promises.stat(full);
    const hash = await computeDropboxContentHashLocal(full);
    localMap.set(canonicalKey(relOrig), { relOrig, full, size: st.size, hash });
  }

  // Rencanakan operasi
  const uploads = [];
  const deletes = [];
  let skipped = 0;

  // Upload / Skip
  for (const [key, L] of localMap) {
    const R = remoteMap.get(key);
    if (!R || R.content_hash !== L.hash || R.size !== L.size) {
      uploads.push({ key, L });
    } else {
      skipped++;
    }
  }
  // Delete di remote untuk file yang gak ada di lokal
  for (const [key, R] of remoteMap) {
    if (!localMap.has(key)) {
      deletes.push({ key, R });
    }
  }

  const totalOps = uploads.length + deletes.length;
  appendLog(gameName, `  plan: ↑${uploads.length} ␡${deletes.length} (skip ${skipped})`);
  emitProgress(gameName, 0, totalOps, "start", "");

  // Eksekusi
  let completedOps = 0;

  // --- Concurrent Uploads ---
  const CONCURRENT_UPLOADS = 4;
  const uploadPromises = [];
  for (const it of uploads) {
    const p = async () => {
      const remotePath = posixJoin(remoteBase, "/", it.L.relOrig);
      const buf = await fs.promises.readFile(it.L.full);
      await dropbox.uploadSmall(remotePath, buf);
      appendLog(gameName, `  [UPLOAD] ${it.L.relOrig}`);
      completedOps++;
      emitProgress(gameName, completedOps, totalOps, "upload", it.L.relOrig);
    };
    uploadPromises.push(p());
    if (uploadPromises.length >= CONCURRENT_UPLOADS) {
      await Promise.all(uploadPromises);
      uploadPromises.length = 0;
    }
  }
  await Promise.all(uploadPromises); // Wait for remaining uploads

  // --- Batch Deletes ---
  if (deletes.length > 0) {
    const pathsToDelete = deletes.map(it => it.R.path_lower);
    appendLog(gameName, `  [REMOTE-DEL] Deleting ${pathsToDelete.length} files in a batch...`);
    emitProgress(gameName, completedOps, totalOps, "delete", `Batch deleting ${pathsToDelete.length} files...`);
    await dropbox.deleteBatch(pathsToDelete);
    completedOps += pathsToDelete.length;
    emitProgress(gameName, completedOps, totalOps, "delete", `Batch deleting ${pathsToDelete.length} files...`);
  }

  // Simpan snapshot remote terbaru (opsional, untuk analitik/ke depan)
  const after = await dropbox.listRecursive(remoteBase);
  saveSnap(store, gameName, after.files);

  appendLog(gameName, `✔ SYNC DONE ↑${uploads.length} ␡${deletes.length} (skip ${skipped})`);
  emitProgress(gameName, totalOps, totalOps, "done", "", true);

  return {
    time: Date.now(),
    uploaded: uploads.length,
    downloaded: 0,
    deletedRemote: deletes.length,
    skipped,
    bootstrap: false,
  };
}

/* --------------- Wrapper: decideAndSync --------------- */
async function decideAndSync(opts) {
  // Satu mode saja — jalankan syncOneDirection
  return await syncOneDirection(opts);
}

module.exports = { decideAndSync, syncOneDirection };
