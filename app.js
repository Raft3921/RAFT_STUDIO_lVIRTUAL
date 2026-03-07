import * as Y from "https://esm.sh/yjs@13.6.24";
import { WebrtcProvider } from "https://esm.sh/y-webrtc@10.3.0?deps=yjs@13.6.24";

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

const WORLD_WIDTH = 4800;
const WORLD_HEIGHT = 3600;
const PLAYER_MAX_SPEED = 190;
const PLAYER_ACCEL = 1100;
const PLAYER_DECEL = 900;
const LOCK_TIMEOUT_MS = 10_000;
const PLAYER_TIMEOUT_MS = 15_000;
const STEP_SEC = 1 / 60;
const ASSET_REV = `${Date.now()}`;
const WOOD_TILE_PATH = "./assets/tile/wood.png";
const PLAYER_SELECT_FRAME_PATH = "./assets/ui/player_select.png";
const KYARA_SELECT_BUTTON_PATH = "./assets/ui/kyara_select.png";
const CAMERA_ZOOM = 2;
const CAMERA_FOLLOW_RATE = 7.5;
const SPRITE_PATHS = {
  raft: {
    front: {
      idle1: "./assets/player/raft/front_idle1.png",
      idle2: "./assets/player/raft/front_idle2.png",
      run1: "./assets/player/raft/front_run1.png",
      run2: "./assets/player/raft/front_run2.png",
    },
    back: {
      idle1: "./assets/player/raft/back_idle1.png",
      idle2: "./assets/player/raft/back_idle2.png",
      run1: "./assets/player/raft/back_run1.png",
      run2: "./assets/player/raft/back_run2.png",
    },
    side: {
      idle1: "./assets/player/raft/side_idle1.png",
      idle2: "./assets/player/raft/side_idle2.png",
      run1: "./assets/player/raft/side_run1.png",
      run2: "./assets/player/raft/side_run2.png",
    },
  },
  mai: {
    front: {
      idle1: "./assets/player/mai/front_idle1.png",
      idle2: "./assets/player/mai/front_idle2.png",
      run1: "./assets/player/mai/front_run1.png",
      run2: "./assets/player/mai/front_run2.png",
    },
    back: {
      idle1: "./assets/player/mai/back_idle1.png",
      idle2: "./assets/player/mai/back_idle2.png",
      run1: "./assets/player/mai/back_run1.png",
      run2: "./assets/player/mai/back_run2.png",
    },
    side: {
      idle1: "./assets/player/mai/side_idle1.png",
      idle2: "./assets/player/mai/side_idle2.png",
      run1: "./assets/player/mai/side_run1.png",
      run2: "./assets/player/mai/side_run2.png",
    },
  },
  yansan: {
    front: {
      idle1: "./assets/player/yansan/front_idle1.png",
      idle2: "./assets/player/yansan/front_idle2.png",
      run1: "./assets/player/yansan/front_run1.png",
      run2: "./assets/player/yansan/front_run2.png",
    },
    back: {
      idle1: "./assets/player/yansan/back_idle1.png",
      idle2: "./assets/player/yansan/back_idle2.png",
      run1: "./assets/player/yansan/back_run1.png",
      run2: "./assets/player/yansan/back_run2.png",
    },
    side: {
      idle1: "./assets/player/yansan/side_idle1.png",
      idle2: "./assets/player/yansan/side_idle2.png",
      run1: "./assets/player/yansan/side_run1.png",
      run2: "./assets/player/yansan/side_run2.png",
    },
  },
  tanutsuna: {
    front: {
      idle1: "./assets/player/tanutsuna/front_idle1.png",
      idle2: "./assets/player/tanutsuna/front_idle2.png",
      run1: "./assets/player/tanutsuna/front_run1.png",
      run2: "./assets/player/tanutsuna/front_run2.png",
    },
    back: {
      idle1: "./assets/player/tanutsuna/back_idle1.png",
      idle2: "./assets/player/tanutsuna/back_idle2.png",
      run1: "./assets/player/tanutsuna/back_run1.png",
      run2: "./assets/player/tanutsuna/back_run2.png",
    },
    side: {
      idle1: "./assets/player/tanutsuna/side_idle1.png",
      idle2: "./assets/player/tanutsuna/side_idle2.png",
      run1: "./assets/player/tanutsuna/side_run1.png",
      run2: "./assets/player/tanutsuna/side_run2.png",
    },
  },
  muto: {
    front: {
      idle1: "./assets/player/muto/front_idle1.png",
      idle2: "./assets/player/muto/front_idle2.png",
      run1: "./assets/player/muto/front_run1.png",
      run2: "./assets/player/muto/front_run2.png",
    },
    back: {
      idle1: "./assets/player/muto/back_idle1.png",
      idle2: "./assets/player/muto/back_idle2.png",
      run1: "./assets/player/muto/back_run1.png",
      run2: "./assets/player/muto/back_run2.png",
    },
    side: {
      idle1: "./assets/player/muto/side_idle1.png",
      idle2: "./assets/player/muto/side_idle2.png",
      run1: "./assets/player/muto/side_run1.png",
      run2: "./assets/player/muto/side_run2.png",
    },
  },
  moron: {
    front: {
      idle1: "./assets/player/moron/front_idle1.png",
      idle2: "./assets/player/moron/front_idle2.png",
      run1: "./assets/player/moron/front_run1.png",
      run2: "./assets/player/moron/front_run2.png",
    },
    back: {
      idle1: "./assets/player/moron/back_idle1.png",
      idle2: "./assets/player/moron/back_idle2.png",
      run1: "./assets/player/moron/back_run1.png",
      run2: "./assets/player/moron/back_run2.png",
    },
    side: {
      idle1: "./assets/player/moron/side_idle1.png",
      idle2: "./assets/player/moron/side_idle2.png",
      run1: "./assets/player/moron/side_run1.png",
      run2: "./assets/player/moron/side_run2.png",
    },
  },
  week: {
    front: {
      idle1: "./assets/player/week/front_idle1.png",
      idle2: "./assets/player/week/front_idle2.png",
      run1: "./assets/player/week/front_run1.png",
      run2: "./assets/player/week/front_run2.png",
    },
    back: {
      idle1: "./assets/player/week/back_idle1.png",
      idle2: "./assets/player/week/back_idle2.png",
      run1: "./assets/player/week/back_run1.png",
      run2: "./assets/player/week/back_run2.png",
    },
    side: {
      idle1: "./assets/player/week/side_idle1.png",
      idle2: "./assets/player/week/side_idle2.png",
      run1: "./assets/player/week/side_run1.png",
      run2: "./assets/player/week/side_run2.png",
    },
  },
  gyoza: {
    front: {
      idle1: "./assets/player/gyoza/front_idle1.png",
      idle2: "./assets/player/gyoza/front_idle2.png",
      run1: "./assets/player/gyoza/front_run1.png",
      run2: "./assets/player/gyoza/front_run2.png",
    },
    back: {
      idle1: "./assets/player/gyoza/back_idle1.png",
      idle2: "./assets/player/gyoza/back_idle2.png",
      run1: "./assets/player/gyoza/back_run1.png",
      run2: "./assets/player/gyoza/back_run2.png",
    },
    side: {
      idle1: "./assets/player/gyoza/side_idle1.png",
      idle2: "./assets/player/gyoza/side_idle2.png",
      run1: "./assets/player/gyoza/side_run1.png",
      run2: "./assets/player/gyoza/side_run2.png",
    },
  },
};

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const joystick = document.getElementById("joystick");
const joystickKnob = document.getElementById("joystick-knob");

