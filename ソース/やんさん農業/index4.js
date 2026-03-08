(() => {
  "use strict";

  const HANDLE_DB_NAME = "yansan_index3_handles";
  const HANDLE_STORE_NAME = "handles";
  const HANDLE_KEY_SAVE_DIR = "map_output_dir";
  const RES = 16;

  const previewCanvas = document.getElementById("previewCanvas");
  const pctx = previewCanvas.getContext("2d");
  pctx.imageSmoothingEnabled = false;

  const pickDirBtn = document.getElementById("pickDirBtn");
  const saveBtn = document.getElementById("saveBtn");
  const loadBtn = document.getElementById("loadBtn");
  const searchInput = document.getElementById("searchInput");
  const tileModeBtn = document.getElementById("tileModeBtn");
  const playerModeBtn = document.getElementById("playerModeBtn");
  const tileListEl = document.getElementById("tileList");
  const selectedLabelEl = document.getElementById("selectedLabel");
  const viewInfoEl = document.getElementById("viewInfo");
  const statusEl = document.getElementById("status");
  const fullTileCheckbox = document.getElementById("fullTileCheckbox");
  const sideTileCheckbox = document.getElementById("sideTileCheckbox");
  const toolButtons = Array.from(document.querySelectorAll(".tool-btn[data-tool]"));
  const fillBtn = document.getElementById("fillBtn");
  const clearBtn = document.getElementById("clearBtn");

  const state = {
    saveDirHandle: null,
    tiles: [],
    selectedId: "",
    listMode: "tile",
    playerFrames: [],
    selectedPlayerFrame: "",
    search: "",
    imageCache: new Map(),
    tool: "draw",
    mouseDown: false,
    masksByTileId: new Map(),
    playerMasksByFrame: new Map(),
  };

  const PLAYER_FRAME_NAMES = [
    "front_idle1", "front_idle2", "front_idle3", "front_run1", "front_run2",
    "back_idle1", "back_idle2", "back_idle3", "back_run1", "back_run2",
    "side_idle1", "side_idle2", "side_idle3", "side_run1", "side_run2",
  ];

  function setStatus(msg) {
    statusEl.textContent = String(msg || "");
  }

  function emptyMaskRows() {
    return new Array(RES).fill(0);
  }

  function cloneMaskRows(rows) {
    const out = emptyMaskRows();
    if (!Array.isArray(rows)) return out;
    for (let y = 0; y < RES; y += 1) {
      out[y] = (Number(rows[y]) || 0) >>> 0;
    }
    return out;
  }

  function normCollision(v) {
    if (v === "none" || v === "h" || v === "v" || v === "full") return v;
    return "none";
  }

  function normalizeMaskFromTile(tile) {
    if (Array.isArray(tile && tile.collisionMask)) {
      return cloneMaskRows(tile.collisionMask);
    }
    const mode = normCollision(tile && tile.collision ? tile.collision : "none");
    const rows = emptyMaskRows();
    if (mode === "none") return rows;
    if (mode === "full") {
      for (let y = 0; y < RES; y += 1) rows[y] = 0xffff;
      return rows;
    }
    if (mode === "h") {
      for (let y = 11; y < RES; y += 1) {
        // inner horizontal band
        let bits = 0;
        for (let x = 1; x < RES - 1; x += 1) bits |= (1 << x);
        rows[y] = bits >>> 0;
      }
      return rows;
    }
    if (mode === "v") {
      for (let y = 1; y < RES; y += 1) {
        let bits = 0;
        for (let x = 6; x <= 9; x += 1) bits |= (1 << x);
        rows[y] = bits >>> 0;
      }
      return rows;
    }
    return rows;
  }

  function inferCollisionFromMask(rows) {
    const mask = cloneMaskRows(rows);
    let any = false;
    let all = true;
    for (let y = 0; y < RES; y += 1) {
      const row = mask[y] & 0xffff;
      if (row !== 0) any = true;
      if (row !== 0xffff) all = false;
    }
    if (!any) return "none";
    if (all) return "full";
    return "full";
  }

  function buildDefaultPlayerMaskRows() {
    const rows = emptyMaskRows();
    const cx = 7.5;
    const cy = 10.5;
    const rx = 4.5;
    const ry = 4.75;
    for (let y = 0; y < RES; y += 1) {
      let bits = 0;
      for (let x = 0; x < RES; x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) bits |= (1 << x);
      }
      rows[y] = bits >>> 0;
    }
    return rows;
  }

  function createDefaultPlayerFrames() {
    return PLAYER_FRAME_NAMES.map((name) => ({
      id: name,
      src: `assets/yansan/${name}.png`,
      collisionMask: buildDefaultPlayerMaskRows(),
    }));
  }

  function getImage(src) {
    const key = String(src || "");
    let img = state.imageCache.get(key);
    if (!img) {
      img = new Image();
      img.src = key;
      state.imageCache.set(key, img);
    }
    return img;
  }

  function openHandleDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("indexedDB not available"));
        return;
      }
      const req = indexedDB.open(HANDLE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) db.createObjectStore(HANDLE_STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("db open failed"));
    });
  }

  async function saveDirHandleToDb(handle) {
    if (!handle) return;
    try {
      const db = await openHandleDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE_NAME, "readwrite");
        tx.objectStore(HANDLE_STORE_NAME).put(handle, HANDLE_KEY_SAVE_DIR);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("db write failed"));
        tx.onabort = () => reject(tx.error || new Error("db write aborted"));
      });
      db.close();
    } catch (_) {}
  }

  async function loadDirHandleFromDb() {
    try {
      const db = await openHandleDb();
      const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE_NAME, "readonly");
        const req = tx.objectStore(HANDLE_STORE_NAME).get(HANDLE_KEY_SAVE_DIR);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error("db read failed"));
      });
      db.close();
      return handle;
    } catch (_) {
      return null;
    }
  }

  async function tryRestoreSaveDirHandle() {
    if (!window.showDirectoryPicker || !window.FileSystemHandle) return false;
    const saved = await loadDirHandleFromDb();
    if (!saved) return false;
    try {
      let perm = "prompt";
      if (typeof saved.queryPermission === "function") perm = await saved.queryPermission({ mode: "readwrite" });
      if (perm !== "granted" && typeof saved.requestPermission === "function") {
        perm = await saved.requestPermission({ mode: "readwrite" });
      }
      if (perm !== "granted") return false;
      state.saveDirHandle = saved;
      return true;
    } catch {
      return false;
    }
  }

  async function chooseSaveDir() {
    if (!window.showDirectoryPicker) {
      setStatus("このブラウザでは保存先選択APIが使えません");
      return false;
    }
    try {
      const picked = await window.showDirectoryPicker({ mode: "readwrite" });
      state.saveDirHandle = picked;
      await saveDirHandleToDb(picked);
      syncViewInfo();
      setStatus("保存先を紐付けました");
      return true;
    } catch {
      setStatus("保存先選択をキャンセルしました");
      return false;
    }
  }

  async function readTextFile(dirHandle, fileName) {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async function writeTextFile(dirHandle, fileName, content) {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  function parseJsAssignedObject(code, keyName) {
    try {
      const sandbox = {};
      const fn = new Function("window", `${String(code || "")}; return window["${keyName}"] || null;`);
      const out = fn(sandbox);
      return out && typeof out === "object" ? out : null;
    } catch {
      return null;
    }
  }

  function buildTilesFromRaw(raw) {
    const src = raw && Array.isArray(raw.tiles) ? raw.tiles : [];
    const tiles = src
      .map((t) => ({
        id: String(t && t.id ? t.id : "").trim(),
        src: String(t && t.src ? t.src : "").trim(),
        collision: normCollision(t && t.collision ? t.collision : "none"),
        collisionMask: Array.isArray(t && t.collisionMask) ? cloneMaskRows(t.collisionMask) : null,
        fullTile: !!(t && t.fullTile),
        sideTile: !!(t && t.sideTile),
        animation: t && t.animation ? t.animation : undefined,
      }))
      .filter((t) => t.id && t.src);
    return tiles;
  }

  function buildPlayerFramesFromRaw(raw) {
    const src = raw && raw.playerCollision && raw.playerCollision.frames && typeof raw.playerCollision.frames === "object"
      ? raw.playerCollision.frames
      : null;
    const frames = createDefaultPlayerFrames();
    if (!src) return frames;
    for (const frame of frames) {
      const saved = src[frame.id];
      if (!saved || typeof saved !== "object") continue;
      if (typeof saved.src === "string" && saved.src.trim()) frame.src = saved.src.trim();
      if (Array.isArray(saved.collisionMask)) frame.collisionMask = cloneMaskRows(saved.collisionMask);
    }
    return frames;
  }

  function toTileJs() {
    const tiles = state.tiles.map((t) => {
      const rows = cloneMaskRows(state.masksByTileId.get(t.id));
      const out = {
        id: t.id,
        src: t.src,
        collision: inferCollisionFromMask(rows),
        collisionMask: rows,
        fullTile: !!t.fullTile,
        sideTile: !!t.sideTile,
      };
      if (t.animation && typeof t.animation === "object") out.animation = t.animation;
      return out;
    });
    const playerCollision = {
      frames: Object.fromEntries(state.playerFrames.map((frame) => [
        frame.id,
        {
          src: frame.src,
          collisionMask: cloneMaskRows(state.playerMasksByFrame.get(frame.id)),
        },
      ])),
    };
    return `window.TILE_DATA = ${JSON.stringify({ tiles, playerCollision }, null, 2)};\n`;
  }

  function rebuildMasks() {
    state.masksByTileId.clear();
    for (const tile of state.tiles) {
      state.masksByTileId.set(tile.id, normalizeMaskFromTile(tile));
    }
    state.playerMasksByFrame.clear();
    for (const frame of state.playerFrames) {
      state.playerMasksByFrame.set(frame.id, cloneMaskRows(frame.collisionMask));
    }
  }

  async function loadTilesFromSaveDir() {
    if (!state.saveDirHandle) return false;
    try {
      const code = await readTextFile(state.saveDirHandle, "tile.js");
      const parsed = parseJsAssignedObject(code, "TILE_DATA");
      const tiles = buildTilesFromRaw(parsed);
      const frames = buildPlayerFramesFromRaw(parsed);
      if (!tiles.length && !frames.length) return false;
      state.tiles = tiles;
      state.playerFrames = frames;
      rebuildMasks();
      if (!state.selectedId || !state.tiles.some((t) => t.id === state.selectedId)) state.selectedId = state.tiles[0] ? state.tiles[0].id : "";
      if (!state.selectedPlayerFrame || !state.playerFrames.some((t) => t.id === state.selectedPlayerFrame)) {
        state.selectedPlayerFrame = state.playerFrames[0] ? state.playerFrames[0].id : "";
      }
      renderAll();
      setStatus("保存先の tile.js を読込しました");
      return true;
    } catch {
      return false;
    }
  }

  function loadTilesFromWindow() {
    const raw = window.TILE_DATA && typeof window.TILE_DATA === "object" ? window.TILE_DATA : null;
    const tiles = buildTilesFromRaw(raw);
    const frames = buildPlayerFramesFromRaw(raw);
    if (!tiles.length && !frames.length) return false;
    state.tiles = tiles;
    state.playerFrames = frames;
    rebuildMasks();
    if (!state.selectedId || !state.tiles.some((t) => t.id === state.selectedId)) state.selectedId = state.tiles[0] ? state.tiles[0].id : "";
    if (!state.selectedPlayerFrame || !state.playerFrames.some((t) => t.id === state.selectedPlayerFrame)) {
      state.selectedPlayerFrame = state.playerFrames[0] ? state.playerFrames[0].id : "";
    }
    renderAll();
    setStatus("同フォルダの tile.js を読込しました");
    return true;
  }

  function getSelectedTile() {
    return state.tiles.find((t) => t.id === state.selectedId) || null;
  }

  function getSelectedPlayerFrame() {
    return state.playerFrames.find((t) => t.id === state.selectedPlayerFrame) || null;
  }

  function getSelectedMask() {
    if (state.listMode === "player") {
      const frame = getSelectedPlayerFrame();
      if (!frame) return null;
      if (!state.playerMasksByFrame.has(frame.id)) state.playerMasksByFrame.set(frame.id, buildDefaultPlayerMaskRows());
      return state.playerMasksByFrame.get(frame.id);
    }
    const tile = getSelectedTile();
    if (!tile) return null;
    if (!state.masksByTileId.has(tile.id)) state.masksByTileId.set(tile.id, emptyMaskRows());
    return state.masksByTileId.get(tile.id);
  }

  function syncViewInfo() {
    const selected = state.listMode === "player" ? getSelectedPlayerFrame() : getSelectedTile();
    const rows = getSelectedMask();
    let count = 0;
    if (rows) {
      for (let y = 0; y < RES; y += 1) {
        const row = rows[y] & 0xffff;
        for (let x = 0; x < RES; x += 1) if (row & (1 << x)) count += 1;
      }
    }
    viewInfoEl.textContent =
      `保存先: ${state.saveDirHandle ? state.saveDirHandle.name : "未設定"} | ` +
      `モード: ${state.listMode === "player" ? "やんさん" : "タイル"} | ` +
      `タイル数: ${state.tiles.length} | ` +
      `選択: ${selected ? selected.id : "-"} | ` +
      `塗り: ${count}/${RES * RES}`;
  }

  function renderToolButtons() {
    for (const btn of toolButtons) {
      btn.classList.toggle("active", btn.dataset.tool === state.tool);
    }
  }

  function renderTileList() {
    const keyword = state.search.trim().toLowerCase();
    tileListEl.innerHTML = "";
    const list = state.listMode === "player" ? state.playerFrames : state.tiles;
    for (const tile of list) {
      const text = `${tile.id} ${tile.src}`.toLowerCase();
      if (keyword && !text.includes(keyword)) continue;
      const isActive = state.listMode === "player" ? tile.id === state.selectedPlayerFrame : tile.id === state.selectedId;
      const row = document.createElement("div");
      row.className = "item-row" + (isActive ? " active" : "");
      const img = document.createElement("img");
      img.className = "item-thumb";
      img.src = tile.src;
      img.alt = tile.id;
      const meta = document.createElement("div");
      meta.className = "item-meta";
      const flags = [];
      if (state.listMode !== "player") {
        if (tile.fullTile) flags.push("全面");
        if (tile.sideTile) flags.push("側面");
      } else {
        flags.push("やんさん");
      }
      const flagLabel = flags.length ? ` | ${flags.join(" / ")}` : "";
      meta.innerHTML = `<div>${tile.id}</div><div class="sub">${tile.src}${flagLabel}</div>`;
      row.appendChild(img);
      row.appendChild(meta);
      row.addEventListener("click", () => {
        if (state.listMode === "player") state.selectedPlayerFrame = tile.id;
        else state.selectedId = tile.id;
        renderAll();
      });
      tileListEl.appendChild(row);
    }
  }

  function drawChecker(ctx, size) {
    const step = size / RES;
    for (let y = 0; y < RES; y += 1) {
      for (let x = 0; x < RES; x += 1) {
        ctx.fillStyle = (x + y) % 2 ? "#1b2747" : "#223156";
        ctx.fillRect(x * step, y * step, step, step);
      }
    }
  }

  function drawMaskOverlay(ctx, rows, size) {
    if (!rows) return;
    const step = size / RES;
    ctx.save();
    ctx.fillStyle = "rgba(90, 170, 255, 0.45)";
    for (let y = 0; y < RES; y += 1) {
      const row = rows[y] & 0xffff;
      for (let x = 0; x < RES; x += 1) {
        if (!(row & (1 << x))) continue;
        ctx.fillRect(Math.floor(x * step), Math.floor(y * step), Math.ceil(step), Math.ceil(step));
      }
    }
    ctx.restore();
  }

  function drawGrid(ctx, size) {
    const step = size / RES;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= RES; i += 1) {
      const p = i * step + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderPreview() {
    const selected = state.listMode === "player" ? getSelectedPlayerFrame() : getSelectedTile();
    const rows = getSelectedMask();
    const size = previewCanvas.width;
    pctx.clearRect(0, 0, size, size);
    drawChecker(pctx, size);
    if (selected) {
      const img = getImage(selected.src);
      if (img.complete && img.naturalWidth > 0) {
        pctx.drawImage(img, 0, 0, size, size);
      }
    }
    drawMaskOverlay(pctx, rows, size);
    drawGrid(pctx, size);
  }

  function renderAll() {
    const selected = state.listMode === "player" ? getSelectedPlayerFrame() : getSelectedTile();
    selectedLabelEl.textContent = `選択中: ${selected ? selected.id : "-"} / ツール: ${state.tool}`;
    fullTileCheckbox.checked = !!(selected && selected.fullTile);
    sideTileCheckbox.checked = !!(selected && selected.sideTile);
    fullTileCheckbox.disabled = state.listMode === "player";
    sideTileCheckbox.disabled = state.listMode === "player";
    tileModeBtn.classList.toggle("active", state.listMode === "tile");
    playerModeBtn.classList.toggle("active", state.listMode === "player");
    renderToolButtons();
    renderTileList();
    renderPreview();
    syncViewInfo();
  }

  function setPixel(x, y, filled) {
    if (x < 0 || y < 0 || x >= RES || y >= RES) return;
    const rows = getSelectedMask();
    if (!rows) return;
    const before = rows[y] >>> 0;
    const bit = 1 << x;
    const after = filled ? (before | bit) : (before & ~bit);
    if (before === after) return;
    rows[y] = after >>> 0;
    renderPreview();
    syncViewInfo();
  }

  function pointToCell(clientX, clientY) {
    const rect = previewCanvas.getBoundingClientRect();
    const px = Math.floor(((clientX - rect.left) / rect.width) * RES);
    const py = Math.floor(((clientY - rect.top) / rect.height) * RES);
    return {
      x: Math.max(0, Math.min(RES - 1, px)),
      y: Math.max(0, Math.min(RES - 1, py)),
    };
  }

  function paintByPointerEvent(ev) {
    const { x, y } = pointToCell(ev.clientX, ev.clientY);
    setPixel(x, y, state.tool === "draw");
  }

  function fillAll(value) {
    const rows = getSelectedMask();
    if (!rows) return;
    const rowValue = value ? 0xffff : 0;
    for (let y = 0; y < RES; y += 1) rows[y] = rowValue;
    renderAll();
  }

  pickDirBtn.addEventListener("click", async () => {
    await chooseSaveDir();
    if (state.saveDirHandle) await loadTilesFromSaveDir();
  });

  loadBtn.addEventListener("click", async () => {
    if (state.saveDirHandle && await loadTilesFromSaveDir()) return;
    if (loadTilesFromWindow()) return;
    setStatus("読込できませんでした");
  });

  saveBtn.addEventListener("click", async () => {
    if (!state.saveDirHandle) {
      const ok = await chooseSaveDir();
      if (!ok) return;
    }
    try {
      await writeTextFile(state.saveDirHandle, "tile.js", toTileJs());
      setStatus("保存: tile.js を上書きしました");
    } catch (err) {
      console.error(err);
      setStatus("保存失敗: 権限または保存先を確認してください");
    }
  });

  searchInput.addEventListener("input", () => {
    state.search = String(searchInput.value || "");
    renderTileList();
  });

  tileModeBtn.addEventListener("click", () => {
    state.listMode = "tile";
    renderAll();
  });
  playerModeBtn.addEventListener("click", () => {
    state.listMode = "player";
    renderAll();
  });

  for (const btn of toolButtons) {
    btn.addEventListener("click", () => {
      state.tool = btn.dataset.tool === "erase" ? "erase" : "draw";
      renderToolButtons();
    });
  }

  fillBtn.addEventListener("click", () => fillAll(true));
  clearBtn.addEventListener("click", () => fillAll(false));
  fullTileCheckbox.addEventListener("change", () => {
    const selected = getSelectedTile();
    if (!selected) return;
    selected.fullTile = !!fullTileCheckbox.checked;
    renderTileList();
    syncViewInfo();
  });
  sideTileCheckbox.addEventListener("change", () => {
    const selected = getSelectedTile();
    if (!selected) return;
    selected.sideTile = !!sideTileCheckbox.checked;
    renderTileList();
    syncViewInfo();
  });

  previewCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
  previewCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    state.mouseDown = true;
    state.tool = e.button === 2 ? "erase" : "draw";
    renderToolButtons();
    paintByPointerEvent(e);
  });
  previewCanvas.addEventListener("pointermove", (e) => {
    if (!state.mouseDown) return;
    paintByPointerEvent(e);
  });
  window.addEventListener("pointerup", () => {
    state.mouseDown = false;
  });

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveBtn.click();
    }
  });

  async function init() {
    setStatus("初期化中...");
    state.playerFrames = createDefaultPlayerFrames();
    if (!state.selectedPlayerFrame && state.playerFrames[0]) state.selectedPlayerFrame = state.playerFrames[0].id;
    const restored = await tryRestoreSaveDirHandle();
    if (restored && await loadTilesFromSaveDir()) {
      setStatus("保存先を復元し tile.js を自動読込しました");
      return;
    }
    if (loadTilesFromWindow()) {
      setStatus("同フォルダの tile.js を読込しました");
      return;
    }
    setStatus("tile.js が読めませんでした");
    renderAll();
  }

  void init();
})();
