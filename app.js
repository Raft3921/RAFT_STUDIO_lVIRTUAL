import * as Y from "https://esm.sh/yjs@13.6.24";
import { WebrtcProvider } from "https://esm.sh/y-webrtc@10.3.0?deps=yjs@13.6.24";

const CHARACTER_DEFS = [
  { id: "raft", name: "ラフト" },
  { id: "mai", name: "まい" },
  { id: "yansan", name: "やんさん" },
  { id: "tanutsuna", name: "たぬつな" },
  { id: "muto", name: "ムート" },
  { id: "moron", name: "もろん" },
  { id: "week", name: "ウィーク" },
  { id: "gyoza", name: "ギョーザ" },
];

const SPRITE_FILES = {
  raft: new Set([
    "back_idle1.png",
    "back_idle2.png",
    "back_run1.png",
    "back_run2.png",
    "front_idle1.png",
  ]),
  mai: new Set(["idle1.png", "idle2.png"]),
  yansan: new Set(["idle1.png", "idle2.png"]),
  tanutsuna: new Set(["idle1.png", "idle2.png"]),
  muto: new Set(["idle1.png", "idle2.png"]),
  moron: new Set(["idle1.png", "idle2.png"]),
  week: new Set(["idle1.png", "idle2.png"]),
  gyoza: new Set(["idle1.png", "idle2.png"]),
};

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1400;
const PLAYER_SPEED = 170;
const LOCK_TIMEOUT_MS = 10_000;
const PLAYER_TIMEOUT_MS = 15_000;
const STEP_SEC = 1 / 60;

const selectionScreen = document.getElementById("selection-screen");
const gameScreen = document.getElementById("game-screen");
const characterGrid = document.getElementById("character-grid");
const roomInput = document.getElementById("room-id-input");
const roomApplyBtn = document.getElementById("room-apply-btn");
const roomCopyBtn = document.getElementById("room-copy-btn");
const changeCharacterBtn = document.getElementById("change-character-btn");
const playerLabel = document.getElementById("player-label");
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
const cardViews = [];
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
  if (imageCache.has(path)) {
    return imageCache.get(path);
  }
  const image = new Image();
  image.src = path;
  image.onerror = () => imageCache.set(path, null);
  image.onload = () => imageCache.set(path, image);
  imageCache.set(path, image);
  return image;
}