const clientId = self.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const inputState = { up: false, down: false, left: false, right: false, joyX: 0, joyY: 0 };
const localPlayer = {
  x: 280 + Math.random() * 120,
  y: 280 + Math.random() * 120,
  vx: 0,
  vy: 0,
  dir: "front",
  moving: false,
  characterId: null,
  name: "",
};

const imageCache = new Map();
const uiState = {
  mode: "selection",
  selectionHitboxes: [],
  selectionActions: [],
  hudHitboxes: [],
  toast: "",
  toastUntil: 0,
};
const joystickState = { activePointerId: null };
let doc;
let provider;
let playersMap;
let locksMap;
let roomId = "";
let animClock = 0;
let rafId = 0;
let accumulator = 0;
let lastMs = performance.now();
let heartbeatTimer = 0;
const cameraState = { x: 0, y: 0, initialized: false };
const transparentSprite = document.createElement("canvas");
transparentSprite.width = 32;
transparentSprite.height = 32;

function deriveRoomId() {
  const hashRoom = window.location.hash.replace(/^#/, "").trim();
  if (hashRoom) {
    return hashRoom;
  }
  return "raft-virtual-room";
}

function setRoom(room) {
  const clean = room.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) {
    return;
  }
  window.location.hash = clean;
  window.location.reload();
}

