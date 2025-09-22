// core/dropbox.js
const fetch = require("node-fetch");
const path = require("path");

let getAccessToken = null;

function init(getTokenFn) {
  getAccessToken = getTokenFn;
}

const posixJoin = (...segs) =>
  segs
    .filter((s) => s !== undefined && s !== null && s !== "")
    .map((s) => String(s).replace(/\\/g, "/"))
    .join("/")
    .replace(/\/+/g, "/");

async function ensureFolder(token, folderPath) {
  await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: folderPath, autorename: false }),
  });
}

async function ensureParentDirs(token, fullPath) {
  const dir = path.posix.dirname(fullPath);
  if (dir === "/" || dir === ".") return;
  const parts = dir.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur = posixJoin(cur, "/", p);
    try { await ensureFolder(token, cur); } catch {}
  }
}

async function listRecursive(basePath) {
  const token = getAccessToken();
  try { await ensureFolder(token, basePath); } catch {}

  const out = [];
  let hasMore = true;
  let cursor = null;

  async function callList(url, bodyObj) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
    if (!resp.ok) throw new Error("Dropbox list error: " + (await resp.text()));
    return resp.json();
  }

  let data = await callList("https://api.dropboxapi.com/2/files/list_folder", {
    path: basePath,
    recursive: true,
    include_deleted: false,
  });
  out.push(...data.entries);
  hasMore = data.has_more;
  cursor = data.cursor;

  while (hasMore) {
    const d = await callList("https://api.dropboxapi.com/2/files/list_folder/continue", { cursor });
    out.push(...d.entries);
    hasMore = d.has_more;
    cursor = d.cursor;
  }

  // files: canonicalKey -> { path_lower, path_display, relLower, relDisplay, content_hash, size, server_modified(ms) }
  // folders: Set<relLower>
  const files = new Map();
  const folders = new Set();

  const baseLower = basePath.toLowerCase();
  const baseDisp = basePath;

  function relOf(p, base) {
    let rel = p.startsWith(base) ? p.slice(base.length) : p;
    return rel.replace(/^\/+/, "");
    }

  for (const e of out) {
    if (e[".tag"] === "file") {
      const relLower = relOf(e.path_lower, baseLower);
      const relDisplay = relOf(e.path_display || e.path_lower, baseDisp);
      files.set(relLower, {
        path_lower: e.path_lower,
        path_display: e.path_display || e.path_lower,
        relLower,
        relDisplay,
        content_hash: e.content_hash || null,
        size: e.size,
        server_modified: new Date(e.server_modified).getTime(),
      });
    } else if (e[".tag"] === "folder") {
      const relLower = relOf(e.path_lower, baseLower);
      if (relLower) folders.add(relLower);
    }
  }

  return { files, folders };
}

/**
 * Listing yang juga mengembalikan set file yang TERHAPUS di remote (tombstone),
 * via `include_deleted: true`. Tidak pakai cursor (sederhana & cukup untuk save-folder).
 * 
 * Return:
 * - files: Map<relLower, { path_lower, relDisplay, content_hash, size, server_modified }>
 * - deleted: Set<relLower>  (path yg di-DELETE di Dropbox)
 */
async function listWithDeletedRecursive(basePath) {
  const token = await getAccessToken();
  try { await ensureFolder(token, basePath); } catch {}

  const entries = [];
  let hasMore = true;
  let cursor = null;

  async function callList(url, bodyObj) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
    if (!resp.ok) throw new Error("Dropbox list error: " + (await resp.text()));
    return resp.json();
  }

  let data = await callList("https://api.dropboxapi.com/2/files/list_folder", {
    path: basePath,
    recursive: true,
    include_deleted: true, // << penting
  });
  entries.push(...data.entries);
  hasMore = data.has_more;
  cursor = data.cursor;

  while (hasMore) {
    const d = await callList("https://api.dropboxapi.com/2/files/list_folder/continue", { cursor });
    entries.push(...(d.entries || []));
    hasMore = d.has_more;
    cursor = d.cursor;
  }

  const files = new Map();
  const deleted = new Set();

  const baseLower = basePath.toLowerCase();
  const baseDisp = basePath;

  function relOf(pLower, baseLower, pDisp) {
    const relLower = (pLower.startsWith(baseLower) ? pLower.slice(baseLower.length) : pLower).replace(/^\/+/, "");
    const relDisp = (pDisp.startsWith(baseDisp) ? pDisp.slice(baseDisp.length) : pDisp).replace(/^\/+/, "");
    return { relLower, relDisp };
  }

  // Terapkan seperti “log” – yang terakhir menang (file vs tombstone)
  for (const e of entries) {
    const tag = e[".tag"];
    if (tag === "file") {
      const { relLower, relDisp } = relOf(e.path_lower, baseLower, e.path_display || e.path_lower);
      files.set(relLower, {
        path_lower: e.path_lower,
        relDisplay: relDisp,
        content_hash: e.content_hash || null,
        size: e.size,
        server_modified: new Date(e.server_modified).getTime(),
      });
      deleted.delete(relLower); // override if previously deleted
    } else if (tag === "deleted") {
      const { relLower } = relOf(e.path_lower, baseLower, e.path_lower);
      deleted.add(relLower);
      files.delete(relLower); // pastikan tidak terlihat sebagai file aktif
    } else if (tag === "folder") {
      // abaikan
    }
  }

  return { files, deleted };
}

async function uploadSmall(dropboxPath, contentBuffer) {
  const token = await getAccessToken();
  await ensureParentDirs(token, dropboxPath);
  const resp = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({
        path: dropboxPath,
        mode: "overwrite",
        autorename: false,
        mute: false,
        strict_conflict: false,
      }),
      "Content-Type": "application/octet-stream",
    },
    body: contentBuffer,
  });
  if (!resp.ok) throw new Error("Upload error: " + (await resp.text()));
}

async function download(pathLower) {
  const token = await getAccessToken();
  const resp = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: pathLower }),
    },
  });
  if (!resp.ok) throw new Error("Download error: " + (await resp.text()));
  return Buffer.from(await resp.arrayBuffer());
}

async function deletePath(pathLower) {
  const token = await getAccessToken();
  const resp = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathLower }),
  });
  if (!resp.ok) throw new Error("delete_v2 error: " + (await resp.text()));
}

async function deleteBatch(paths) {
  const token = await getAccessToken();
  if (!paths || paths.length === 0) return { success: true };

  const entries = paths.map(p => ({ path: p }));
  const resp = await fetch("https://api.dropboxapi.com/2/files/delete_batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });

  if (!resp.ok) throw new Error("delete_batch error: " + (await resp.text()));

  const data = await resp.json();
  if (data[".tag"] === "complete") return { success: true, entries: data.entries };

  // Handle async job
  const async_job_id = data.async_job_id;
  for (let i = 0; i < 10; i++) { // Poll up to 10 times
    await new Promise(res => setTimeout(res, 1000)); // Wait 1 second
    const checkResp = await fetch("https://api.dropboxapi.com/2/files/delete_batch/check", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ async_job_id }),
    });
    const checkData = await checkResp.json();
    if (checkData[".tag"] === "complete") return { success: true, entries: checkData.entries };
    if (checkData[".tag"] === "failed") throw new Error(`Batch delete failed: ${checkData.failed}`);
  }
  throw new Error("Batch delete job timed out.");
}

module.exports = {
  init,
  listRecursive,
  listWithDeletedRecursive, // << export baru
  uploadSmall,
  download,
  deletePath,
  deleteBatch,
  ensureParentDirs,
};