function getSpriteImage(characterId, dir, moving, frame) {
  const base = `./assets/player/${characterId}`;
  const files = SPRITE_FILES[characterId] || new Set();
  const frameSafe = frame === 2 ? 2 : 1;
  const candidates = [];

  if (files.has(`${dir}_${moving ? "run" : "idle"}${frameSafe}.png`)) {
    candidates.push(`${base}/${dir}_${moving ? "run" : "idle"}${frameSafe}.png`);
  }
  if (files.has(`${dir}_idle${frameSafe}.png`)) {
    candidates.push(`${base}/${dir}_idle${frameSafe}.png`);
  }
  if (files.has(`idle${frameSafe}.png`)) {
    candidates.push(`${base}/idle${frameSafe}.png`);
  }

  if (moving) {
    if (files.has(`idle${frameSafe}.png`)) {
      candidates.push(`${base}/idle${frameSafe}.png`);
    }
    if (files.has("idle1.png")) {
      candidates.push(`${base}/idle1.png`);
    }
  }
  if (files.has("idle1.png")) {
    candidates.push(`${base}/idle1.png`);
  }
  if (files.has("back_idle1.png")) {
    candidates.push(`${base}/back_idle1.png`);
  }
  if (files.has("front_idle1.png")) {
    candidates.push(`${base}/front_idle1.png`);
  }

  for (const path of candidates) {
    const img = getImage(path);
    if (img && img.complete && img.naturalWidth > 0) {
      return img;
    }
    if (img === null) {
      continue;
    }
  }
  return null;
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
  renderCards();
  updatePlayerLabel();
  showGame();
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

function renderCards() {
  cardViews.forEach((card) => {
    const lock = readValidLock(card.characterId);
    const blocked = Boolean(lock && lock.clientId !== clientId);
    card.button.disabled = blocked;
    card.status.className = `status ${blocked ? "busy" : "free"}`;
    card.status.textContent = blocked ? `使用中: ${occupantName(lock)}` : "選択できます";
  });
}

function createCharacterCard(def) {
  const article = document.createElement("article");
  article.className = "character-card";

  const preview = document.createElement("div");
  preview.className = "character-preview";
  const img = document.createElement("img");
  img.alt = `${def.name}のプレビュー`;
  const ph = document.createElement("span");
  ph.className = "placeholder";
  ph.textContent = "画像準備中";
  preview.append(img, ph);

  const name = document.createElement("p");
  name.className = "character-name";
  name.textContent = def.name;

  const status = document.createElement("p");
  status.className = "status free";
  status.textContent = "選択できます";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-select";
  button.textContent = "このキャラで参加";
  button.addEventListener("click", () => {
    acquireCharacter(def.id);
  });

  article.append(preview, name, status, button);
  characterGrid.append(article);
  cardViews.push({ characterId: def.id, img, placeholder: ph, status, button });
}

function startCardPreviewLoop() {
  setInterval(() => {
    const frame = Math.floor(performance.now() / 350) % 2 === 0 ? 1 : 2;
    cardViews.forEach((card) => {
      const sprite = getSpriteImage(card.characterId, "front", false, frame);
      if (sprite) {
        card.img.src = sprite.src;
        card.img.style.visibility = "visible";
        card.placeholder.style.display = "none";
      } else {
        card.img.style.visibility = "hidden";
        card.placeholder.style.display = "block";
      }
    });
    renderCards();
  }, 250);
}

function updatePlayerLabel() {
  const room = roomId;
  if (!localPlayer.characterId) {
    playerLabel.textContent = `部屋: ${room}`;
    return;
  }
  playerLabel.textContent = `部屋: ${room} / ${localPlayer.name}`;
}

function showSelection() {
  selectionScreen.classList.add("active");
}

function showGame() {
  selectionScreen.classList.remove("active");
}

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

function updateSimulation(dt) {
  if (!localPlayer.characterId) {
    return;
  }

  const axis = axisFromInput();
  localPlayer.vx = axis.x * PLAYER_SPEED;
  localPlayer.vy = axis.y * PLAYER_SPEED;
  localPlayer.moving = axis.mag > 0.05;

  localPlayer.x += localPlayer.vx * dt;
  localPlayer.y += localPlayer.vy * dt;

  localPlayer.x = Math.max(40, Math.min(WORLD_WIDTH - 40, localPlayer.x));
  localPlayer.y = Math.max(40, Math.min(WORLD_HEIGHT - 40, localPlayer.y));

  if (localPlayer.moving) {
    if (Math.abs(localPlayer.vx) > Math.abs(localPlayer.vy)) {
      localPlayer.dir = localPlayer.vx >= 0 ? "right" : "left";
    } else {
      localPlayer.dir = localPlayer.vy >= 0 ? "front" : "back";
    }
  }

  upsertLocalPlayer();
}

function drawPlaceholder(x, y) {
  ctx.fillStyle = "#cfd5c9";
  ctx.fillRect(x - 16, y - 26, 32, 32);
  ctx.strokeStyle = "#7a8374";
  ctx.setLineDash([4, 2]);
  ctx.strokeRect(x - 16, y - 26, 32, 32);
  ctx.setLineDash([]);
}

function drawActor(player, cameraX, cameraY) {
  const screenX = player.x - cameraX;
  const screenY = player.y - cameraY;
  const frame = Math.floor(animClock * (player.moving ? 10 : 5)) % 2 === 0 ? 1 : 2;
  const sprite = getSpriteImage(player.characterId, player.dir, player.moving, frame);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(screenX, screenY + 10, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (sprite) {
    ctx.save();
    if (player.dir === "right") {
      ctx.translate(screenX + 32, screenY - 32);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0, 64, 64);
    } else {
      ctx.drawImage(sprite, screenX - 32, screenY - 32, 64, 64);
    }
    ctx.restore();
  } else {
    drawPlaceholder(screenX, screenY);
  }

  ctx.fillStyle = "#1f2a21";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(player.name, screenX, screenY - 38);
}

function drawBackground(cameraX, cameraY) {
  ctx.fillStyle = "#dce7d6";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const gridSize = 64;
  const startX = -((cameraX % gridSize) + gridSize) % gridSize;
  const startY = -((cameraY % gridSize) + gridSize) % gridSize;

  ctx.strokeStyle = "rgba(69,94,76,0.18)";
  ctx.lineWidth = 1;
  for (let x = startX; x < window.innerWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, window.innerHeight);
    ctx.stroke();
  }

  for (let y = startY; y < window.innerHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(window.innerWidth, y);
    ctx.stroke();
  }
}