function getImage(path) {
  const key = `${path}?v=${ASSET_REV}`;
  const cached = imageCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const image = new Image();
  image.src = key;
  image.onerror = () => {
    // Do not pin failures forever. Retry on next frame in case CDN cache/deploy lag.
    imageCache.delete(key);
  };
  image.onload = () => imageCache.set(key, image);
  imageCache.set(key, image);
  return image;
}

function getSpriteImage(characterId, dir, moving, frame) {
  const dirToken = dir === "left" || dir === "right" ? "side" : dir;
  const action = moving && (frame === 3 || frame === 4) ? "run" : "idle";
  const num = moving ? (frame === 4 ? 2 : 1) : (frame === 2 ? 2 : 1);
  const key = `${action}${num}`;
  const path = SPRITE_PATHS[characterId]?.[dirToken]?.[key];
  return path ? getImage(path) : null;
}

function preloadSprites() {
  for (const character of Object.values(SPRITE_PATHS)) {
    for (const dir of Object.values(character)) {
      for (const path of Object.values(dir)) {
        getImage(path);
      }
    }
  }
  getImage(PLAYER_SELECT_FRAME_PATH);
  getImage(KYARA_SELECT_BUTTON_PATH);
}

function nowMs() {
  return Date.now();
}

function readValidLock(characterId) {
  const lock = locksMap.get(characterId);
  if (!lock || typeof lock !== "object") {
    return null;
  }
  if (!lock.ts || nowMs() - lock.ts > LOCK_TIMEOUT_MS) {
    if (lock.clientId !== clientId) {
      locksMap.delete(characterId);
    }
    return null;
  }
  return lock;
}

function cleanupStalePlayers() {
  const now = nowMs();
  playersMap.forEach((player, playerId) => {
    if (!player || now - (player.lastSeen || 0) > PLAYER_TIMEOUT_MS) {
      playersMap.delete(playerId);
    }
  });
}

function cleanupStaleLocks() {
  CHARACTER_DEFS.forEach((def) => {
    readValidLock(def.id);
  });
}

function upsertLocalPlayer() {
  if (!localPlayer.characterId) {
    return;
  }
  playersMap.set(clientId, {
    x: localPlayer.x,
    y: localPlayer.y,
    vx: localPlayer.vx,
    vy: localPlayer.vy,
    dir: localPlayer.dir,
    moving: localPlayer.moving,
    characterId: localPlayer.characterId,
    name: localPlayer.name,
    lastSeen: nowMs(),
  });
}

function releaseMyLock() {
  if (!localPlayer.characterId) {
    return;
  }
  const lock = locksMap.get(localPlayer.characterId);
  if (lock?.clientId === clientId) {
    locksMap.delete(localPlayer.characterId);
  }
}

function acquireCharacter(characterId) {
  cleanupStalePlayers();
  cleanupStaleLocks();
  const lock = readValidLock(characterId);
  if (lock && lock.clientId !== clientId) {
    return false;
  }

  const previous = localPlayer.characterId;
  if (previous && previous !== characterId) {
    const prevLock = locksMap.get(previous);
    if (prevLock?.clientId === clientId) {
      locksMap.delete(previous);
    }
  }

  const def = CHARACTER_DEFS.find((v) => v.id === characterId);
  localPlayer.characterId = characterId;
  localPlayer.name = def?.name || characterId;

  locksMap.set(characterId, { clientId, ts: nowMs() });
  upsertLocalPlayer();
  setUiMode("game");
  requestGameFullscreen();
  return true;
}

function occupantName(lock) {
  if (!lock) {
    return "";
  }
  if (lock.clientId === clientId) {
    return "あなた";
  }
  const player = playersMap.get(lock.clientId);
  if (player?.name) {
    return player.name;
  }
  return "誰か";
}

function setUiMode(mode) {
  uiState.mode = mode;
  joystick.style.display = mode === "game" ? "grid" : "none";
  if (mode !== "game") {
    inputState.up = false;
    inputState.down = false;
    inputState.left = false;
    inputState.right = false;
    inputState.joyX = 0;
    inputState.joyY = 0;
    joystickKnob.style.transform = "translate(0px, 0px)";
  }
}

