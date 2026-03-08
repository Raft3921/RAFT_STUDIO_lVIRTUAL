(() => {
  "use strict";

  const LOCAL_KEY = "yansan_index3_editor_v3";
  const HANDLE_DB_NAME = "yansan_index3_handles";
  const HANDLE_STORE_NAME = "handles";
  const HANDLE_KEY_SAVE_DIR = "map_output_dir";
  const ERASE_TILE_ID = "__empty__";
  const TILE_SIZE = 64;
  const LAYER_IDS = [1, 1.5, 2, 3, 4, 5];
  const LEGACY_LAYER_IDS = [1, 2, 3, 4, 5];
  const DEFAULT_MAP_W = 256;
  const DEFAULT_MAP_H = 256;
  const MIN_MAP_SIZE = 16;
  const MAX_MAP_SIZE = 2048;
  const HISTORY_LIMIT = 80;

  const DEFAULT_TILES = [
    { id: "grass1", src: "assets/grass1.png", collision: "none" },
    { id: "grass2", src: "assets/grass2.png", collision: "none" },
    { id: "grass3", src: "assets/grass3.png", collision: "none" },
    { id: "grass4", src: "assets/grass4.png", collision: "none" },
    { id: "grass5", src: "assets/grass5.png", collision: "none" },
    { id: "barrier0", src: "assets/barrier0.png", collision: "full" },
    { id: "barrier1", src: "assets/barrier1.png", collision: "h" },
    { id: "barrier2", src: "assets/barrier2.png", collision: "v" },
    { id: "barrier3", src: "assets/barrier3.png", collision: "full" },
    { id: "barrier4", src: "assets/barrier4.png", collision: "full" },
    { id: "barrier5", src: "assets/barrier5.png", collision: "full" },
    { id: "barrier6", src: "assets/barrier6.png", collision: "full" },
    { id: "barrier7", src: "assets/barrier7.png", collision: "v" },
    { id: "barrier8", src: "assets/barrier8.png", collision: "h" },
    { id: "barrier9", src: "assets/barrier9.png", collision: "h" },
    { id: "barrier10", src: "assets/barrier10.png", collision: "full" },
  ];

  const canvas = document.getElementById("mapCanvas");
  const ctx = canvas.getContext("2d");
  const metaEl = document.getElementById("meta");
  const palettePanel = document.getElementById("palettePanel");
  const addTilePanel = document.getElementById("addTilePanel");
  const saveBtn = document.getElementById("saveBtn");
  const loadBtn = document.getElementById("loadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const pickDirBtn = document.getElementById("pickDirBtn");
  const tabPalette = document.getElementById("tabPalette");
  const tabAdd = document.getElementById("tabAdd");
  const tileNameInput = document.getElementById("tileName");
  const tileSrcInput = document.getElementById("tileSrc");
  const addTileBtn = document.getElementById("addTileBtn");
  const mapWInput = document.getElementById("mapWInput");
  const mapHInput = document.getElementById("mapHInput");
  const applySizeBtn = document.getElementById("applySizeBtn");
  const tileCollisionInput = document.getElementById("tileCollision");
  const tileAnimOnInput = document.getElementById("tileAnimOn");
  const tileAnimFramesInput = document.getElementById("tileAnimFrames");
  const tileAnimPreviewEl = document.getElementById("tileAnimPreview");
  const spawnToolBtn = document.getElementById("spawnToolBtn");
  const layerButtons = Array.from(document.querySelectorAll(".layer-btn"));
  const sidebarEl = document.getElementById("sidebar");
  const tileContextMenu = document.getElementById("tileContextMenu");
  const tileEditBtn = document.getElementById("tileEditBtn");
  const tileDeleteBtn = document.getElementById("tileDeleteBtn");
  const tileCancelBtn = document.getElementById("tileCancelBtn");

  const state = {
    mapW: DEFAULT_MAP_W,
    mapH: DEFAULT_MAP_H,
    tileset: DEFAULT_TILES.map((t) => ({ ...t })),
    images: new Map(),
    // Sparse: each layer keeps only changed/non-empty cells.
    layers: LAYER_IDS.map((_, idx) => new Map()), // layer 1 default grass1, others default empty
    activeLayer: 1,
    toolMode: "paint", // paint | spawn
    spawnTileX: 0,
    spawnTileY: 0,
    selectedId: "grass1",
    painting: false,
    erasing: false,
    hoveredX: -1,
    hoveredY: -1,
    // Camera is top-left world coordinate; starts at origin 0,0.
    cameraX: 0,
    cameraY: 0,
    zoom: 1,
    moveKeys: new Set(),
    saveDirHandle: null,
    autoSaveTimer: 0,
    localSaveTimer: 0,
    saveInFlight: false,
    lastTimeMs: performance.now(),
    activeTab: "palette",
    contextTileId: "",
    editingTileId: "",
    lastAutoTileSrc: "",
    undoStack: [],
    redoStack: [],
    editSessionStart: null,
  };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function normMapSize(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return clamp(Math.floor(n), MIN_MAP_SIZE, MAX_MAP_SIZE);
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function parseCellKey(key) {
    const [sx, sy] = String(key).split(",");
    return [Number(sx), Number(sy)];
  }

  function getImage(src) {
    let img = state.images.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      state.images.set(src, img);
    }
    return img;
  }

  function isValidTileId(id) {
    return state.tileset.some((t) => t.id === id);
  }

  function getTileById(id) {
    return state.tileset.find((t) => t.id === id) || state.tileset[0];
  }

  function normalizeCollision(v) {
    if (v === "h" || v === "v" || v === "full" || v === "none") return v;
    return "none";
  }

  function normalizeAnimation(raw) {
    if (!raw || typeof raw !== "object") return null;
    const enabled = !!raw.enabled;
    if (!enabled) return null;
    const frameCount = clamp(Math.floor(Number(raw.frameCount) || 0), 2, 60);
    const frames = Array.isArray(raw.frames)
      ? raw.frames.map((p) => String(p || "").trim()).filter((p) => !!p)
      : [];
    return {
      enabled: true,
      frameCount,
      frames,
    };
  }

  function splitAnimatedSrcParts(src) {
    const s = String(src || "").trim();
    const m = s.match(/^(.*?)(\d+)(\.[a-z0-9]+)$/i);
    if (!m) return null;
    return { prefix: m[1], ext: m[3] };
  }

  function buildAnimationFramesFromSrc(src, frameCount) {
    const parts = splitAnimatedSrcParts(src);
    if (!parts) return [];
    const out = [];
    for (let i = 1; i <= frameCount; i += 1) out.push(`${parts.prefix}${i}${parts.ext}`);
    return out;
  }

  function getTileAnimationFrames(tile) {
    const anim = normalizeAnimation(tile && tile.animation ? tile.animation : null);
    if (!anim) return null;
    const byData = Array.isArray(anim.frames) ? anim.frames.filter((p) => !!p) : [];
    if (byData.length >= anim.frameCount) return byData.slice(0, anim.frameCount);
    const bySrc = buildAnimationFramesFromSrc(tile.src, anim.frameCount);
    if (bySrc.length >= anim.frameCount) return bySrc;
    return null;
  }

  function getAnimatedTileSrc(tile, nowMs) {
    const frames = getTileAnimationFrames(tile);
    if (!frames || !frames.length) return tile.src;
    const idx = Math.floor(nowMs / 140) % frames.length;
    return frames[idx] || tile.src;
  }

  function getTileCollisionById(id) {
    const tile = state.tileset.find((t) => t.id === id);
    return normalizeCollision(tile && tile.collision ? tile.collision : "none");
  }

  function normalizeCellEntry(raw, fallbackDir = "h") {
    if (raw == null) return null;
    if (typeof raw === "string") return { id: raw };
    if (typeof raw === "object") {
      const id = String(raw.id || "");
      if (!id) return null;
      return { id };
    }
    return null;
  }

  function normalizeLayerId(value, fallback = 1) {
    const n = Number(value);
    return LAYER_IDS.includes(n) ? n : fallback;
  }

  function getLayerArrayIndex(layer) {
    return Math.max(0, LAYER_IDS.indexOf(normalizeLayerId(layer, 1)));
  }

  function getLayerMap(layer) {
    return state.layers[getLayerArrayIndex(layer)];
  }

  function getDefaultTileIdForLayer(layer) {
    return layer === 1 ? "grass1" : null;
  }

  function getCellId(layer, x, y) {
    if (x < 0 || y < 0 || x >= state.mapW || y >= state.mapH) return null;
    const map = getLayerMap(layer);
    const stored = map.get(cellKey(x, y));
    if (stored !== undefined) {
      const entry = normalizeCellEntry(stored, "h");
      return entry ? entry.id : null;
    }
    return getDefaultTileIdForLayer(layer);
  }

  function getCellEntry(layer, x, y) {
    if (x < 0 || y < 0 || x >= state.mapW || y >= state.mapH) return null;
    const map = getLayerMap(layer);
    const stored = map.get(cellKey(x, y));
    if (stored !== undefined) return normalizeCellEntry(stored, "h");
    const def = getDefaultTileIdForLayer(layer);
    return def ? { id: def, dir: "h" } : null;
  }

  function setCellId(layer, x, y, value) {
    if (x < 0 || y < 0 || x >= state.mapW || y >= state.mapH) return;
    const key = cellKey(x, y);
    const map = getLayerMap(layer);
    const defaultId = getDefaultTileIdForLayer(layer);
    const entry = normalizeCellEntry(value, "h");
    if (!entry || entry.id === defaultId) {
      map.delete(key);
      return;
    }
    map.set(key, entry);
  }

  function worldToScreen(wx, wy) {
    return {
      x: (wx - state.cameraX) * state.zoom,
      y: (wy - state.cameraY) * state.zoom,
    };
  }

  function screenToWorld(sx, sy) {
    return {
      x: sx / state.zoom + state.cameraX,
      y: sy / state.zoom + state.cameraY,
    };
  }

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    clampCamera();
  }

  function clampCamera() {
    const visibleW = canvas.clientWidth / state.zoom;
    const visibleH = canvas.clientHeight / state.zoom;
    const maxX = Math.max(0, state.mapW * TILE_SIZE - visibleW);
    const maxY = Math.max(0, state.mapH * TILE_SIZE - visibleH);
    state.cameraX = clamp(state.cameraX, 0, maxX);
    state.cameraY = clamp(state.cameraY, 0, maxY);
  }

  function syncMeta(msg = "") {
    const modCount = state.layers.reduce((sum, m) => sum + m.size, 0);
    const selectedLabel = state.selectedId === ERASE_TILE_ID ? "空白(削除)" : state.selectedId;
    metaEl.textContent =
      `選択: ${selectedLabel}\n` +
      `編集中レイヤー: L${String(state.activeLayer)}\n` +
      `ツール: ${state.toolMode === "spawn" ? "初期地点" : "タイル"}\n` +
      `サイズ: ${state.mapW} x ${state.mapH}\n` +
      `原点: (0,0)  カーソル: (${Math.max(0, state.hoveredX)}, ${Math.max(0, state.hoveredY)})\n` +
      `初期地点: (${state.spawnTileX}, ${state.spawnTileY})\n` +
      `ズーム: x${state.zoom.toFixed(2)}\n` +
      `保存先: ${state.saveDirHandle ? state.saveDirHandle.name : "未設定"}\n` +
      `変更タイル数: ${modCount}\n` +
      `左クリック: 配置 / 右クリック: 消去\n` +
      `WASD: カメラ移動 / ↑↓: ズーム\n` +
      (msg || "");
  }

  function setZoom(nextZoom, keepScreenCx = canvas.clientWidth * 0.5, keepScreenCy = canvas.clientHeight * 0.5) {
    const prevZoom = state.zoom;
    const z = clamp(nextZoom, 0.35, 3);
    if (Math.abs(z - prevZoom) < 0.0001) return;
    const worldCx = keepScreenCx / prevZoom + state.cameraX;
    const worldCy = keepScreenCy / prevZoom + state.cameraY;
    state.zoom = z;
    state.cameraX = worldCx - keepScreenCx / z;
    state.cameraY = worldCy - keepScreenCy / z;
    clampCamera();
  }

  function resetCameraToSpawn() {
    const worldX = (state.spawnTileX + 0.5) * TILE_SIZE;
    const worldY = (state.spawnTileY + 0.5) * TILE_SIZE;
    state.cameraX = worldX - (canvas.clientWidth * 0.5) / state.zoom;
    state.cameraY = worldY - (canvas.clientHeight * 0.5) / state.zoom;
    clampCamera();
  }

  function isSidebarEditingActive() {
    const el = document.activeElement;
    if (!el) return false;
    if (!sidebarEl || !sidebarEl.contains(el)) return false;
    if (el.isContentEditable) return true;
    const tag = String(el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
  }

  function refreshLayerButtons() {
    for (const btn of layerButtons) {
      const layer = normalizeLayerId(btn.dataset.layer, 1);
      btn.classList.toggle("active", layer === state.activeLayer);
    }
  }

  function updateSpawnToolButton() {
    const on = state.toolMode === "spawn";
    spawnToolBtn.textContent = `初期地点ツール: ${on ? "ON" : "OFF"}`;
    spawnToolBtn.classList.toggle("active", on);
  }

  function setTab(tab) {
    state.activeTab = tab;
    tabPalette.classList.toggle("active", tab === "palette");
    tabAdd.classList.toggle("active", tab === "add");
    palettePanel.style.display = tab === "palette" ? "grid" : "none";
    addTilePanel.style.display = tab === "add" ? "block" : "none";
  }

  function buildPalette() {
    palettePanel.innerHTML = "";

    const eraseBtn = document.createElement("button");
    eraseBtn.type = "button";
    eraseBtn.className = "tile-btn";
    eraseBtn.dataset.id = ERASE_TILE_ID;
    eraseBtn.innerHTML = `<span style="width:32px;height:32px;display:block;border:1px dashed rgba(255,255,255,0.5);border-radius:4px;background:linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02));"></span><span>空白(削除)</span>`;
    eraseBtn.classList.toggle("active", state.selectedId === ERASE_TILE_ID);
    eraseBtn.addEventListener("click", () => {
      state.selectedId = ERASE_TILE_ID;
      for (const b of palettePanel.querySelectorAll(".tile-btn")) {
        b.classList.toggle("active", b.dataset.id === ERASE_TILE_ID);
      }
      syncMeta();
    });
    palettePanel.appendChild(eraseBtn);

    for (const tile of state.tileset) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile-btn";
      btn.dataset.id = tile.id;
      btn.innerHTML = `<img src="${tile.src}" alt="${tile.id}" /><span>${tile.id}</span>`;
      btn.classList.toggle("active", tile.id === state.selectedId);
      btn.addEventListener("click", () => {
        state.selectedId = tile.id;
        for (const b of palettePanel.querySelectorAll(".tile-btn")) {
          b.classList.toggle("active", b.dataset.id === tile.id);
        }
        syncMeta();
      });
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showTileContextMenu(tile.id, e.clientX, e.clientY);
      });
      palettePanel.appendChild(btn);
    }
  }

  function resolveTileSrc(id, rawSrc) {
    const idText = String(id || "").trim();
    const raw = String(rawSrc || "").trim();
    if (!raw) return `assets/${idText}.png`;
    if (raw.includes("/")) return raw;
    if (/\.[a-z0-9]+$/i.test(raw)) return `assets/${raw}`;
    return `assets/${raw}.png`;
  }

  function syncTileSrcAutoFill() {
    const name = String(tileNameInput.value || "").trim();
    if (!name) return;
    const current = String(tileSrcInput.value || "").trim();
    const nextAuto = `assets/${name}.png`;
    if (!current || current === state.lastAutoTileSrc || current === nextAuto) {
      tileSrcInput.value = nextAuto;
      state.lastAutoTileSrc = nextAuto;
    }
  }

  function updateTileAnimPreview() {
    const animOn = !!tileAnimOnInput.checked;
    const frameCount = clamp(Math.floor(Number(tileAnimFramesInput.value) || 0), 2, 60);
    const src = resolveTileSrc(String(tileNameInput.value || "").trim(), tileSrcInput.value);
    if (!animOn) {
      tileAnimPreviewEl.textContent = "アニメーション: OFF";
      return;
    }
    const frames = buildAnimationFramesFromSrc(src, frameCount);
    if (!frames.length) {
      tileAnimPreviewEl.textContent = "末尾に数字付きの画像パスにしてください（例: assets/water1.png）";
      return;
    }
    tileAnimPreviewEl.textContent = `自動パス (${frameCount}):\n${frames.join("\n")}`;
  }

  function hideTileContextMenu() {
    state.contextTileId = "";
    tileContextMenu.classList.remove("open");
  }

  function showTileContextMenu(tileId, clientX, clientY) {
    state.contextTileId = String(tileId || "");
    const w = 150;
    const h = 124;
    const x = clamp(clientX, 8, window.innerWidth - w - 8);
    const y = clamp(clientY, 8, window.innerHeight - h - 8);
    tileContextMenu.style.left = `${x}px`;
    tileContextMenu.style.top = `${y}px`;
    tileContextMenu.classList.add("open");
  }

  function deleteTileById(tileId) {
    const id = String(tileId || "");
    if (!id) return false;
    if (id === "grass1") {
      syncMeta("grass1 は削除できません");
      return false;
    }
    const idx = state.tileset.findIndex((t) => t.id === id);
    if (idx < 0) return false;
    state.tileset.splice(idx, 1);
    for (const layer of state.layers) {
      for (const [k, v] of layer.entries()) {
        const entry = normalizeCellEntry(v, "h");
        if (entry && entry.id === id) layer.delete(k);
      }
    }
    if (state.selectedId === id) state.selectedId = state.tileset[0]?.id || "grass1";
    buildPalette();
    markEdited();
    syncMeta(`タイル削除: ${id}`);
    return true;
  }

  function startEditTileById(tileId) {
    const id = String(tileId || "");
    const tile = state.tileset.find((t) => t.id === id);
    if (!tile) return false;
    state.editingTileId = id;
    tileNameInput.value = tile.id;
    tileSrcInput.value = tile.src;
    tileCollisionInput.value = normalizeCollision(tile.collision);
    const anim = normalizeAnimation(tile.animation);
    tileAnimOnInput.checked = !!anim;
    tileAnimFramesInput.value = String(anim ? anim.frameCount : 4);
    state.lastAutoTileSrc = tile.src;
    addTileBtn.textContent = "更新";
    setTab("add");
    updateTileAnimPreview();
    syncMeta(`タイル編集: ${id}`);
    return true;
  }

  function resetMap() {
    for (const layer of state.layers) layer.clear();
    state.cameraX = 0;
    state.cameraY = 0;
    state.hoveredX = -1;
    state.hoveredY = -1;
    state.spawnTileX = 0;
    state.spawnTileY = 0;
  }

  function setMapSize(nextW, nextH) {
    const w = normMapSize(nextW, state.mapW);
    const h = normMapSize(nextH, state.mapH);
    if (w === state.mapW && h === state.mapH) return;
    const nextLayers = state.layers.map(() => new Map());
    for (let li = 0; li < state.layers.length; li += 1) {
      for (const [k, value] of state.layers[li].entries()) {
        const [x, y] = parseCellKey(k);
        if (x >= 0 && y >= 0 && x < w && y < h) nextLayers[li].set(k, value);
      }
    }
    state.mapW = w;
    state.mapH = h;
    state.layers = nextLayers;
    state.spawnTileX = clamp(state.spawnTileX, 0, w - 1);
    state.spawnTileY = clamp(state.spawnTileY, 0, h - 1);
    mapWInput.value = String(w);
    mapHInput.value = String(h);
    clampCamera();
  }

  function serializeEditorState() {
    const layerCells = state.layers.map((m) =>
      Array.from(m.entries()).map(([k, v]) => [k, normalizeCellEntry(v, "h") || null]));
    return {
      mapW: state.mapW,
      mapH: state.mapH,
      selectedId: state.selectedId,
      activeLayer: state.activeLayer,
      layerOrder: LAYER_IDS.slice(),
      spawn: { x: state.spawnTileX, y: state.spawnTileY },
      tileset: state.tileset.map((t) => ({
        id: t.id,
        src: t.src,
        collision: normalizeCollision(t.collision),
        animation: normalizeAnimation(t.animation),
      })),
      layerCells,
      // backward-compatible mirror for layer1
      cells: layerCells[0],
    };
  }

  function cloneSnapshot(snapshot) {
    return JSON.parse(JSON.stringify(snapshot));
  }

  function snapshotKey(snapshot) {
    return JSON.stringify(snapshot);
  }

  function pushUndoSnapshot(snapshot) {
    state.undoStack.push(cloneSnapshot(snapshot));
    if (state.undoStack.length > HISTORY_LIMIT) state.undoStack.shift();
    state.redoStack.length = 0;
  }

  function beginEditSession() {
    if (state.editSessionStart) return;
    state.editSessionStart = cloneSnapshot(serializeEditorState());
  }

  function endEditSession() {
    if (!state.editSessionStart) return;
    const before = state.editSessionStart;
    state.editSessionStart = null;
    const after = serializeEditorState();
    if (snapshotKey(before) === snapshotKey(after)) return;
    pushUndoSnapshot(before);
  }

  function undoEdit() {
    if (!state.undoStack.length) return false;
    const current = cloneSnapshot(serializeEditorState());
    const prev = state.undoStack.pop();
    state.redoStack.push(current);
    applyEditorState(prev, { keepCamera: true });
    scheduleAutoSave();
    syncMeta("元に戻しました");
    return true;
  }

  function redoEdit() {
    if (!state.redoStack.length) return false;
    const current = cloneSnapshot(serializeEditorState());
    const next = state.redoStack.pop();
    state.undoStack.push(current);
    applyEditorState(next, { keepCamera: true });
    scheduleAutoSave();
    syncMeta("やり直しました");
    return true;
  }

  function applyEditorState(payload, options = {}) {
    const keepCamera = !!options.keepCamera;
    if (!payload || typeof payload !== "object") return false;
    if (!Array.isArray(payload.tileset)) return false;

    const mapW = normMapSize(payload.mapW, DEFAULT_MAP_W);
    const mapH = normMapSize(payload.mapH, DEFAULT_MAP_H);

    const tileset = payload.tileset
      .map((t) => ({
        id: String(t.id || ""),
        src: String(t.src || ""),
        collision: normalizeCollision(t && t.collision ? t.collision : "none"),
        animation: normalizeAnimation(t && t.animation ? t.animation : null),
      }))
      .filter((t) => t.id && t.src);
    state.tileset = tileset.length ? tileset : DEFAULT_TILES.map((t) => ({ ...t }));

    state.mapW = mapW;
    state.mapH = mapH;
    state.layers = LAYER_IDS.map(() => new Map());

    const applyPairsToLayer = (pairs, layer) => {
      if (!Array.isArray(pairs)) return;
      for (const pair of pairs) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const [k, rawValue] = pair;
        const [x, y] = parseCellKey(k);
        const entry = normalizeCellEntry(rawValue, "h");
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < 0 || y < 0 || x >= state.mapW || y >= state.mapH) continue;
        if (!entry) continue;
        const id = String(entry.id || "");
        if (!isValidTileId(id)) continue;
        if (layer === 1 && id === "grass1") continue;
        setCellId(layer, x, y, entry);
      }
    };

    if (Array.isArray(payload.layerCells)) {
      for (let li = 0; li < LAYER_IDS.length; li += 1) {
        applyPairsToLayer(payload.layerCells[li], LAYER_IDS[li]);
      }
    } else if (Array.isArray(payload.cells)) {
      applyPairsToLayer(payload.cells, 1);
    } else if (Array.isArray(payload.tileIds)) {
      // backward compatibility v2 array format
      for (let i = 0; i < payload.tileIds.length; i += 1) {
        const id = String(payload.tileIds[i] || "grass1");
        if (!isValidTileId(id) || id === "grass1") continue;
        const x = i % state.mapW;
        const y = Math.floor(i / state.mapW);
        if (y >= state.mapH) break;
        setCellId(1, x, y, { id, dir: "h" });
      }
    }

    const selected = String(payload.selectedId || "");
    state.selectedId = selected === ERASE_TILE_ID || isValidTileId(selected) ? selected : state.tileset[0].id;
    state.activeLayer = normalizeLayerId(payload.activeLayer, 1);
    state.spawnTileX = clamp(Math.floor(Number(payload?.spawn?.x) || 0), 0, state.mapW - 1);
    state.spawnTileY = clamp(Math.floor(Number(payload?.spawn?.y) || 0), 0, state.mapH - 1);
    mapWInput.value = String(state.mapW);
    mapHInput.value = String(state.mapH);
    if (!keepCamera) {
      state.cameraX = 0;
      state.cameraY = 0;
    }
    buildPalette();
    refreshLayerButtons();
    updateSpawnToolButton();
    clampCamera();
    return true;
  }

  function saveLocalState() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(serializeEditorState()));
  }

  function loadLocalState() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return false;
      return applyEditorState(JSON.parse(raw));
    } catch {
      return false;
    }
  }

  function toTileJs() {
    const tiles = state.tileset.map((t) => {
      const out = { id: t.id, src: t.src, collision: normalizeCollision(t.collision) };
      const anim = normalizeAnimation(t.animation);
      if (anim) {
        out.animation = {
          enabled: true,
          frameCount: anim.frameCount,
          frames: getTileAnimationFrames(t) || [],
        };
      }
      return out;
    });
    return `window.TILE_DATA = ${JSON.stringify({ tiles }, null, 2)};\n`;
  }

  function toTerrainJs() {
    const layers = state.layers.map((m, idx) => ({
      index: LAYER_IDS[idx],
      default: idx === 0 ? "grass1" : null,
      sparse: Object.fromEntries(
        Array.from(m.entries()).map(([k, v]) => [k, normalizeCellEntry(v, "h") || null]).filter(([, v]) => v),
      ),
    }));
    const layer1SparseIdOnly = {};
    for (const [k, v] of Object.entries(layers[0].sparse)) {
      layer1SparseIdOnly[k] = typeof v === "object" ? String(v.id || "grass1") : String(v || "grass1");
    }
    const payload = {
      width: state.mapW,
      height: state.mapH,
      default: "grass1",
      sparse: layer1SparseIdOnly,
      layers,
      origin: { x: 0, y: 0 },
      spawn: { x: state.spawnTileX, y: state.spawnTileY },
    };
    return `window.TERRAIN_DATA = ${JSON.stringify(payload, null, 2)};\n`;
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
        if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
          db.createObjectStore(HANDLE_STORE_NAME);
        }
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
      if (typeof saved.queryPermission === "function") {
        perm = await saved.queryPermission({ mode: "readwrite" });
      }
      if (perm !== "granted" && typeof saved.requestPermission === "function") {
        perm = await saved.requestPermission({ mode: "readwrite" });
      }
      if (perm !== "granted") return false;
      state.saveDirHandle = saved;
      return true;
    } catch (_) {
      return false;
    }
  }

  async function chooseSaveDir() {
    if (!window.showDirectoryPicker) {
      syncMeta("このブラウザでは保存先選択APIが使えません");
      return false;
    }
    try {
      const picked = await window.showDirectoryPicker({ mode: "readwrite" });
      state.saveDirHandle = picked;
      await saveDirHandleToDb(picked);
      syncMeta("保存先を紐付けました");
      return true;
    } catch {
      syncMeta("保存先選択をキャンセルしました");
      return false;
    }
  }

  async function writeTextFile(dirHandle, fileName, content) {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function readTextFile(dirHandle, fileName) {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
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

  function normalizeSparseToPairs(sparseObj) {
    const out = [];
    if (!(sparseObj && typeof sparseObj === "object")) return out;
    for (const [k, raw] of Object.entries(sparseObj)) {
      let id = "";
      if (typeof raw === "string") id = raw;
      else if (raw && typeof raw === "object") id = String(raw.id || "");
      id = String(id || "");
      if (!id) continue;
      out.push([k, { id }]);
    }
    return out;
  }

  function buildEditorStateFromProjectFiles(tileData, terrainData) {
    if (!tileData || !Array.isArray(tileData.tiles)) return null;
    if (!terrainData || typeof terrainData !== "object") return null;
    const mapW = normMapSize(terrainData.width, DEFAULT_MAP_W);
    const mapH = normMapSize(terrainData.height, DEFAULT_MAP_H);
    const tileset = tileData.tiles
      .map((t) => ({
        id: String(t && t.id ? t.id : ""),
        src: String(t && t.src ? t.src : ""),
        collision: normalizeCollision(t && t.collision ? t.collision : "none"),
        animation: normalizeAnimation(t && t.animation ? t.animation : null),
      }))
      .filter((t) => t.id && t.src);
    if (!tileset.length) return null;

    const layerCells = LAYER_IDS.map(() => []);
    if (Array.isArray(terrainData.layers)) {
      const sourceOrder = terrainData.layers.length === LEGACY_LAYER_IDS.length
        ? LEGACY_LAYER_IDS
        : LAYER_IDS;
      for (let i = 0; i < terrainData.layers.length; i += 1) {
        const layer = terrainData.layers[i];
        const layerId = Number.isFinite(Number(layer && layer.index))
          ? Number(layer.index)
          : sourceOrder[i];
        const targetIndex = LAYER_IDS.indexOf(layerId);
        if (targetIndex < 0) continue;
        layerCells[targetIndex] = normalizeSparseToPairs(layer && layer.sparse);
      }
    } else if (terrainData.sparse && typeof terrainData.sparse === "object") {
      layerCells[0] = normalizeSparseToPairs(terrainData.sparse);
    }

    return {
      mapW,
      mapH,
      selectedId: tileset[0].id,
      activeLayer: 1,
      spawn: {
        x: clamp(Math.floor(Number(terrainData?.spawn?.x) || 0), 0, mapW - 1),
        y: clamp(Math.floor(Number(terrainData?.spawn?.y) || 0), 0, mapH - 1),
      },
      tileset,
      layerCells,
      cells: layerCells[0],
    };
  }

  async function loadFromSaveDirFiles() {
    if (!state.saveDirHandle) return false;
    try {
      const [tileJsText, terrainJsText] = await Promise.all([
        readTextFile(state.saveDirHandle, "tile.js"),
        readTextFile(state.saveDirHandle, "terrain.js"),
      ]);
      const tileData = parseJsAssignedObject(tileJsText, "TILE_DATA");
      const terrainData = parseJsAssignedObject(terrainJsText, "TERRAIN_DATA");
      const payload = buildEditorStateFromProjectFiles(tileData, terrainData);
      if (!payload) return false;
      const ok = applyEditorState(payload);
      if (ok) {
        scheduleLocalSave();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function saveAll(opts = {}) {
    const quiet = !!opts.quiet;
    if (state.saveInFlight) return false;
    state.saveInFlight = true;
    saveLocalState();
    const tileJs = toTileJs();
    const terrainJs = toTerrainJs();
    try {
      if (!state.saveDirHandle) {
        const restored = await tryRestoreSaveDirHandle();
        if (!restored) {
          const selected = await chooseSaveDir();
          if (!selected) return false;
        }
      }
      try {
        await writeTextFile(state.saveDirHandle, "tile.js", tileJs);
        await writeTextFile(state.saveDirHandle, "terrain.js", terrainJs);
        if (!quiet) syncMeta("保存: tile.js / terrain.js を上書きしました");
        return true;
      } catch (err) {
        console.error(err);
        if (!quiet) syncMeta("保存失敗: 保存先の権限を確認してください");
        return false;
      }
    } finally {
      state.saveInFlight = false;
    }
  }

  function scheduleLocalSave() {
    if (state.localSaveTimer) clearTimeout(state.localSaveTimer);
    state.localSaveTimer = setTimeout(() => {
      state.localSaveTimer = 0;
      saveLocalState();
    }, 250);
  }

  function scheduleAutoSave() {
    scheduleLocalSave();
    if (!state.saveDirHandle) return;
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(() => {
      state.autoSaveTimer = 0;
      void saveAll({ quiet: true });
    }, 500);
  }

  function markEdited() {
    scheduleAutoSave();
  }

  function paintAt(sx, sy) {
    const p = screenToWorld(sx, sy);
    const tx = Math.floor(p.x / TILE_SIZE);
    const ty = Math.floor(p.y / TILE_SIZE);
    state.hoveredX = tx;
    state.hoveredY = ty;
    if (tx < 0 || ty < 0 || tx >= state.mapW || ty >= state.mapH) return;
    if (state.toolMode === "spawn") {
      if (state.spawnTileX !== tx || state.spawnTileY !== ty) {
        state.spawnTileX = tx;
        state.spawnTileY = ty;
        markEdited();
      }
      return;
    }
    const layer = state.activeLayer;
    const eraseTarget = layer === 1 ? "grass1" : null;
    const nextId = state.erasing || state.selectedId === ERASE_TILE_ID ? eraseTarget : state.selectedId;
    const before = getCellEntry(layer, tx, ty);
    const nextEntry = nextId == null ? null : { id: nextId };
    const beforeKey = before ? String(before.id || "") : "";
    const nextKey = nextEntry ? String(nextEntry.id || "") : "";
    if (beforeKey === nextKey) return;
    setCellId(layer, tx, ty, nextEntry);
    markEdited();
  }

  function update(dt) {
    const speed = 740;
    if (state.moveKeys.has("KeyW")) state.cameraY -= speed * dt;
    if (state.moveKeys.has("KeyS")) state.cameraY += speed * dt;
    if (state.moveKeys.has("KeyA")) state.cameraX -= speed * dt;
    if (state.moveKeys.has("KeyD")) state.cameraX += speed * dt;
    clampCamera();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.fillStyle = "#163816";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const nowMs = performance.now();

    const visibleW = canvas.clientWidth / state.zoom;
    const visibleH = canvas.clientHeight / state.zoom;
    const startX = Math.max(0, Math.floor(state.cameraX / TILE_SIZE) - 1);
    const endX = Math.min(state.mapW - 1, Math.floor((state.cameraX + visibleW) / TILE_SIZE) + 1);
    const startY = Math.max(0, Math.floor(state.cameraY / TILE_SIZE) - 1);
    const endY = Math.min(state.mapH - 1, Math.floor((state.cameraY + visibleH) / TILE_SIZE) + 1);
    const drawTile = TILE_SIZE * state.zoom;

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const p = worldToScreen(x * TILE_SIZE, y * TILE_SIZE);
        for (const layer of LAYER_IDS) {
          const entry = getCellEntry(layer, x, y);
          const id = entry ? entry.id : null;
          if (!id) continue;
          const tile = getTileById(id);
          if (!tile) continue;
          const img = getImage(getAnimatedTileSrc(tile, nowMs));
          const alpha = layer === state.activeLayer ? 1 : 0.28;
          if (img.complete && img.naturalWidth > 0) {
            ctx.globalAlpha = alpha;
            ctx.drawImage(img, p.x, p.y, drawTile, drawTile);
            ctx.globalAlpha = 1;
          } else if (layer === 1) {
            ctx.fillStyle = "#45a244";
            ctx.globalAlpha = alpha;
            ctx.fillRect(p.x, p.y, drawTile, drawTile);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    for (let x = startX; x <= endX + 1; x += 1) {
      const p0 = worldToScreen(x * TILE_SIZE, startY * TILE_SIZE);
      const p1 = worldToScreen(x * TILE_SIZE, (endY + 1) * TILE_SIZE);
      ctx.beginPath();
      ctx.moveTo(p0.x + 0.5, p0.y);
      ctx.lineTo(p1.x + 0.5, p1.y);
      ctx.stroke();
    }
    for (let y = startY; y <= endY + 1; y += 1) {
      const p0 = worldToScreen(startX * TILE_SIZE, y * TILE_SIZE);
      const p1 = worldToScreen((endX + 1) * TILE_SIZE, y * TILE_SIZE);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y + 0.5);
      ctx.lineTo(p1.x, p1.y + 0.5);
      ctx.stroke();
    }

    if (state.hoveredX >= 0 && state.hoveredY >= 0) {
      const p = worldToScreen(state.hoveredX * TILE_SIZE, state.hoveredY * TILE_SIZE);
      ctx.strokeStyle = "rgba(255,255,255,0.88)";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 1, p.y + 1, drawTile - 2, drawTile - 2);
    }

    if (state.spawnTileX >= 0 && state.spawnTileY >= 0) {
      const p = worldToScreen(state.spawnTileX * TILE_SIZE, state.spawnTileY * TILE_SIZE);
      const cx = p.x + drawTile * 0.5;
      const cy = p.y + drawTile * 0.5;
      const markHalf = Math.max(8, drawTile * 0.18);
      ctx.save();
      ctx.strokeStyle = "rgba(255,220,90,0.95)";
      ctx.fillStyle = "rgba(255,220,90,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - markHalf);
      ctx.lineTo(cx + markHalf, cy);
      ctx.lineTo(cx, cy + markHalf);
      ctx.lineTo(cx - markHalf, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function loop(nowMs) {
    const dt = Math.min(0.05, (nowMs - state.lastTimeMs) / 1000);
    state.lastTimeMs = nowMs;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  tabPalette.addEventListener("click", () => setTab("palette"));
  tabAdd.addEventListener("click", () => setTab("add"));
  for (const btn of layerButtons) {
    btn.addEventListener("click", () => {
      state.activeLayer = normalizeLayerId(btn.dataset.layer, 1);
      refreshLayerButtons();
      syncMeta();
    });
  }
  spawnToolBtn.addEventListener("click", () => {
    state.toolMode = state.toolMode === "spawn" ? "paint" : "spawn";
    updateSpawnToolButton();
    syncMeta();
  });

  applySizeBtn.addEventListener("click", () => {
    beginEditSession();
    setMapSize(mapWInput.value, mapHInput.value);
    endEditSession();
    markEdited();
    syncMeta("サイズを変更しました");
  });

  addTileBtn.addEventListener("click", () => {
    const id = String(tileNameInput.value || "").trim();
    const src = resolveTileSrc(id, tileSrcInput.value);
    const collision = normalizeCollision(tileCollisionInput.value || "none");
    const animEnabled = !!tileAnimOnInput.checked;
    const animFrameCount = clamp(Math.floor(Number(tileAnimFramesInput.value) || 0), 2, 60);
    const animFrames = animEnabled ? buildAnimationFramesFromSrc(src, animFrameCount) : [];
    const animation = animEnabled && animFrames.length
      ? { enabled: true, frameCount: animFrameCount, frames: animFrames }
      : null;
    if (!id || !src) {
      syncMeta("タイル名と画像パスを入力してください");
      return;
    }
    if (animEnabled && !animFrames.length) {
      syncMeta("アニメON時は末尾が数字の画像パスにしてください（例: assets/water1.png）");
      return;
    }
    beginEditSession();
    if (state.editingTileId) {
      const oldId = state.editingTileId;
      const editingIdx = state.tileset.findIndex((t) => t.id === oldId);
      if (editingIdx < 0) {
        endEditSession();
        syncMeta("編集対象が見つかりません");
        return;
      }
      if (id !== oldId && state.tileset.some((t, i) => i !== editingIdx && t.id === id)) {
        endEditSession();
        syncMeta("同名タイルがあります");
        return;
      }
      state.tileset[editingIdx] = { id, src, collision, animation };
      if (id !== oldId) {
        for (const layer of state.layers) {
          for (const [k, v] of layer.entries()) {
            const entry = normalizeCellEntry(v, "h");
            if (!entry || entry.id !== oldId) continue;
            layer.set(k, { id });
          }
        }
      }
    } else {
      if (state.tileset.some((t) => t.id === id)) {
        endEditSession();
        syncMeta("同名タイルがあります");
        return;
      }
      state.tileset.push({ id, src, collision, animation });
    }
    state.selectedId = id;
    state.editingTileId = "";
    addTileBtn.textContent = "+ 追加";
    getImage(src);
    buildPalette();
    setTab("palette");
    tileNameInput.value = "";
    tileSrcInput.value = "";
    tileCollisionInput.value = "none";
    tileAnimOnInput.checked = false;
    tileAnimFramesInput.value = "4";
    updateTileAnimPreview();
    state.lastAutoTileSrc = "";
    endEditSession();
    markEdited();
    syncMeta("タイルを保存しました");
  });
  tileNameInput.addEventListener("input", () => {
    syncTileSrcAutoFill();
    updateTileAnimPreview();
  });
  tileSrcInput.addEventListener("input", updateTileAnimPreview);
  tileAnimOnInput.addEventListener("change", updateTileAnimPreview);
  tileAnimFramesInput.addEventListener("input", updateTileAnimPreview);
  tileEditBtn.addEventListener("click", () => {
    const target = state.contextTileId;
    hideTileContextMenu();
    startEditTileById(target);
  });
  tileDeleteBtn.addEventListener("click", () => {
    const target = state.contextTileId;
    hideTileContextMenu();
    beginEditSession();
    deleteTileById(target);
    endEditSession();
  });
  tileCancelBtn.addEventListener("click", () => {
    hideTileContextMenu();
  });

  pickDirBtn.addEventListener("click", async () => {
    const ok = await chooseSaveDir();
    if (ok) {
      // 保存先を紐付けたら即時に同名ファイルへ上書き保存。
      await saveAll();
    }
  });

  saveBtn.addEventListener("click", () => { void saveAll(); });
  loadBtn.addEventListener("click", async () => {
    if (state.saveDirHandle && await loadFromSaveDirFiles()) {
      syncMeta("保存先フォルダの tile.js / terrain.js を読込しました");
      return;
    }
    if (!loadLocalState()) syncMeta("保存データがありません");
    else syncMeta("ローカルデータを読込しました");
  });
  clearBtn.addEventListener("click", () => {
    resetCameraToSpawn();
    syncMeta("カメラを初期地点へ戻しました");
  });

  window.addEventListener("keydown", (e) => {
    const cmd = e.metaKey || e.ctrlKey;
    if (!isSidebarEditingActive() && cmd && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redoEdit();
      else undoEdit();
      return;
    }
    if (!isSidebarEditingActive() && cmd && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redoEdit();
      return;
    }
    if (isSidebarEditingActive()) {
      state.moveKeys.clear();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void saveAll();
      return;
    }
    if (e.code === "ArrowUp") {
      e.preventDefault();
      setZoom(state.zoom * 1.1);
      syncMeta();
      return;
    }
    if (e.code === "ArrowDown") {
      e.preventDefault();
      setZoom(state.zoom / 1.1);
      syncMeta();
      return;
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      state.moveKeys.add(e.code);
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (isSidebarEditingActive()) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      state.moveKeys.delete(e.code);
      e.preventDefault();
    }
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    const rect = canvas.getBoundingClientRect();
    beginEditSession();
    state.painting = true;
    state.erasing = e.button === 2;
    paintAt(e.clientX - rect.left, e.clientY - rect.top);
  });
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy);
    state.hoveredX = Math.floor(w.x / TILE_SIZE);
    state.hoveredY = Math.floor(w.y / TILE_SIZE);
    if (state.painting) paintAt(sx, sy);
  });
  window.addEventListener("pointerup", () => {
    if (state.painting) endEditSession();
    state.painting = false;
    state.erasing = false;
  });
  window.addEventListener("pointerdown", (e) => {
    if (!tileContextMenu.classList.contains("open")) return;
    if (tileContextMenu.contains(e.target)) return;
    hideTileContextMenu();
  });
  window.addEventListener("resize", hideTileContextMenu);
  window.addEventListener("scroll", hideTileContextMenu, true);

  window.addEventListener("beforeunload", () => {
    if (state.localSaveTimer) {
      clearTimeout(state.localSaveTimer);
      state.localSaveTimer = 0;
    }
    saveLocalState();
  });

  window.addEventListener("resize", resize);

  mapWInput.value = String(DEFAULT_MAP_W);
  mapHInput.value = String(DEFAULT_MAP_H);
  updateTileAnimPreview();

  async function initStartup() {
    let loadedFromFolder = false;
    const restoredHandle = await tryRestoreSaveDirHandle();
    if (restoredHandle) {
      loadedFromFolder = await loadFromSaveDirFiles();
    }
    if (!loadedFromFolder && !loadLocalState()) {
      resetMap();
      buildPalette();
    }
    resetCameraToSpawn();
    refreshLayerButtons();
    updateSpawnToolButton();
    if (restoredHandle) {
      syncMeta(loadedFromFolder
        ? "保存先を復元して tile.js / terrain.js を自動読込しました"
        : "保存先を復元しました（地形ファイルは未読込）");
    }
    setTab("palette");
    resize();
    syncMeta();
    requestAnimationFrame(loop);
  }

  void initStartup();
})();