function render() {
  cleanupStalePlayers();

  const focusX = localPlayer.characterId ? localPlayer.x : WORLD_WIDTH / 2;
  const focusY = localPlayer.characterId ? localPlayer.y : WORLD_HEIGHT / 2;
  const cameraX = Math.max(0, Math.min(WORLD_WIDTH - window.innerWidth, focusX - window.innerWidth / 2));
  const cameraY = Math.max(0, Math.min(WORLD_HEIGHT - window.innerHeight, focusY - window.innerHeight / 2));

  drawBackground(cameraX, cameraY);

  const players = [];
  playersMap.forEach((player) => {
    if (!player?.characterId) {
      return;
    }
    players.push(player);
  });

  players.sort((a, b) => a.y - b.y);
  for (const player of players) {
    drawActor(player, cameraX, cameraY);
  }
}

function frameLoop(ts) {
  const deltaMs = Math.min(100, ts - lastMs);
  lastMs = ts;
  accumulator += deltaMs / 1000;

  while (accumulator >= STEP_SEC) {
    updateSimulation(STEP_SEC);
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
    joystick.setPointerCapture(e.pointerId);
    updateKnob(e.clientX, e.clientY);
    e.preventDefault();
  });

  joystick.addEventListener("pointermove", (e) => {
    if ((e.buttons & 1) !== 1 && e.pressure === 0) {
      return;
    }
    updateKnob(e.clientX, e.clientY);
    e.preventDefault();
  });

  joystick.addEventListener("pointerup", reset);
  joystick.addEventListener("pointercancel", reset);
}

function setupSync() {
  doc = new Y.Doc();
  provider = new WebrtcProvider(roomId, doc, {
    maxConns: 30,
    filterBcConns: false,
  });
  playersMap = doc.getMap("players");
  locksMap = doc.getMap("locks");

  playersMap.observe(renderCards);
  locksMap.observe(renderCards);

  heartbeatTimer = window.setInterval(() => {
    cleanupStalePlayers();
    cleanupStaleLocks();

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

function initUi() {
  CHARACTER_DEFS.forEach(createCharacterCard);
  startCardPreviewLoop();
  renderCards();

  roomInput.value = roomId;
  roomApplyBtn.addEventListener("click", () => setRoom(roomInput.value));
  roomCopyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      roomCopyBtn.textContent = "コピー済み";
      setTimeout(() => {
        roomCopyBtn.textContent = "招待URLをコピー";
      }, 1200);
    } catch {
      roomCopyBtn.textContent = "コピー失敗";
      setTimeout(() => {
        roomCopyBtn.textContent = "招待URLをコピー";
      }, 1200);
    }
  });

  changeCharacterBtn.addEventListener("click", () => {
    releaseMyLock();
    playersMap.delete(clientId);
    localPlayer.characterId = null;
    localPlayer.name = "";
    updatePlayerLabel();
    showSelection();
    renderCards();
  });

  updatePlayerLabel();
  showSelection();
}

function init() {
  roomId = deriveRoomId();
  resizeCanvas();
  setupKeyboard();
  setupJoystick();
  setupSync();
  initUi();

  window.addEventListener("resize", resizeCanvas);
  cancelAnimationFrame(rafId);
  lastMs = performance.now();
  accumulator = 0;
  rafId = requestAnimationFrame(frameLoop);
}

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
    animClock += dt;
    left -= dt;
  }
  render();
};

init();