async function requestGameFullscreen() {
  if (uiState.mode !== "game") return;
  if (document.fullscreenElement) return;
  try {
    const target = document.documentElement;
    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    // Ignore; fullscreen availability depends on browser and gesture policies.
  }
}

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

function showToast(text, durationMs = 1200) {
  uiState.toast = text;
  uiState.toastUntil = performance.now() + durationMs;
}

async function copyInviteUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("招待URLをコピーしました");
  } catch {
    showToast("コピーに失敗しました");
  }
}

function setupCanvasUi() {
  function handleCanvasPress(x, y) {
    const sx = (x * window.innerWidth) / canvas.clientWidth;
    const sy = (y * window.innerHeight) / canvas.clientHeight;

    if (uiState.mode === "selection") {
      for (const action of uiState.selectionActions) {
        if (pointInRect(sx, sy, action.rect)) {
          if (action.action === "copy") {
            copyInviteUrl();
          }
          return;
        }
      }
      if (uiState.selectionHitboxes.length === 0) {
        const { left, top, cols, cardW, cardH, gap } = getSelectionLayout();
        uiState.selectionHitboxes = CHARACTER_DEFS.map((def, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const rect = { x: left + col * (cardW + gap), y: top + row * (cardH + gap), w: cardW, h: cardH };
          const lock = readValidLock(def.id);
          return { characterId: def.id, rect, blocked: Boolean(lock && lock.clientId !== clientId) };
        });
      }
      for (const hit of uiState.selectionHitboxes) {
        if (pointInRect(sx, sy, hit.rect)) {
          if (!hit.blocked) {
            acquireCharacter(hit.characterId);
          }
          return;
        }
      }
      return;
    }

    for (const hit of uiState.hudHitboxes) {
      if (!pointInRect(sx, sy, hit.rect)) {
        continue;
      }
      if (hit.action === "back") {
        releaseMyLock();
        playersMap.delete(clientId);
        localPlayer.characterId = null;
        localPlayer.name = "";
        setUiMode("selection");
      } else if (hit.action === "copy") {
        copyInviteUrl();
      }
      return;
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    handleCanvasPress(event.clientX - rect.left, event.clientY - rect.top);
  });

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    handleCanvasPress(event.clientX - rect.left, event.clientY - rect.top);
  });

  canvas.addEventListener("touchstart", (event) => {
    if (!event.touches[0]) return;
    const rect = canvas.getBoundingClientRect();
    handleCanvasPress(event.touches[0].clientX - rect.left, event.touches[0].clientY - rect.top);
    event.preventDefault();
  });
}

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function axisFromInput() {
  let x = 0;
  let y = 0;
  if (inputState.left) x -= 1;
  if (inputState.right) x += 1;
  if (inputState.up) y -= 1;
  if (inputState.down) y += 1;

  if (Math.hypot(inputState.joyX, inputState.joyY) > 0.02) {
    x = inputState.joyX;
    y = inputState.joyY;
  }

  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }
  return { x, y, mag };
}

function approach(current, target, maxDelta) {
  if (current < target) {
    return Math.min(target, current + maxDelta);
  }
  return Math.max(target, current - maxDelta);
}

function updateSimulation(dt) {
  if (!localPlayer.characterId) {
    return;
  }

  const axis = axisFromInput();
  const targetVx = axis.x * PLAYER_MAX_SPEED;
  const targetVy = axis.y * PLAYER_MAX_SPEED;
  const accel = axis.mag > 0.05 ? PLAYER_ACCEL : PLAYER_DECEL;
  localPlayer.vx = approach(localPlayer.vx, targetVx, accel * dt);
  localPlayer.vy = approach(localPlayer.vy, targetVy, accel * dt);
  localPlayer.moving = Math.hypot(localPlayer.vx, localPlayer.vy) > 6;

  localPlayer.x += localPlayer.vx * dt;
  localPlayer.y += localPlayer.vy * dt;

  localPlayer.x = Math.max(40, Math.min(WORLD_WIDTH - 40, localPlayer.x));
  localPlayer.y = Math.max(40, Math.min(WORLD_HEIGHT - 40, localPlayer.y));

  if (localPlayer.moving) {
    if (Math.abs(localPlayer.vx) > Math.abs(localPlayer.vy)) {
      localPlayer.dir = localPlayer.vx >= 0 ? "right" : "left";
    } else {
      localPlayer.dir = localPlayer.vy >= 0 ? "back" : "front";
    }
  }

  upsertLocalPlayer();
}

