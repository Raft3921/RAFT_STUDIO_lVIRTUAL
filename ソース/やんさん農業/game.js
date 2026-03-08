import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
  update as updateDb,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

(() => {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBiG900ktRuSw6AKAHk_bLpk4w70ZSFvVw",
    authDomain: "raft-studio-virtual.firebaseapp.com",
    databaseURL: "https://raft-studio-virtual-default-rtdb.firebaseio.com",
    projectId: "raft-studio-virtual",
    storageBucket: "raft-studio-virtual.firebasestorage.app",
    messagingSenderId: "18437364527",
    appId: "1:18437364527:web:a0045fbac8da99a4bb1fda",
  };
  const CHARACTER_DEFS = [
    { id: "raft", name: "RAFT" },
    { id: "mai", name: "MAI" },
    { id: "tanutsuna", name: "TANUTSUNA" },
    { id: "yansan", name: "YANSAN" },
    { id: "muto", name: "MUTO" },
    { id: "moron", name: "MORON" },
    { id: "week", name: "WEEK" },
    { id: "gyoza", name: "GYOZA" },
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const mobileUi = document.getElementById("mobile-ui");
  const mobileActionBtn = document.getElementById("mobile-action");
  const mobileInventoryBtn = document.getElementById("mobile-inventory");
  const mobileMoveButtons = Array.from(document.querySelectorAll("[data-move]"));
  const mobileSlotButtons = Array.from(document.querySelectorAll("[data-slot]"));
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  let keyboardAttachedOnTouch = false;
  const FARM_ASSET_ROOT = new URL("./assets/", import.meta.url).toString();
  const ROOT_ASSET_ROOT = new URL("../../assets/", import.meta.url).toString();
  const SYNC_INTERVAL_MS = 80;
  const LOCK_TIMEOUT_MS = 12_000;
  const PLAYER_TIMEOUT_MS = 12_000;

  const WORLD = {
    width: 2200,
    height: 2200,
    tileSize: 64,
  };
  const LAYER_IDS = [1, 1.5, 2, 3, 4, 5];
  const LEGACY_LAYER_IDS = [1, 2, 3, 4, 5];
  const UPPER_LAYER_IDS = [1.5, 2, 3, 4, 5];
  const CAMERA = {
    zoom: 1.5,
    defaultZoom: 1.5,
    minZoom: 0.38,
    maxZoom: 2.2,
  };
  const CAMERA_ZOOM_STEP = 0.12;
  if (isTouchDevice) {
    CAMERA.defaultZoom = 0.95;
    CAMERA.zoom = 0.95;
    CAMERA.minZoom = 0.6;
    CAMERA.maxZoom = 2.0;
  }
  const PLAYER = {
    spriteInsetPx: 10,
    drawHeight: 92,
    hitRadiusWorld: 14,
  };
  const SUN = {
    cycleSeconds: 90,
    minAltitude: 0.18,
    maxAltitude: 0.95,
    shadowAlphaMin: 0.12,
    shadowAlphaMax: 0.30,
  };
  const SHADER = {
    enableCinematic: false,
    performanceMode: true,
    waterWaveSpeed: 1.35,
    waterDistortion: 0.1,
    rayCount: 6,
  };
  const LAYER_COLOR_GRADING = {
    layer1Base: { brightness: 1.03, saturate: 1.08, hueDeg: -2 },
    layer2Base: { brightness: 1.05, saturate: 1.04, hueDeg: -1 },
  };
  const LAYER_BRIGHTNESS = {
    layer1: 0.96,
    layer2: 1.05,
  };
  const BARRIER_INSET = 80;
  const BARRIER_INSET_TOP = 100;
  const BARRIER_OUTER_RING = 0;
  const BARRIER_IMAGES = {
    lr: "assets/barrier1.png", // left + right
    ud: "assets/barrier2.png", // up + down
    rd: "assets/barrier3.png", // right + down
    ld: "assets/barrier4.png", // left + down
    lu: "assets/barrier5.png", // left + up
    ru: "assets/barrier6.png", // right + up
  };
  const ITEMS = {
    sickle: { icon: "assets/sickle.png", overlayFolder: "sickle" },
    schop: { icon: "assets/schop.png", overlayFolder: null },
    hoes: { icon: "assets/hoes.png", overlayFolder: "hoes" },
    soil_sifter: { icon: "assets/soil_sifter.png", overlayFolder: null },
    hammer: { icon: "assets/hammer.png", overlayFolder: "hammer" },
    fence: { icon: "assets/item/fence.png", overlayFolder: null },
    clambon_seed: { icon: "assets/item/clambon_seed.png", overlayFolder: null },
    clambon: { icon: "assets/item/clambon.png", overlayFolder: null },
    big_clambon: { icon: "assets/item/big_clambon.png", overlayFolder: null },
  };
  const CROP_IMAGES = {
    1: "assets/clambon/clambon1.png",
    2: "assets/clambon/clambon2.png",
    3: "assets/clambon/clambon3.png",
    4: "assets/clambon/clambon4.png",
    5: "assets/clambon/clambon5.png",
    6: "assets/clambon/clambon6.png",
  };
  const CROP_GROWTH_SECONDS = {
    1: 5,
    2: 5,
    3: 6,
    4: 5,
  };
  const CLAMBON_FULL_GROW_MS = 10 * 60 * 1000;
  const TOOL_ITEMS = new Set(["sickle", "schop", "hoes", "soil_sifter", "hammer"]);
  const USE_PREVIEW_ITEMS = new Set(["sickle", "schop", "hoes", "soil_sifter", "hammer", "clambon_seed", "fence"]);
  const TILE_IMAGES = {
    clippings: "assets/clippings_grass.png",
    stone_dirt: "assets/stone_dirt.png",
    stone_dirt2: "assets/stone_dirt2.png",
    stone_dirt3: "assets/stone_dirt3.png",
    stone_dirt4: "assets/stone_dirt4.png",
    stone_dirt5: "assets/stone_dirt5.png",
    stone_dirt6: "assets/stone_dirt6.png",
    stone_dirt7: "assets/stone_dirt7.png",
    stone_dirt8: "assets/stone_dirt8.png",
    stone_dirt9: "assets/stone_dirt9.png",
    stone_dirt10: "assets/stone_dirt10.png",
    stone_dirt11: "assets/stone_dirt11.png",
    stone_dirt12: "assets/stone_dirt12.png",
    stone_dirt13: "assets/stone_dirt13.png",
    stone_dirt14: "assets/stone_dirt14.png",
    stone_dirt15: "assets/stone_dirt15.png",
    stone_dirt16: "assets/stone_dirt16.png",
    dirt: "assets/dirt.png",
    dirt2: "assets/dirt2.png",
    dirt3: "assets/dirt3.png",
    dirt4: "assets/dirt4.png",
    dirt5: "assets/dirt5.png",
    dirt6: "assets/dirt6.png",
    dirt7: "assets/dirt7.png",
    dirt8: "assets/dirt8.png",
    dirt9: "assets/dirt9.png",
    dirt10: "assets/dirt10.png",
    dirt11: "assets/dirt11.png",
    dirt12: "assets/dirt12.png",
    dirt13: "assets/dirt13.png",
    dirt14: "assets/dirt14.png",
    dirt15: "assets/dirt15.png",
    dirt16: "assets/dirt16.png",
    groove_dirt: "assets/groove_dirt.png",
    groove_dirt2: "assets/groove_dirt2.png",
    groove_dirt3: "assets/groove_dirt3.png",
    groove_dirt4: "assets/groove_dirt4.png",
    groove_dirt5: "assets/groove_dirt5.png",
    groove_dirt6: "assets/groove_dirt6.png",
    groove_dirt7: "assets/groove_dirt7.png",
    groove_dirt8: "assets/groove_dirt8.png",
    groove_dirt9: "assets/groove_dirt9.png",
    groove_dirt10: "assets/groove_dirt10.png",
    groove_dirt11: "assets/groove_dirt11.png",
    groove_dirt12: "assets/groove_dirt12.png",
    groove_dirt13: "assets/groove_dirt13.png",
    groove_dirt14: "assets/groove_dirt14.png",
    groove_dirt15: "assets/groove_dirt15.png",
    groove_dirt16: "assets/groove_dirt16.png",
    hole_groove_dirt: "assets/hole_groove_dirt.png",
    hole_groove_dirt2: "assets/hole_groove_dirt2.png",
    hole_groove_dirt3: "assets/hole_groove_dirt3.png",
    hole_groove_dirt4: "assets/hole_groove_dirt4.png",
    hole_groove_dirt5: "assets/hole_groove_dirt5.png",
    hole_groove_dirt6: "assets/hole_groove_dirt6.png",
    hole_groove_dirt7: "assets/hole_groove_dirt7.png",
    hole_groove_dirt8: "assets/hole_groove_dirt8.png",
    hole_groove_dirt9: "assets/hole_groove_dirt9.png",
    hole_groove_dirt10: "assets/hole_groove_dirt10.png",
    hole_groove_dirt11: "assets/hole_groove_dirt11.png",
    hole_groove_dirt12: "assets/hole_groove_dirt12.png",
    hole_groove_dirt13: "assets/hole_groove_dirt13.png",
    hole_groove_dirt14: "assets/hole_groove_dirt14.png",
    hole_groove_dirt15: "assets/hole_groove_dirt15.png",
    hole_groove_dirt16: "assets/hole_groove_dirt16.png",
  };
  const UI_IMAGES = {
    title: "assets/title.png",
    player_select: "assets/ui/player_select.png",
    kyara_select: "assets/ui/kyara_select.png",
    ui_up: "assets/ui/up.png",
    ui_down: "assets/ui/down.png",
    ui_left: "assets/ui/left.png",
    ui_right: "assets/ui/right.png",
    panel_tl: "assets/panel_tl.png",
    panel_top: "assets/panel_top.png",
    panel_tr: "assets/panel_tr.png",
    panel_left: "assets/panel_left.png",
    panel_center: "assets/panel_center.png",
    panel_right: "assets/panel_right.png",
    panel_bl: "assets/panel_bl.png",
    panel_bottom: "assets/panel_bottom.png",
    panel_br: "assets/panel_br.png",
    tab_l: "assets/tab_l.png",
    tab_m: "assets/tab_m.png",
    tab_r: "assets/tab_r.png",
    tab_l_on: "assets/tab_l_on.png",
    tab_m_on: "assets/tab_m_on.png",
    tab_r_on: "assets/tab_r_on.png",
    slot: "assets/slot.png",
    slot_on: "assets/slot2.png",
    select: "assets/select.png",
    select2: "assets/select2.png",
  };
  const SAVE_STORAGE_KEY = "yansan_farm_save_v2";
  const CHARACTER_SAVE_STORAGE_KEY = "yansan_farm_character_state_v1";
  const LEGACY_SAVE_STORAGE_KEY = "yansan_farm_save_v1";
  const SAVE_SLOT_COUNT = 3;
  const AUTOSAVE_INTERVAL = 300;
  const CLIPPINGS_REGROWTH_SECONDS = 600;
  const CLIPPINGS_REGROWTH_MS = CLIPPINGS_REGROWTH_SECONDS * 1000;
  const DIRT_VARIANT_BY_GRASS_MASK = new Map([
    [0b0000, TILE_IMAGES.dirt],   // all sides soil
    [0b1111, TILE_IMAGES.dirt2],  // all sides grass
    [0b0001, TILE_IMAGES.dirt3],  // left grass
    [0b0010, TILE_IMAGES.dirt4],  // right grass
    [0b0100, TILE_IMAGES.dirt5],  // up grass
    [0b1000, TILE_IMAGES.dirt6],  // down grass
    [0b0101, TILE_IMAGES.dirt7],  // left + up
    [0b0110, TILE_IMAGES.dirt8],  // right + up
    [0b1001, TILE_IMAGES.dirt9],  // left + down
    [0b1010, TILE_IMAGES.dirt10], // right + down
    [0b0111, TILE_IMAGES.dirt11], // left + right + up
    [0b1011, TILE_IMAGES.dirt12], // left + right + down
    [0b1101, TILE_IMAGES.dirt13], // up + down + left
    [0b1110, TILE_IMAGES.dirt14], // up + down + right
    [0b1100, TILE_IMAGES.dirt15], // up + down
    [0b0011, TILE_IMAGES.dirt16], // left + right
  ]);
  const STONE_DIRT_VARIANT_BY_GRASS_MASK = new Map([
    [0b0000, TILE_IMAGES.stone_dirt],   // all sides soil
    [0b1111, TILE_IMAGES.stone_dirt2],  // all sides grass
    [0b0001, TILE_IMAGES.stone_dirt3],  // left grass
    [0b0010, TILE_IMAGES.stone_dirt4],  // right grass
    [0b0100, TILE_IMAGES.stone_dirt5],  // up grass
    [0b1000, TILE_IMAGES.stone_dirt6],  // down grass
    [0b0101, TILE_IMAGES.stone_dirt7],  // left + up
    [0b0110, TILE_IMAGES.stone_dirt8],  // right + up
    [0b1001, TILE_IMAGES.stone_dirt9],  // left + down
    [0b1010, TILE_IMAGES.stone_dirt10], // right + down
    [0b0111, TILE_IMAGES.stone_dirt11], // left + right + up
    [0b1011, TILE_IMAGES.stone_dirt12], // left + right + down
    [0b1101, TILE_IMAGES.stone_dirt13], // up + down + left
    [0b1110, TILE_IMAGES.stone_dirt14], // up + down + right
    [0b1100, TILE_IMAGES.stone_dirt15], // up + down
    [0b0011, TILE_IMAGES.stone_dirt16], // left + right
  ]);
  const GROOVE_DIRT_VARIANT_BY_GRASS_MASK = new Map([
    [0b0000, TILE_IMAGES.groove_dirt],   // all sides groove
    [0b1111, TILE_IMAGES.groove_dirt2],  // all sides outside
    [0b0001, TILE_IMAGES.groove_dirt3],  // left outside
    [0b0010, TILE_IMAGES.groove_dirt4],  // right outside
    [0b0100, TILE_IMAGES.groove_dirt5],  // up outside
    [0b1000, TILE_IMAGES.groove_dirt6],  // down outside
    [0b0101, TILE_IMAGES.groove_dirt7],  // left + up
    [0b0110, TILE_IMAGES.groove_dirt8],  // right + up
    [0b1001, TILE_IMAGES.groove_dirt9],  // left + down
    [0b1010, TILE_IMAGES.groove_dirt10], // right + down
    [0b0111, TILE_IMAGES.groove_dirt11], // left + right + up
    [0b1011, TILE_IMAGES.groove_dirt12], // left + right + down
    [0b1101, TILE_IMAGES.groove_dirt13], // up + down + left
    [0b1110, TILE_IMAGES.groove_dirt14], // up + down + right
    [0b1100, TILE_IMAGES.groove_dirt15], // up + down
    [0b0011, TILE_IMAGES.groove_dirt16], // left + right
  ]);
  const HOLE_GROOVE_DIRT_VARIANT_BY_GRASS_MASK = new Map([
    [0b0000, TILE_IMAGES.hole_groove_dirt],   // all sides holed
    [0b1111, TILE_IMAGES.hole_groove_dirt2],  // all sides outside
    [0b0001, TILE_IMAGES.hole_groove_dirt3],  // left outside
    [0b0010, TILE_IMAGES.hole_groove_dirt4],  // right outside
    [0b0100, TILE_IMAGES.hole_groove_dirt5],  // up outside
    [0b1000, TILE_IMAGES.hole_groove_dirt6],  // down outside
    [0b0101, TILE_IMAGES.hole_groove_dirt7],  // left + up
    [0b0110, TILE_IMAGES.hole_groove_dirt8],  // right + up
    [0b1001, TILE_IMAGES.hole_groove_dirt9],  // left + down
    [0b1010, TILE_IMAGES.hole_groove_dirt10], // right + down
    [0b0111, TILE_IMAGES.hole_groove_dirt11], // left + right + up
    [0b1011, TILE_IMAGES.hole_groove_dirt12], // left + right + down
    [0b1101, TILE_IMAGES.hole_groove_dirt13], // up + down + left
    [0b1110, TILE_IMAGES.hole_groove_dirt14], // up + down + right
    [0b1100, TILE_IMAGES.hole_groove_dirt15], // up + down
    [0b0011, TILE_IMAGES.hole_groove_dirt16], // left + right
  ]);
  const ITEM_USE_HANDLERS = {
    sickle: () => applyClippingsToForwardTile(),
    schop: () => applySchopToForwardTile(),
    hoes: () => applyDirtToForwardTile(),
    soil_sifter: () => applySoilSifterToForwardTile(),
    hammer: () => breakFenceToItemAtForwardTile(),
    fence: () => placeFenceAtForwardTile(),
    clambon_seed: () => {
      const planted = plantClambonOnForwardTile();
      if (planted) consumeSelectedItemOnce("clambon_seed");
      return planted;
    },
  };
  const UNIQUE_TOOL_KINDS = new Set(["sickle", "schop", "hoes", "soil_sifter", "hammer"]);

  const keys = new Set();
  const imageCache = new Map();
  const shadowSilhouetteCache = new Map();
  const clientId = self.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let db = null;
  let playersRef = null;
  let locksRef = null;
  let worldTilesRef = null;
  let localPlayerRef = null;
  let localLockRef = null;
  let stopPlayersSync = null;
  let stopLocksSync = null;
  let stopConnectionSync = null;
  let stopWorldTilesSync = null;
  let lastSyncAt = 0;
  let lastWorldTilesSyncAt = 0;
  let lastFullscreenRequestAt = 0;
  let isDbConnected = false;
  let syncLastError = "";
  let worldTilesDirty = false;
  const pendingTilePatches = new Map();
  const onlinePlayers = new Map();
  const remoteVisualPlayers = new Map();
  const characterLocks = new Map();
  const mobileInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    actionHeld: false,
    nextActionAt: 0,
  };
  const touchHudPointers = new Map();

  const animation = {
    sideIdle: ["side_idle1", "side_idle2"],
    sideRun: ["side_run1", "side_idle1", "side_run2", "side_idle1"],
    frontIdle: ["front_idle1", "front_idle2"],
    frontRun: ["front_run1", "front_idle1", "front_run2", "front_idle1"],
    backIdle: ["back_idle1", "back_idle2"],
    backRun: ["back_run1", "back_idle1", "back_run2", "back_idle1"],
  };
  const grassVariants = [
    "assets/grass1.png",
    "assets/grass2.png",
    "assets/grass3.png",
    "assets/grass4.png",
    "assets/grass5.png",
  ];
  const externalTileData = window.TILE_DATA && Array.isArray(window.TILE_DATA.tiles) ? window.TILE_DATA : null;
  const externalTerrainRaw = window.TERRAIN_DATA && typeof window.TERRAIN_DATA === "object" ? window.TERRAIN_DATA : null;
  const externalTerrainData = externalTerrainRaw &&
    Number.isFinite(externalTerrainRaw.width) &&
    Number.isFinite(externalTerrainRaw.height)
    ? externalTerrainRaw
    : null;
  const externalTerrainWidth = externalTerrainData ? Math.max(1, Math.floor(externalTerrainData.width)) : 0;
  const externalTerrainHeight = externalTerrainData ? Math.max(1, Math.floor(externalTerrainData.height)) : 0;
  const externalTerrainOriginX = externalTerrainData && externalTerrainData.origin && Number.isFinite(externalTerrainData.origin.x)
    ? Math.floor(externalTerrainData.origin.x)
    : 0;
  const externalTerrainOriginY = externalTerrainData && externalTerrainData.origin && Number.isFinite(externalTerrainData.origin.y)
    ? Math.floor(externalTerrainData.origin.y)
    : 0;
  if (externalTerrainWidth > 0 && externalTerrainHeight > 0) {
    WORLD.width = externalTerrainWidth * WORLD.tileSize;
    WORLD.height = externalTerrainHeight * WORLD.tileSize;
  }
  const externalTileSrcById = new Map();
  const externalTileCollisionById = new Map();
  const externalTileCollisionMaskById = new Map();
  const externalTileFullTileById = new Map();
  const externalTileSideTileById = new Map();
  const externalTileAnimationById = new Map();
  const externalPlayerCollisionMaskByFrame = new Map();
  const playerCollisionProbeCache = new Map();
  function normalizeTileAnimation(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!raw.enabled) return null;
    const frameCount = clamp(Math.floor(Number(raw.frameCount) || 0), 2, 60);
    const frames = Array.isArray(raw.frames)
      ? raw.frames.map((p) => String(p || "").trim()).filter((p) => !!p)
      : [];
    if (!frames.length) return null;
    return { frameCount, frames: frames.slice(0, frameCount) };
  }

  function normalizeCollisionMaskRows(raw) {
    if (!Array.isArray(raw)) return null;
    const rows = new Array(16).fill(0);
    for (let y = 0; y < 16; y += 1) {
      const v = Number(raw[y]);
      rows[y] = Number.isFinite(v) ? ((v >>> 0) & 0xffff) : 0;
    }
    return rows;
  }

  function normalizeLayerId(layer, fallback = 1) {
    const n = Number(layer);
    return LAYER_IDS.includes(n) ? n : fallback;
  }

  function getExternalTerrainLayerIndex(layer) {
    const id = normalizeLayerId(layer, 1);
    if (externalTerrainLayerIndexById.has(id)) return externalTerrainLayerIndexById.get(id);
    if (externalTerrainLayers && externalTerrainLayers.length === LEGACY_LAYER_IDS.length) {
      const legacyIndex = LEGACY_LAYER_IDS.indexOf(id);
      return legacyIndex >= 0 ? legacyIndex : 0;
    }
    return 0;
  }

  function buildDefaultPlayerCollisionMaskRows() {
    const rows = new Array(16).fill(0);
    const cx = 7.5;
    const cy = 10.5;
    const rx = 4.5;
    const ry = 4.75;
    for (let y = 0; y < 16; y += 1) {
      let bits = 0;
      for (let x = 0; x < 16; x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) bits |= (1 << x);
      }
      rows[y] = bits >>> 0;
    }
    return rows;
  }

  function getPlayerSpriteKey(player) {
    const moving = Number(player.speed) > 10 || Boolean(player.moving);
    const idleFrame = Number(player.idleFrameIndex) || 0;
    const runFrame = Number(player.runFrameIndex) || 0;
    if (player.facing === "front") {
      return moving ? animation.frontRun[runFrame] : animation.frontIdle[idleFrame];
    }
    if (player.facing === "back") {
      return moving ? animation.backRun[runFrame] : animation.backIdle[idleFrame];
    }
    return moving ? animation.sideRun[runFrame] : animation.sideIdle[idleFrame];
  }

  function getCurrentPlayerSpriteKey() {
    return getPlayerSpriteKey(state.player);
  }

  function getPlayerCollisionProbeOffsets(frameKey) {
    const key = String(frameKey || "");
    if (playerCollisionProbeCache.has(key)) return playerCollisionProbeCache.get(key);
    const rows = externalPlayerCollisionMaskByFrame.get(key) || buildDefaultPlayerCollisionMaskRows();
    const image = loadSprite(key);
    const ratio = image && image.naturalWidth > 0 && image.naturalHeight > 0
      ? image.naturalWidth / image.naturalHeight
      : 1;
    const width = PLAYER.drawHeight * ratio;
    const height = PLAYER.drawHeight;
    const mirrorX = state.player.facing === "right" && key.startsWith("side_");
    const probes = [];
    const outerSamples = [];
    for (let my = 0; my < 16; my += 1) {
      const row = rows[my] || 0;
      for (let mx = 0; mx < 16; mx += 1) {
        if (!(row & (1 << mx))) continue;
        const sampleX = mirrorX ? (15 - mx) : mx;
        const px = ((sampleX + 0.5) / 16 - 0.5) * width;
        const py = (-0.9 + (my + 0.5) / 16) * height;
        probes.push([px, py]);
        const leftEmpty = mx === 0 || !(row & (1 << (mx - 1)));
        const rightEmpty = mx === 15 || !(row & (1 << (mx + 1)));
        const upRow = my > 0 ? (rows[my - 1] || 0) : 0;
        const downRow = my < 15 ? (rows[my + 1] || 0) : 0;
        const upEmpty = my === 0 || !(upRow & (1 << mx));
        const downEmpty = my === 15 || !(downRow & (1 << mx));
        if (leftEmpty || rightEmpty || upEmpty || downEmpty) outerSamples.push([px, py]);
      }
    }
    for (const [px, py] of outerSamples) {
      probes.push([px * 1.04, py * 1.04]);
    }
    if (!probes.length) {
      probes.push(
        [0, 0],
        [PLAYER.hitRadiusWorld, 0],
        [-PLAYER.hitRadiusWorld, 0],
        [0, PLAYER.hitRadiusWorld],
        [0, -PLAYER.hitRadiusWorld],
      );
    }
    playerCollisionProbeCache.set(key, probes);
    return probes;
  }
  if (externalTileData) {
    for (const t of externalTileData.tiles) {
      if (!t || typeof t.id !== "string" || typeof t.src !== "string") continue;
      externalTileSrcById.set(t.id, t.src);
      if (typeof t.collision === "string") externalTileCollisionById.set(t.id, t.collision);
      const maskRows = normalizeCollisionMaskRows(t.collisionMask);
      if (maskRows) externalTileCollisionMaskById.set(t.id, maskRows);
      if (t.fullTile === true) externalTileFullTileById.set(t.id, true);
      if (t.sideTile === true) externalTileSideTileById.set(t.id, true);
      const anim = normalizeTileAnimation(t.animation);
      if (anim) externalTileAnimationById.set(t.id, anim);
    }
    const playerFrames = externalTileData.playerCollision &&
      externalTileData.playerCollision.frames &&
      typeof externalTileData.playerCollision.frames === "object"
      ? externalTileData.playerCollision.frames
      : null;
    if (playerFrames) {
      for (const [frameKey, frameData] of Object.entries(playerFrames)) {
        const rows = normalizeCollisionMaskRows(frameData && frameData.collisionMask);
        if (rows) externalPlayerCollisionMaskByFrame.set(frameKey, rows);
      }
    }
  }
  const externalTerrainSparse = externalTerrainData && externalTerrainData.sparse && typeof externalTerrainData.sparse === "object"
    ? externalTerrainData.sparse
    : null;
  const externalTerrainLayers = externalTerrainData && Array.isArray(externalTerrainData.layers)
    ? externalTerrainData.layers
    : null;
  const externalTerrainLayerOrder = externalTerrainLayers
    ? externalTerrainLayers.map((layer, idx) => {
      const explicit = Number(layer && layer.index);
      if (Number.isFinite(explicit)) return explicit;
      const fallbackOrder = externalTerrainLayers.length === LEGACY_LAYER_IDS.length ? LEGACY_LAYER_IDS : LAYER_IDS;
      return fallbackOrder[idx] || (idx + 1);
    })
    : null;
  const externalTerrainLayerIndexById = new Map(
    externalTerrainLayerOrder
      ? externalTerrainLayerOrder.map((layerId, idx) => [layerId, idx])
      : [],
  );
  function getConfiguredSpawnTile() {
    const maxTileX = Math.max(0, Math.floor(WORLD.width / WORLD.tileSize) - 1);
    const maxTileY = Math.max(0, Math.floor(WORLD.height / WORLD.tileSize) - 1);
    const sx = externalTerrainData && externalTerrainData.spawn && Number.isFinite(externalTerrainData.spawn.x)
      ? Math.floor(externalTerrainData.spawn.x)
      : Math.floor(maxTileX * 0.5);
    const sy = externalTerrainData && externalTerrainData.spawn && Number.isFinite(externalTerrainData.spawn.y)
      ? Math.floor(externalTerrainData.spawn.y)
      : Math.floor(maxTileY * 0.5);
    return {
      x: clamp(sx, 0, maxTileX),
      y: clamp(sy, 0, maxTileY),
    };
  }
  function tileToWorldCenter(tx, ty) {
    return {
      x: tx * WORLD.tileSize + WORLD.tileSize * 0.5,
      y: ty * WORLD.tileSize + WORLD.tileSize * 0.5,
    };
  }
  const configuredSpawnTile = getConfiguredSpawnTile();
  const configuredSpawnWorld = tileToWorldCenter(configuredSpawnTile.x, configuredSpawnTile.y);
  function buildDefaultWorldItems() {
    return [
      {
        kind: "sickle",
        x: configuredSpawnWorld.x,
        y: configuredSpawnWorld.y - WORLD.tileSize * 3,
        pickupRadius: 20,
        pickupDelay: 0,
        collected: false,
      },
      {
        kind: "schop",
        x: configuredSpawnWorld.x + WORLD.tileSize,
        y: configuredSpawnWorld.y - WORLD.tileSize * 3,
        pickupRadius: 20,
        pickupDelay: 0,
        collected: false,
      },
      {
        kind: "hoes",
        x: configuredSpawnWorld.x + WORLD.tileSize * 2,
        y: configuredSpawnWorld.y - WORLD.tileSize * 3,
        pickupRadius: 20,
        pickupDelay: 0,
        collected: false,
      },
      {
        kind: "soil_sifter",
        x: configuredSpawnWorld.x + WORLD.tileSize * 3,
        y: configuredSpawnWorld.y - WORLD.tileSize * 3,
        pickupRadius: 20,
        pickupDelay: 0,
        collected: false,
      },
      {
        kind: "hammer",
        x: configuredSpawnWorld.x + WORLD.tileSize * 4,
        y: configuredSpawnWorld.y - WORLD.tileSize * 3,
        pickupRadius: 20,
        pickupDelay: 0,
        collected: false,
      },
    ];
  }

  const state = {
    mode: "char_select",
    time: 0,
    autosaveElapsed: 0,
    activeSaveSlot: -1,
    currentSlotPlaySeconds: 0,
    debugCollisionView: false,
    debugTimeOffsetHours: 0,
    debugTimeOverrideActive: false,
    player: {
      x: configuredSpawnWorld.x,
      y: configuredSpawnWorld.y,
      vx: 0,
      vy: 0,
      speed: 0,
      facing: "front",
      idleFrameTime: 0,
      idleFrameIndex: 0,
      runFrameTime: 0,
      runFrameIndex: 0,
      aimAngle: -Math.PI * 0.5,
    },
    camera: {
      x: configuredSpawnWorld.x,
      y: configuredSpawnWorld.y,
      vx: 0,
      vy: 0,
    },
    worldItems: buildDefaultWorldItems(),
    collectedToolKinds: new Set(),
    inventory: {
      slots: Array(9).fill(null),
      bag: Array(27).fill(null),
      selectedSlot: 0,
    },
    useEffects: [],
    tileOverrides: new Map(),
    clippingsTimers: new Map(),
    crops: new Map(),
    titleUi: {
      startRect: { x: 0, y: 0, w: 0, h: 0 },
      exitRect: { x: 0, y: 0, w: 0, h: 0 },
      hot: "",
      pressed: "",
    },
    saveSelectUi: {
      cards: Array.from({ length: SAVE_SLOT_COUNT }, () => ({
        cardRect: { x: 0, y: 0, w: 0, h: 0 },
        nameRect: { x: 0, y: 0, w: 0, h: 0 },
        startRect: { x: 0, y: 0, w: 0, h: 0 },
        deleteRect: { x: 0, y: 0, w: 0, h: 0 },
      })),
      hotStartIndex: -1,
      pressedStartIndex: -1,
      hotDeleteIndex: -1,
      pressedDeleteIndex: -1,
      editNameIndex: -1,
    },
    pauseUi: {
      saveRect: { x: 0, y: 0, w: 0, h: 0 },
      loadRect: { x: 0, y: 0, w: 0, h: 0 },
      titleRect: { x: 0, y: 0, w: 0, h: 0 },
      resumeRect: { x: 0, y: 0, w: 0, h: 0 },
      hot: "",
      pressed: "",
    },
    inventoryUi: {
      bagRects: Array.from({ length: 27 }, () => ({ x: 0, y: 0, w: 0, h: 0 })),
      quickRects: Array.from({ length: 9 }, () => ({ x: 0, y: 0, w: 0, h: 0 })),
      closeRect: { x: 0, y: 0, w: 0, h: 0 },
      quickBarReserve: 0,
      closePressed: false,
      hot: null,
      drag: {
        active: false,
        sourceType: "",
        sourceIndex: -1,
        entry: null,
        x: 0,
        y: 0,
      },
    },
    farmView: {
      targetZoom: CAMERA.defaultZoom,
      scanCooldown: 0,
      lastTileX: -1,
      lastTileY: -1,
    },
    selectedCharacterId: "",
    playerName: "",
    syncUi: {
      cardRects: [],
      copyRect: { x: 0, y: 0, w: 0, h: 0 },
      roomId: "",
      toast: "",
      toastUntil: 0,
      scrollY: 0,
      maxScrollY: 0,
      dragActive: false,
      dragMoved: false,
      dragStartY: 0,
      dragLastY: 0,
    },
    touchHud: {
      upRect: { x: 0, y: 0, w: 0, h: 0 },
      downRect: { x: 0, y: 0, w: 0, h: 0 },
      leftRect: { x: 0, y: 0, w: 0, h: 0 },
      rightRect: { x: 0, y: 0, w: 0, h: 0 },
      saveRect: { x: 0, y: 0, w: 0, h: 0 },
      useRect: { x: 0, y: 0, w: 0, h: 0 },
      inventoryRect: { x: 0, y: 0, w: 0, h: 0 },
      zoomInRect: { x: 0, y: 0, w: 0, h: 0 },
      zoomOutRect: { x: 0, y: 0, w: 0, h: 0 },
      active: "",
      pointerId: null,
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mapToObject(map) {
    const out = {};
    for (const [k, v] of map.entries()) out[k] = v;
    return out;
  }

  function mapsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a.entries()) {
      if (b.get(k) !== v) return false;
    }
    return true;
  }

  function setTileOverride(k, v) {
    if (state.tileOverrides.get(k) === v) return false;
    state.tileOverrides.set(k, v);
    pendingTilePatches.set(k, v);
    worldTilesDirty = true;
    return true;
  }

  function deleteTileOverride(k) {
    if (!state.tileOverrides.has(k)) return false;
    state.tileOverrides.delete(k);
    pendingTilePatches.set(k, null);
    worldTilesDirty = true;
    return true;
  }

  function objectToMap(obj) {
    const map = new Map();
    const src = obj && typeof obj === "object" ? obj : {};
    for (const k of Object.keys(src)) map.set(k, src[k]);
    return map;
  }

  function cloneTerrainCellRaw(raw) {
    if (raw == null) return null;
    if (typeof raw === "string") return raw;
    if (typeof raw === "object") {
      const id = String(raw.id || "");
      if (!id) return null;
      return {
        id,
        dir: raw.dir === "v" ? "v" : "h",
      };
    }
    return null;
  }

  function cloneSparseObject(src) {
    const out = {};
    const base = src && typeof src === "object" ? src : {};
    for (const [k, v] of Object.entries(base)) {
      const cell = cloneTerrainCellRaw(v);
      if (cell == null) continue;
      out[k] = cell;
    }
    return out;
  }

  function replaceObjectContents(target, next) {
    if (!target || typeof target !== "object") return;
    for (const k of Object.keys(target)) delete target[k];
    if (!next || typeof next !== "object") return;
    for (const [k, v] of Object.entries(next)) target[k] = v;
  }

  const initialTerrainLayersSparse = externalTerrainLayers
    ? externalTerrainLayers.map((layer) => cloneSparseObject(layer && layer.sparse))
    : null;
  const initialTerrainSparse = externalTerrainSparse
    ? cloneSparseObject(externalTerrainSparse)
    : null;

  function normalizeTerrainCellForSave(raw) {
    const cell = cloneTerrainCellRaw(raw);
    if (cell == null) return null;
    if (typeof cell === "string") return { id: cell, dir: "h" };
    return { id: String(cell.id || ""), dir: cell.dir === "v" ? "v" : "h" };
  }

  function terrainCellEquals(aRaw, bRaw) {
    const a = normalizeTerrainCellForSave(aRaw);
    const b = normalizeTerrainCellForSave(bRaw);
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.id === b.id && a.dir === b.dir;
  }

  function buildTerrainSaveData() {
    if (!(externalTerrainData && externalTerrainWidth > 0 && externalTerrainHeight > 0)) return null;
    if (externalTerrainLayers) {
      const layersPatch = [];
      for (let i = 0; i < externalTerrainLayers.length; i += 1) {
        const layer = externalTerrainLayers[i];
        const currentSparse = cloneSparseObject(layer && layer.sparse);
        const initialSparse = initialTerrainLayersSparse && initialTerrainLayersSparse[i]
          ? initialTerrainLayersSparse[i]
          : {};
        const patch = {};
        const keys = new Set([...Object.keys(initialSparse), ...Object.keys(currentSparse)]);
        for (const key of keys) {
          const baseCell = initialSparse[key];
          const nowCell = currentSparse[key];
        if (terrainCellEquals(baseCell, nowCell)) continue;
        patch[key] = nowCell == null ? null : normalizeTerrainCellForSave(nowCell);
      }
      if (Object.keys(patch).length > 0) {
          layersPatch.push({ index: externalTerrainLayerOrder ? externalTerrainLayerOrder[i] : (i + 1), sparsePatch: patch });
      }
      }
      if (!layersPatch.length) return null;
      return { layersPatch };
    }
    if (externalTerrainSparse && typeof externalTerrainSparse === "object") {
      const currentSparse = cloneSparseObject(externalTerrainSparse);
      const baseSparse = initialTerrainSparse || {};
      const sparsePatch = {};
      const keys = new Set([...Object.keys(baseSparse), ...Object.keys(currentSparse)]);
      for (const key of keys) {
        const baseCell = baseSparse[key];
        const nowCell = currentSparse[key];
        if (terrainCellEquals(baseCell, nowCell)) continue;
        sparsePatch[key] = nowCell == null ? null : normalizeTerrainCellForSave(nowCell);
      }
      if (!Object.keys(sparsePatch).length) return null;
      return { sparsePatch };
    }
    return null;
  }

  function buildTerrainFullSnapshot() {
    if (!(externalTerrainData && externalTerrainWidth > 0 && externalTerrainHeight > 0)) return null;
    if (externalTerrainLayers) {
      return {
        layers: externalTerrainLayers.map((layer, i) => ({
          index: externalTerrainLayerOrder ? externalTerrainLayerOrder[i] : (i + 1),
          sparse: cloneSparseObject(layer && layer.sparse),
        })),
      };
    }
    if (externalTerrainSparse && typeof externalTerrainSparse === "object") {
      return { sparse: cloneSparseObject(externalTerrainSparse) };
    }
    return null;
  }

  function applyTerrainSaveData(terrain) {
    if (!(externalTerrainData && externalTerrainWidth > 0 && externalTerrainHeight > 0)) return;
    if (externalTerrainLayers) {
      for (let i = 0; i < externalTerrainLayers.length; i += 1) {
        const layerData = externalTerrainLayers[i];
        if (!(layerData && typeof layerData === "object")) continue;
        if (!layerData.sparse || typeof layerData.sparse !== "object") layerData.sparse = {};
        const nextBase = initialTerrainLayersSparse && initialTerrainLayersSparse[i]
          ? initialTerrainLayersSparse[i]
          : {};
        replaceObjectContents(layerData.sparse, cloneSparseObject(nextBase));
      }
      if (externalTerrainSparse && typeof externalTerrainSparse === "object") {
        const firstBase = initialTerrainLayersSparse && initialTerrainLayersSparse[0]
          ? initialTerrainLayersSparse[0]
          : {};
        replaceObjectContents(externalTerrainSparse, cloneSparseObject(firstBase));
      }
    } else if (externalTerrainSparse && typeof externalTerrainSparse === "object") {
      replaceObjectContents(externalTerrainSparse, cloneSparseObject(initialTerrainSparse || {}));
    }
    if (!terrain || typeof terrain !== "object") return;

    // Backward compatibility: old full terrain save format.
    if (externalTerrainLayers && Array.isArray(terrain.layers)) {
      for (let i = 0; i < externalTerrainLayers.length; i += 1) {
        const layerData = externalTerrainLayers[i];
        if (!(layerData && typeof layerData === "object")) continue;
        const savedLayer = terrain.layers[i];
        const nextSparse = cloneSparseObject(savedLayer && savedLayer.sparse);
        if (!layerData.sparse || typeof layerData.sparse !== "object") layerData.sparse = {};
        replaceObjectContents(layerData.sparse, nextSparse);
      }
      if (externalTerrainSparse && typeof externalTerrainSparse === "object") {
        const firstLayer = externalTerrainLayers[0];
        replaceObjectContents(externalTerrainSparse, cloneSparseObject(firstLayer && firstLayer.sparse));
      }
      return;
    }

    // New patch format.
    if (externalTerrainLayers && Array.isArray(terrain.layersPatch)) {
      for (const patchLayer of terrain.layersPatch) {
        const layerIndex = getExternalTerrainLayerIndex(patchLayer && patchLayer.index);
        const layerData = externalTerrainLayers[layerIndex];
        if (!(layerData && layerData.sparse && typeof layerData.sparse === "object")) continue;
        const patch = patchLayer && patchLayer.sparsePatch && typeof patchLayer.sparsePatch === "object"
          ? patchLayer.sparsePatch
          : null;
        if (!patch) continue;
        for (const [k, v] of Object.entries(patch)) {
          if (v == null) {
            delete layerData.sparse[k];
          } else {
            const cell = normalizeTerrainCellForSave(v);
            if (!cell || !cell.id) {
              delete layerData.sparse[k];
            } else {
              layerData.sparse[k] = cell;
            }
          }
        }
      }
      if (externalTerrainSparse && typeof externalTerrainSparse === "object") {
        const firstLayer = externalTerrainLayers[0];
        replaceObjectContents(externalTerrainSparse, cloneSparseObject(firstLayer && firstLayer.sparse));
      }
      return;
    }

    if (externalTerrainSparse && typeof externalTerrainSparse === "object" && terrain.sparse) {
      replaceObjectContents(externalTerrainSparse, cloneSparseObject(terrain.sparse));
      return;
    }

    if (externalTerrainSparse && typeof externalTerrainSparse === "object" && terrain.sparsePatch) {
      const patch = terrain.sparsePatch && typeof terrain.sparsePatch === "object" ? terrain.sparsePatch : null;
      if (!patch) return;
      for (const [k, v] of Object.entries(patch)) {
        if (v == null) {
          delete externalTerrainSparse[k];
        } else {
          const cell = normalizeTerrainCellForSave(v);
          if (!cell || !cell.id) delete externalTerrainSparse[k];
          else externalTerrainSparse[k] = cell;
        }
      }
    }
  }

  function isStackableItem(kind) {
    return !!kind && !TOOL_ITEMS.has(kind);
  }

  function getSlotKind(entry) {
    if (!entry) return null;
    if (typeof entry === "string") return entry;
    if (typeof entry === "object" && typeof entry.kind === "string") return entry.kind;
    return null;
  }

  function getSlotCount(entry) {
    if (!entry) return 0;
    if (typeof entry === "string") return 1;
    if (typeof entry === "object") return Math.max(1, Number(entry.count) || 1);
    return 0;
  }

  function normalizeInventorySlots(slots, expectedLength = 9) {
    const src = Array.isArray(slots) ? slots : [];
    const normalized = [];
    for (let i = 0; i < expectedLength; i += 1) {
      const entry = src[i];
      const kind = getSlotKind(entry);
      if (!kind) {
        normalized.push(null);
        continue;
      }
      if (isStackableItem(kind)) {
        normalized.push({ kind, count: getSlotCount(entry) });
      } else {
        normalized.push(kind);
      }
    }
    while (normalized.length < expectedLength) normalized.push(null);
    return normalized;
  }

  function normalizeCollectedToolKinds(src) {
    const out = new Set();
    const arr = Array.isArray(src) ? src : [];
    for (const kind of arr) {
      const k = String(kind || "");
      if (UNIQUE_TOOL_KINDS.has(k)) out.add(k);
    }
    return out;
  }

  function rebuildCollectedToolKindsFromState() {
    const set = new Set();
    for (const entry of state.inventory.slots) {
      const kind = getSlotKind(entry);
      if (UNIQUE_TOOL_KINDS.has(kind)) set.add(kind);
    }
    for (const entry of state.inventory.bag) {
      const kind = getSlotKind(entry);
      if (UNIQUE_TOOL_KINDS.has(kind)) set.add(kind);
    }
    for (const it of state.worldItems) {
      if (!it || !it.collected) continue;
      if (UNIQUE_TOOL_KINDS.has(it.kind)) set.add(it.kind);
    }
    state.collectedToolKinds = set;
  }

  function applyCollectedToolVisibility() {
    if (!(state.collectedToolKinds instanceof Set)) state.collectedToolKinds = new Set();
    for (const it of state.worldItems) {
      if (!it || !UNIQUE_TOOL_KINDS.has(it.kind)) continue;
      if (state.collectedToolKinds.has(it.kind)) it.collected = true;
    }
  }

  function getSelectedItemKind() {
    return getSlotKind(state.inventory.slots[state.inventory.selectedSlot]);
  }

  function cloneSlotEntry(entry) {
    if (!entry) return null;
    if (typeof entry === "string") return entry;
    return { kind: entry.kind, count: getSlotCount(entry) };
  }

  function getEntryFromArea(area, index) {
    if (area === "quick") return state.inventory.slots[index] || null;
    if (area === "bag") return state.inventory.bag[index] || null;
    return null;
  }

  function setEntryToArea(area, index, entry) {
    if (area === "quick") state.inventory.slots[index] = entry || null;
    if (area === "bag") state.inventory.bag[index] = entry || null;
  }

  function normalizeCropsMap(map) {
    const out = new Map();
    if (!(map instanceof Map)) return out;
    const nowMs = Date.now();
    for (const [k, v] of map.entries()) {
      if (!v || typeof v !== "object") continue;
      const plantedAtMs = Number(v.plantedAtMs);
      const harvestAtMs = Number(v.harvestAtMs);
      if (Number.isFinite(plantedAtMs) && Number.isFinite(harvestAtMs) && harvestAtMs > plantedAtMs) {
        out.set(k, {
          plantedAtMs,
          harvestAtMs,
          rare: !!v.rare,
          fromHarvest: !!v.fromHarvest,
        });
      } else {
        // Backward compatibility for old crop format.
        const stage = clamp(Number(v.stage) || 1, 1, 6);
        const elapsedRatio = stage >= 5 ? 1 : stage >= 4 ? 0.85 : stage >= 3 ? 0.6 : stage >= 2 ? 0.3 : 0;
        const plantedFallback = nowMs - Math.floor(CLAMBON_FULL_GROW_MS * elapsedRatio);
        out.set(k, {
          plantedAtMs: plantedFallback,
          harvestAtMs: plantedFallback + CLAMBON_FULL_GROW_MS,
          rare: stage >= 6 || !!v.rareRoute,
          fromHarvest: stage >= 3,
        });
      }
    }
    return out;
  }

  function createDefaultSlot(index) {
    return {
      name: `データ${index + 1}`,
      totalPlaySeconds: 0,
      updatedAt: 0,
      payload: null,
    };
  }

  function normalizeSaveCollection(raw) {
    const out = {
      version: 2,
      lastSlot: 0,
      slots: Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => createDefaultSlot(i)),
    };
    if (!raw || typeof raw !== "object") return out;
    if (Array.isArray(raw.slots)) {
      for (let i = 0; i < SAVE_SLOT_COUNT; i += 1) {
        const s = raw.slots[i];
        if (!s || typeof s !== "object") continue;
        out.slots[i] = {
          name: typeof s.name === "string" && s.name.trim() ? s.name : `データ${i + 1}`,
          totalPlaySeconds: Math.max(0, Number(s.totalPlaySeconds) || 0),
          updatedAt: Math.max(0, Number(s.updatedAt) || 0),
          payload: s.payload && typeof s.payload === "object" ? s.payload : null,
        };
      }
      out.lastSlot = clamp(Number(raw.lastSlot) || 0, 0, SAVE_SLOT_COUNT - 1);
      return out;
    }
    return out;
  }

  function migrateLegacySingleSave() {
    try {
      const raw = localStorage.getItem(LEGACY_SAVE_STORAGE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || typeof payload !== "object") return null;
      const out = normalizeSaveCollection(null);
      out.slots[0] = {
        name: "データ1",
        totalPlaySeconds: Math.max(0, Number(payload?.state?.time) || 0),
        updatedAt: Date.now(),
        payload,
      };
      out.lastSlot = 0;
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(out));
      return out;
    } catch {
      return null;
    }
  }

  function readSaveCollection() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        const migrated = migrateLegacySingleSave();
        return migrated || normalizeSaveCollection(null);
      }
      return normalizeSaveCollection(JSON.parse(raw));
    } catch {
      return normalizeSaveCollection(null);
    }
  }

  function writeSaveCollection(collection) {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(normalizeSaveCollection(collection)));
  }

  function readCharacterStateCollection() {
    try {
      const raw = localStorage.getItem(CHARACTER_SAVE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeCharacterStateCollection(collection) {
    const out = collection && typeof collection === "object" ? collection : {};
    localStorage.setItem(CHARACTER_SAVE_STORAGE_KEY, JSON.stringify(out));
  }

  function getCharacterStateRef(characterId) {
    if (!db) return null;
    const id = String(characterId || "").trim();
    if (!id) return null;
    // Character progression is global across devices for this site.
    return ref(db, `characterStates/${id}`);
  }

  function getCropVisualStage(crop, nowMs) {
    if (!crop) return 0;
    const plantedAtMs = Number(crop.plantedAtMs) || nowMs;
    const harvestAtMs = Number(crop.harvestAtMs) || plantedAtMs + CLAMBON_FULL_GROW_MS;
    if (nowMs >= harvestAtMs) return crop.rare ? 6 : 5;

    const duration = Math.max(1, harvestAtMs - plantedAtMs);
    const progress = clamp((nowMs - plantedAtMs) / duration, 0, 0.9999);
    if (crop.fromHarvest) {
      // After harvest: once fruit appears, keep same fruit sprite until next harvest.
      // 0-25%: stage3, 25-100%: stage4(normal) or stage6(rare).
      if (progress < 0.25) return 3;
      return crop.rare ? 6 : 4;
    }
    if (progress < 0.25) return 1;
    if (progress < 0.5) return 2;
    if (progress < 0.75) return 3;
    // Initial growth: once fruit appears, keep it fixed.
    return crop.rare ? 6 : 4;
  }

  function findMatchingDefaultWorldItemIndex(defaultItems, item, used) {
    for (let i = 0; i < defaultItems.length; i += 1) {
      if (used.has(i)) continue;
      const d = defaultItems[i];
      if (!d || d.kind !== item.kind) continue;
      if (Math.abs((Number(d.x) || 0) - (Number(item.x) || 0)) > 0.01) continue;
      if (Math.abs((Number(d.y) || 0) - (Number(item.y) || 0)) > 0.01) continue;
      used.add(i);
      return i;
    }
    return -1;
  }

  function buildWorldItemsSaveData() {
    const defaults = buildDefaultWorldItems();
    const matched = new Set();
    const current = Array.isArray(state.worldItems) ? state.worldItems : [];
    const matchedDefaultByCurrent = new Map();
    for (let i = 0; i < current.length; i += 1) {
      const it = current[i];
      const idx = findMatchingDefaultWorldItemIndex(defaults, it, matched);
      if (idx >= 0) matchedDefaultByCurrent.set(i, idx);
    }

    const collectedDefaultIndices = [];
    for (let i = 0; i < defaults.length; i += 1) {
      let found = false;
      let collected = false;
      for (const [currentIdx, defIdx] of matchedDefaultByCurrent.entries()) {
        if (defIdx !== i) continue;
        found = true;
        collected = !!current[currentIdx]?.collected;
        break;
      }
      if (!found || collected) collectedDefaultIndices.push(i);
    }

    const droppedItems = [];
    for (let i = 0; i < current.length; i += 1) {
      if (matchedDefaultByCurrent.has(i)) continue;
      const it = current[i];
      if (!it || typeof it !== "object") continue;
      droppedItems.push({
        kind: it.kind,
        x: Number(it.x) || configuredSpawnWorld.x,
        y: Number(it.y) || configuredSpawnWorld.y,
        pickupRadius: Number(it.pickupRadius) || 20,
        pickupDelay: Math.max(0, Number(it.pickupDelay) || 0),
        collected: !!it.collected,
      });
    }

    if (!collectedDefaultIndices.length && !droppedItems.length) return null;
    return {
      collectedDefaultIndices,
      droppedItems,
    };
  }

  function applyWorldItemsSaveData(data) {
    const defaults = buildDefaultWorldItems();
    const collectedSet = new Set(
      Array.isArray(data?.collectedDefaultIndices)
        ? data.collectedDefaultIndices.map((n) => clamp(Number(n) || 0, 0, defaults.length - 1))
        : []
    );
    state.worldItems = defaults.map((it, i) => ({
      ...it,
      collected: collectedSet.has(i),
    }));
    const dropped = Array.isArray(data?.droppedItems) ? data.droppedItems : [];
    for (const it of dropped) {
      if (!it || typeof it !== "object") continue;
      state.worldItems.push({
        kind: it.kind,
        x: Number(it.x) || configuredSpawnWorld.x,
        y: Number(it.y) || configuredSpawnWorld.y,
        pickupRadius: Number(it.pickupRadius) || 20,
        pickupDelay: Math.max(0, Number(it.pickupDelay) || 0),
        collected: !!it.collected,
      });
    }
  }

  function buildSaveData() {
    return {
      version: 1,
      savedAt: Date.now(),
      state: {
        time: state.time,
        player: {
          x: state.player.x,
          y: state.player.y,
          vx: state.player.vx,
          vy: state.player.vy,
          speed: state.player.speed,
          facing: state.player.facing,
          idleFrameTime: state.player.idleFrameTime,
          idleFrameIndex: state.player.idleFrameIndex,
          runFrameTime: state.player.runFrameTime,
          runFrameIndex: state.player.runFrameIndex,
          aimAngle: state.player.aimAngle,
        },
        camera: {
          x: state.camera.x,
          y: state.camera.y,
          vx: state.camera.vx,
          vy: state.camera.vy,
        },
        worldItems: buildWorldItemsSaveData(),
        characterProgress: {
          collectedTools: [...state.collectedToolKinds],
        },
        terrainFull: buildTerrainFullSnapshot(),
        inventory: {
          slots: [...state.inventory.slots],
          bag: [...state.inventory.bag],
          selectedSlot: state.inventory.selectedSlot,
        },
        tileOverrides: mapToObject(state.tileOverrides),
        clippingsTimers: mapToObject(state.clippingsTimers),
        crops: mapToObject(state.crops),
        terrain: buildTerrainSaveData(),
      },
    };
  }

  function applySaveData(payload) {
    const root = payload && payload.state ? payload.state : payload;
    if (!root || typeof root !== "object") return false;
    if (!root.player || !root.camera || !root.inventory) return false;

    state.time = Number(root.time) || 0;
    state.player.x = Number(root.player.x) || state.player.x;
    state.player.y = Number(root.player.y) || state.player.y;
    state.player.vx = Number(root.player.vx) || 0;
    state.player.vy = Number(root.player.vy) || 0;
    state.player.speed = Number(root.player.speed) || 0;
    state.player.facing = root.player.facing || "front";
    state.player.idleFrameTime = Number(root.player.idleFrameTime) || 0;
    state.player.idleFrameIndex = Number(root.player.idleFrameIndex) || 0;
    state.player.runFrameTime = Number(root.player.runFrameTime) || 0;
    state.player.runFrameIndex = Number(root.player.runFrameIndex) || 0;
    state.player.aimAngle = Number(root.player.aimAngle) || -Math.PI * 0.5;

    state.camera.x = Number(root.camera.x) || state.camera.x;
    state.camera.y = Number(root.camera.y) || state.camera.y;
    state.camera.vx = Number(root.camera.vx) || 0;
    state.camera.vy = Number(root.camera.vy) || 0;

    state.inventory.slots = normalizeInventorySlots(root.inventory.slots, 9);
    state.inventory.bag = normalizeInventorySlots(root.inventory.bag || [], 27);
    if (state.inventory.bag.length !== 27) {
      state.inventory.bag = state.inventory.bag.slice(0, 27);
      while (state.inventory.bag.length < 27) state.inventory.bag.push(null);
    }
    state.inventory.selectedSlot = clamp(Number(root.inventory.selectedSlot) || 0, 0, 8);
    state.collectedToolKinds = normalizeCollectedToolKinds(root.characterProgress?.collectedTools);

    if (Array.isArray(root.worldItems) && root.worldItems.length) {
      // Backward compatibility for old full world item save format.
      state.worldItems = root.worldItems.map((it) => ({
        kind: it.kind,
        x: Number(it.x) || configuredSpawnWorld.x,
        y: Number(it.y) || configuredSpawnWorld.y,
        pickupRadius: Number(it.pickupRadius) || 20,
        pickupDelay: Math.max(0, Number(it.pickupDelay) || 0),
        collected: !!it.collected,
      }));
    } else {
      applyWorldItemsSaveData(root.worldItems);
    }
    if (!state.collectedToolKinds.size) rebuildCollectedToolKindsFromState();
    applyCollectedToolVisibility();

    state.tileOverrides = objectToMap(root.tileOverrides);
    pendingTilePatches.clear();
    worldTilesDirty = true;
    state.clippingsTimers = objectToMap(root.clippingsTimers);
    const nowMs = Date.now();
    for (const [k, v] of state.clippingsTimers.entries()) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        state.clippingsTimers.set(k, nowMs + CLIPPINGS_REGROWTH_MS);
      } else if (n < 1000000000000) {
        // Backward compatibility: old save had elapsed seconds.
        state.clippingsTimers.set(k, nowMs + Math.max(0, CLIPPINGS_REGROWTH_MS - Math.floor(n * 1000)));
      } else {
        state.clippingsTimers.set(k, n);
      }
    }
    state.crops = normalizeCropsMap(objectToMap(root.crops));
    if (root.terrainFull && typeof root.terrainFull === "object") {
      applyTerrainSaveData(root.terrainFull);
    } else {
      applyTerrainSaveData(root.terrain);
    }
    ensureRequiredToolsAvailable();
    state.useEffects = [];
    state.autosaveElapsed = 0;
    return true;
  }

  function hasInventoryItemKind(kind) {
    for (const entry of state.inventory.slots) {
      if (getSlotKind(entry) === kind) return true;
    }
    for (const entry of state.inventory.bag) {
      if (getSlotKind(entry) === kind) return true;
    }
    return false;
  }

  function hasWorldItemKind(kind) {
    return state.worldItems.some((it) => !it.collected && it.kind === kind);
  }

  function ensureRequiredToolsAvailable() {
    const required = [
      { kind: "sickle", dx: 0 },
      { kind: "schop", dx: WORLD.tileSize },
      { kind: "hoes", dx: WORLD.tileSize * 2 },
      { kind: "soil_sifter", dx: WORLD.tileSize * 3 },
      { kind: "hammer", dx: WORLD.tileSize * 4 },
    ];
    for (const req of required) {
      if (state.collectedToolKinds.has(req.kind)) continue;
      if (hasInventoryItemKind(req.kind)) continue;
      if (hasWorldItemKind(req.kind)) continue;
      state.worldItems.push({
        kind: req.kind,
        x: configuredSpawnWorld.x + req.dx,
        y: configuredSpawnWorld.y - WORLD.tileSize * 3,
        pickupRadius: 20,
        pickupDelay: 0,
        collected: false,
      });
    }
  }

  function saveGameToStorage(auto = false) {
    if (state.activeSaveSlot < 0 || state.activeSaveSlot >= SAVE_SLOT_COUNT) return false;
    try {
      const collection = readSaveCollection();
      const payload = buildSaveData();
      const slot = collection.slots[state.activeSaveSlot] || createDefaultSlot(state.activeSaveSlot);
      collection.slots[state.activeSaveSlot] = {
        ...slot,
        totalPlaySeconds: state.currentSlotPlaySeconds,
        updatedAt: Date.now(),
        payload,
      };
      collection.lastSlot = state.activeSaveSlot;
      writeSaveCollection(collection);
      if (!auto) console.log("saved");
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  function saveCharacterState(auto = false) {
    const characterId = String(state.selectedCharacterId || "");
    if (!characterId) return false;
    const entry = {
      updatedAt: Date.now(),
      totalPlaySeconds: Math.max(0, Number(state.currentSlotPlaySeconds) || 0),
      payload: buildSaveData(),
    };
    let localOk = true;
    try {
      const collection = readCharacterStateCollection();
      collection[characterId] = entry;
      writeCharacterStateCollection(collection);
    } catch (err) {
      localOk = false;
      console.error(err);
    }
    const cloudRef = getCharacterStateRef(characterId);
    if (cloudRef) {
      set(cloudRef, entry).catch((err) => setSyncError(err));
    }
    if (!auto) console.log("saved character state");
    return localOk;
  }

  function loadCharacterStateLocal(characterId) {
    const id = String(characterId || "");
    if (!id) return false;
    try {
      const collection = readCharacterStateCollection();
      const entry = collection[id];
      if (!entry || typeof entry !== "object" || !entry.payload) return false;
      const ok = applySaveData(entry.payload);
      if (!ok) return false;
      state.currentSlotPlaySeconds = Math.max(0, Number(entry.totalPlaySeconds) || state.currentSlotPlaySeconds);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async function loadCharacterState(characterId) {
    const id = String(characterId || "");
    if (!id) return false;
    const cloudRef = getCharacterStateRef(id);
    if (cloudRef) {
      try {
        const snapshot = await get(cloudRef);
        const entry = snapshot.exists() ? snapshot.val() : null;
        if (entry && typeof entry === "object" && entry.payload) {
          const ok = applySaveData(entry.payload);
          if (ok) {
            state.currentSlotPlaySeconds = Math.max(0, Number(entry.totalPlaySeconds) || state.currentSlotPlaySeconds);
            // Keep a local cache fallback, but source of truth is Firebase.
            const collection = readCharacterStateCollection();
            collection[id] = entry;
            writeCharacterStateCollection(collection);
            return true;
          }
        }
      } catch (err) {
        setSyncError(err);
      }
    }
    return loadCharacterStateLocal(id);
  }

  function loadGameFromStorage(slotIndex = state.activeSaveSlot) {
    try {
      if (slotIndex < 0 || slotIndex >= SAVE_SLOT_COUNT) return false;
      const collection = readSaveCollection();
      const payload = collection.slots[slotIndex]?.payload;
      if (!payload) return false;
      return applySaveData(payload);
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  function tryCloseTab() {
    window.close();
    setTimeout(() => {
      if (!window.closed) {
        alert("このタブは自動で閉じられません。手動で閉じてください。");
      }
    }, 80);
  }

  function resetGameplayState() {
    state.time = 0;
    state.autosaveElapsed = 0;
    state.player = {
      x: configuredSpawnWorld.x,
      y: configuredSpawnWorld.y,
      vx: 0,
      vy: 0,
      speed: 0,
      facing: "front",
      idleFrameTime: 0,
      idleFrameIndex: 0,
      runFrameTime: 0,
      runFrameIndex: 0,
      aimAngle: -Math.PI * 0.5,
    };
    state.camera = {
      x: configuredSpawnWorld.x,
      y: configuredSpawnWorld.y,
      vx: 0,
      vy: 0,
    };
    state.worldItems = buildDefaultWorldItems();
    state.collectedToolKinds = new Set();
    state.inventory.slots = Array(9).fill(null);
    state.inventory.bag = Array(27).fill(null);
    state.inventory.selectedSlot = 0;
    state.useEffects = [];
    state.tileOverrides = new Map();
    pendingTilePatches.clear();
    worldTilesDirty = true;
    state.clippingsTimers = new Map();
    state.crops = new Map();
    state.farmView.targetZoom = CAMERA.defaultZoom;
    state.farmView.scanCooldown = 0;
    state.farmView.lastTileX = -1;
    state.farmView.lastTileY = -1;
    state.currentSlotPlaySeconds = 0;
    ensureRequiredToolsAvailable();
  }

  function getSaveSlotsView() {
    return readSaveCollection().slots.map((slot, i) => ({
      index: i,
      name: slot.name || `データ${i + 1}`,
      totalPlaySeconds: Math.max(0, Number(slot.totalPlaySeconds) || 0),
      updatedAt: Math.max(0, Number(slot.updatedAt) || 0),
      hasData: !!slot.payload,
    }));
  }

  function formatPlayTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  function drawEllipsisText(text, x, y, maxWidth) {
    const raw = String(text ?? "");
    if (ctx.measureText(raw).width <= maxWidth) {
      ctx.fillText(raw, x, y);
      return;
    }
    let t = raw;
    while (t.length > 0 && ctx.measureText(`${t}…`).width > maxWidth) {
      t = t.slice(0, -1);
    }
    ctx.fillText(t.length ? `${t}…` : "", x, y);
  }

  function smoothDamp(current, target, velocityRef, smoothTime, dt) {
    const t = Math.max(0.0001, smoothTime);
    const omega = 2 / t;
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const temp = (velocityRef.value + omega * change) * dt;
    velocityRef.value = (velocityRef.value - omega * temp) * exp;
    return target + (change + temp) * exp;
  }

  function loadImage(path) {
    const raw = String(path || "");
    let resolved = raw;
    if (raw.startsWith("assets/player/") || raw.startsWith("assets/ui/")) {
      resolved = `${ROOT_ASSET_ROOT}${raw.slice("assets/".length)}`;
    } else if (raw.startsWith("assets/")) {
      resolved = `${FARM_ASSET_ROOT}${raw.slice("assets/".length)}`;
    }
    if (imageCache.has(resolved)) return imageCache.get(resolved);
    const img = new Image();
    img.src = resolved;
    imageCache.set(resolved, img);
    return img;
  }

  function getShadowSilhouette(path) {
    if (shadowSilhouetteCache.has(path)) return shadowSilhouetteCache.get(path);
    const img = loadImage(path);
    if (!(img.complete && img.naturalWidth > 0)) return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cx = c.getContext("2d", { willReadFrequently: true });
    cx.imageSmoothingEnabled = false;
    cx.clearRect(0, 0, c.width, c.height);
    cx.drawImage(img, 0, 0);
    // Avoid getImageData to stay compatible with tainted canvases (CORS/file://).
    cx.globalCompositeOperation = "source-in";
    cx.fillStyle = "#000";
    cx.fillRect(0, 0, c.width, c.height);
    cx.globalCompositeOperation = "source-over";
    shadowSilhouetteCache.set(path, c);
    return c;
  }

  function getSpritePath(characterId, key) {
    const cid = String(characterId || "raft");
    const frame = String(key || "front_idle1");
    return `assets/player/${cid}/${frame}.png`;
  }

  function loadSprite(name, characterId = state.selectedCharacterId) {
    return loadImage(getSpritePath(characterId, name));
  }

  function worldToScreen(wx, wy) {
    return {
      x: (wx - state.camera.x) * CAMERA.zoom + canvas.clientWidth * 0.5,
      y: (wy - state.camera.y) * CAMERA.zoom + canvas.clientHeight * 0.5,
    };
  }

  function getTileViewBounds(padding = 1) {
    const tileSize = WORLD.tileSize;
    const viewHalfW = (canvas.clientWidth * 0.5) / CAMERA.zoom;
    const viewHalfH = (canvas.clientHeight * 0.5) / CAMERA.zoom;
    return {
      tileSize,
      drawTile: tileSize * CAMERA.zoom,
      startX: Math.floor((state.camera.x - viewHalfW) / tileSize) - padding,
      endX: Math.floor((state.camera.x + viewHalfW) / tileSize) + padding,
      startY: Math.floor((state.camera.y - viewHalfH) / tileSize) - padding,
      endY: Math.floor((state.camera.y + viewHalfH) / tileSize) + padding,
    };
  }

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(640, Math.floor(window.innerWidth));
    const height = Math.max(360, Math.floor(window.innerHeight));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function hasLayer2CollisionAtTile(tx, ty) {
    const cell = getTerrainCellAt(tx, ty, 2);
    if (!(cell && cell.id)) return false;
    return getLayer2CollisionModeAtTile(tx, ty) !== "none";
  }

  function hasAnyLayer2TileAtTile(tx, ty) {
    const cell = getTerrainCellAt(tx, ty, 2);
    return !!(cell && cell.id);
  }

  function normalizeCollisionMode(v) {
    if (v === "h" || v === "v" || v === "full" || v === "none") return v;
    return "none";
  }

  function inferLegacyCollisionModeById(id) {
    const s = String(id || "");
    if (!s) return "none";
    if (s === "barrier0") return "full";
    if (s === "barrier1") return "h";
    if (s === "barrier2") return "v";
    if (s === "barrier6" || s === "barrier7") return "v";
    if (s === "barrier8" || s === "barrier9") return "h";
    if (s.startsWith("barrier")) return "full";
    return "none";
  }

  function getLayer2CollisionModeAtTile(tx, ty) {
    const cell = getTerrainCellAt(tx, ty, 2);
    if (!(cell && cell.id)) return "none";
    const byTile = normalizeCollisionMode(externalTileCollisionById.get(cell.id));
    if (byTile !== "none") return byTile;
    // Backward compatibility for old per-cell dir data.
    if (cell.dir === "h" || cell.dir === "v") return cell.dir;
    return inferLegacyCollisionModeById(cell.id);
  }

  function isLayer2SolidAtWorldPoint(wx, wy) {
    const tx = Math.floor(wx / WORLD.tileSize);
    const ty = Math.floor(wy / WORLD.tileSize);
    const cell = getTerrainCellAt(tx, ty, 2);
    if (!(cell && cell.id)) return false;
    const localX = wx - tx * WORLD.tileSize;
    const localY = wy - ty * WORLD.tileSize;

    // If tile.js provides a per-pixel collision mask, it takes priority.
    const maskRows = externalTileCollisionMaskById.get(cell.id);
    if (maskRows) {
      const mx = clamp(Math.floor((localX / WORLD.tileSize) * 16), 0, 15);
      const my = clamp(Math.floor((localY / WORLD.tileSize) * 16), 0, 15);
      const row = maskRows[my] || 0;
      return !!(row & (1 << mx));
    }

    const mode = getLayer2CollisionModeAtTile(tx, ty);
    if (mode === "none") return false;
    const collideStartY = WORLD.tileSize * 0.72;
    const sideMargin = WORLD.tileSize * 0.08;
    const horizontalSolid =
      localY >= collideStartY &&
      localX >= sideMargin &&
      localX <= WORLD.tileSize - sideMargin;

    if (mode === "full") {
      // "full" = horizontal behavior + side-entry block.
      // Front/back movement follows horizontal mode,
      // and left/right entry is blocked by side walls.
      const sideWallW = WORLD.tileSize * 0.14;
      const sideSolid = localX <= sideWallW || localX >= WORLD.tileSize - sideWallW;
      return horizontalSolid || sideSolid;
    }
    if (mode === "v") {
      // Vertical fence: collide on a central vertical band.
      const bandHalf = WORLD.tileSize * 0.16;
      const cx = WORLD.tileSize * 0.5;
      if (Math.abs(localX - cx) > bandHalf) return false;
      if (localY < WORLD.tileSize * 0.08) return false;
      return true;
    }
    // Horizontal fence: collide on lower band, almost full width.
    return horizontalSolid;
  }

  function isLayer2BlockedForPlayer(x, y, radius) {
    const probes = getPlayerCollisionProbeOffsets(getCurrentPlayerSpriteKey());
    for (const [ox, oy] of probes) {
      if (isLayer2SolidAtWorldPoint(x + ox, y + oy)) return true;
    }
    if (!probes.length) {
      const s = radius * 0.72;
      const foot = radius * 0.55;
      const fallbackProbes = [
        [x, y],
        [x + radius, y], [x - radius, y], [x, y + radius], [x, y - radius],
        [x + s, y + s], [x + s, y - s], [x - s, y + s], [x - s, y - s],
        [x, y + foot], [x + s * 0.7, y + foot], [x - s * 0.7, y + foot],
      ];
      for (const [px, py] of fallbackProbes) {
        if (isLayer2SolidAtWorldPoint(px, py)) return true;
      }
    }
    return false;
  }

  function isPlayerBlockedAt(x, y, radius) {
    const minX = BARRIER_INSET + radius;
    const maxX = WORLD.width - BARRIER_INSET - radius;
    const minY = BARRIER_INSET_TOP + radius;
    const maxY = WORLD.height - BARRIER_INSET - radius;
    if (x < minX || x > maxX || y < minY || y > maxY) return true;

    return isLayer2BlockedForPlayer(x, y, radius);
  }

  function updatePlayer(dt) {
    const accel = 900;
    const maxSpeed = 240;
    const drag = 8.4;
    const wallBounce = 0.52;
    const wallPushSpeed = 110;

    let inputX = 0;
    let inputY = 0;
    if (keys.has("ArrowLeft") || mobileInput.left) inputX -= 1;
    if (keys.has("ArrowRight") || mobileInput.right) inputX += 1;
    if (keys.has("ArrowUp") || mobileInput.up) inputY -= 1;
    if (keys.has("ArrowDown") || mobileInput.down) inputY += 1;

    state.player.vx += inputX * accel * dt;
    state.player.vy += inputY * accel * dt;

    if (inputX === 0) state.player.vx *= Math.exp(-drag * dt);
    if (inputY === 0) state.player.vy *= Math.exp(-drag * dt);

    state.player.vx = clamp(state.player.vx, -maxSpeed, maxSpeed);
    state.player.vy = clamp(state.player.vy, -maxSpeed, maxSpeed);

    const r = PLAYER.hitRadiusWorld;
    pushPlayerOutIfBlocked();
    const desiredFacing = inputX < 0 ? "left"
      : inputX > 0 ? "right"
      : inputY < 0 ? "front"
      : inputY > 0 ? "back"
      : null;
    const nextX = state.player.x + state.player.vx * dt;
    if (!isPlayerBlockedAt(nextX, state.player.y, r)) {
      state.player.x = nextX;
    } else {
      const hitDirX = Math.sign(state.player.vx || inputX || 0);
      state.player.vx = -state.player.vx * wallBounce;
      if (inputX !== 0) state.player.vx -= hitDirX * wallPushSpeed;
    }

    const nextY = state.player.y + state.player.vy * dt;
    if (!isPlayerBlockedAt(state.player.x, nextY, r)) {
      state.player.y = nextY;
    } else {
      const hitDirY = Math.sign(state.player.vy || inputY || 0);
      state.player.vy = -state.player.vy * wallBounce;
      if (inputY !== 0) state.player.vy -= hitDirY * wallPushSpeed;
    }
    pushPlayerOutIfBlocked();

    state.player.speed = Math.hypot(state.player.vx, state.player.vy);

    if (desiredFacing) {
      state.player.facing = desiredFacing;
    } else if (Math.abs(state.player.vx) > Math.abs(state.player.vy) && Math.abs(state.player.vx) > 4) {
      state.player.facing = state.player.vx > 0 ? "right" : "left";
    } else if (Math.abs(state.player.vy) > 4) {
      state.player.facing = state.player.vy < 0 ? "front" : "back";
    }

    if (state.player.speed > 14) {
      state.player.aimAngle = Math.atan2(state.player.vy, state.player.vx);
    } else if (state.player.facing === "right") {
      state.player.aimAngle = 0;
    } else if (state.player.facing === "left") {
      state.player.aimAngle = Math.PI;
    } else if (state.player.facing === "front") {
      state.player.aimAngle = -Math.PI * 0.5;
    } else {
      state.player.aimAngle = Math.PI * 0.5;
    }

    const moving = state.player.speed > 10;
    if (moving) {
      state.player.runFrameTime += dt;
      if (state.player.runFrameTime >= 0.12) {
        state.player.runFrameTime = 0;
        state.player.runFrameIndex = (state.player.runFrameIndex + 1) % 4;
      }
    } else {
      state.player.idleFrameTime += dt;
      if (state.player.idleFrameTime >= 0.24) {
        state.player.idleFrameTime = 0;
        state.player.idleFrameIndex = (state.player.idleFrameIndex + 1) % 2;
      }
    }
  }

  function updateCamera(dt) {
    const xVel = { value: state.camera.vx };
    const yVel = { value: state.camera.vy };

    state.camera.x = smoothDamp(state.camera.x, state.player.x, xVel, 0.2, dt);
    state.camera.y = smoothDamp(state.camera.y, state.player.y, yVel, 0.24, dt);

    const halfW = (canvas.clientWidth * 0.5) / CAMERA.zoom;
    const halfH = (canvas.clientHeight * 0.5) / CAMERA.zoom;
    state.camera.x = clamp(state.camera.x, halfW, WORLD.width - halfW);
    state.camera.y = clamp(state.camera.y, halfH, WORLD.height - halfH);

    state.camera.vx = xVel.value;
    state.camera.vy = yVel.value;
  }

  function addInventoryItem(kind) {
    if (isStackableItem(kind)) {
      for (let i = 0; i < state.inventory.slots.length; i += 1) {
        const entry = state.inventory.slots[i];
        if (getSlotKind(entry) !== kind) continue;
        const nextCount = getSlotCount(entry) + 1;
        state.inventory.slots[i] = { kind, count: nextCount };
        return i;
      }
      for (let i = 0; i < state.inventory.bag.length; i += 1) {
        const entry = state.inventory.bag[i];
        if (getSlotKind(entry) !== kind) continue;
        const nextCount = getSlotCount(entry) + 1;
        state.inventory.bag[i] = { kind, count: nextCount };
        return i;
      }
      for (let i = 0; i < state.inventory.bag.length; i += 1) {
        if (state.inventory.bag[i] === null) {
          state.inventory.bag[i] = { kind, count: 1 };
          return i;
        }
      }
      for (let i = 0; i < state.inventory.slots.length; i += 1) {
        if (state.inventory.slots[i] === null) {
          state.inventory.slots[i] = { kind, count: 1 };
          return i;
        }
      }
      return -1;
    }
    for (let i = 0; i < state.inventory.slots.length; i += 1) {
      if (state.inventory.slots[i] === null) {
        state.inventory.slots[i] = kind;
        return i;
      }
    }
    for (let i = 0; i < state.inventory.bag.length; i += 1) {
      if (state.inventory.bag[i] === null) {
        state.inventory.bag[i] = kind;
        return i;
      }
    }
    return -1;
  }

  function consumeSelectedItemOnce(expectedKind) {
    const i = state.inventory.selectedSlot;
    const entry = state.inventory.slots[i];
    if (getSlotKind(entry) !== expectedKind) return false;
    if (!isStackableItem(expectedKind)) {
      state.inventory.slots[i] = null;
      return true;
    }
    const count = getSlotCount(entry);
    if (count <= 1) {
      state.inventory.slots[i] = null;
    } else {
      state.inventory.slots[i] = { kind: expectedKind, count: count - 1 };
    }
    return true;
  }

  function updateWorldItem(dt) {
    for (const item of state.worldItems) {
      if (item.collected) continue;
      if (item.pickupDelay && item.pickupDelay > 0) {
        item.pickupDelay = Math.max(0, item.pickupDelay - dt);
        continue;
      }
      const dx = state.player.x - item.x;
      const dy = state.player.y - item.y;
      if (Math.abs(dx) > WORLD.tileSize * 3 || Math.abs(dy) > WORLD.tileSize * 3) continue;
      const pickupR = PLAYER.hitRadiusWorld + item.pickupRadius;
      if (dx * dx + dy * dy <= pickupR * pickupR) {
        const slotIndex = addInventoryItem(item.kind);
        if (slotIndex >= 0) {
          item.collected = true;
          if (UNIQUE_TOOL_KINDS.has(item.kind)) state.collectedToolKinds.add(item.kind);
          saveCharacterState(true);
        }
      }
    }
  }

  function maybeDropClambonSeedAtTile(tx, ty) {
    if (Math.random() >= 0.3) return;
    const cx = tx * WORLD.tileSize + WORLD.tileSize * 0.5;
    const cy = ty * WORLD.tileSize + WORLD.tileSize * 0.5;
    for (const item of state.worldItems) {
      if (item.collected || item.kind !== "clambon_seed") continue;
      const dx = item.x - cx;
      const dy = item.y - cy;
      if (dx * dx + dy * dy <= (WORLD.tileSize * 0.4) * (WORLD.tileSize * 0.4)) {
        return;
      }
    }
    state.worldItems.push({
      kind: "clambon_seed",
      x: cx,
      y: cy,
      pickupRadius: 20,
      pickupDelay: 0.2,
      collected: false,
    });
  }

  function spawnDroppedItem(kind, x, y, spread = 18) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    const px = clamp(x + Math.cos(angle) * r, 6, WORLD.width - 6);
    const py = clamp(y + Math.sin(angle) * r, 6, WORLD.height - 6);
    state.worldItems.push({
      kind,
      x: px,
      y: py,
      pickupRadius: 20,
      pickupDelay: 0.35,
      collected: false,
    });
  }

  function triggerUseAction() {
    const held = getSelectedItemKind();
    const handler = held ? ITEM_USE_HANDLERS[held] : null;
    const changed = handler ? !!handler() : tryHarvestClambonAtForwardTile();
    if (!changed) return;
    state.useEffects.push({
      x: state.player.x,
      y: state.player.y,
      angle: state.player.aimAngle,
      age: 0,
      duration: 0.24,
    });
  }

  function updateUseEffects(dt) {
    for (const fx of state.useEffects) {
      fx.age += dt;
    }
    state.useEffects = state.useEffects.filter((fx) => fx.age < fx.duration);
  }

  function tileKey(tx, ty) {
    return `${tx},${ty}`;
  }

  function getCrop(tx, ty) {
    return state.crops.get(tileKey(tx, ty)) || null;
  }

  function setCrop(tx, ty, crop) {
    state.crops.set(tileKey(tx, ty), crop);
  }

  function removeCrop(tx, ty) {
    state.crops.delete(tileKey(tx, ty));
  }

  function normalizeTerrainCellValue(raw) {
    if (raw == null) return null;
    if (typeof raw === "string") return { id: raw, dir: "h" };
    if (typeof raw === "object") {
      const id = String(raw.id || "");
      if (!id) return null;
      return { id, dir: raw.dir === "v" ? "v" : "h" };
    }
    return null;
  }

  function getExternalTerrainCellAt(layer, localX, localY) {
    if (!externalTerrainData) return null;
    if (externalTerrainLayers) {
      const layerIndex = getExternalTerrainLayerIndex(layer);
      const data = externalTerrainLayers[layerIndex];
      if (data && data.sparse && typeof data.sparse === "object") {
        return normalizeTerrainCellValue(data.sparse[`${localX},${localY}`] ?? null);
      }
      if (layerIndex === 0 && externalTerrainSparse) {
        return normalizeTerrainCellValue(externalTerrainSparse[`${localX},${localY}`] ?? null);
      }
      return null;
    }
    if (Array.isArray(externalTerrainData.tiles)) {
      const idx = localY * externalTerrainWidth + localX;
      return normalizeTerrainCellValue(externalTerrainData.tiles[idx] ?? null);
    }
    if (externalTerrainSparse) {
      return normalizeTerrainCellValue(externalTerrainSparse[`${localX},${localY}`] ?? null);
    }
    return null;
  }

  function getTerrainCellAt(tx, ty, layer = 1) {
    if (!(externalTerrainData && externalTerrainWidth > 0 && externalTerrainHeight > 0)) return null;
    const localX = tx - externalTerrainOriginX;
    const localY = ty - externalTerrainOriginY;
    if (localX < 0 || localY < 0 || localX >= externalTerrainWidth || localY >= externalTerrainHeight) return null;
    return getExternalTerrainCellAt(layer, localX, localY);
  }

  function isFenceTileId(id) {
    return /^barrier([0-9]|10)$/.test(String(id || ""));
  }

  function setLayerTileAt(tx, ty, id, layer = 2) {
    if (!(externalTerrainData && externalTerrainWidth > 0 && externalTerrainHeight > 0)) return false;
    const localX = tx - externalTerrainOriginX;
    const localY = ty - externalTerrainOriginY;
    if (localX < 0 || localY < 0 || localX >= externalTerrainWidth || localY >= externalTerrainHeight) return false;
    const key = `${localX},${localY}`;
    if (externalTerrainLayers) {
      const layerIndex = getExternalTerrainLayerIndex(layer);
      const data = externalTerrainLayers[layerIndex];
      if (!(data && data.sparse && typeof data.sparse === "object")) return false;
      if (!id) delete data.sparse[key];
      else data.sparse[key] = { id: String(id), dir: "h" };
      if (layerIndex === 0 && externalTerrainSparse && typeof externalTerrainSparse === "object") {
        if (!id) delete externalTerrainSparse[key];
        else externalTerrainSparse[key] = String(id);
      }
      return true;
    }
    return false;
  }

  function removeLayerTileAt(tx, ty, layer = 2) {
    if (!(externalTerrainData && externalTerrainWidth > 0 && externalTerrainHeight > 0)) return false;
    const localX = tx - externalTerrainOriginX;
    const localY = ty - externalTerrainOriginY;
    if (localX < 0 || localY < 0 || localX >= externalTerrainWidth || localY >= externalTerrainHeight) return false;
    const key = `${localX},${localY}`;
    if (externalTerrainLayers) {
      const layerIndex = getExternalTerrainLayerIndex(layer);
      const data = externalTerrainLayers[layerIndex];
      if (!(data && data.sparse && typeof data.sparse === "object")) return false;
      if (!(key in data.sparse)) return false;
      delete data.sparse[key];
      if (layerIndex === 0 && externalTerrainSparse && typeof externalTerrainSparse === "object") {
        delete externalTerrainSparse[key];
      }
      return true;
    }
    return false;
  }

  function getFenceAutoTileId(tx, ty) {
    const hasL = isFenceTileId(getTerrainCellAt(tx - 1, ty, 2)?.id);
    const hasR = isFenceTileId(getTerrainCellAt(tx + 1, ty, 2)?.id);
    const hasU = isFenceTileId(getTerrainCellAt(tx, ty - 1, 2)?.id);
    const hasD = isFenceTileId(getTerrainCellAt(tx, ty + 1, 2)?.id);

    // Horizontal priority first.
    if (hasL || hasR) {
      if (hasL && hasR) return "barrier1";       // left + right
      if (hasR && hasD) return "barrier3";       // right + down
      if (hasL && hasD) return "barrier4";       // left + down
      if (hasL && hasU) return "barrier5";       // left + up
      if (hasU && hasR) return "barrier10";      // up + right
      if (hasR) return "barrier8";               // right only
      if (hasL) return "barrier9";               // left only
    }
    if (hasU && hasD) return "barrier2";         // up + down
    if (hasU) return "barrier6";                 // up only
    if (hasD) return "barrier7";                 // down only
    // isolated fallback
    return "barrier0";
  }

  function recalcFenceAt(tx, ty) {
    const cell = getTerrainCellAt(tx, ty, 2);
    if (!(cell && isFenceTileId(cell.id))) return;
    const nextId = getFenceAutoTileId(tx, ty);
    setLayerTileAt(tx, ty, nextId, 2);
  }

  function recalcFenceAround(tx, ty) {
    recalcFenceAt(tx, ty);
    recalcFenceAt(tx - 1, ty);
    recalcFenceAt(tx + 1, ty);
    recalcFenceAt(tx, ty - 1);
    recalcFenceAt(tx, ty + 1);
  }

  function pushPlayerOutIfBlocked() {
    const r = PLAYER.hitRadiusWorld;
    if (!isPlayerBlockedAt(state.player.x, state.player.y, r)) return false;

    const originX = state.player.x;
    const originY = state.player.y;
    const angleStep = Math.PI / 8;
    const maxDist = WORLD.tileSize * 2.5;
    const stepDist = 4;

    for (let dist = stepDist; dist <= maxDist; dist += stepDist) {
      for (let i = 0; i < 16; i += 1) {
        const a = i * angleStep;
        const nx = originX + Math.cos(a) * dist;
        const ny = originY + Math.sin(a) * dist;
        if (isPlayerBlockedAt(nx, ny, r)) continue;
        state.player.x = nx;
        state.player.y = ny;
        state.player.vx = 0;
        state.player.vy = 0;
        return true;
      }
    }

    // Fallback to spawn when no nearby valid point is found.
    state.player.x = configuredSpawnWorld.x;
    state.player.y = configuredSpawnWorld.y;
    state.player.vx = 0;
    state.player.vy = 0;
    return true;
  }

  function getTileImage(tx, ty, layer = 1) {
    const override = state.tileOverrides.get(tileKey(tx, ty));
    if (override && layer === 1) return override;
    if (externalTerrainData && externalTerrainWidth > 0 && externalTerrainHeight > 0) {
      const localX = tx - externalTerrainOriginX;
      const localY = ty - externalTerrainOriginY;
      if (localX >= 0 && localY >= 0 && localX < externalTerrainWidth && localY < externalTerrainHeight) {
        const cell = getExternalTerrainCellAt(layer, localX, localY);
        const terrainId = cell ? cell.id : null;
        let fallbackId = null;
        if (externalTerrainLayers) {
          const layerIndex = getExternalTerrainLayerIndex(layer);
          const layerData = externalTerrainLayers[layerIndex];
          fallbackId = layerData && typeof layerData.default === "string" ? layerData.default : null;
        }
        if (!fallbackId) {
          fallbackId = layer === 1 ? String(externalTerrainData.default || "grass1") : "";
        }
        const resolvedId = String(terrainId || fallbackId || "");
        let src = externalTileSrcById.get(resolvedId) || externalTileSrcById.get(fallbackId);
        if (!src && /^barrier([0-9]|10)$/.test(resolvedId)) {
          src = `assets/${resolvedId}.png`;
        }
        const anim = externalTileAnimationById.get(resolvedId) || externalTileAnimationById.get(fallbackId);
        if (anim && anim.frames && anim.frames.length) {
          const idx = Math.floor((state.time * 1000) / 140) % anim.frames.length;
          src = anim.frames[idx] || src;
        }
        if (src) {
          // For ground grass tiles, keep visual variation randomized (grass1..5)
          // even when explicit grass tile ids are placed in terrain data.
          if (layer === 1 && (resolvedId.startsWith("grass") || isGrassTileImage(src))) {
            return chooseGrassVariant(tx, ty);
          }
          return src;
        }
        if (layer > 1) return null;
      }
    }
    if (layer > 1) return null;
    return chooseGrassVariant(tx, ty);
  }

  function getTerrainTileIdAt(tx, ty, layer = 1) {
    if (!(externalTerrainData && externalTerrainWidth > 0 && externalTerrainHeight > 0)) return null;
    const localX = tx - externalTerrainOriginX;
    const localY = ty - externalTerrainOriginY;
    if (localX < 0 || localY < 0 || localX >= externalTerrainWidth || localY >= externalTerrainHeight) return null;
    const cell = getExternalTerrainCellAt(layer, localX, localY);
    const terrainId = cell ? cell.id : null;
    if (terrainId) return String(terrainId);
    if (externalTerrainLayers) {
      const layerIndex = getExternalTerrainLayerIndex(layer);
      const layerData = externalTerrainLayers[layerIndex];
      if (layerData && typeof layerData.default === "string") return String(layerData.default);
    }
    if (layer === 1 && externalTerrainData.default) return String(externalTerrainData.default);
    return null;
  }

  function applyClippingsToForwardTile() {
    const candidates = getUseTargetTiles();
    let changed = false;
    for (const [x, y] of candidates) {
      if (hasAnyLayer2TileAtTile(x, y)) continue;
      const before = getTileImage(x, y);
      if (!isGrassTileImage(before)) continue;
      if (before === TILE_IMAGES.clippings) continue;
      const key = tileKey(x, y);
      setTileOverride(key, TILE_IMAGES.clippings);
      state.clippingsTimers.set(key, Date.now() + CLIPPINGS_REGROWTH_MS);
      maybeDropClambonSeedAtTile(x, y);
      changed = true;
    }
    return changed;
  }

  function applyDirtToForwardTile() {
    const targets = getUseTargetTiles();
    let changed = false;
    for (const [x, y] of targets) {
      if (hasAnyLayer2TileAtTile(x, y)) continue;
      const before = getTileImage(x, y);
      if (before !== TILE_IMAGES.clippings) continue;
      const key = tileKey(x, y);
      setTileOverride(key, TILE_IMAGES.stone_dirt);
      state.clippingsTimers.delete(key);
      changed = true;
    }
    if (!changed) return false;

    recalcSoilVariantsNearTargets(targets);
    return true;
  }

  function applySchopToForwardTile() {
    const targets = getUseTargetTiles();
    let changed = false;
    for (const [x, y] of targets) {
      if (hasAnyLayer2TileAtTile(x, y)) continue;
      const before = getTileImage(x, y);
      const key = tileKey(x, y);
      const crop = getCrop(x, y);
      if (crop) {
        const holePath = convertGrooveToHoleImage(before);
        if (!holePath) continue;
        removeCrop(x, y);
        setTileOverride(key, holePath);
        const cx = x * WORLD.tileSize + WORLD.tileSize * 0.5;
        const cy = y * WORLD.tileSize + WORLD.tileSize * 0.5;
        spawnDroppedItem("clambon_seed", cx, cy, 18);
        recalcSoilVariantsNearTargets([[x, y]]);
        changed = true;
        continue;
      }
      const nextPath = convertSchopTileImage(before);
      if (!nextPath) continue;
      setTileOverride(key, nextPath);
      changed = true;
    }
    return changed;
  }

  function applySoilSifterToForwardTile() {
    const targets = getUseTargetTiles();
    let changed = false;
    for (const [x, y] of targets) {
      if (hasAnyLayer2TileAtTile(x, y)) continue;
      const before = getTileImage(x, y);
      if (!isStoneDirtTileImage(before)) continue;
      const key = tileKey(x, y);
      setTileOverride(key, TILE_IMAGES.dirt);
      changed = true;
    }
    if (!changed) return false;
    recalcSoilVariantsNearTargets(targets);
    return true;
  }

  function recalcSoilVariantsNearTargets(targets) {
    const recalcSet = new Set();
    for (const [x, y] of targets) {
      recalcSet.add(tileKey(x, y));
      recalcSet.add(tileKey(x - 1, y));
      recalcSet.add(tileKey(x + 1, y));
      recalcSet.add(tileKey(x, y - 1));
      recalcSet.add(tileKey(x, y + 1));
    }
    for (const k of recalcSet) {
      const [sx, sy] = k.split(",").map(Number);
      recalcSoilVariantAt(sx, sy);
    }
  }

  function breakFenceToItemAtForwardTile() {
    const targets = getUseTargetTiles();
    let changed = false;
    for (const [x, y] of targets) {
      const cell = getTerrainCellAt(x, y, 2);
      if (!(cell && isFenceTileId(cell.id))) continue;
      if (!removeLayerTileAt(x, y, 2)) continue;
      recalcFenceAround(x, y);
      const cx = x * WORLD.tileSize + WORLD.tileSize * 0.5;
      const cy = y * WORLD.tileSize + WORLD.tileSize * 0.5;
      spawnDroppedItem("fence", cx, cy, 12);
      changed = true;
    }
    return changed;
  }

  function placeFenceAtForwardTile() {
    const targets = getUseTargetTiles();
    let placed = false;
    for (const [x, y] of targets) {
      if (hasAnyLayer2TileAtTile(x, y)) continue;
      if (!setLayerTileAt(x, y, "barrier2", 2)) continue;
      recalcFenceAround(x, y);
      pushPlayerOutIfBlocked();
      consumeSelectedItemOnce("fence");
      placed = true;
      break;
    }
    return placed;
  }

  function plantClambonOnForwardTile() {
    const targets = getUseTargetTiles();
    let planted = false;
    const nowMs = Date.now();
    for (const [x, y] of targets) {
      if (!isPlantableSoilTile(x, y)) continue;
      if (getCrop(x, y)) continue;
      const before = getTileImage(x, y);
      const nextGround = convertHoleToGrooveImage(before);
      if (nextGround) {
        setTileOverride(tileKey(x, y), nextGround);
      }
      setCrop(x, y, {
        plantedAtMs: nowMs,
        harvestAtMs: nowMs + CLAMBON_FULL_GROW_MS,
        rare: Math.random() < 0.12,
        fromHarvest: false,
      });
      recalcSoilVariantsNearTargets([[x, y]]);
      planted = true;
    }
    return planted;
  }

  function tryHarvestClambonAtForwardTile() {
    const targets = getUseTargetTiles();
    const nowMs = Date.now();
    for (const [x, y] of targets) {
      const crop = getCrop(x, y);
      if (!crop) continue;
      const stage = getCropVisualStage(crop, nowMs);
      if (stage < 4) continue;
      const cx = x * WORLD.tileSize + WORLD.tileSize * 0.5;
      const cy = y * WORLD.tileSize + WORLD.tileSize * 0.5;
      const gain = stage === 6 ? "big_clambon" : "clambon";
      spawnDroppedItem(gain, cx, cy, 26);
      const seedCount = Math.floor(Math.random() * 4); // 0..3
      for (let i = 0; i < seedCount; i += 1) {
        spawnDroppedItem("clambon_seed", cx, cy, 30);
      }
      crop.plantedAtMs = nowMs;
      crop.harvestAtMs = nowMs + CLAMBON_FULL_GROW_MS;
      crop.fromHarvest = true;
      crop.rare = Math.random() < 0.12;
      return true;
    }
    return false;
  }

  function updateCrops() {
    // Real-time based growth. No per-frame stage mutation needed.
  }

  function updateClippingsRegrowth(dt) {
    const nowMs = Date.now();
    for (const [k, timer] of state.clippingsTimers.entries()) {
      const regrowAtMs = Number(timer) || 0;
      const current = state.tileOverrides.get(k);
      if (current !== TILE_IMAGES.clippings) {
        state.clippingsTimers.delete(k);
        continue;
      }
      if (nowMs >= regrowAtMs) {
        deleteTileOverride(k);
        state.clippingsTimers.delete(k);
      }
    }
  }

  function isGrassTileImage(path) {
    const p = String(path || "");
    return p.startsWith("assets/grass");
  }

  function isDirtTileImage(path) {
    const p = String(path || "");
    return /^assets\/dirt(\d+)?\.png$/.test(p);
  }

  function isStoneDirtTileImage(path) {
    const p = String(path || "");
    return /^assets\/stone_dirt(\d+)?\.png$/.test(p);
  }

  function isBaseSoilTileImage(path) {
    return isDirtTileImage(path) || isStoneDirtTileImage(path);
  }

  function convertDirtToGrooveImage(path) {
    const m = /^assets\/dirt(\d+)?\.png$/.exec(String(path || ""));
    if (!m) return null;
    const variant = Math.max(1, Math.min(16, Number(m[1]) || 1));
    return variant === 1 ? TILE_IMAGES.groove_dirt : TILE_IMAGES[`groove_dirt${variant}`];
  }

  function convertGrooveToHoleImage(path) {
    const m = /^assets\/groove_dirt(\d+)?\.png$/.exec(String(path || ""));
    if (!m) return null;
    const variant = Math.max(1, Math.min(16, Number(m[1]) || 1));
    return variant === 1 ? TILE_IMAGES.hole_groove_dirt : TILE_IMAGES[`hole_groove_dirt${variant}`];
  }

  function convertHoleToGrooveImage(path) {
    const m = /^assets\/hole_groove_dirt(\d+)?\.png$/.exec(String(path || ""));
    if (!m) return null;
    const variant = Math.max(1, Math.min(16, Number(m[1]) || 1));
    return variant === 1 ? TILE_IMAGES.groove_dirt : TILE_IMAGES[`groove_dirt${variant}`];
  }

  function convertSchopTileImage(path) {
    return convertDirtToGrooveImage(path) || convertGrooveToHoleImage(path);
  }

  function isGrooveDirtTileImage(path) {
    const p = String(path || "");
    return /^assets\/groove_dirt(\d+)?\.png$/.test(p);
  }

  function isHoleGrooveDirtTileImage(path) {
    const p = String(path || "");
    return /^assets\/hole_groove_dirt(\d+)?\.png$/.test(p);
  }

  function isGrooveFamilyTileImage(path) {
    return isGrooveDirtTileImage(path) || isHoleGrooveDirtTileImage(path);
  }

  function isSoilTileImage(path) {
    return isDirtTileImage(path)
      || isStoneDirtTileImage(path)
      || isGrooveDirtTileImage(path)
      || isHoleGrooveDirtTileImage(path);
  }

  function isDirtTile(tx, ty) {
    return isDirtTileImage(getTileImage(tx, ty));
  }

  function isSoilTile(tx, ty) {
    return isSoilTileImage(getTileImage(tx, ty));
  }

  function isPlantableSoilTile(tx, ty) {
    return isHoleGrooveDirtTileImage(getTileImage(tx, ty));
  }

  function recalcSoilVariantAt(tx, ty) {
    const maxTileX = Math.floor(WORLD.width / WORLD.tileSize) - 1;
    const maxTileY = Math.floor(WORLD.height / WORLD.tileSize) - 1;
    if (tx < 0 || ty < 0 || tx > maxTileX || ty > maxTileY) return;
    const currentPath = getTileImage(tx, ty);
    if (!isSoilTileImage(currentPath)) return;

    let variantMap = DIRT_VARIANT_BY_GRASS_MASK;
    let fallback = TILE_IMAGES.dirt;
    let sameGroup = isBaseSoilTileImage;
    if (isStoneDirtTileImage(currentPath)) {
      variantMap = STONE_DIRT_VARIANT_BY_GRASS_MASK;
      fallback = TILE_IMAGES.stone_dirt;
      sameGroup = isBaseSoilTileImage;
    } else if (isGrooveDirtTileImage(currentPath)) {
      variantMap = GROOVE_DIRT_VARIANT_BY_GRASS_MASK;
      fallback = TILE_IMAGES.groove_dirt;
      sameGroup = isGrooveFamilyTileImage;
    } else if (isHoleGrooveDirtTileImage(currentPath)) {
      variantMap = HOLE_GROOVE_DIRT_VARIANT_BY_GRASS_MASK;
      fallback = TILE_IMAGES.hole_groove_dirt;
      sameGroup = isGrooveFamilyTileImage;
    }

    let mask = 0;
    if (!sameGroup(getTileImage(tx - 1, ty))) mask |= 0b0001; // left outside
    if (!sameGroup(getTileImage(tx + 1, ty))) mask |= 0b0010; // right outside
    if (!sameGroup(getTileImage(tx, ty - 1))) mask |= 0b0100; // up outside
    if (!sameGroup(getTileImage(tx, ty + 1))) mask |= 0b1000; // down outside

    const variant = variantMap.get(mask) || fallback;
    setTileOverride(tileKey(tx, ty), variant);
  }

  function getConnectedDirtTileCount(startX, startY, maxVisit = 5000) {
    const maxTileX = Math.floor(WORLD.width / WORLD.tileSize) - 1;
    const maxTileY = Math.floor(WORLD.height / WORLD.tileSize) - 1;
    if (startX < 0 || startY < 0 || startX > maxTileX || startY > maxTileY) return 0;
    if (!isSoilTile(startX, startY)) return 0;

    const qx = [startX];
    const qy = [startY];
    let head = 0;
    let count = 0;
    const visited = new Set([tileKey(startX, startY)]);

    while (head < qx.length && count < maxVisit) {
      const x = qx[head];
      const y = qy[head];
      head += 1;
      count += 1;

      const neigh = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neigh) {
        if (nx < 0 || ny < 0 || nx > maxTileX || ny > maxTileY) continue;
        const k = tileKey(nx, ny);
        if (visited.has(k)) continue;
        if (!isSoilTile(nx, ny)) continue;
        visited.add(k);
        qx.push(nx);
        qy.push(ny);
      }
    }

    return count;
  }

  function updateAdaptiveFarmZoom(dt) {
    state.farmView.targetZoom = clamp(state.farmView.targetZoom, CAMERA.minZoom, CAMERA.maxZoom);
    const follow = 1 - Math.exp(-dt * 6.0);
    CAMERA.zoom += (state.farmView.targetZoom - CAMERA.zoom) * follow;
    CAMERA.zoom = clamp(CAMERA.zoom, CAMERA.minZoom, CAMERA.maxZoom);
  }

  function adjustManualZoom(delta) {
    const next = clamp(state.farmView.targetZoom + delta, CAMERA.minZoom, CAMERA.maxZoom);
    state.farmView.targetZoom = next;
    CAMERA.defaultZoom = next;
  }

  function getForwardTargetTiles() {
    const tileX = Math.floor(state.player.x / WORLD.tileSize);
    const tileY = Math.floor(state.player.y / WORLD.tileSize);

    const dx = Math.cos(state.player.aimAngle);
    const dy = Math.sin(state.player.aimAngle);
    let stepX = 0;
    let stepY = 0;
    if (Math.abs(dx) >= Math.abs(dy)) {
      stepX = dx >= 0 ? 1 : -1;
    } else {
      stepY = dy >= 0 ? 1 : -1;
    }

    const maxTileX = Math.floor(WORLD.width / WORLD.tileSize) - 1;
    const maxTileY = Math.floor(WORLD.height / WORLD.tileSize) - 1;
    const currentX = clamp(tileX, 0, maxTileX);
    const currentY = clamp(tileY, 0, maxTileY);
    const targetX = clamp(tileX + stepX, 0, maxTileX);
    const targetY = clamp(tileY + stepY, 0, maxTileY);
    return [
      [currentX, currentY],
      [targetX, targetY],
    ];
  }

  function getUseTargetTiles() {
    const [, forward] = getForwardTargetTiles();
    return [forward];
  }

  function applyTileToForward(tileImagePath, options = {}) {
    const onlyFromGrass = !!options.onlyFromGrass;
    const candidates = getUseTargetTiles();
    let changed = false;
    for (const [x, y] of candidates) {
      const before = getTileImage(x, y);
      if (onlyFromGrass && !isGrassTileImage(before)) continue;
      if (before === tileImagePath) continue;
      setTileOverride(tileKey(x, y), tileImagePath);
      changed = true;
    }
    return changed;
  }

  function getPlayerSprite() {
    const key = getCurrentPlayerSpriteKey();
    return { key, image: loadSprite(key), flip: state.player.facing === "right" };
  }

  function drawGrassTiles() {
    const { tileSize, drawTile, startX, endX, startY, endY } = getTileViewBounds(1);

    const originX = canvas.clientWidth * 0.5 - state.camera.x * CAMERA.zoom;
    const originY = canvas.clientHeight * 0.5 - state.camera.y * CAMERA.zoom;
    for (let ty = startY; ty <= endY; ty += 1) {
      const sy = originY + ty * drawTile;
      for (let tx = startX; tx <= endX; tx += 1) {
        const sx = originX + tx * drawTile;
        const tilePath = getTileImage(tx, ty, 1);
        const tileImage = loadImage(tilePath);

        if (tileImage.complete && tileImage.naturalWidth > 0) {
          ctx.drawImage(tileImage, sx, sy, drawTile, drawTile);
        } else {
          ctx.fillStyle = "#4e8b3f";
          ctx.fillRect(sx, sy, drawTile, drawTile);
        }
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  function drawUpperTileLayers(frontPass) {
    const { tileSize, drawTile, startX, endX, startY, endY } = getTileViewBounds(1);
    const playerDepthY = state.player.y + PLAYER.hitRadiusWorld * 0.25;
    const originX = canvas.clientWidth * 0.5 - state.camera.x * CAMERA.zoom;
    const originY = canvas.clientHeight * 0.5 - state.camera.y * CAMERA.zoom;
    for (const layer of UPPER_LAYER_IDS) {
      if (externalTerrainLayers) {
        const layerData = externalTerrainLayers[getExternalTerrainLayerIndex(layer)];
        const sparse = layerData && layerData.sparse && typeof layerData.sparse === "object" ? layerData.sparse : null;
        if (sparse) {
          for (const [key, rawCell] of Object.entries(sparse)) {
            const cell = normalizeTerrainCellValue(rawCell);
            if (!cell || !cell.id) continue;
            const [localX, localY] = key.split(",").map(Number);
            const tx = localX + externalTerrainOriginX;
            const ty = localY + externalTerrainOriginY;
            if (tx < startX || tx > endX || ty < startY || ty > endY) continue;
            const tileId = cell.id;
            const isFullTile = !!externalTileFullTileById.get(tileId);
            const depthPivot = isFullTile ? 0.5 : 0.8;
            const depthY = ty * tileSize + tileSize * depthPivot;
            const playerSortY = isFullTile ? state.player.y : playerDepthY;
            if (frontPass ? depthY < playerSortY : depthY >= playerSortY) continue;
            const tilePath = getTileImage(tx, ty, layer);
            if (!tilePath) continue;
            const img = loadImage(tilePath);
            if (!(img.complete && img.naturalWidth > 0)) continue;
            const sx = originX + tx * drawTile;
            const sy = originY + ty * drawTile;
            if (layer === 2) {
              const isSideTile = !!externalTileSideTileById.get(tileId);
              if (isFullTile) {
                ctx.drawImage(img, sx, sy, drawTile, drawTile);
                ctx.fillStyle = isSideTile
                  ? "rgba(0,0,0,0.18)"
                  : "rgba(255,255,255,0.12)";
                ctx.fillRect(sx, sy, drawTile, drawTile);
              } else {
                ctx.save();
                ctx.filter = isSideTile ? "brightness(0.82)" : "brightness(1.12)";
                ctx.drawImage(img, sx, sy, drawTile, drawTile);
                ctx.restore();
              }
            } else {
              ctx.drawImage(img, sx, sy, drawTile, drawTile);
            }
          }
        }
      } else {
        for (let ty = startY; ty <= endY; ty += 1) {
          for (let tx = startX; tx <= endX; tx += 1) {
            const tileId = getTerrainTileIdAt(tx, ty, layer);
            const isFullTile = !!(tileId && externalTileFullTileById.get(tileId));
            const depthPivot = isFullTile ? 0.5 : 0.8;
            const depthY = ty * tileSize + tileSize * depthPivot;
            const playerSortY = isFullTile ? state.player.y : playerDepthY;
            if (frontPass ? depthY < playerSortY : depthY >= playerSortY) continue;
            const tilePath = getTileImage(tx, ty, layer);
            if (!tilePath) continue;
            const img = loadImage(tilePath);
            if (!(img.complete && img.naturalWidth > 0)) continue;
            const sx = originX + tx * drawTile;
            const sy = originY + ty * drawTile;
            if (layer === 2) {
              const isSideTile = !!(tileId && externalTileSideTileById.get(tileId));
              if (isFullTile) {
                ctx.drawImage(img, sx, sy, drawTile, drawTile);
                ctx.fillStyle = isSideTile
                  ? "rgba(0,0,0,0.18)"
                  : "rgba(255,255,255,0.12)";
                ctx.fillRect(sx, sy, drawTile, drawTile);
              } else {
                ctx.save();
                ctx.filter = isSideTile ? "brightness(0.82)" : "brightness(1.12)";
                ctx.drawImage(img, sx, sy, drawTile, drawTile);
                ctx.restore();
              }
            } else {
              ctx.drawImage(img, sx, sy, drawTile, drawTile);
            }
          }
        }
      }
    }
  }

  function getSunShadowState() {
    const now = getCurrentWorldDate();
    const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const dayFraction = ((hour / 24) % 1 + 1) % 1;
    const sunrise = 6;
    const sunset = 18;
    const daylightRaw = (hour - sunrise) / (sunset - sunrise);
    const daylightClamped = clamp(daylightRaw, 0, 1);
    const daylight = Math.sin(daylightClamped * Math.PI);
    const isDay = hour >= sunrise && hour < sunset;
    const morning = isDay ? clamp((12 - hour) / 6, 0, 1) : 0;
    const noon = isDay ? (1 - Math.abs(hour - 12) / 3) : 0;
    const noonClamped = clamp(noon, 0, 1);
    const night = isDay ? 0 : 1;

    // Daytime sun moves from east to west; nighttime keeps a soft moon-like direction.
    let azimuth;
    if (isDay) {
      azimuth = (-0.78 * Math.PI) + daylightClamped * (1.56 * Math.PI);
    } else {
      azimuth = dayFraction * Math.PI * 2 + Math.PI * 0.2;
    }
    const dirX = Math.cos(azimuth);
    const dirY = Math.sin(azimuth);

    let altitude = SUN.minAltitude + (SUN.maxAltitude - SUN.minAltitude) * daylight;
    if (!isDay) altitude = SUN.minAltitude * 0.42;

    const shadowLength = WORLD.tileSize * (0.22 + (1 - altitude) * 0.95 + night * 0.1);
    const alpha = SUN.shadowAlphaMin + (1 - altitude) * (SUN.shadowAlphaMax - SUN.shadowAlphaMin) + night * 0.06;
    const shadowDx = -dirX * shadowLength;
    const shadowDy = -dirY * shadowLength * 0.75;
    const evening = isDay ? clamp((hour - 15) / 3, 0, 1) : 0;
    let phaseName = "noon";
    if (night) phaseName = "night";
    else if (morning > 0.32) phaseName = "morning";
    else if (evening > 0.32) phaseName = "evening";
    return {
      dirX, dirY, altitude, shadowLength, alpha, shadowDx, shadowDy,
      phaseName, morning, noon: noonClamped, night, dayFraction, evening,
    };
  }

  function drawLayer2GroundShadows(sunState) {
    const tileSize = WORLD.tileSize;
    const viewHalfW = (canvas.clientWidth * 0.5) / CAMERA.zoom;
    const viewHalfH = (canvas.clientHeight * 0.5) / CAMERA.zoom;
    const drawTile = tileSize * CAMERA.zoom;
    const startX = Math.floor((state.camera.x - viewHalfW) / tileSize) - 1;
    const endX = Math.floor((state.camera.x + viewHalfW) / tileSize) + 1;
    const startY = Math.floor((state.camera.y - viewHalfH) / tileSize) - 1;
    const endY = Math.floor((state.camera.y + viewHalfH) / tileSize) + 1;
    const visibleTileCount = Math.max(1, (endX - startX + 1) * (endY - startY + 1));
    if (visibleTileCount > 1300) return;
    const sun = sunState || getSunShadowState();
    const shadowDx = sun.shadowDx * CAMERA.zoom;
    const shadowDy = sun.shadowDy * CAMERA.zoom;
    const shadowPadTilesX = Math.max(2, Math.ceil(Math.abs(shadowDx) / drawTile) + 2);
    const shadowPadTilesY = Math.max(2, Math.ceil(Math.abs(shadowDy) / drawTile) + 2);
    const sampleStartX = startX - shadowPadTilesX;
    const sampleEndX = endX + shadowPadTilesX;
    const sampleStartY = startY - shadowPadTilesY;
    const sampleEndY = endY + shadowPadTilesY;
    const fullTileOccupied = new Set();
    for (let layer = 2; layer <= 2; layer += 1) {
      for (let ty = sampleStartY; ty <= sampleEndY; ty += 1) {
        for (let tx = sampleStartX; tx <= sampleEndX; tx += 1) {
          let hasExplicitPlacement = false;
          if (externalTerrainData && externalTerrainWidth > 0 && externalTerrainHeight > 0) {
            const localX = tx - externalTerrainOriginX;
            const localY = ty - externalTerrainOriginY;
            if (localX >= 0 && localY >= 0 && localX < externalTerrainWidth && localY < externalTerrainHeight) {
              const cell = getExternalTerrainCellAt(layer, localX, localY);
              hasExplicitPlacement = !!(cell && cell.id);
            }
          }
          if (hasExplicitPlacement) fullTileOccupied.add(`${tx},${ty}`);
        }
      }
    }
    if (fullTileOccupied.size === 0) return;

    const hasFullCell = (tx, ty) => fullTileOccupied.has(`${tx},${ty}`);
    const drawEdgeQuadGradient = (ax, ay, bx, by) => {
      const mx = (ax + bx) * 0.5;
      const my = (ay + by) * 0.5;
      const grad = ctx.createLinearGradient(mx, my, mx + shadowDx, my + shadowDy);
      grad.addColorStop(0, "rgba(0,0,0,0.38)");
      grad.addColorStop(0.72, "rgba(0,0,0,0.18)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + shadowDx, by + shadowDy);
      ctx.lineTo(ax + shadowDx, ay + shadowDy);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    };

    // Connected-region edge extrusion shadow (no silhouette projection).
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = clamp(sun.alpha * 1.15, 0.10, 0.38);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (const key of fullTileOccupied) {
      const [tx, ty] = key.split(",").map(Number);
      const p = worldToScreen(tx * tileSize, ty * tileSize);

      // Shifted footprint (shadowed area on ground).
      ctx.fillRect(p.x + shadowDx, p.y + shadowDy, drawTile, drawTile);

      // Only outer edges receive gradient transitions.
      const x0 = p.x;
      const y0 = p.y;
      const x1 = p.x + drawTile;
      const y1 = p.y + drawTile;
      if (!hasFullCell(tx, ty - 1)) drawEdgeQuadGradient(x0, y0, x1, y0);
      if (!hasFullCell(tx + 1, ty)) drawEdgeQuadGradient(x1, y0, x1, y1);
      if (!hasFullCell(tx, ty + 1)) drawEdgeQuadGradient(x1, y1, x0, y1);
      if (!hasFullCell(tx - 1, ty)) drawEdgeQuadGradient(x0, y1, x0, y0);
    }
    ctx.restore();
  }

  function drawWorldLightingShader(sunState) {
    if (!SHADER.enableCinematic) return;
    const sun = sunState || getSunShadowState();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dirLen = Math.max(0.0001, Math.hypot(sun.dirX, sun.dirY));
    const dirX = sun.dirX / dirLen;
    const dirY = sun.dirY / dirLen;
    const span = Math.max(w, h) * 0.72;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const sx = cx - dirX * span;
    const sy = cy - dirY * span;
    const ex = cx + dirX * span;
    const ey = cy + dirY * span;
    const time = state.time;
    const sourceX = clamp(cx + dirX * w * 0.45, -w * 0.08, w * 1.08);
    const sourceY = clamp(cy + dirY * h * 0.28 - h * 0.24, -h * 0.2, h * 0.42);
    const morning = sun.morning || 0;
    const noon = sun.noon || 0;
    const night = sun.night || 0;

    ctx.save();
    // Fast path: keep only essential passes to reduce per-frame gradient cost.
    if (SHADER.performanceMode) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      const directionalFast = ctx.createLinearGradient(sx, sy, ex, ey);
      directionalFast.addColorStop(0, `rgba(255,236,176,${(0.018 + morning * 0.012).toFixed(3)})`);
      directionalFast.addColorStop(0.5, "rgba(255,255,255,0)");
      directionalFast.addColorStop(1, `rgba(24,44,66,${(0.05 + noon * 0.02 + night * 0.12).toFixed(3)})`);
      ctx.fillStyle = directionalFast;
      ctx.fillRect(0, 0, w, h);

      if (night > 0.02) {
        const nightTintFast = ctx.createLinearGradient(0, 0, w, h);
        nightTintFast.addColorStop(0, `rgba(18,28,58,${(0.1 * night).toFixed(3)})`);
        nightTintFast.addColorStop(1, `rgba(8,14,34,${(0.16 * night).toFixed(3)})`);
        ctx.fillStyle = nightTintFast;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
      return;
    }

    // Soft bloom from off-screen light source (no visible beam/ray lines).
    ctx.globalCompositeOperation = "screen";
    const edgeHaze = ctx.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, Math.max(w, h) * 1.05);
    edgeHaze.addColorStop(0, `rgba(255,250,218,${(0.07 + morning * 0.06 + noon * 0.03).toFixed(3)})`);
    edgeHaze.addColorStop(0.26, `rgba(255,236,184,${(0.045 + morning * 0.04 + noon * 0.015).toFixed(3)})`);
    edgeHaze.addColorStop(0.56, `rgba(255,220,164,${(0.02 + morning * 0.018).toFixed(3)})`);
    edgeHaze.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = edgeHaze;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "multiply";
    const directional = ctx.createLinearGradient(sx, sy, ex, ey);
    directional.addColorStop(0, `rgba(255,236,176,${(0.022 + morning * 0.018).toFixed(3)})`);
    directional.addColorStop(0.5, "rgba(255,255,255,0)");
    directional.addColorStop(1, `rgba(24,44,66,${(0.07 + noon * 0.03 + night * 0.16).toFixed(3)})`);
    ctx.fillStyle = directional;
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.2, cx, cy, Math.max(w, h) * 0.72);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, `rgba(0,0,0,${(0.06 + night * 0.18).toFixed(3)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Stronger rainbow-like haze layer.
    const iris = ctx.createLinearGradient(
      sourceX,
      sourceY,
      sourceX + dirX * Math.max(w, h) * 1.35,
      sourceY + dirY * Math.max(w, h) * 1.35
    );
    const rainbow = 1 - night * 0.85;
    iris.addColorStop(0.08, `rgba(255,154,118,${(0.02 + 0.04 * rainbow + morning * 0.02).toFixed(3)})`);
    iris.addColorStop(0.28, `rgba(255,210,124,${(0.02 + 0.035 * rainbow + noon * 0.01).toFixed(3)})`);
    iris.addColorStop(0.44, `rgba(145,228,255,${(0.02 + 0.04 * rainbow + noon * 0.012).toFixed(3)})`);
    iris.addColorStop(0.62, `rgba(145,170,255,${(0.018 + 0.03 * rainbow).toFixed(3)})`);
    iris.addColorStop(0.78, `rgba(188,255,172,${(0.016 + 0.026 * rainbow).toFixed(3)})`);
    iris.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = iris;
    ctx.fillRect(0, 0, w, h);

    // Secondary radial chromatic halo for "blurred rainbow" impression.
    const halo = ctx.createRadialGradient(
      sourceX + Math.sin(time * 0.17) * w * 0.04,
      sourceY + Math.cos(time * 0.13) * h * 0.03,
      Math.min(w, h) * 0.04,
      sourceX,
      sourceY,
      Math.max(w, h) * 0.84
    );
    halo.addColorStop(0.14, `rgba(255,196,138,${(0.03 + 0.03 * rainbow).toFixed(3)})`);
    halo.addColorStop(0.34, `rgba(255,126,140,${(0.026 + 0.024 * rainbow).toFixed(3)})`);
    halo.addColorStop(0.52, `rgba(128,210,255,${(0.03 + 0.03 * rainbow).toFixed(3)})`);
    halo.addColorStop(0.72, `rgba(170,164,255,${(0.02 + 0.02 * rainbow).toFixed(3)})`);
    halo.addColorStop(0.88, `rgba(202,255,178,${(0.014 + 0.016 * rainbow).toFixed(3)})`);
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    const warmHalo = ctx.createRadialGradient(
      sourceX + dirX * w * 0.12,
      sourceY + dirY * h * 0.08,
      Math.min(w, h) * 0.03,
      sourceX + dirX * w * 0.12,
      sourceY + dirY * h * 0.08,
      Math.max(w, h) * 0.92
    );
    warmHalo.addColorStop(0, `rgba(255,182,126,${(0.035 + morning * 0.05).toFixed(3)})`);
    warmHalo.addColorStop(0.24, `rgba(255,130,132,${(0.025 + morning * 0.035).toFixed(3)})`);
    warmHalo.addColorStop(0.56, "rgba(255,255,255,0)");
    ctx.fillStyle = warmHalo;
    ctx.fillRect(0, 0, w, h);

    const coolHalo = ctx.createRadialGradient(
      sourceX - dirY * w * 0.11,
      sourceY + dirX * h * 0.11,
      Math.min(w, h) * 0.03,
      sourceX - dirY * w * 0.11,
      sourceY + dirX * h * 0.11,
      Math.max(w, h) * 0.88
    );
    coolHalo.addColorStop(0, `rgba(116,202,255,${(0.035 + noon * 0.045 + night * 0.02).toFixed(3)})`);
    coolHalo.addColorStop(0.28, `rgba(170,146,255,${(0.02 + noon * 0.03 + night * 0.018).toFixed(3)})`);
    coolHalo.addColorStop(0.58, "rgba(255,255,255,0)");
    ctx.fillStyle = coolHalo;
    ctx.fillRect(0, 0, w, h);

    const greenHalo = ctx.createRadialGradient(
      sourceX + dirY * w * 0.1,
      sourceY - dirX * h * 0.09,
      Math.min(w, h) * 0.03,
      sourceX + dirY * w * 0.1,
      sourceY - dirX * h * 0.09,
      Math.max(w, h) * 0.86
    );
    greenHalo.addColorStop(0, `rgba(188,255,154,${(0.028 + noon * 0.025).toFixed(3)})`);
    greenHalo.addColorStop(0.3, `rgba(126,255,224,${(0.02 + noon * 0.02).toFixed(3)})`);
    greenHalo.addColorStop(0.62, "rgba(255,255,255,0)");
    ctx.fillStyle = greenHalo;
    ctx.fillRect(0, 0, w, h);

    // Night tint: deep navy cinematic overlay.
    if (night > 0.02) {
      ctx.globalCompositeOperation = "multiply";
      const nightTint = ctx.createLinearGradient(0, 0, w, h);
      nightTint.addColorStop(0, `rgba(18,28,58,${(0.14 * night).toFixed(3)})`);
      nightTint.addColorStop(0.55, `rgba(14,26,52,${(0.18 * night).toFixed(3)})`);
      nightTint.addColorStop(1, `rgba(8,14,34,${(0.24 * night).toFixed(3)})`);
      ctx.fillStyle = nightTint;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "screen";
      const moonMist = ctx.createRadialGradient(w * 0.18, h * 0.1, 0, w * 0.18, h * 0.1, Math.max(w, h) * 0.7);
      moonMist.addColorStop(0, `rgba(130,164,255,${(0.06 * night).toFixed(3)})`);
      moonMist.addColorStop(0.45, `rgba(92,126,212,${(0.045 * night).toFixed(3)})`);
      moonMist.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = moonMist;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function isWaterTileImage(path) {
    const p = String(path || "");
    return /\/water(\d+)?\.png$/i.test(p);
  }

  function drawWaterSurfaceShader() {
    const tileSize = WORLD.tileSize;
    const viewHalfW = (canvas.clientWidth * 0.5) / CAMERA.zoom;
    const viewHalfH = (canvas.clientHeight * 0.5) / CAMERA.zoom;
    const drawTile = tileSize * CAMERA.zoom;
    const startX = Math.floor((state.camera.x - viewHalfW) / tileSize) - 1;
    const endX = Math.floor((state.camera.x + viewHalfW) / tileSize) + 1;
    const startY = Math.floor((state.camera.y - viewHalfH) / tileSize) - 1;
    const endY = Math.floor((state.camera.y + viewHalfH) / tileSize) + 1;
    const visibleTileCount = Math.max(1, (endX - startX + 1) * (endY - startY + 1));
    if (visibleTileCount > 1400) return;
    const time = state.time * SHADER.waterWaveSpeed;
    if (SHADER.performanceMode) {
      // Fast path: no clipping/gradients per tile, just subtle per-tile tint.
      for (let ty = startY; ty <= endY; ty += 1) {
        for (let tx = startX; tx <= endX; tx += 1) {
          const tilePath = getTileImage(tx, ty, 1);
          if (!isWaterTileImage(tilePath)) continue;
          const p = worldToScreen(tx * tileSize, ty * tileSize);
          const pulse = Math.sin(time * 1.2 + tx * 0.5 + ty * 0.4) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(176,236,255,${(0.045 + pulse * 0.025).toFixed(3)})`;
          ctx.fillRect(p.x, p.y, drawTile, drawTile);
        }
      }
      return;
    }
    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        const tilePath = getTileImage(tx, ty, 1);
        if (!isWaterTileImage(tilePath)) continue;
        const p = worldToScreen(tx * tileSize, ty * tileSize);
        const warp = Math.sin(time * 2.2 + tx * 0.9 + ty * 0.7) * drawTile * SHADER.waterDistortion;
        const foam = Math.cos(time * 1.7 + tx * 1.8 - ty * 1.2) * 0.5 + 0.5;

        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x, p.y, drawTile, drawTile);
        ctx.clip();

        ctx.globalCompositeOperation = "screen";
        const sheen = ctx.createLinearGradient(p.x - warp, p.y, p.x + drawTile + warp, p.y + drawTile);
        sheen.addColorStop(0, "rgba(150,220,255,0.04)");
        sheen.addColorStop(0.5, "rgba(208,242,255,0.16)");
        sheen.addColorStop(1, "rgba(105,192,246,0.05)");
        ctx.fillStyle = sheen;
        ctx.fillRect(p.x - drawTile, p.y - drawTile, drawTile * 3, drawTile * 3);

        ctx.globalCompositeOperation = "overlay";
        const caustic = ctx.createLinearGradient(p.x, p.y + warp, p.x + drawTile, p.y + drawTile - warp);
        caustic.addColorStop(0, `rgba(255,255,255,${(0.06 + foam * 0.07).toFixed(3)})`);
        caustic.addColorStop(0.42, "rgba(165,224,255,0.02)");
        caustic.addColorStop(1, `rgba(255,255,255,${(0.02 + foam * 0.05).toFixed(3)})`);
        ctx.fillStyle = caustic;
        ctx.fillRect(p.x, p.y, drawTile, drawTile);
        ctx.restore();
      }
    }
  }

  function drawGrassForeground(maskRect) {
    void maskRect;
  }

  function hash2D(tx, ty) {
    let h = 0x811c9dc5;
    h ^= (tx >>> 0) + 0x9e3779b9 + (h << 6) + (h >>> 2);
    h ^= (ty >>> 0) + 0x85ebca6b + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
  }

  function chooseGrassVariant(tx, ty) {
    const r = (hash2D(tx, ty) + 0.5) / 4294967296;
    if (r < 0.56) return grassVariants[0];
    if (r < 0.86) return grassVariants[1];
    if (r < 0.94) return grassVariants[2];
    if (r < 0.985) return grassVariants[3];
    return grassVariants[4];
  }

  function getBarrierImagePath(tx, ty, minTileX, maxTileX, minTileY, maxTileY) {
    const left = tx === minTileX;
    const right = tx === maxTileX;
    const top = ty === minTileY;
    const bottom = ty === maxTileY;
    if (top && left) return BARRIER_IMAGES.rd;
    if (top && right) return BARRIER_IMAGES.ld;
    if (bottom && right) return BARRIER_IMAGES.lu;
    if (bottom && left) return BARRIER_IMAGES.ru;
    if (top || bottom) return BARRIER_IMAGES.lr;
    if (left || right) return BARRIER_IMAGES.ud;
    return "";
  }

  function isBarrierTile(tx, ty) {
    const worldMaxTileX = Math.floor(WORLD.width / WORLD.tileSize) - 1;
    const worldMaxTileY = Math.floor(WORLD.height / WORLD.tileSize) - 1;
    const minTileX = -BARRIER_OUTER_RING;
    const minTileY = -BARRIER_OUTER_RING;
    const maxTileX = worldMaxTileX + BARRIER_OUTER_RING;
    const maxTileY = worldMaxTileY + BARRIER_OUTER_RING;
    return tx === minTileX || ty === minTileY || tx === maxTileX || ty === maxTileY;
  }

  function drawWorldBarriers(layer) {
    const tileSize = WORLD.tileSize;
    const drawTile = tileSize * CAMERA.zoom;
    const worldMaxTileX = Math.floor(WORLD.width / tileSize) - 1;
    const worldMaxTileY = Math.floor(WORLD.height / tileSize) - 1;
    const minTileX = -BARRIER_OUTER_RING;
    const minTileY = -BARRIER_OUTER_RING;
    const maxTileX = worldMaxTileX + BARRIER_OUTER_RING;
    const maxTileY = worldMaxTileY + BARRIER_OUTER_RING;
    const viewHalfW = (canvas.clientWidth * 0.5) / CAMERA.zoom;
    const viewHalfH = (canvas.clientHeight * 0.5) / CAMERA.zoom;
    const startX = Math.floor((state.camera.x - viewHalfW) / tileSize) - 1;
    const endX = Math.floor((state.camera.x + viewHalfW) / tileSize) + 1;
    const startY = Math.floor((state.camera.y - viewHalfH) / tileSize) - 1;
    const endY = Math.floor((state.camera.y + viewHalfH) / tileSize) + 1;

    const drawBarrierAt = (tx, ty) => {
      if (tx < minTileX || ty < minTileY || tx > maxTileX || ty > maxTileY) return;
      const isTopSide = ty === minTileY;
      if (layer === "back" && !isTopSide) return;
      if (layer === "front" && isTopSide) return;
      const path = getBarrierImagePath(tx, ty, minTileX, maxTileX, minTileY, maxTileY);
      if (!path) return;
      const img = loadImage(path);
      const p = worldToScreen(tx * tileSize, ty * tileSize);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, p.x, p.y, drawTile, drawTile);
      }
    };

    for (let tx = startX; tx <= endX; tx += 1) {
      drawBarrierAt(tx, 0);
      drawBarrierAt(tx, maxTileY);
    }
    for (let ty = startY; ty <= endY; ty += 1) {
      drawBarrierAt(0, ty);
      drawBarrierAt(maxTileX, ty);
    }
  }

  function updateRemoteVisualPlayers(dt) {
    const t = 1 - Math.exp(-12 * dt);
    for (const [id, p] of onlinePlayers.entries()) {
      if (!p || typeof p !== "object") continue;
      const tx = Number(p.x) || 0;
      const ty = Number(p.y) || 0;
      const existing = remoteVisualPlayers.get(id);
      if (!existing) {
        remoteVisualPlayers.set(id, { x: tx, y: ty, raw: p });
        continue;
      }
      existing.x += (tx - existing.x) * t;
      existing.y += (ty - existing.y) * t;
      existing.raw = p;
    }
    for (const id of remoteVisualPlayers.keys()) {
      if (!onlinePlayers.has(id)) remoteVisualPlayers.delete(id);
    }
  }

  function drawCharacterEntity(entity, pass = "all") {
    const p = worldToScreen(entity.x, entity.y);
    const key = getPlayerSpriteKey(entity);
    const image = loadSprite(key, entity.characterId);
    const isSide = key.startsWith("side_");
    if (!isSide && pass === "front") return;

    const targetH = PLAYER.drawHeight * CAMERA.zoom;
    const ratio = image && image.naturalWidth > 0 && image.naturalHeight > 0
      ? image.naturalWidth / image.naturalHeight
      : 0.78;
    const targetW = targetH * ratio;
    const shadowRx = PLAYER.hitRadiusWorld * 1.05 * CAMERA.zoom;
    const shadowRy = PLAYER.hitRadiusWorld * 0.4 * CAMERA.zoom;
    const drawFullSprite = !isSide || pass === "all";
    const flip = entity.facing === "right";

    if (pass !== "front") {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + shadowRy * 0.2, shadowRx, shadowRy, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(p.x, p.y - targetH * 0.9);
    if (flip) ctx.scale(-1, 1);

    if (!drawFullSprite) {
      const left = -targetW * 0.5;
      const backIsLeft = flip;
      const frontWidthRatio = 0.34;
      const frontHeightRatio = 0.5;
      const frontW = targetW * frontWidthRatio;
      const frontH = targetH * frontHeightRatio;
      const frontX = backIsLeft ? left : (left + targetW - frontW);
      const backW = targetW - frontW;
      const backX = backIsLeft ? (left + frontW) : left;
      ctx.beginPath();
      if (pass === "back") {
        ctx.rect(backX, 0, backW, targetH);
        ctx.rect(frontX, frontH, frontW, targetH - frontH);
      } else {
        ctx.rect(frontX, 0, frontW, frontH);
      }
      ctx.clip();
    }

    if (image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -targetW * 0.5, 0, targetW, targetH);
    } else if (entity.isLocal) {
      ctx.fillStyle = "#f6cf52";
      ctx.fillRect(-targetW * 0.4, 0, targetW * 0.8, targetH * 0.92);
    }

    if (entity.isLocal) {
      const held = getSelectedItemKind();
      if (held && ITEMS[held] && ITEMS[held].overlayFolder) {
        const folder = ITEMS[held].overlayFolder;
        let overlayPath = `assets/skin/${folder}/${key}.png`;
        if (key.startsWith("side_") && entity.facing === "right") {
          overlayPath = `assets/skin/${folder}/2${key}.png`;
        }
        const overlay = loadImage(overlayPath);
        if (overlay.complete && overlay.naturalWidth > 0) {
          ctx.drawImage(overlay, -targetW * 0.5, 0, targetW, targetH);
        }
      }
    }
    ctx.restore();

    if (!entity.isLocal && (pass === "all" || pass === "front")) {
      ctx.fillStyle = "rgba(15,24,18,0.92)";
      ctx.font = `bold ${Math.max(10, Math.floor(12 * CAMERA.zoom))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(entity.name || entity.characterId), p.x, p.y - targetH * 0.98);
    }
  }

  function buildDrawCharacters(includeLocal = true) {
    const list = [];
    if (includeLocal && state.selectedCharacterId) {
      list.push({
        x: state.player.x,
        y: state.player.y,
        speed: state.player.speed,
        moving: state.player.speed > 10,
        facing: state.player.facing,
        idleFrameIndex: state.player.idleFrameIndex,
        runFrameIndex: state.player.runFrameIndex,
        characterId: state.selectedCharacterId,
        name: state.playerName || state.selectedCharacterId.toUpperCase(),
        isLocal: true,
      });
    }
    for (const [id, vr] of remoteVisualPlayers.entries()) {
      const rp = vr.raw;
      if (!rp || typeof rp !== "object" || !rp.characterId) continue;
      list.push({
        x: vr.x,
        y: vr.y,
        speed: Number(rp.speed) || 0,
        moving: Boolean(rp.moving),
        facing: rp.facing || "front",
        idleFrameIndex: Number(rp.idleFrameIndex) || 0,
        runFrameIndex: Number(rp.runFrameIndex) || 0,
        characterId: rp.characterId,
        name: rp.name || rp.characterId,
        isLocal: false,
        id,
      });
    }
    list.sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0));
    return list;
  }

  function drawCharacters(pass = "all", includeLocal = true) {
    const list = buildDrawCharacters(includeLocal);
    for (const entity of list) drawCharacterEntity(entity, pass);
  }

  function drawCollisionDebug() {
    if (!state.debugCollisionView) return;
    const { startX, endX, startY, endY, drawTile } = getTileViewBounds(1);
    const originX = canvas.clientWidth * 0.5 - state.camera.x * CAMERA.zoom;
    const originY = canvas.clientHeight * 0.5 - state.camera.y * CAMERA.zoom;
    ctx.save();

    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        const cell = getTerrainCellAt(tx, ty, 2);
        if (!(cell && cell.id)) continue;
        const maskRows = externalTileCollisionMaskById.get(cell.id);
        const sx = originX + tx * drawTile;
        const sy = originY + ty * drawTile;
        if (maskRows) {
          const step = drawTile / 16;
          ctx.fillStyle = "rgba(255, 64, 64, 0.28)";
          for (let my = 0; my < 16; my += 1) {
            const row = maskRows[my] || 0;
            for (let mx = 0; mx < 16; mx += 1) {
              if (!(row & (1 << mx))) continue;
              ctx.fillRect(sx + mx * step, sy + my * step, Math.ceil(step), Math.ceil(step));
            }
          }
        } else if (getLayer2CollisionModeAtTile(tx, ty) !== "none") {
          ctx.fillStyle = "rgba(255, 64, 64, 0.18)";
          ctx.fillRect(sx, sy, drawTile, drawTile);
        }
      }
    }

    const playerKey = getCurrentPlayerSpriteKey();
    const playerMask = externalPlayerCollisionMaskByFrame.get(playerKey) || buildDefaultPlayerCollisionMaskRows();
    const playerImage = loadSprite(playerKey);
    const playerRatio = playerImage && playerImage.naturalWidth > 0 && playerImage.naturalHeight > 0
      ? playerImage.naturalWidth / playerImage.naturalHeight
      : 1;
    const playerW = PLAYER.drawHeight * playerRatio * CAMERA.zoom;
    const playerH = PLAYER.drawHeight * CAMERA.zoom;
    const playerLeft = canvas.clientWidth * 0.5 - playerW * 0.5;
    const playerTop = canvas.clientHeight * 0.5 - playerH * 0.9;
    const stepX = playerW / 16;
    const stepY = playerH / 16;
    const mirrorX = state.player.facing === "right" && playerKey.startsWith("side_");
    ctx.fillStyle = "rgba(80, 220, 255, 0.34)";
    for (let my = 0; my < 16; my += 1) {
      const row = playerMask[my] || 0;
      for (let mx = 0; mx < 16; mx += 1) {
        if (!(row & (1 << mx))) continue;
        const drawX = mirrorX ? (15 - mx) : mx;
        ctx.fillRect(playerLeft + drawX * stepX, playerTop + my * stepY, Math.ceil(stepX), Math.ceil(stepY));
      }
    }

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(10, 40, 170, 22);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("F3 DEBUG: collision", 16, 45);
    ctx.restore();
  }

  function drawCrops() {
    const { tileSize, drawTile, startX, endX, startY, endY } = getTileViewBounds(1);
    const originX = canvas.clientWidth * 0.5 - state.camera.x * CAMERA.zoom;
    const originY = canvas.clientHeight * 0.5 - state.camera.y * CAMERA.zoom;
    const nowMs = Date.now();
    for (const [k, crop] of state.crops.entries()) {
      if (!crop) continue;
      const stage = getCropVisualStage(crop, nowMs);
      if (!CROP_IMAGES[stage]) continue;
      const [tx, ty] = k.split(",").map(Number);
      if (tx < startX || tx > endX || ty < startY || ty > endY) continue;
      const sx = originX + tx * drawTile;
      const sy = originY + ty * drawTile;
      const img = loadImage(CROP_IMAGES[stage]);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, sx, sy, drawTile, drawTile);
      }
    }
  }

  function drawWorldItems() {
    const visibleXMin = state.camera.x - canvas.clientWidth * 0.5 / CAMERA.zoom - WORLD.tileSize;
    const visibleXMax = state.camera.x + canvas.clientWidth * 0.5 / CAMERA.zoom + WORLD.tileSize;
    const visibleYMin = state.camera.y - canvas.clientHeight * 0.5 / CAMERA.zoom - WORLD.tileSize;
    const visibleYMax = state.camera.y + canvas.clientHeight * 0.5 / CAMERA.zoom + WORLD.tileSize;
    for (const item of state.worldItems) {
      if (item.collected) continue;
      if (item.x < visibleXMin || item.x > visibleXMax || item.y < visibleYMin || item.y > visibleYMax) continue;

      const p = worldToScreen(item.x, item.y);
      const iconPath = ITEMS[item.kind] ? ITEMS[item.kind].icon : "";
      const icon = loadImage(iconPath);
      const bob = Math.sin(state.time * 4.5) * 2.2;

      const itemSize = 36 * CAMERA.zoom;
      const itemHalf = itemSize * 0.5;

      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 13 * CAMERA.zoom, 12 * CAMERA.zoom, 5 * CAMERA.zoom, 0, 0, Math.PI * 2);
      ctx.fill();

      if (icon.complete && icon.naturalWidth > 0) {
        ctx.drawImage(icon, p.x - itemHalf, p.y - 28 * CAMERA.zoom + bob * CAMERA.zoom, itemSize, itemSize);
      } else {
        ctx.fillStyle = "#d7d7d7";
        ctx.fillRect(p.x - 10 * CAMERA.zoom, p.y - 18 * CAMERA.zoom + bob * CAMERA.zoom, 20 * CAMERA.zoom, 20 * CAMERA.zoom);
      }
    }
  }

  function drawHeldItem() {
    const held = getSelectedItemKind();
    if (!held) return;

    const iconPath = ITEMS[held] ? ITEMS[held].icon : "";
    const icon = loadImage(iconPath);
    const p = worldToScreen(state.player.x, state.player.y);
    let ox = 14;
    let oy = -3;
    let flip = false;

    if (state.player.facing === "back") {
      ox = -12;
      oy = -8;
    } else if (state.player.facing === "front") {
      ox = 13;
      oy = 3;
    } else if (state.player.facing === "left") {
      ox = -18;
      oy = -4;
      flip = true;
    } else if (state.player.facing === "right") {
      ox = 18;
      oy = -4;
    }

    ctx.save();
    ctx.translate(p.x + ox, p.y + oy);
    if (flip) ctx.scale(-1, 1);
    if (icon.complete && icon.naturalWidth > 0) {
      ctx.drawImage(icon, -13, -13, 26, 26);
    } else {
      ctx.fillStyle = "#d7d7d7";
      ctx.fillRect(-8, -8, 16, 16);
    }
    ctx.restore();
  }

  function drawInventoryUI() {
    const slotCount = state.inventory.slots.length;
    const slotBase = loadImage(UI_IMAGES.slot);
    const slotSel = loadImage(UI_IMAGES.slot_on);
    const srcW = (slotBase.complete && slotBase.naturalWidth > 0) ? slotBase.naturalWidth : 16;
    const srcH = (slotBase.complete && slotBase.naturalHeight > 0) ? slotBase.naturalHeight : 16;
    const compact = isTouchDevice || canvas.clientWidth < 980 || canvas.clientHeight < 720;
    const baseScale = compact ? Math.round(40 / Math.max(srcW, srcH)) : Math.round(54 / Math.max(srcW, srcH));
    let slotScale = Math.max(2, baseScale);
    if (compact) {
      const maxBarW = Math.max(120, canvas.clientWidth - 24);
      const maxScaleByWidth = Math.floor((maxBarW - (slotCount - 1) * 4) / (slotCount * srcW));
      slotScale = Math.max(2, Math.min(slotScale, maxScaleByWidth));
    }
    const slotW = srcW * slotScale;
    const slotH = srcH * slotScale;
    const gap = compact ? Math.max(3, Math.floor(slotScale)) : Math.max(6, Math.floor(slotScale * 2));
    const totalH = slotCount * slotH + (slotCount - 1) * gap;
    const totalW = slotCount * slotW + (slotCount - 1) * gap;
    const startX = compact ? Math.max(8, Math.floor((canvas.clientWidth - totalW) * 0.5)) : (canvas.clientWidth - slotW - 16);
    const bottomSafePad = state.mode === "inventory"
      ? Math.max(18, Math.floor(slotH * 0.34))
      : (isTouchDevice ? Math.max(42, Math.floor(slotH * 0.9)) : Math.max(18, Math.floor(slotH * 0.34)));
    state.inventoryUi.quickBarReserve = slotH + bottomSafePad + 10;
    const startY = compact
      ? Math.max(8, canvas.clientHeight - slotH - bottomSafePad)
      : Math.max(14, Math.floor((canvas.clientHeight - totalH) * 0.5));

    for (let i = 0; i < slotCount; i += 1) {
      const x = compact ? startX + i * (slotW + gap) : startX;
      const y = compact ? startY : startY + i * (slotH + gap);
      state.inventoryUi.quickRects[i] = { x, y, w: slotW, h: slotH };
      const selected = i === state.inventory.selectedSlot;
      const entry = state.inventory.slots[i];
      const itemKind = getSlotKind(entry);
      const itemCount = getSlotCount(entry);

      const slotImg = selected ? slotSel : slotBase;
      if (slotImg.complete && slotImg.naturalWidth > 0) {
        ctx.drawImage(slotImg, x, y, slotW, slotH);
      } else {
        ctx.fillStyle = selected ? "rgba(22, 32, 22, 0.82)" : "rgba(18, 24, 18, 0.62)";
        ctx.fillRect(x, y, slotW, slotH);
      }

      if (itemKind) {
        const iconPath = ITEMS[itemKind] ? ITEMS[itemKind].icon : "";
        const icon = loadImage(iconPath);
        const iconSize = Math.max(20, Math.floor(slotW * 0.58));
        const ix = x + Math.floor((slotW - iconSize) * 0.5);
        const iy = y + Math.floor((slotH - iconSize) * 0.5);
        if (icon.complete && icon.naturalWidth > 0) {
          ctx.drawImage(icon, ix, iy, iconSize, iconSize);
        } else {
          ctx.fillStyle = "#d7d7d7";
          const fallback = Math.max(16, Math.floor(iconSize * 0.78));
          ctx.fillRect(x + Math.floor((slotW - fallback) * 0.5), y + Math.floor((slotH - fallback) * 0.5), fallback, fallback);
        }
        if (itemCount > 1) {
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.font = `bold ${Math.max(12, Math.floor(slotH * 0.24))}px sans-serif`;
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillText(String(itemCount), x + slotW - Math.floor(slotW * 0.12), y + slotH - Math.floor(slotH * 0.08));
        }
      }
    }
  }

  function drawTouchHud() {
    if (!isTouchDevice || state.mode !== "play") return;
    const uiScale = Math.max(1, Math.min(2, Math.floor(Math.min(canvas.clientWidth / 480, canvas.clientHeight / 300))));
    const s = 46 * uiScale;
    const pad = 10;
    const baseY = canvas.clientHeight - s * 3 - 96;
    const reversed = keyboardAttachedOnTouch;
    const leftX = reversed ? (canvas.clientWidth - s * 3 - pad) : pad;
    state.touchHud.upRect = { x: leftX + s, y: baseY, w: s, h: s };
    state.touchHud.leftRect = { x: leftX, y: baseY + s, w: s, h: s };
    state.touchHud.rightRect = { x: leftX + s * 2, y: baseY + s, w: s, h: s };
    state.touchHud.downRect = { x: leftX + s, y: baseY + s * 2, w: s, h: s };
    const rightX = reversed ? pad : (canvas.clientWidth - s * 2 - pad);
    state.touchHud.zoomInRect = { x: rightX, y: baseY - s * 1.25, w: s * 2, h: s };
    state.touchHud.zoomOutRect = { x: rightX, y: baseY - s * 0.15, w: s * 2, h: s };
    state.touchHud.useRect = { x: rightX, y: baseY + s, w: s * 2, h: s };
    state.touchHud.inventoryRect = { x: rightX, y: baseY + s * 2, w: s * 2, h: s };
    state.touchHud.saveRect = { x: canvas.clientWidth - s * 2 - pad, y: pad + 6, w: s * 2, h: s };

    const drawImageButton = (rect, imagePath, active, fallback) => {
      const img = loadImage(imagePath);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
        if (active) {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }
      } else {
        drawTabButton(rect, fallback, active, uiScale);
      }
    };
    const drawActionButton = (rect, label, active) => {
      const btn = loadImage(UI_IMAGES.kyara_select);
      if (btn.complete && btn.naturalWidth > 0) {
        ctx.drawImage(btn, rect.x, rect.y, rect.w, rect.h);
        if (active) {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }
        ctx.fillStyle = "#102015";
        ctx.font = `bold ${Math.max(11, Math.floor(rect.h * 0.42))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, rect.x + rect.w * 0.5, rect.y + rect.h * 0.5 + 1);
      } else {
        drawTabButton(rect, label, active, uiScale);
      }
    };

    drawImageButton(state.touchHud.upRect, UI_IMAGES.ui_up, state.touchHud.active === "up", "↑");
    drawImageButton(state.touchHud.leftRect, UI_IMAGES.ui_left, state.touchHud.active === "left", "←");
    drawImageButton(state.touchHud.rightRect, UI_IMAGES.ui_right, state.touchHud.active === "right", "→");
    drawImageButton(state.touchHud.downRect, UI_IMAGES.ui_down, state.touchHud.active === "down", "↓");
    drawImageButton(state.touchHud.zoomInRect, UI_IMAGES.ui_up, state.touchHud.active === "zoom_in", "+");
    drawImageButton(state.touchHud.zoomOutRect, UI_IMAGES.ui_down, state.touchHud.active === "zoom_out", "-");
    drawActionButton(state.touchHud.useRect, "使う", state.touchHud.active === "use");
    drawActionButton(state.touchHud.inventoryRect, "インベントリ", state.touchHud.active === "inventory");
    drawActionButton(state.touchHud.saveRect, "保存", state.touchHud.active === "save");
  }

  function getTouchHudHit(x, y) {
    if (pointInRect(x, y, state.touchHud.upRect)) return "up";
    if (pointInRect(x, y, state.touchHud.leftRect)) return "left";
    if (pointInRect(x, y, state.touchHud.rightRect)) return "right";
    if (pointInRect(x, y, state.touchHud.downRect)) return "down";
    if (pointInRect(x, y, state.touchHud.zoomInRect)) return "zoom_in";
    if (pointInRect(x, y, state.touchHud.zoomOutRect)) return "zoom_out";
    if (pointInRect(x, y, state.touchHud.useRect)) return "use";
    if (pointInRect(x, y, state.touchHud.inventoryRect)) return "inventory";
    if (pointInRect(x, y, state.touchHud.saveRect)) return "save";
    return "";
  }

  function saveWorldNow() {
    saveCharacterState(true);
    saveGameToStorage(true);
    syncLocalPlayer(true);
    showSyncToast("保存しました", 1400);
  }

  function drawUseEffects() {
    for (const fx of state.useEffects) {
      const t = fx.age / fx.duration;
      const p = worldToScreen(fx.x, fx.y);
      const reach = (22 + 28 * t) * CAMERA.zoom;
      const centerX = p.x + Math.cos(fx.angle) * (12 * CAMERA.zoom + reach * 0.32);
      const centerY = p.y + Math.sin(fx.angle) * (12 * CAMERA.zoom + reach * 0.32);
      const alpha = 0.78 * (1 - t);

      ctx.lineCap = "round";
      ctx.lineWidth = (7 - 3.5 * t) * CAMERA.zoom;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, reach, fx.angle - Math.PI * 0.5, fx.angle + Math.PI * 0.5);
      ctx.stroke();
    }
  }

  function drawUseTargetPreview() {
    const held = getSelectedItemKind();
    if (state.mode !== "play") return;
    const emptyHand = !held;
    if (!emptyHand && !USE_PREVIEW_ITEMS.has(held)) return;

    const frame = Math.floor(state.time * 6) % 2 === 0 ? UI_IMAGES.select : UI_IMAGES.select2;
    const marker = loadImage(frame);
    if (!(marker.complete && marker.naturalWidth > 0 && marker.naturalHeight > 0)) return;

    const drawTile = WORLD.tileSize * CAMERA.zoom;
    const targets = getUseTargetTiles();
    const playerTileX = Math.floor(state.player.x / WORLD.tileSize);
    const playerTileY = Math.floor(state.player.y / WORLD.tileSize);
    const playerOnLayer1Only = !hasAnyLayer2TileAtTile(playerTileX, playerTileY);
    for (const [tx, ty] of targets) {
      if (playerOnLayer1Only && hasAnyLayer2TileAtTile(tx, ty)) continue;
      const wx = tx * WORLD.tileSize;
      const wy = ty * WORLD.tileSize;
      const p = worldToScreen(wx, wy);
      if (emptyHand) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.drawImage(marker, p.x, p.y, drawTile, drawTile);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(140, 180, 255, 0.18)";
        ctx.fillRect(p.x, p.y, drawTile, drawTile);
        ctx.restore();
      } else {
        ctx.drawImage(marker, p.x, p.y, drawTile, drawTile);
      }
    }
  }

  function formatTimeLabel(ms) {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  function getCurrentWorldDate() {
    const now = new Date();
    if (!state.debugTimeOverrideActive || !Number.isFinite(state.debugTimeOffsetHours) || state.debugTimeOffsetHours === 0) {
      return now;
    }
    return new Date(now.getTime() + state.debugTimeOffsetHours * 60 * 60 * 1000);
  }

  function getCurrentWorldTimeMs() {
    return getCurrentWorldDate().getTime();
  }

  function getTimeOfDayOverlayState() {
    const now = getCurrentWorldDate();
    const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

    let color = null;
    let alpha = 0;
    if (hour >= 5 && hour < 8) {
      const t = (hour - 5) / 3;
      color = [255, 255, 252];
      alpha = 0.24 * (1 - t);
    } else if (hour >= 16 && hour < 19) {
      const t = (hour - 16) / 3;
      color = [255, 132, 48];
      alpha = 0.24 * Math.sin(t * Math.PI);
    } else if (hour >= 19 || hour < 5) {
      let t = 1;
      if (hour >= 19 && hour < 21) t = (hour - 19) / 2;
      else if (hour >= 3 && hour < 5) t = 1 - (hour - 3) / 2;
      color = [10, 18, 52];
      alpha = 0.42 * clamp(t, 0, 1);
    }

    return { color, alpha };
  }

  function drawTimeOfDayOverlay() {
    const overlay = getTimeOfDayOverlayState();
    if (!overlay.color || overlay.alpha <= 0.001) return;
    const [r, g, b] = overlay.color;
    ctx.fillStyle = `rgba(${r},${g},${b},${overlay.alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  function getNextCropHarvestAtMs() {
    let next = null;
    for (const crop of state.crops.values()) {
      if (!crop || typeof crop !== "object") continue;
      const t = Number(crop.harvestAtMs);
      if (!Number.isFinite(t)) continue;
      if (next === null || t < next) next = t;
    }
    return next;
  }

  function drawClockHud() {
    const nowMs = getCurrentWorldTimeMs();
    const nowText = formatTimeLabel(nowMs);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(10, 10, 96, 24);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(nowText, 16, 16);
  }

  function drawPanelFrame(x, y, w, h, scale) {
    const tl = loadImage(UI_IMAGES.panel_tl);
    const t = loadImage(UI_IMAGES.panel_top);
    const tr = loadImage(UI_IMAGES.panel_tr);
    const l = loadImage(UI_IMAGES.panel_left);
    const c = loadImage(UI_IMAGES.panel_center);
    const r = loadImage(UI_IMAGES.panel_right);
    const bl = loadImage(UI_IMAGES.panel_bl);
    const b = loadImage(UI_IMAGES.panel_bottom);
    const br = loadImage(UI_IMAGES.panel_br);
    const s = Math.max(1, scale | 0);
    const edgeW = (tl.naturalWidth > 0 ? tl.naturalWidth : 16) * s;
    const edgeH = (tl.naturalHeight > 0 ? tl.naturalHeight : 16) * s;
    const innerW = Math.max(1, w - edgeW * 2);
    const innerH = Math.max(1, h - edgeH * 2);

    // Center: tile fill (no stretch)
    if (c.complete && c.naturalWidth > 0 && c.naturalHeight > 0) {
      const stepW = c.naturalWidth * s;
      const stepH = c.naturalHeight * s;
      for (let yy = y + edgeH; yy < y + edgeH + innerH; yy += stepH) {
        for (let xx = x + edgeW; xx < x + edgeW + innerW; xx += stepW) {
          const dw = Math.min(stepW, x + edgeW + innerW - xx);
          const dh = Math.min(stepH, y + edgeH + innerH - yy);
          const sw = Math.max(1, Math.round(dw / s));
          const sh = Math.max(1, Math.round(dh / s));
          ctx.drawImage(c, 0, 0, sw, sh, xx, yy, dw, dh);
        }
      }
    }

    // Top / Bottom edges: horizontal tile
    const topH = (t.naturalHeight > 0 ? t.naturalHeight : 16) * s;
    const bottomH = (b.naturalHeight > 0 ? b.naturalHeight : 16) * s;
    const topStepW = (t.naturalWidth > 0 ? t.naturalWidth : 16) * s;
    const bottomStepW = (b.naturalWidth > 0 ? b.naturalWidth : 16) * s;
    for (let xx = x + edgeW; xx < x + edgeW + innerW; xx += topStepW) {
      const dw = Math.min(topStepW, x + edgeW + innerW - xx);
      if (t.complete && t.naturalWidth > 0 && t.naturalHeight > 0) {
        const sw = Math.max(1, Math.round(dw / s));
        ctx.drawImage(t, 0, 0, sw, t.naturalHeight, xx, y, dw, topH);
      }
      if (b.complete && b.naturalWidth > 0 && b.naturalHeight > 0) {
        const bdw = Math.min(bottomStepW, x + edgeW + innerW - xx);
        const bsw = Math.max(1, Math.round(bdw / s));
        ctx.drawImage(b, 0, 0, bsw, b.naturalHeight, xx, y + h - bottomH, bdw, bottomH);
      }
    }

    // Left / Right edges: vertical tile
    const leftW = (l.naturalWidth > 0 ? l.naturalWidth : 16) * s;
    const rightW = (r.naturalWidth > 0 ? r.naturalWidth : 16) * s;
    const leftStepH = (l.naturalHeight > 0 ? l.naturalHeight : 16) * s;
    const rightStepH = (r.naturalHeight > 0 ? r.naturalHeight : 16) * s;
    for (let yy = y + edgeH; yy < y + edgeH + innerH; yy += leftStepH) {
      const dh = Math.min(leftStepH, y + edgeH + innerH - yy);
      if (l.complete && l.naturalWidth > 0 && l.naturalHeight > 0) {
        const sh = Math.max(1, Math.round(dh / s));
        ctx.drawImage(l, 0, 0, l.naturalWidth, sh, x, yy, leftW, dh);
      }
      if (r.complete && r.naturalWidth > 0 && r.naturalHeight > 0) {
        const rdh = Math.min(rightStepH, y + edgeH + innerH - yy);
        const rsh = Math.max(1, Math.round(rdh / s));
        ctx.drawImage(r, 0, 0, r.naturalWidth, rsh, x + w - rightW, yy, rightW, rdh);
      }
    }

    // Corners
    if (tl.complete && tl.naturalWidth > 0) ctx.drawImage(tl, x, y, tl.naturalWidth * s, tl.naturalHeight * s);
    if (tr.complete && tr.naturalWidth > 0) ctx.drawImage(tr, x + w - tr.naturalWidth * s, y, tr.naturalWidth * s, tr.naturalHeight * s);
    if (bl.complete && bl.naturalWidth > 0) ctx.drawImage(bl, x, y + h - bl.naturalHeight * s, bl.naturalWidth * s, bl.naturalHeight * s);
    if (br.complete && br.naturalWidth > 0) ctx.drawImage(br, x + w - br.naturalWidth * s, y + h - br.naturalHeight * s, br.naturalWidth * s, br.naturalHeight * s);
  }

  function drawTabButton(rect, label, on, scale) {
    const l = loadImage(on ? UI_IMAGES.tab_l_on : UI_IMAGES.tab_l);
    const m = loadImage(on ? UI_IMAGES.tab_m_on : UI_IMAGES.tab_m);
    const r = loadImage(on ? UI_IMAGES.tab_r_on : UI_IMAGES.tab_r);
    const s = Math.max(1, scale | 0);
    const edgeL = (l.naturalWidth > 0 ? l.naturalWidth : 16) * s;
    const edgeR = (r.naturalWidth > 0 ? r.naturalWidth : 16) * s;
    const btnH = (m.naturalHeight > 0 ? m.naturalHeight : 16) * s;
    const midW = Math.max(8, rect.w - edgeL - edgeR);
    const y = rect.y + Math.floor((rect.h - btnH) * 0.5);

    if (l.complete && l.naturalWidth > 0) ctx.drawImage(l, rect.x, y, l.naturalWidth * s, l.naturalHeight * s);
    if (m.complete && m.naturalWidth > 0 && m.naturalHeight > 0) {
      const stepW = m.naturalWidth * s;
      let xx = rect.x + edgeL;
      while (xx < rect.x + edgeL + midW) {
        const dw = Math.min(stepW, rect.x + edgeL + midW - xx);
        const sw = Math.max(1, Math.round(dw / s));
        ctx.drawImage(m, 0, 0, sw, m.naturalHeight, xx, y, dw, btnH);
        xx += stepW;
      }
    }
    if (r.complete && r.naturalWidth > 0) ctx.drawImage(r, rect.x + rect.w - edgeR, y, r.naturalWidth * s, r.naturalHeight * s);

    ctx.fillStyle = "rgba(245,248,255,0.95)";
    ctx.font = `bold ${Math.max(20, Math.floor(btnH * 0.48))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w * 0.5, rect.y + rect.h * 0.5 + 1);
  }

  function drawTitleScreen() {
    const baseTile = 16;
    const uiScale = Math.max(2, Math.min(4, Math.floor(Math.min(canvas.clientWidth / 560, canvas.clientHeight / 320))));
    const tile = baseTile * uiScale;
    const panelCols = Math.max(24, Math.min(44, Math.floor(canvas.clientWidth * 0.84 / tile)));
    const panelRows = Math.max(14, Math.min(26, Math.floor(canvas.clientHeight * 0.60 / tile)));
    const panelW = panelCols * tile;
    const panelH = panelRows * tile;
    const panelX = Math.floor((canvas.clientWidth - panelW) * 0.5);
    const panelY = Math.floor((canvas.clientHeight - panelH) * 0.18);
    drawPanelFrame(panelX, panelY, panelW, panelH, uiScale);

    const titleImg = loadImage(UI_IMAGES.title);
    const titleCenterX = panelX + panelW * 0.5;
    const titleY = panelY + 46;
    if (titleImg.complete && titleImg.naturalWidth > 0 && titleImg.naturalHeight > 0) {
      const maxW = Math.floor(panelW * 0.92);
      const maxH = Math.floor(panelH * 0.52);
      const scale = Math.max(1, Math.floor(Math.min(
        maxW / titleImg.naturalWidth,
        maxH / titleImg.naturalHeight,
      )));
      const dw = titleImg.naturalWidth * scale;
      const dh = titleImg.naturalHeight * scale;
      ctx.drawImage(titleImg, Math.floor(titleCenterX - dw * 0.5), titleY, dw, dh);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 56px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("やんさん農業ゲーム", titleCenterX, panelY + 86);
    }

    const btnW = tile * 10;
    const btnH = tile * 2;
    const btnX = panelX + Math.floor((panelW - btnW) * 0.5);
    const btnY = panelY + panelH - btnH * 2 - tile * 1.2;
    state.titleUi.startRect = { x: btnX, y: btnY, w: btnW, h: btnH };
    state.titleUi.exitRect = {
      x: btnX,
      y: btnY + btnH + Math.floor(tile * 0.6),
      w: btnW,
      h: btnH,
    };
    drawTabButton(state.titleUi.startRect, "スタート", state.titleUi.hot === "start" || state.titleUi.pressed === "start", uiScale);
    drawTabButton(state.titleUi.exitRect, "終了", state.titleUi.hot === "exit" || state.titleUi.pressed === "exit", uiScale);
  }

  function drawSaveSelectScreen() {
    const slots = getSaveSlotsView();
    const uiScale = Math.max(2, Math.min(4, Math.floor(Math.min(canvas.clientWidth / 560, canvas.clientHeight / 320))));
    const cols = canvas.clientWidth < 860 ? 1 : 3;
    const rows = Math.ceil(SAVE_SLOT_COUNT / cols);
    const gap = Math.max(10, Math.floor(canvas.clientWidth * 0.018));
    const topPad = Math.floor(canvas.clientHeight * 0.16);
    const bottomPad = 18;
    const availableW = Math.max(220, canvas.clientWidth - 20);
    const availableH = Math.max(240, canvas.clientHeight - topPad - bottomPad);
    const cardW = Math.max(180, Math.floor((availableW - (cols - 1) * gap) / cols));
    const cardH = Math.max(130, Math.floor((availableH - (rows - 1) * gap) / rows));
    const totalW = cardW * cols + gap * (cols - 1);
    const startX = Math.floor((canvas.clientWidth - totalW) * 0.5);
    const startY = topPad;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    for (let i = 0; i < 3; i += 1) {
      const slot = slots[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      const r = { x, y, w: cardW, h: cardH };
      state.saveSelectUi.cards[i].cardRect = r;
      drawPanelFrame(r.x, r.y, r.w, r.h, uiScale);

      const nameRect = {
        x: r.x + Math.floor(r.w * 0.08),
        y: r.y + Math.floor(r.h * 0.18),
        w: Math.floor(r.w * 0.84),
        h: Math.floor(r.h * 0.18),
      };
      state.saveSelectUi.cards[i].nameRect = nameRect;
      const selectedName = state.saveSelectUi.editNameIndex === i;
      const displayName = selectedName
        ? String(slot.name || "")
        : (String(slot.name || "").trim() || `データ${i + 1}`);
      ctx.fillStyle = selectedName ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)";
      ctx.fillRect(nameRect.x, nameRect.y, nameRect.w, nameRect.h);
      ctx.strokeStyle = selectedName ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(nameRect.x + 0.5, nameRect.y + 0.5, nameRect.w - 1, nameRect.h - 1);

      ctx.fillStyle = "rgba(245,248,255,0.95)";
      ctx.font = `bold ${Math.max(16, Math.floor(nameRect.h * 0.45))}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      drawEllipsisText(displayName, nameRect.x + 8, nameRect.y + nameRect.h * 0.5, nameRect.w - 16);

      ctx.font = `${Math.max(11, Math.floor(cardH * 0.075))}px sans-serif`;
      drawEllipsisText(
        `プレイ記録 ${formatPlayTime(slot.totalPlaySeconds)}`,
        r.x + Math.floor(r.w * 0.08),
        r.y + Math.floor(r.h * 0.52),
        Math.floor(r.w * 0.84),
      );

      const startRect = {
        x: r.x + Math.floor(r.w * 0.18),
        y: r.y + Math.floor(r.h * 0.62),
        w: Math.floor(r.w * 0.64),
        h: Math.floor(r.h * 0.15),
      };
      state.saveSelectUi.cards[i].startRect = startRect;
      const on = state.saveSelectUi.hotStartIndex === i || state.saveSelectUi.pressedStartIndex === i;
      drawTabButton(startRect, "スタート", on, uiScale);

      const deleteRect = {
        x: r.x + Math.floor(r.w * 0.18),
        y: r.y + Math.floor(r.h * 0.80),
        w: Math.floor(r.w * 0.64),
        h: Math.floor(r.h * 0.12),
      };
      state.saveSelectUi.cards[i].deleteRect = deleteRect;
      const delOn = state.saveSelectUi.hotDeleteIndex === i || state.saveSelectUi.pressedDeleteIndex === i;
      drawTabButton(deleteRect, "削除", delOn, uiScale);
    }
  }

  function drawPauseScreen() {
    const baseTile = 16;
    const uiScale = Math.max(2, Math.min(4, Math.floor(Math.min(canvas.clientWidth / 560, canvas.clientHeight / 320))));
    const tile = baseTile * uiScale;
    const panelCols = Math.max(20, Math.min(32, Math.floor(canvas.clientWidth * 0.56 / tile)));
    const panelRows = Math.max(15, Math.min(24, Math.floor(canvas.clientHeight * 0.68 / tile)));
    const panelW = panelCols * tile;
    const panelH = panelRows * tile;
    const panelX = Math.floor((canvas.clientWidth - panelW) * 0.5);
    const panelY = Math.floor((canvas.clientHeight - panelH) * 0.5);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    drawPanelFrame(panelX, panelY, panelW, panelH, uiScale);

    const btnW = Math.floor(panelW * 0.56);
    const btnH = tile * 2;
    const gap = Math.floor(tile * 0.55);
    const listTop = panelY + Math.floor(tile * 1.5);
    const btnX = panelX + Math.floor((panelW - btnW) * 0.5);

    state.pauseUi.saveRect = { x: btnX, y: listTop, w: btnW, h: btnH };
    state.pauseUi.loadRect = { x: btnX, y: listTop + (btnH + gap), w: btnW, h: btnH };
    state.pauseUi.titleRect = { x: btnX, y: listTop + (btnH + gap) * 2, w: btnW, h: btnH };
    state.pauseUi.resumeRect = { x: btnX, y: listTop + (btnH + gap) * 3, w: btnW, h: btnH };

    drawTabButton(state.pauseUi.saveRect, "セーブ", state.pauseUi.hot === "save" || state.pauseUi.pressed === "save", uiScale);
    drawTabButton(state.pauseUi.loadRect, "ロード", state.pauseUi.hot === "load" || state.pauseUi.pressed === "load", uiScale);
    drawTabButton(state.pauseUi.titleRect, "タイトルへ", state.pauseUi.hot === "title" || state.pauseUi.pressed === "title", uiScale);
    drawTabButton(state.pauseUi.resumeRect, "ゲームへ", state.pauseUi.hot === "resume" || state.pauseUi.pressed === "resume", uiScale);
  }

  function getInventorySlotAt(x, y) {
    for (let i = 0; i < state.inventoryUi.bagRects.length; i += 1) {
      if (pointInRect(x, y, state.inventoryUi.bagRects[i])) return { area: "bag", index: i };
    }
    for (let i = 0; i < state.inventoryUi.quickRects.length; i += 1) {
      if (pointInRect(x, y, state.inventoryUi.quickRects[i])) return { area: "quick", index: i };
    }
    return null;
  }

  function getQuickSlotIndexAt(x, y) {
    for (let i = 0; i < state.inventoryUi.quickRects.length; i += 1) {
      if (pointInRect(x, y, state.inventoryUi.quickRects[i])) return i;
    }
    return -1;
  }

  function canMergeEntries(a, b) {
    const kindA = getSlotKind(a);
    const kindB = getSlotKind(b);
    if (!kindA || !kindB) return false;
    if (kindA !== kindB) return false;
    return isStackableItem(kindA);
  }

  function performInventoryDrop(target) {
    const drag = state.inventoryUi.drag;
    if (!drag.active || !drag.entry) return;
    const source = { area: drag.sourceType, index: drag.sourceIndex };
    const sourceEntry = cloneSlotEntry(drag.entry);
    if (!target) {
      setEntryToArea(source.area, source.index, sourceEntry);
      return;
    }

    const targetEntry = cloneSlotEntry(getEntryFromArea(target.area, target.index));
    if (source.area === target.area && source.index === target.index) {
      setEntryToArea(source.area, source.index, sourceEntry);
      return;
    }
    if (canMergeEntries(sourceEntry, targetEntry)) {
      const merged = { kind: getSlotKind(sourceEntry), count: getSlotCount(sourceEntry) + getSlotCount(targetEntry) };
      setEntryToArea(target.area, target.index, merged);
      return;
    }
    setEntryToArea(target.area, target.index, sourceEntry);
    setEntryToArea(source.area, source.index, targetEntry);
  }

  function drawInventoryScreen() {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const slotBase = loadImage(UI_IMAGES.slot);
    const slotSel = loadImage(UI_IMAGES.slot_on);
    const srcW = (slotBase.complete && slotBase.naturalWidth > 0) ? slotBase.naturalWidth : 16;
    const srcH = (slotBase.complete && slotBase.naturalHeight > 0) ? slotBase.naturalHeight : 16;
    const bagCols = canvas.clientWidth >= canvas.clientHeight ? 9 : 6;
    const bagRows = Math.ceil(27 / bagCols);
    const gapBase = 6;
    const pad = 10;
    const closeW = 92;
    const closeH = 36;
    const topY = pad + closeH + 8;
    const availW = Math.max(180, canvas.clientWidth - pad * 2);
    const quickBarReserve = Math.max(56, state.inventoryUi.quickBarReserve || 0);
    const availH = Math.max(120, canvas.clientHeight - topY - pad - quickBarReserve);
    const maxScaleW = Math.floor((availW - (bagCols - 1) * gapBase) / (bagCols * srcW));
    const maxScaleH = Math.floor((availH - (bagRows - 1) * gapBase) / (bagRows * srcH));
    const slotScale = Math.max(1, Math.min(4, maxScaleW, maxScaleH));
    const slotW = srcW * slotScale;
    const slotH = srcH * slotScale;
    const gap = Math.max(3, Math.floor(slotScale * 1.2));
    const bagW = bagCols * slotW + (bagCols - 1) * gap;
    const bagH = bagRows * slotH + (bagRows - 1) * gap;
    const bagStartX = Math.max(pad, Math.floor((canvas.clientWidth - bagW) * 0.5));
    const bagStartY = Math.max(topY, Math.floor((topY + availH - bagH) * 0.5));

    state.inventoryUi.closeRect = {
      x: canvas.clientWidth - closeW - pad,
      y: pad,
      w: closeW,
      h: closeH,
    };
    drawTabButton(
      state.inventoryUi.closeRect,
      "閉じる",
      state.inventoryUi.closePressed,
      Math.max(1, Math.min(3, Math.floor(slotScale * 0.9))),
    );

    const drawSlotEntry = (area, index, x, y, selected) => {
      const hot = state.inventoryUi.hot && state.inventoryUi.hot.area === area && state.inventoryUi.hot.index === index;
      const slotImg = selected || hot ? slotSel : slotBase;
      if (slotImg.complete && slotImg.naturalWidth > 0) {
        ctx.drawImage(slotImg, x, y, slotW, slotH);
      } else {
        ctx.fillStyle = selected || hot ? "rgba(22, 32, 22, 0.82)" : "rgba(18, 24, 18, 0.62)";
        ctx.fillRect(x, y, slotW, slotH);
      }
      const entry = getEntryFromArea(area, index);
      const itemKind = getSlotKind(entry);
      const itemCount = getSlotCount(entry);
      if (!itemKind) return;
      const iconPath = ITEMS[itemKind] ? ITEMS[itemKind].icon : "";
      const icon = loadImage(iconPath);
      const iconSize = Math.max(18, Math.floor(slotW * 0.58));
      const ix = x + Math.floor((slotW - iconSize) * 0.5);
      const iy = y + Math.floor((slotH - iconSize) * 0.5);
      if (icon.complete && icon.naturalWidth > 0) {
        ctx.drawImage(icon, ix, iy, iconSize, iconSize);
      }
      if (itemCount > 1) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = `bold ${Math.max(11, Math.floor(slotH * 0.24))}px sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(itemCount), x + slotW - Math.floor(slotW * 0.10), y + slotH - Math.floor(slotH * 0.06));
      }
    };

    for (let i = 0; i < 27; i += 1) {
      const col = i % bagCols;
      const row = Math.floor(i / bagCols);
      const x = bagStartX + col * (slotW + gap);
      const y = bagStartY + row * (slotH + gap);
      state.inventoryUi.bagRects[i] = { x, y, w: slotW, h: slotH };
      drawSlotEntry("bag", i, x, y, false);
    }

    const drag = state.inventoryUi.drag;
    if (drag.active && drag.entry) {
      const itemKind = getSlotKind(drag.entry);
      const itemCount = getSlotCount(drag.entry);
      const iconPath = ITEMS[itemKind] ? ITEMS[itemKind].icon : "";
      const icon = loadImage(iconPath);
      const drawX = drag.x - slotW * 0.5;
      const drawY = drag.y - slotH * 0.5;
      ctx.globalAlpha = 0.9;
      if (slotSel.complete && slotSel.naturalWidth > 0) {
        ctx.drawImage(slotSel, drawX, drawY, slotW, slotH);
      }
      const iconSize = Math.max(18, Math.floor(slotW * 0.58));
      if (icon.complete && icon.naturalWidth > 0) {
        ctx.drawImage(icon, drawX + Math.floor((slotW - iconSize) * 0.5), drawY + Math.floor((slotH - iconSize) * 0.5), iconSize, iconSize);
      }
      if (itemCount > 1) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = `bold ${Math.max(11, Math.floor(slotH * 0.24))}px sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(itemCount), drawX + slotW - Math.floor(slotW * 0.10), drawY + slotH - Math.floor(slotH * 0.06));
      }
      ctx.globalAlpha = 1;
    }
  }

  function pointInRect(px, py, r) {
    return px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h;
  }

  function deriveRoomId() {
    const raw = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
    const clean = raw.replace(/[^a-z0-9_-]/g, "");
    return clean || "yansan-farm-room";
  }

  function showSyncToast(text, ms = 1200) {
    state.syncUi.toast = text;
    state.syncUi.toastUntil = performance.now() + ms;
  }

  function setSyncError(err) {
    const raw = typeof err === "string" ? err : String(err?.message || err || "");
    syncLastError = raw || "sync error";
    console.error("sync", err);
  }

  async function copyInviteUrl() {
    const url = new URL(window.location.href);
    url.hash = state.syncUi.roomId;
    const text = url.toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "readonly");
        area.style.position = "fixed";
        area.style.opacity = "0";
        area.style.pointerEvents = "none";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      showSyncToast("URLコピーしました");
    } catch {
      showSyncToast("コピー失敗", 1800);
    }
  }

  function refreshLocks(snapshot) {
    characterLocks.clear();
    if (!snapshot.exists()) return;
    const now = Date.now();
    snapshot.forEach((c) => {
      const v = c.val();
      if (!v || typeof v !== "object") return;
      if (typeof v.ts === "number" && now - v.ts > LOCK_TIMEOUT_MS) return;
      characterLocks.set(c.key, v);
    });
  }

  function isCharacterLockedByOther(characterId) {
    const lock = characterLocks.get(characterId);
    if (!lock) return false;
    return lock.clientId !== clientId;
  }

  async function acquireCharacter(characterId) {
    if (!db || !locksRef) return false;
    if (!isDbConnected) {
      showSyncToast("ONLINE接続待ちです", 1800);
      return false;
    }
    const def = CHARACTER_DEFS.find((c) => c.id === characterId);
    if (!def) return false;

    if (localLockRef) {
      remove(localLockRef).catch(() => {});
      localLockRef = null;
    }
    const nextLockRef = ref(db, `${state.syncUi.roomPath}/locks/${characterId}`);
    const tx = await runTransaction(nextLockRef, (current) => {
      const now = Date.now();
      if (current && typeof current === "object") {
        const stale = typeof current.ts !== "number" || now - current.ts > LOCK_TIMEOUT_MS;
        const mine = current.clientId === clientId;
        if (!stale && !mine) return;
      }
      return { clientId, ts: now, name: def.name };
    }, { applyLocally: false }).catch((err) => {
      setSyncError(err);
      return null;
    });
    if (!(tx && tx.committed)) return false;
    localLockRef = nextLockRef;
    onDisconnect(nextLockRef).remove().catch((err) => setSyncError(err));

    state.selectedCharacterId = characterId;
    state.playerName = def.name;
    const loaded = await loadCharacterState(characterId);
    if (!loaded) resetGameplayState();
    state.mode = "play";
    requestGameplayFullscreen();
    refreshMobileUi();
    syncLocalPlayer(true);
    return true;
  }

  function releaseCharacter() {
    saveCharacterState(true);
    if (localLockRef) {
      remove(localLockRef).catch(() => {});
      localLockRef = null;
    }
    if (localPlayerRef) {
      remove(localPlayerRef).catch(() => {});
    }
    state.selectedCharacterId = "";
    state.playerName = "";
  }

  async function forceClearAllCharacters() {
    if (!db || !state.syncUi.roomPath) return false;
    try {
      await Promise.all([
        remove(ref(db, `${state.syncUi.roomPath}/players`)),
        remove(ref(db, `${state.syncUi.roomPath}/locks`)),
      ]);
      onlinePlayers.clear();
      characterLocks.clear();
      remoteVisualPlayers.clear();
      releaseCharacter();
      setMode("char_select");
      showSyncToast("全キャラを退出させました", 1800);
      return true;
    } catch (err) {
      setSyncError(err);
      showSyncToast("全退出に失敗しました", 1800);
      return false;
    }
  }

  function setupMultiplayerSync() {
    state.syncUi.roomId = deriveRoomId();
    state.syncUi.roomPath = `rooms/${state.syncUi.roomId}`;
    const app = initializeApp(FIREBASE_CONFIG, `yansan-farm-${Date.now()}`);
    db = getDatabase(app);
    playersRef = ref(db, `${state.syncUi.roomPath}/players`);
    locksRef = ref(db, `${state.syncUi.roomPath}/locks`);
    worldTilesRef = ref(db, `${state.syncUi.roomPath}/world/tileOverrides`);
    localPlayerRef = ref(db, `${state.syncUi.roomPath}/players/${clientId}`);
    const connectedRef = ref(db, ".info/connected");

    stopPlayersSync = onValue(playersRef, (snapshot) => {
      onlinePlayers.clear();
      const now = Date.now();
      if (!snapshot.exists()) return;
      snapshot.forEach((c) => {
        if (!c.key || c.key === clientId) return;
        const v = c.val();
        if (!v || typeof v !== "object") return;
        const ts = Number(v.ts) || 0;
        if (!ts || now - ts > PLAYER_TIMEOUT_MS) return;
        onlinePlayers.set(c.key, v);
      });
      for (const id of remoteVisualPlayers.keys()) {
        if (!onlinePlayers.has(id)) remoteVisualPlayers.delete(id);
      }
    }, (err) => setSyncError(err));
    stopLocksSync = onValue(locksRef, (snapshot) => {
      refreshLocks(snapshot);
      if (state.selectedCharacterId && isCharacterLockedByOther(state.selectedCharacterId)) {
        releaseCharacter();
        state.mode = "char_select";
        refreshMobileUi();
        showSyncToast("キャラが使用中になりました", 2000);
      }
    }, (err) => setSyncError(err));
    stopConnectionSync = onValue(connectedRef, (snapshot) => {
      isDbConnected = snapshot.val() === true;
      if (isDbConnected) syncLastError = "";
    }, (err) => setSyncError(err));
    stopWorldTilesSync = onValue(worldTilesRef, (snapshot) => {
      const src = snapshot.exists() && snapshot.val() && typeof snapshot.val() === "object"
        ? snapshot.val()
        : {};
      const next = new Map();
      for (const [k, v] of Object.entries(src)) {
        if (!k || typeof v !== "string") continue;
        next.set(k, v);
      }
      // Keep unsent local edits so incoming remote updates do not wipe them.
      for (const [k, v] of pendingTilePatches.entries()) {
        if (typeof v === "string") next.set(k, v);
        else next.delete(k);
      }
      if (!mapsEqual(state.tileOverrides, next)) {
        state.tileOverrides = next;
        state.clippingsTimers.clear();
      }
      worldTilesDirty = pendingTilePatches.size > 0;
    }, (err) => setSyncError(err));
    onDisconnect(localPlayerRef).remove().catch((err) => setSyncError(err));
    window.addEventListener("beforeunload", () => {
      releaseCharacter();
      stopPlayersSync?.();
      stopLocksSync?.();
      stopConnectionSync?.();
      stopWorldTilesSync?.();
    });
  }

  function syncLocalPlayer(force = false) {
    if (!localPlayerRef || !state.selectedCharacterId) return;
    const now = Date.now();
    if (!force && now - lastSyncAt < SYNC_INTERVAL_MS) return;
    lastSyncAt = now;
    set(localPlayerRef, {
      x: state.player.x,
      y: state.player.y,
      vx: state.player.vx,
      vy: state.player.vy,
      speed: state.player.speed,
      facing: state.player.facing,
      idleFrameIndex: state.player.idleFrameIndex,
      runFrameIndex: state.player.runFrameIndex,
      moving: state.player.speed > 10,
      characterId: state.selectedCharacterId,
      name: state.playerName || state.selectedCharacterId.toUpperCase(),
      ts: now,
    }).catch((err) => setSyncError(err));
    if (localLockRef) {
      set(localLockRef, {
        clientId,
        ts: now,
        name: state.playerName || state.selectedCharacterId.toUpperCase(),
      }).catch((err) => setSyncError(err));
    }
    if (worldTilesRef && pendingTilePatches.size > 0 && (force || now - lastWorldTilesSyncAt >= 150)) {
      lastWorldTilesSyncAt = now;
      const sent = new Map(pendingTilePatches);
      const patch = {};
      for (const [k, v] of sent.entries()) patch[k] = v === null ? null : v;
      updateDb(worldTilesRef, patch)
        .then(() => {
          for (const [k, v] of sent.entries()) {
            if (pendingTilePatches.get(k) === v) pendingTilePatches.delete(k);
          }
          worldTilesDirty = pendingTilePatches.size > 0;
        })
        .catch((err) => setSyncError(err));
    }
  }

  function drawCharacterSelectScreen() {
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.fillStyle = "rgba(242,247,239,0.98)";
    const titleScale = Math.max(0.4, Math.min(1, canvas.clientWidth / 1200));
    ctx.font = `bold ${Math.floor(64 * titleScale)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("SEKECT PLAYER", canvas.clientWidth * 0.5, 16);
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(`ROOM ID: ${state.syncUi.roomId}`, canvas.clientWidth * 0.5, 90);
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = syncLastError
      ? "rgba(255,120,120,0.96)"
      : (isDbConnected ? "rgba(126,240,165,0.95)" : "rgba(255,210,145,0.95)");
    const syncLabel = syncLastError
      ? `SYNC ERROR / PEERS: ${onlinePlayers.size}`
      : `SYNC: ${isDbConnected ? "ONLINE" : "CONNECTING"} / PEERS: ${onlinePlayers.size}`;
    ctx.fillText(syncLabel, canvas.clientWidth * 0.5, 114);

    const btnW = 150;
    const btnH = 28;
    state.syncUi.copyRect = { x: Math.floor(canvas.clientWidth * 0.5 - btnW * 0.5), y: 126, w: btnW, h: btnH };
    ctx.fillStyle = "rgba(245,247,241,0.95)";
    ctx.fillRect(state.syncUi.copyRect.x, state.syncUi.copyRect.y, btnW, btnH);
    ctx.strokeStyle = "rgba(52,71,57,0.35)";
    ctx.strokeRect(state.syncUi.copyRect.x, state.syncUi.copyRect.y, btnW, btnH);
    ctx.fillStyle = "#1f2a21";
    ctx.fillText("COPY URL", canvas.clientWidth * 0.5, 132);

    state.syncUi.cardRects = [];
    const cols = 4;
    const rows = Math.ceil(CHARACTER_DEFS.length / cols);
    const gap = Math.max(4, Math.floor(canvas.clientWidth * 0.008));
    const startY = 148;
    const footerPad = 48;
    const availableW = Math.max(240, canvas.clientWidth - 16);
    const availableH = Math.max(160, canvas.clientHeight - startY - footerPad);
    const cardW = Math.max(64, Math.floor((availableW - (cols - 1) * gap) / cols));
    const cardH = Math.max(74, Math.floor((availableH - (rows - 1) * gap) / rows));
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = Math.floor((canvas.clientWidth - totalW) * 0.5);
    const cardScale = Math.max(0.56, Math.min(1, Math.min(cardW / 180, cardH / 220)));
    const contentH = rows * cardH + (rows - 1) * gap;
    state.syncUi.maxScrollY = 0;
    state.syncUi.scrollY = 0;
    const viewTop = startY;
    const viewBottom = startY + availableH;

    for (let i = 0; i < CHARACTER_DEFS.length; i += 1) {
      const c = CHARACTER_DEFS[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      const rect = { x, y, w: cardW, h: cardH, id: c.id };
      state.syncUi.cardRects.push(rect);
      if (y + cardH < viewTop || y > viewBottom) continue;
      const blocked = isCharacterLockedByOther(c.id);
      const panel = loadImage(UI_IMAGES.player_select);

      if (panel.complete && panel.naturalWidth > 0) {
        ctx.drawImage(panel, x, y, cardW, cardH);
      } else {
        ctx.fillStyle = blocked ? "rgba(96,32,32,0.82)" : "rgba(245,247,241,0.96)";
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeStyle = blocked ? "rgba(255,120,120,0.55)" : "rgba(33,56,39,0.35)";
        ctx.strokeRect(x, y, cardW, cardH);
      }

      const key = animation.frontIdle[Math.floor((state.time * 3) % animation.frontIdle.length)];
      const img = loadSprite(key, c.id);
      const size = Math.floor(Math.min(cardW, cardH) * 0.42);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x + (cardW - size) * 0.5, y + 10, size, size);
      }

      ctx.fillStyle = blocked ? "#e24a4a" : "#26b85c";
      ctx.fillRect(x + 8, y + Math.floor(cardH * 0.56), Math.max(6, Math.floor(cardW * 0.05)), Math.max(6, Math.floor(cardW * 0.05)));
      ctx.fillStyle = "#1f2a21";
      ctx.font = `bold ${Math.max(9, Math.floor(30 * cardScale))}px sans-serif`;
      ctx.fillText(c.name, x + cardW * 0.5, y + Math.floor(cardH * 0.52));

      const playY = y + cardH - Math.max(20, Math.floor(cardH * 0.22));
      const playBtn = loadImage(UI_IMAGES.kyara_select);
      if (playBtn.complete && playBtn.naturalWidth > 0) {
        const btnPad = Math.max(4, Math.floor(cardW * 0.06));
        const btnH = Math.max(14, Math.floor(cardH * 0.16));
        ctx.drawImage(playBtn, x + btnPad, playY, cardW - btnPad * 2, btnH);
        if (blocked) {
          ctx.fillStyle = "rgba(46,10,10,0.45)";
          ctx.fillRect(x + btnPad, playY, cardW - btnPad * 2, btnH);
        }
      } else {
        ctx.fillStyle = blocked ? "rgba(60,20,20,0.8)" : "rgba(245,247,241,0.95)";
        const btnPad = Math.max(4, Math.floor(cardW * 0.06));
        const btnH = Math.max(14, Math.floor(cardH * 0.16));
        ctx.fillRect(x + btnPad, playY, cardW - btnPad * 2, btnH);
        ctx.strokeStyle = blocked ? "rgba(255,120,120,0.45)" : "rgba(52,71,57,0.35)";
        ctx.strokeRect(x + btnPad, playY, cardW - btnPad * 2, btnH);
      }
      ctx.fillStyle = blocked ? "#ffd9d9" : "#102015";
      ctx.font = `bold ${Math.max(8, Math.floor(22 * cardScale))}px sans-serif`;
      ctx.fillText("PLAY", x + cardW * 0.5, playY + 2);
    }

    if (state.syncUi.toast && performance.now() <= state.syncUi.toastUntil) {
      const w = 300;
      const h = 34;
      const x = (canvas.clientWidth - w) * 0.5;
      const y = canvas.clientHeight - 54;
      ctx.fillStyle = "rgba(20,28,23,0.88)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(180,210,185,0.55)";
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#eef6eb";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(state.syncUi.toast, canvas.clientWidth * 0.5, y + 5);
    }
  }

  function getButtonIdAtTitle(x, y) {
    if (pointInRect(x, y, state.titleUi.startRect)) return "start";
    if (pointInRect(x, y, state.titleUi.exitRect)) return "exit";
    return "";
  }

  function getSaveSlotStartIndexAt(x, y) {
    for (let i = 0; i < state.saveSelectUi.cards.length; i += 1) {
      if (pointInRect(x, y, state.saveSelectUi.cards[i].startRect)) return i;
    }
    return -1;
  }

  function getSaveSlotDeleteIndexAt(x, y) {
    for (let i = 0; i < state.saveSelectUi.cards.length; i += 1) {
      if (pointInRect(x, y, state.saveSelectUi.cards[i].deleteRect)) return i;
    }
    return -1;
  }

  function getSaveSlotNameIndexAt(x, y) {
    for (let i = 0; i < state.saveSelectUi.cards.length; i += 1) {
      if (pointInRect(x, y, state.saveSelectUi.cards[i].nameRect)) return i;
    }
    return -1;
  }

  function getButtonIdAtPause(x, y) {
    if (pointInRect(x, y, state.pauseUi.saveRect)) return "save";
    if (pointInRect(x, y, state.pauseUi.loadRect)) return "load";
    if (pointInRect(x, y, state.pauseUi.titleRect)) return "title";
    if (pointInRect(x, y, state.pauseUi.resumeRect)) return "resume";
    return "";
  }

  function getCharacterCardIdAt(x, y) {
    for (let i = 0; i < state.syncUi.cardRects.length; i += 1) {
      const card = state.syncUi.cardRects[i];
      if (pointInRect(x, y, card)) return card.id;
    }
    return "";
  }

  function setMode(nextMode) {
    if (state.inventoryUi.drag.active && state.inventoryUi.drag.entry) {
      setEntryToArea(state.inventoryUi.drag.sourceType, state.inventoryUi.drag.sourceIndex, state.inventoryUi.drag.entry);
    }
    state.mode = nextMode;
    keys.clear();
    state.titleUi.hot = "";
    state.titleUi.pressed = "";
    state.pauseUi.hot = "";
    state.pauseUi.pressed = "";
    state.saveSelectUi.hotStartIndex = -1;
    state.saveSelectUi.pressedStartIndex = -1;
    state.saveSelectUi.hotDeleteIndex = -1;
    state.saveSelectUi.pressedDeleteIndex = -1;
    state.saveSelectUi.editNameIndex = -1;
    state.inventoryUi.hot = null;
    state.inventoryUi.closePressed = false;
    state.inventoryUi.drag.active = false;
    state.inventoryUi.drag.sourceType = "";
    state.inventoryUi.drag.sourceIndex = -1;
    state.inventoryUi.drag.entry = null;
    state.syncUi.dragActive = false;
    state.syncUi.dragMoved = false;
    clearTouchHudInput();
    refreshMobileUi();
  }

  function syncTouchHudFromPointers() {
    let up = false;
    let down = false;
    let left = false;
    let right = false;
    let action = false;
    for (const control of touchHudPointers.values()) {
      if (control === "up") up = true;
      else if (control === "down") down = true;
      else if (control === "left") left = true;
      else if (control === "right") right = true;
      else if (control === "use") action = true;
    }
    mobileInput.up = up;
    mobileInput.down = down;
    mobileInput.left = left;
    mobileInput.right = right;
    mobileInput.actionHeld = action;
    if (touchHudPointers.size) {
      let last = "";
      for (const control of touchHudPointers.values()) last = control;
      state.touchHud.active = last;
    } else {
      state.touchHud.active = "";
    }
    return true;
  }

  function clearTouchHudInput(pointerId = null) {
    if (pointerId !== null) {
      if (!touchHudPointers.has(pointerId)) return false;
      touchHudPointers.delete(pointerId);
      if (state.touchHud.pointerId === pointerId) state.touchHud.pointerId = null;
    } else {
      touchHudPointers.clear();
      state.touchHud.pointerId = null;
    }
    syncTouchHudFromPointers();
    return true;
  }

  function handleTitleButton(id) {
    if (id === "start") {
      setMode("title_slots");
    } else if (id === "exit") {
      tryCloseTab();
    }
  }

  function handleSaveSlotStart(slotIndex) {
    const collection = readSaveCollection();
    const slot = collection.slots[slotIndex] || createDefaultSlot(slotIndex);
    state.activeSaveSlot = slotIndex;
    state.currentSlotPlaySeconds = Math.max(0, Number(slot.totalPlaySeconds) || 0);
    if (!slot.payload) {
      resetGameplayState();
      state.activeSaveSlot = slotIndex;
    } else {
      const ok = loadGameFromStorage(slotIndex);
      if (!ok) {
        resetGameplayState();
        state.activeSaveSlot = slotIndex;
      }
    }
    collection.lastSlot = slotIndex;
    writeSaveCollection(collection);
    setMode("play");
  }

  function handleSaveSlotDelete(slotIndex) {
    const i = clamp(Number(slotIndex) || 0, 0, SAVE_SLOT_COUNT - 1);
    const ok = window.confirm("削除してもいいですか？");
    if (!ok) return;
    const collection = readSaveCollection();
    const prev = collection.slots[i] || createDefaultSlot(i);
    collection.slots[i] = {
      name: prev.name || `データ${i + 1}`,
      totalPlaySeconds: 0,
      updatedAt: Date.now(),
      payload: null,
    };
    if (collection.lastSlot === i) collection.lastSlot = 0;
    writeSaveCollection(collection);
    if (state.activeSaveSlot === i) state.activeSaveSlot = -1;
    window.alert("削除しました！");
  }

  function renameSaveSlot(slotIndex, name) {
    const text = String(name ?? "").slice(0, 16);
    const collection = readSaveCollection();
    const slot = collection.slots[slotIndex] || createDefaultSlot(slotIndex);
    slot.name = text;
    collection.slots[slotIndex] = slot;
    writeSaveCollection(collection);
  }

  function finalizeEditedSaveName() {
    const i = state.saveSelectUi.editNameIndex;
    if (i < 0) return;
    const collection = readSaveCollection();
    const slot = collection.slots[i] || createDefaultSlot(i);
    if (!String(slot.name || "").trim()) {
      slot.name = `データ${i + 1}`;
      collection.slots[i] = slot;
      writeSaveCollection(collection);
    }
    state.saveSelectUi.editNameIndex = -1;
  }

  function handlePauseButton(id) {
    if (id === "save") {
      saveGameToStorage(false);
      return;
    }
    if (id === "load") {
      loadGameFromStorage();
      return;
    }
    if (id === "title") {
      releaseCharacter();
      setMode("char_select");
      return;
    }
    if (id === "resume") {
      setMode("play");
    }
  }

  function update(dt) {
    state.time += dt;
    if (state.activeSaveSlot >= 0) state.currentSlotPlaySeconds += dt;
    updatePlayer(dt);
    updateWorldItem(dt);
    updateCrops();
    updateAdaptiveFarmZoom(dt);
    updateClippingsRegrowth(dt);
    updateUseEffects(dt);
    updateRemoteVisualPlayers(dt);
    updateCamera(dt);
    if (state.mode === "play" && mobileInput.actionHeld) {
      const now = performance.now();
      if (now >= mobileInput.nextActionAt) {
        triggerUseAction();
        mobileInput.nextActionAt = now + 190;
      }
    }
    syncLocalPlayer(false);
    state.autosaveElapsed += dt;
    if (state.autosaveElapsed >= AUTOSAVE_INTERVAL) {
      state.autosaveElapsed = 0;
      saveCharacterState(true);
      saveGameToStorage(true);
    }
  }

  function render() {
    canvas.style.cursor = state.mode === "play" ? "none" : "default";
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    if (state.mode === "char_select") {
      drawGrassTiles();
      drawUpperTileLayers(false);
      drawCharacters("all", false);
      drawCharacterSelectScreen();
      refreshMobileUi();
      return;
    }

    drawGrassTiles();
    drawUpperTileLayers(false);
    drawWorldBarriers("back");
    drawUseTargetPreview();
    drawWorldItems();
    drawCrops();
    drawUseEffects();
    drawCharacters("back", true);
    drawUpperTileLayers(true);
    const playerScreen = worldToScreen(state.player.x, state.player.y);
    const playerW = PLAYER.drawHeight * CAMERA.zoom * 0.78;
    const playerH = PLAYER.drawHeight * CAMERA.zoom;
    const hideTopH = playerH * 0.9;
    drawGrassForeground({
      x: playerScreen.x - playerW * 0.48,
      y: playerScreen.y - playerH * 0.9,
      w: playerW * 0.96,
      h: hideTopH,
    });
    drawWorldBarriers("front");
    drawCharacters("front", true);
    drawTimeOfDayOverlay();
    drawCollisionDebug();
    drawClockHud();
    if (state.mode === "inventory") {
      drawInventoryScreen();
      drawInventoryUI();
    } else {
      drawInventoryUI();
      drawTouchHud();
    }
    if (state.mode === "title") {
      drawTitleScreen();
    } else if (state.mode === "title_slots") {
      drawSaveSelectScreen();
    } else if (state.mode === "pause") {
      drawPauseScreen();
    }
    refreshMobileUi();
  }

  function runStep(dt) {
    const clamped = Math.min(0.05, dt);
    if (state.mode === "play") {
      update(clamped);
    } else {
      state.time += clamped;
      updateRemoteVisualPlayers(clamped);
    }
    render();
  }

  let last = performance.now();
  function loop(now) {
    const dt = (now - last) / 1000;
    last = now;
    runStep(dt);
    requestAnimationFrame(loop);
  }

  window.render_game_to_text = () => {
    const tileX = Math.floor(state.player.x / WORLD.tileSize);
    const tileY = Math.floor(state.player.y / WORLD.tileSize);
    const nowMs = getCurrentWorldTimeMs();
    const nextHarvestAtMs = getNextCropHarvestAtMs();
    const sunState = getSunShadowState();
    return JSON.stringify({
      coordinate_system: "orthographic top-down; origin world top-left; +x right, +y down",
      mode: state.mode,
      current_time_ms: nowMs,
      current_time_local: formatTimeLabel(nowMs),
      debug_collision_view: state.debugCollisionView,
      debug_time_offset_hours: state.debugTimeOverrideActive ? state.debugTimeOffsetHours : 0,
      day_phase: sunState.phaseName,
      next_harvest_at_ms: nextHarvestAtMs,
      next_harvest_at_local: nextHarvestAtMs ? formatTimeLabel(nextHarvestAtMs) : null,
      player: {
        x: Number(state.player.x.toFixed(2)),
        y: Number(state.player.y.toFixed(2)),
        vx: Number(state.player.vx.toFixed(2)),
        vy: Number(state.player.vy.toFixed(2)),
        facing: state.player.facing,
        mode: state.mode,
        hit_radius_world: PLAYER.hitRadiusWorld,
      },
      camera: {
        x: Number(state.camera.x.toFixed(2)),
        y: Number(state.camera.y.toFixed(2)),
      },
      tile_under_player: {
        x: tileX,
        y: tileY,
        image: getTileImage(tileX, tileY),
      },
      map_spawn_tile: {
        x: configuredSpawnTile.x,
        y: configuredSpawnTile.y,
      },
      world_item: state.worldItems.length ? {
        kind: state.worldItems[0].kind,
        x: Number(state.worldItems[0].x.toFixed(2)),
        y: Number(state.worldItems[0].y.toFixed(2)),
        collected: state.worldItems[0].collected,
      } : null,
      world_items: state.worldItems.map((it) => ({
        kind: it.kind,
        x: Number(it.x.toFixed(2)),
        y: Number(it.y.toFixed(2)),
        collected: it.collected,
      })),
      crops: {
        count: state.crops.size,
      },
      inventory: {
        selected_slot: state.inventory.selectedSlot + 1,
        slots: state.inventory.slots.map((entry) => {
          const kind = getSlotKind(entry);
          if (!kind) return null;
          return { kind, count: getSlotCount(entry) };
        }),
        bag: state.inventory.bag.map((entry) => {
          const kind = getSlotKind(entry);
          if (!kind) return null;
          return { kind, count: getSlotCount(entry) };
        }),
      },
      use_effects: state.useEffects.length,
      clipped_tiles: state.tileOverrides.size,
    });
  };

  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) runStep(1 / 60);
  };

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function requestGameplayFullscreen() {
    const now = performance.now();
    if (now - lastFullscreenRequestAt < 750) return;
    lastFullscreenRequestAt = now;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    if (isTouchDevice && screen.orientation && typeof screen.orientation.lock === "function") {
      screen.orientation.lock("landscape").catch(() => {});
    }
  }

  function refreshMobileUi() {
    if (mobileUi) {
      mobileUi.classList.add("hidden");
      mobileUi.setAttribute("aria-hidden", "true");
    }
    if (state.mode !== "play") {
      clearTouchHudInput();
    }
  }

  function bindMobileHold(el, onDown, onUp) {
    if (!el) return;
    let activePointerId = null;
    const release = (event) => {
      if (activePointerId === null) return;
      if (event && event.pointerId !== activePointerId) return;
      activePointerId = null;
      onUp();
    };
    el.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      activePointerId = event.pointerId;
      el.setPointerCapture?.(event.pointerId);
      onDown();
    }, { passive: false });
    el.addEventListener("pointerup", release, { passive: false });
    el.addEventListener("pointercancel", release, { passive: false });
    el.addEventListener("lostpointercapture", () => release(), { passive: false });
  }

  function setupMobileControls() {
    refreshMobileUi();
  }

  window.addEventListener("keydown", (event) => {
    if (isTouchDevice) {
      const key = String(event.key || "");
      if (key && key !== "Unidentified") keyboardAttachedOnTouch = true;
    }
    if (event.key === "F9") {
      forceClearAllCharacters();
      event.preventDefault();
      return;
    }

    if (event.key === "F3") {
      state.debugCollisionView = !state.debugCollisionView;
      event.preventDefault();
      return;
    }

    if (event.key === "F8") {
      state.debugTimeOverrideActive = true;
      event.preventDefault();
      return;
    }

    if (state.debugTimeOverrideActive && (event.key === "a" || event.key === "A" || event.key === "d" || event.key === "D")) {
      state.debugTimeOffsetHours += (event.key === "d" || event.key === "D") ? 1 : -1;
      event.preventDefault();
      return;
    }

    if (state.mode === "title_slots") {
      if (event.key === "Escape") {
        finalizeEditedSaveName();
        setMode("title");
        event.preventDefault();
        return;
      }
      const editIndex = state.saveSelectUi.editNameIndex;
      if (editIndex >= 0) {
        const collection = readSaveCollection();
        const slotName = collection.slots[editIndex]?.name;
        const currentName = typeof slotName === "string" ? slotName : `データ${editIndex + 1}`;
        if (event.key === "Enter") {
          finalizeEditedSaveName();
          event.preventDefault();
          return;
        }
        if (event.key === "Backspace") {
          renameSaveSlot(editIndex, currentName.slice(0, -1));
          event.preventDefault();
          return;
        }
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          renameSaveSlot(editIndex, `${currentName}${event.key}`);
          event.preventDefault();
          return;
        }
      }
    }

    if (event.key === "e" || event.key === "E") {
      if (state.mode === "play") {
        setMode("inventory");
      } else if (state.mode === "inventory") {
        setMode("play");
      }
      event.preventDefault();
      return;
    }

    if (event.key === "Escape" || event.key === "p" || event.key === "P") {
      if (state.mode === "play") {
        setMode("pause");
      } else if (state.mode === "inventory") {
        setMode("play");
      } else if (state.mode === "pause") {
        setMode("play");
      }
      event.preventDefault();
      return;
    }

    if (event.code.startsWith("Digit")) {
      const n = Number(event.code.slice(5));
      if ((state.mode === "play" || state.mode === "inventory") && Number.isInteger(n) && n >= 1 && n <= 9) {
        state.inventory.selectedSlot = n - 1;
        event.preventDefault();
        return;
      }
    }

    if (event.key === "f" || event.key === "F") {
      toggleFullscreen();
      event.preventDefault();
      return;
    }

    if (state.mode !== "play") {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.key) || event.code === "Space") {
        event.preventDefault();
      }
      return;
    }

    keys.add(event.code === "Space" ? "Space" : event.key);

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.key) || event.code === "Space") {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "F8") {
      state.debugTimeOverrideActive = false;
      state.debugTimeOffsetHours = 0;
      event.preventDefault();
      return;
    }
    if (state.mode !== "play") return;
    keys.delete(event.code === "Space" ? "Space" : event.key);
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (state.mode === "char_select") {
      state.syncUi.dragActive = true;
      state.syncUi.dragMoved = false;
      state.syncUi.dragStartY = y;
      state.syncUi.dragLastY = y;
      return;
    }
    if (state.mode === "title") {
      state.titleUi.pressed = getButtonIdAtTitle(x, y);
      return;
    }
    if (state.mode === "title_slots") {
      state.saveSelectUi.pressedStartIndex = getSaveSlotStartIndexAt(x, y);
      state.saveSelectUi.pressedDeleteIndex = getSaveSlotDeleteIndexAt(x, y);
      const nameHit = getSaveSlotNameIndexAt(x, y);
      if (nameHit < 0) finalizeEditedSaveName();
      state.saveSelectUi.editNameIndex = nameHit;
      return;
    }
    if (state.mode === "pause") {
      state.pauseUi.pressed = getButtonIdAtPause(x, y);
      return;
    }
    if (state.mode === "inventory") {
      if (event.button !== 0) return;
      if (pointInRect(x, y, state.inventoryUi.closeRect)) {
        state.inventoryUi.closePressed = true;
        return;
      }
      const hit = getInventorySlotAt(x, y);
      state.inventoryUi.hot = hit;
      if (!hit) return;
      const entry = getEntryFromArea(hit.area, hit.index);
      if (!entry) return;
      setEntryToArea(hit.area, hit.index, null);
      state.inventoryUi.drag.active = true;
      state.inventoryUi.drag.sourceType = hit.area;
      state.inventoryUi.drag.sourceIndex = hit.index;
      state.inventoryUi.drag.entry = cloneSlotEntry(entry);
      state.inventoryUi.drag.x = x;
      state.inventoryUi.drag.y = y;
      return;
    }
    if (state.mode === "play" && event.button === 0) {
      const hudHit = getTouchHudHit(x, y);
      if (hudHit) {
        canvas.setPointerCapture?.(event.pointerId);
        state.touchHud.active = hudHit;
        state.touchHud.pointerId = event.pointerId;
        touchHudPointers.set(event.pointerId, hudHit);
        syncTouchHudFromPointers();
        if (hudHit === "zoom_in") {
          adjustManualZoom(-CAMERA_ZOOM_STEP);
        } else if (hudHit === "zoom_out") {
          adjustManualZoom(CAMERA_ZOOM_STEP);
        } else if (hudHit === "use") {
          mobileInput.nextActionAt = 0;
          triggerUseAction();
        } else if (hudHit === "inventory") {
          setMode("inventory");
        } else if (hudHit === "save") {
          saveWorldNow();
        }
        requestGameplayFullscreen();
        return;
      }
      const quickIndex = getQuickSlotIndexAt(x, y);
      if (quickIndex >= 0) {
        state.inventory.selectedSlot = quickIndex;
        refreshMobileUi();
        requestGameplayFullscreen();
        return;
      }
    }
    const held = getSelectedItemKind();
    if (!held && (event.button === 0 || event.button === 2)) {
      tryHarvestClambonAtForwardTile();
      return;
    }
    if (event.button === 2) {
      tryHarvestClambonAtForwardTile();
      return;
    }
    if (event.button !== 0) return;
    requestGameplayFullscreen();
    triggerUseAction();
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (state.mode !== "title" && state.mode !== "title_slots" && state.mode !== "pause" && state.mode !== "inventory" && state.mode !== "char_select") return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (state.mode === "char_select") {
      if (!state.syncUi.dragActive) return;
      const dy = y - state.syncUi.dragLastY;
      state.syncUi.dragLastY = y;
      if (Math.abs(y - state.syncUi.dragStartY) > 5) state.syncUi.dragMoved = true;
      if (state.syncUi.maxScrollY > 0 && dy !== 0) {
        state.syncUi.scrollY = clamp(state.syncUi.scrollY - dy, 0, state.syncUi.maxScrollY);
      }
    } else if (state.mode === "title") {
      state.titleUi.hot = getButtonIdAtTitle(x, y);
    } else if (state.mode === "title_slots") {
      state.saveSelectUi.hotStartIndex = getSaveSlotStartIndexAt(x, y);
      state.saveSelectUi.hotDeleteIndex = getSaveSlotDeleteIndexAt(x, y);
    } else if (state.mode === "pause") {
      state.pauseUi.hot = getButtonIdAtPause(x, y);
    } else {
      state.inventoryUi.hot = getInventorySlotAt(x, y);
      if (state.inventoryUi.drag.active) {
        state.inventoryUi.drag.x = x;
        state.inventoryUi.drag.y = y;
      }
    }
  });

  canvas.addEventListener("pointerup", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (state.mode === "char_select") {
      const wasDragging = state.syncUi.dragActive && state.syncUi.dragMoved;
      state.syncUi.dragActive = false;
      state.syncUi.dragMoved = false;
      if (wasDragging) return;
      if (pointInRect(x, y, state.syncUi.copyRect)) {
        copyInviteUrl();
        return;
      }
      const characterId = getCharacterCardIdAt(x, y);
      if (!characterId) return;
      if (isCharacterLockedByOther(characterId)) {
        showSyncToast("このキャラは使用中です", 1800);
        return;
      }
      acquireCharacter(characterId).then((ok) => {
        if (!ok) showSyncToast("参加できませんでした", 1800);
      });
      return;
    }
    if (state.touchHud.active) {
      clearTouchHudInput(event.pointerId);
      return;
    }
    if (state.mode !== "title" && state.mode !== "title_slots" && state.mode !== "pause" && state.mode !== "inventory") return;
    if (state.mode === "title") {
      const upId = getButtonIdAtTitle(x, y);
      const clicked = state.titleUi.pressed && state.titleUi.pressed === upId ? upId : "";
      state.titleUi.pressed = "";
      if (clicked) handleTitleButton(clicked);
    } else if (state.mode === "title_slots") {
      const upStart = getSaveSlotStartIndexAt(x, y);
      const clicked = state.saveSelectUi.pressedStartIndex >= 0 && state.saveSelectUi.pressedStartIndex === upStart ? upStart : -1;
      const upDelete = getSaveSlotDeleteIndexAt(x, y);
      const deleteClicked = state.saveSelectUi.pressedDeleteIndex >= 0 && state.saveSelectUi.pressedDeleteIndex === upDelete ? upDelete : -1;
      state.saveSelectUi.pressedStartIndex = -1;
      state.saveSelectUi.pressedDeleteIndex = -1;
      if (clicked >= 0) {
        finalizeEditedSaveName();
        handleSaveSlotStart(clicked);
      } else if (deleteClicked >= 0) {
        finalizeEditedSaveName();
        handleSaveSlotDelete(deleteClicked);
      }
    } else {
      if (state.mode === "pause") {
        const upId = getButtonIdAtPause(x, y);
        const clicked = state.pauseUi.pressed && state.pauseUi.pressed === upId ? upId : "";
        state.pauseUi.pressed = "";
        if (clicked) handlePauseButton(clicked);
      } else {
        if (state.inventoryUi.closePressed) {
          state.inventoryUi.closePressed = false;
          if (pointInRect(x, y, state.inventoryUi.closeRect)) {
            setMode("play");
            return;
          }
        }
        if (!state.inventoryUi.drag.active) return;
        const target = getInventorySlotAt(x, y);
        performInventoryDrop(target);
        state.inventoryUi.drag.active = false;
        state.inventoryUi.drag.sourceType = "";
        state.inventoryUi.drag.sourceIndex = -1;
        state.inventoryUi.drag.entry = null;
        if (target && target.area === "quick") {
          state.inventory.selectedSlot = target.index;
        }
      }
    }
  });

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointercancel", (event) => {
    clearTouchHudInput(event.pointerId);
  }, { passive: true });
  canvas.addEventListener("pointerleave", () => {
    clearTouchHudInput();
  }, { passive: true });
  window.addEventListener("blur", () => {
    clearTouchHudInput();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") clearTouchHudInput();
  });
  document.addEventListener("fullscreenchange", () => {
    resize();
    if (state.mode === "play" && !document.fullscreenElement) {
      requestGameplayFullscreen();
    }
  });
  document.addEventListener("contextmenu", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("dragstart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("selectstart", (event) => {
    if (isTouchDevice) event.preventDefault();
  }, { passive: false });

  grassVariants.forEach((path) => loadImage(path));
  loadImage(TILE_IMAGES.clippings);
  Object.values(TILE_IMAGES).forEach((path) => loadImage(path));
  Object.values(BARRIER_IMAGES).forEach((path) => loadImage(path));
  Object.values(CROP_IMAGES).forEach((path) => loadImage(path));
  Object.values(ITEMS).forEach((item) => loadImage(item.icon));
  Object.values(UI_IMAGES).forEach((path) => loadImage(path));
  CHARACTER_DEFS.forEach((c) => {
    Object.values(animation).forEach((group) => {
      group.forEach((key) => loadSprite(key, c.id));
    });
  });
  // Do not bulk-preload tool overlay sprites:
  // many projects do not have full frame sets, which causes noisy 404 logs.

  setupMobileControls();
  setupMultiplayerSync();
  resize();
  render();
  requestAnimationFrame(loop);
})();