function updateCamera(dt) {
  const focusX = localPlayer.characterId ? localPlayer.x : WORLD_WIDTH / 2;
  const focusY = localPlayer.characterId ? localPlayer.y : WORLD_HEIGHT / 2;
  const viewWidth = window.innerWidth / CAMERA_ZOOM;
  const viewHeight = window.innerHeight / CAMERA_ZOOM;
  const targetX = Math.max(0, Math.min(WORLD_WIDTH - viewWidth, focusX - viewWidth / 2));
  const targetY = Math.max(0, Math.min(WORLD_HEIGHT - viewHeight, focusY - viewHeight / 2));

  if (!cameraState.initialized) {
    cameraState.x = targetX;
    cameraState.y = targetY;
    cameraState.initialized = true;
    return;
  }

  const t = 1 - Math.exp(-CAMERA_FOLLOW_RATE * dt);
  cameraState.x += (targetX - cameraState.x) * t;
  cameraState.y += (targetY - cameraState.y) * t;
}

function drawPlaceholder(x, y) {
  ctx.fillStyle = "#cfd5c9";
  ctx.fillRect(x - 16, y - 26, 32, 32);
  ctx.strokeStyle = "#7a8374";
  ctx.setLineDash([4, 2]);
  ctx.strokeRect(x - 16, y - 26, 32, 32);
  ctx.setLineDash([]);
}

function drawActor(player, cameraX, cameraY, zoom) {
  const screenX = Math.round((player.x - cameraX) * zoom);
  const screenY = Math.round((player.y - cameraY) * zoom);
  const frame = player.moving
    ? [3, 1, 4, 1][Math.floor(animClock * 10) % 4]
    : Math.floor(animClock * 5) % 2 === 0
      ? 1
      : 2;
  const sprite = getSpriteImage(player.characterId, player.dir, player.moving, frame);
  const drawable = sprite && sprite.complete && sprite.naturalWidth > 0 ? sprite : transparentSprite;
  const spriteSize = Math.round(64 * zoom);
  const spriteHalf = spriteSize / 2;

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(screenX, screenY + 24 * zoom, 15 * zoom, 6 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  if (player.dir === "right") {
    ctx.translate(Math.round(screenX + spriteHalf), Math.round(screenY - spriteHalf));
    ctx.scale(-1, 1);
    ctx.drawImage(drawable, 0, 0, spriteSize, spriteSize);
  } else {
    ctx.drawImage(drawable, screenX - spriteHalf, screenY - spriteHalf, spriteSize, spriteSize);
  }
  ctx.restore();

  ctx.fillStyle = "#1f2a21";
  ctx.font = `bold ${Math.max(14, 12 * zoom)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(player.name, screenX, screenY - 38 * zoom);
}

function drawBackground(cameraX, cameraY, zoom) {
  ctx.fillStyle = "#d8c7a8";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const wood = getImage(WOOD_TILE_PATH);
  const tileSize = 64;
  const viewWidth = window.innerWidth / zoom;
  const viewHeight = window.innerHeight / zoom;
  const tileScreen = tileSize * zoom;
  const startWX = Math.floor(cameraX / tileSize) * tileSize;
  const startWY = Math.floor(cameraY / tileSize) * tileSize;
  const endWX = cameraX + viewWidth + tileSize;
  const endWY = cameraY + viewHeight + tileSize;

  if (wood && wood.complete && wood.naturalWidth > 0) {
    for (let wy = startWY; wy < endWY; wy += tileSize) {
      for (let wx = startWX; wx < endWX; wx += tileSize) {
        const sx = Math.round((wx - cameraX) * zoom);
        const sy = Math.round((wy - cameraY) * zoom);
        ctx.drawImage(wood, sx, sy, tileScreen, tileScreen);
      }
    }
  }

  ctx.strokeStyle = "rgba(80,54,24,0.15)";
  ctx.lineWidth = 1;
  for (let wx = startWX; wx < endWX; wx += tileSize) {
    const x = Math.round((wx - cameraX) * zoom);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, window.innerHeight);
    ctx.stroke();
  }

  for (let wy = startWY; wy < endWY; wy += tileSize) {
    const y = Math.round((wy - cameraY) * zoom);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(window.innerWidth, y);
    ctx.stroke();
  }
}

function drawButton(rect, label, tone = "light") {
  ctx.fillStyle = tone === "dark" ? "rgba(28,39,31,0.92)" : "rgba(245,247,241,0.92)";
  ctx.strokeStyle = tone === "dark" ? "#b9d1b7" : "rgba(52,71,57,0.35)";
  ctx.lineWidth = 2;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = tone === "dark" ? "#eaf5e7" : "#1f2a21";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
}

function drawFittedText(text, centerX, topY, maxWidth, maxSize = 20, minSize = 11, color = "#1f2a21") {
  let size = maxSize;
  for (; size >= minSize; size--) {
    ctx.font = `bold ${size}px sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(text, centerX, topY);
  return size;
}

function getSelectionLayout() {
  const baseCardW = 150;
  const baseCardH = 188;
  const baseGap = 12;
  const top = 132;
  const maxColsByWidth = Math.max(1, Math.floor((window.innerWidth + baseGap) / (baseCardW + baseGap)));
  const cols = Math.max(1, Math.min(4, maxColsByWidth, CHARACTER_DEFS.length));
  const rows = Math.ceil(CHARACTER_DEFS.length / cols);
  const fitW = (window.innerWidth - baseGap * (cols - 1) - 20) / (cols * baseCardW);
  const fitH = (window.innerHeight - top - 24 - baseGap * (rows - 1)) / (rows * baseCardH);
  const scale = Math.max(0.56, Math.min(1, fitW, fitH));
  const cardW = Math.floor(baseCardW * scale);
  const cardH = Math.floor(baseCardH * scale);
  const gap = Math.floor(baseGap * scale);
  const totalW = cols * cardW + (cols - 1) * gap;
  const left = Math.floor((window.innerWidth - totalW) / 2);
  return {
    left,
    top,
    cols,
    scale,
    cardW,
    cardH,
    gap,
  };
}

function drawSelectionUi() {
  uiState.selectionHitboxes = [];
  uiState.selectionActions = [];
  ctx.fillStyle = "rgba(15,18,15,0.58)";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.fillStyle = "#f2f7ef";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  drawFittedText("SEKECT PLAYER", window.innerWidth / 2, 16, window.innerWidth - 24, 72, 28, "#f2f7ef");
  ctx.fillStyle = "#e8f0e3";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`ROOM ID: ${roomId}`, window.innerWidth / 2, 86);
  const copyRect = { x: Math.floor(window.innerWidth / 2 - 76), y: 106, w: 152, h: 22 };
  drawButton(copyRect, "COPY URL", "light");
  uiState.selectionActions.push({ action: "copy", rect: copyRect });

  const { left, top, cols, scale, cardW, cardH, gap } = getSelectionLayout();
  const frame = Math.floor(animClock * 5) % 2 === 0 ? 1 : 2;

  CHARACTER_DEFS.forEach((def, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = left + col * (cardW + gap);
    const y = top + row * (cardH + gap);
    const lock = readValidLock(def.id);
    const blocked = Boolean(lock && lock.clientId !== clientId);
    const rect = { x, y, w: cardW, h: cardH };
    uiState.selectionHitboxes.push({ characterId: def.id, rect, blocked });

    const frameImg = getImage(PLAYER_SELECT_FRAME_PATH);
    if (frameImg && frameImg.complete && frameImg.naturalWidth > 0) {
      ctx.drawImage(frameImg, x, y, cardW, cardH);
    } else {
      ctx.fillStyle = "rgba(240,245,235,0.95)";
      ctx.strokeStyle = "rgba(33,56,39,0.35)";
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeRect(x, y, cardW, cardH);
    }
    if (blocked) {
      ctx.fillStyle = "rgba(96,32,32,0.48)";
      ctx.fillRect(x, y, cardW, cardH);
    }

    const sprite = getSpriteImage(def.id, "front", false, frame);
    const drawable = sprite && sprite.complete && sprite.naturalWidth > 0 ? sprite : transparentSprite;
    const avatar = Math.floor(64 * scale);
    ctx.drawImage(drawable, x + cardW / 2 - avatar / 2, y + Math.floor(18 * scale), avatar, avatar);

    ctx.fillStyle = blocked ? "#ffe6e6" : "#1f2a21";
    const statusSize = Math.max(8, Math.floor(10 * scale));
    const statusGap = Math.max(6, Math.floor(8 * scale));
    const nameY = y + Math.floor(94 * scale);
    const nameFont = Math.max(11, Math.floor(20 * scale));
    ctx.font = `bold ${nameFont}px sans-serif`;
    const nameWidth = ctx.measureText(def.name).width;
    const groupW = statusSize + statusGap + nameWidth;
    const gx = x + (cardW - groupW) / 2;
    const sy = nameY + Math.max(2, Math.floor(6 * scale));
    ctx.fillStyle = blocked ? "#b64646" : "#2a9b55";
    ctx.fillRect(Math.floor(gx), Math.floor(sy), statusSize, statusSize);
    drawFittedText(def.name, x + cardW / 2, nameY, cardW - 24, nameFont, Math.max(10, Math.floor(12 * scale)), blocked ? "#ffe6e6" : "#1f2a21");

    const buttonRect = {
      x: x + Math.floor(12 * scale),
      y: y + Math.floor(148 * scale),
      w: cardW - Math.floor(24 * scale),
      h: Math.floor(30 * scale),
    };
    const selectBtn = getImage(KYARA_SELECT_BUTTON_PATH);
    if (selectBtn && selectBtn.complete && selectBtn.naturalWidth > 0) {
      ctx.drawImage(selectBtn, buttonRect.x, buttonRect.y, buttonRect.w, buttonRect.h);
      if (blocked) {
        ctx.fillStyle = "rgba(45,10,10,0.45)";
        ctx.fillRect(buttonRect.x, buttonRect.y, buttonRect.w, buttonRect.h);
      }
      ctx.fillStyle = blocked ? "#ffd9d9" : "#102015";
      ctx.font = `bold ${Math.max(11, Math.floor(14 * scale))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PLAY", buttonRect.x + buttonRect.w / 2, buttonRect.y + buttonRect.h / 2 + 1);
    } else {
      drawButton(buttonRect, "PLAY", blocked ? "dark" : "light");
    }
  });
}

function ensureLocalCharacterOwnership() {
  if (!localPlayer.characterId) {
    return;
  }
  const lock = readValidLock(localPlayer.characterId);
  if (lock && lock.clientId !== clientId) {
    playersMap.delete(clientId);
    localPlayer.characterId = null;
    localPlayer.name = "";
    setUiMode("selection");
    showToast("そのキャラは他の人が使用中です");
  }
}

function drawHudUi() {
  uiState.hudHitboxes = [];
  const panel = { x: 12, y: 12, w: Math.min(560, window.innerWidth - 24), h: 44 };
  ctx.fillStyle = "rgba(245,247,241,0.9)";
  ctx.strokeStyle = "rgba(49,68,56,0.32)";
  ctx.lineWidth = 2;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);

  const label = `部屋: ${roomId}${localPlayer.name ? ` / ${localPlayer.name}` : ""}`;
  ctx.fillStyle = "#1f2a21";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, panel.x + 12, panel.y + panel.h / 2);

  // Play mode is locked to movement only; no extra HUD actions.
}

function drawToast() {
  if (!uiState.toast || performance.now() > uiState.toastUntil) {
    return;
  }
  const w = Math.min(window.innerWidth - 30, 360);
  const h = 36;
  const x = (window.innerWidth - w) / 2;
  const y = window.innerHeight - 58;
  ctx.fillStyle = "rgba(22,28,23,0.88)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(180,210,185,0.55)";
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#eef6eb";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(uiState.toast, x + w / 2, y + h / 2);
}

function render() {
  ctx.imageSmoothingEnabled = false;
  cleanupStalePlayers();

  const cameraX = Math.round(cameraState.x * CAMERA_ZOOM) / CAMERA_ZOOM;
  const cameraY = Math.round(cameraState.y * CAMERA_ZOOM) / CAMERA_ZOOM;

  drawBackground(cameraX, cameraY, CAMERA_ZOOM);

  const players = [];
  playersMap.forEach((player) => {
    if (!player?.characterId) {
      return;
    }
    players.push(player);
  });

  players.sort((a, b) => a.y - b.y);
  for (const player of players) {
    drawActor(player, cameraX, cameraY, CAMERA_ZOOM);
  }

  if (uiState.mode === "selection") {
    drawSelectionUi();
  } else {
    drawHudUi();
  }
  drawToast();
}

function frameLoop(ts) {
  const deltaMs = Math.min(100, ts - lastMs);
  lastMs = ts;
  accumulator += deltaMs / 1000;

  while (accumulator >= STEP_SEC) {
    updateSimulation(STEP_SEC);
    updateCamera(STEP_SEC);
    animClock += STEP_SEC;
    accumulator -= STEP_SEC;
  }

  render();
  rafId = requestAnimationFrame(frameLoop);
}

function setupKeyboard() {
  const downMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
  };

  window.addEventListener("keydown", (event) => {
    const key = downMap[event.key] || downMap[event.key.toLowerCase?.()];
    if (key) {
      inputState[key] = true;
      event.preventDefault();
    }

    if (event.key.toLowerCase() === "f") {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    const key = downMap[event.key] || downMap[event.key.toLowerCase?.()];
    if (key) {
      inputState[key] = false;
      event.preventDefault();
    }
  });
}

function setupJoystick() {
  const radius = 46;

  function updateKnob(clientX, clientY) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = dist > radius ? radius / dist : 1;

    const x = dx * clamped;
    const y = dy * clamped;
    inputState.joyX = x / radius;
    inputState.joyY = y / radius;
    joystickKnob.style.transform = `translate(${x}px, ${y}px)`;
  }

  function reset() {
    inputState.joyX = 0;
    inputState.joyY = 0;
    joystickKnob.style.transform = "translate(0px, 0px)";
  }

  joystick.addEventListener("pointerdown", (e) => {
    joystickState.activePointerId = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    updateKnob(e.clientX, e.clientY);
    e.preventDefault();
  });

  joystick.addEventListener("pointermove", (e) => {
    if (joystickState.activePointerId !== e.pointerId) {
      return;
    }
    updateKnob(e.clientX, e.clientY);
    e.preventDefault();
  });

  joystick.addEventListener("pointerup", (e) => {
    if (joystickState.activePointerId === e.pointerId) {
      joystickState.activePointerId = null;
      reset();
    }
  });
  joystick.addEventListener("pointercancel", (e) => {
    if (joystickState.activePointerId === e.pointerId) {
      joystickState.activePointerId = null;
      reset();
    }
  });
  joystick.addEventListener("lostpointercapture", () => {
    joystickState.activePointerId = null;
    reset();
  });
  window.addEventListener("blur", () => {
    joystickState.activePointerId = null;
    reset();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      joystickState.activePointerId = null;
      reset();
    }
  });
}

function setupSync() {
  doc = new Y.Doc();
  provider = new WebrtcProvider(roomId, doc, {
    maxConns: 30,
    filterBcConns: false,
  });
  playersMap = doc.getMap("players");
  locksMap = doc.getMap("locks");

  heartbeatTimer = window.setInterval(() => {
    cleanupStalePlayers();
    cleanupStaleLocks();
    ensureLocalCharacterOwnership();

    if (localPlayer.characterId) {
      locksMap.set(localPlayer.characterId, { clientId, ts: nowMs() });
      upsertLocalPlayer();
    }
  }, 1000);

  window.addEventListener("beforeunload", () => {
    releaseMyLock();
    playersMap.delete(clientId);
  });
}

function init() {
  roomId = deriveRoomId();
  getImage(WOOD_TILE_PATH);
  preloadSprites();
  resizeCanvas();
  setupKeyboard();
  setupJoystick();
  setupCanvasUi();
  setupSync();
  setUiMode(localPlayer.characterId ? "game" : "selection");

  window.addEventListener("resize", resizeCanvas);
  cancelAnimationFrame(rafId);
  lastMs = performance.now();
  accumulator = 0;
  rafId = requestAnimationFrame(frameLoop);
}

document.addEventListener("fullscreenchange", () => {
  if (uiState.mode === "game" && !document.fullscreenElement) {
    showToast("プレイ中は全画面です");
  }
});

window.render_game_to_text = () => {
  cleanupStalePlayers();
  const players = [];
  playersMap?.forEach((player, id) => {
    if (!player?.characterId) return;
    players.push({
      id,
      name: player.name,
      characterId: player.characterId,
      x: Math.round(player.x),
      y: Math.round(player.y),
      dir: player.dir,
      moving: Boolean(player.moving),
    });
  });

  const payload = {
    coordinateSystem: "origin=(0,0) top-left, x:right, y:down",
    roomId,
    selfId: clientId,
    selectedCharacter: localPlayer.characterId,
    players,
  };
  return JSON.stringify(payload);
};

window.advanceTime = (ms) => {
  const seconds = Math.max(0, ms) / 1000;
  let left = seconds;
  while (left > 0) {
    const dt = Math.min(STEP_SEC, left);
    updateSimulation(dt);
    updateCamera(dt);
    animClock += dt;
    left -= dt;
  }
  render();
};

init();
