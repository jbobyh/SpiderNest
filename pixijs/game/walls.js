// ============================================================
// WALLS — open/close toggle with flying heart animation
// ============================================================

import { Sounds } from '../core/sound.js';
import { saveCurrentGame } from '../game-loop.js';
import { doShiftWall, doUnshiftWall } from './state.js';
import { CELL_PX, getNearestWall, inOpenRect, SHIFT_STEP } from '../world/constants.js';

// Flying heart state (module-local)
let flyingHeart = null;
let pendingOpenHeart = false; // false | 'hud' | 'cell'
let _rightWasHeld = false;    // for debouncing right-click

// HUD heart coordinates for animation target
function getHudHeartCoords(state, index) {
  const ICON = 20, GAP = 4, PAD_X = 10, PAD_Y = 10;
  const filled = state.player?.lives || 0;
  const removedWt = state.playerRemovedWalls || 0;
  const total = Math.max(filled + removedWt, filled);
  const reverseIndex = total - 1 - index;
  const x = PAD_X + reverseIndex * (ICON + GAP) + ICON / 2;
  const y = PAD_Y + ICON / 2;
  return { x, y };
}

// Find wall direction with largest shift to auto-pull when lives === 1
function findAutoPullWall(state) {
  const ws = state.wallShifts;
  let bestDir = null;
  let bestShift = 0;
  for (const dir of ['N', 'S', 'E', 'W']) {
    if (ws[dir] > bestShift) {
      bestShift = ws[dir];
      bestDir = dir;
    }
  }
  if (!bestDir) return null;

  const r = state.openRect;
  let midX, midY;
  if (bestDir === 'N') { midX = (r.minX + r.maxX) / 2; midY = r.minY; }
  else if (bestDir === 'S') { midX = (r.minX + r.maxX) / 2; midY = r.maxY; }
  else if (bestDir === 'W') { midX = r.minX; midY = (r.minY + r.maxY) / 2; }
  else { midX = r.maxX; midY = (r.minY + r.maxY) / 2; }
  return { dir: bestDir, midX, midY };
}

// Launch flying heart animation
function launchFlyingHeart(fromX, fromY, toX, toY, onArrive, getTarget) {
  const dist = Math.hypot(toX - fromX, toY - fromY);
  const duration = Math.max(0.18, Math.min(0.45, dist / (CELL_PX * 2.5)));
  flyingHeart = {
    x: fromX, y: fromY,
    startX: fromX, startY: fromY,
    targetX: toX, targetY: toY,
    t: 0, duration, onArrive, getTarget: getTarget || null,
  };
  Sounds.hearttravel?.();
}

// Update flying heart animation
export function updateFlyingHeart(dt) {
  if (!flyingHeart) return;
  const fh = flyingHeart;

  if (fh.getTarget) {
    const t = fh.getTarget();
    fh.targetX = t.x;
    fh.targetY = t.y;
  }

  const p = Math.min(fh.t / fh.duration, 1);
  const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; // easeInOutQuad
  fh.x = fh.startX + (fh.targetX - fh.startX) * e;
  fh.y = fh.startY + (fh.targetY - fh.startY) * e;
  fh.t += dt;

  if (fh.t >= fh.duration) {
    const cb = fh.onArrive;
    flyingHeart = null;
    if (cb) cb();
  }
}

// Get current flying heart for rendering
export function getFlyingHeart() {
  return flyingHeart;
}

// Check if wall interaction is in progress
export function isWallInteractionPending() {
  return !!flyingHeart;
}

// Handle right-click wall shift (push outward or pull inward)
export function handleWallShift(state, mx, my, rightHeld, camera = null) {
  // Debounce: trigger only on rising edge
  if (!rightHeld) {
    _rightWasHeld = false;
    return;
  }
  if (_rightWasHeld) return; // already processing
  _rightWasHeld = true;

  // Block if heart is flying
  if (flyingHeart) return;

  const wall = getNearestWall(state.openRect, mx, my);
  if (!wall) return;

  const clickInside = inOpenRect(mx, my, state.openRect);
  const maxLives = CONFIG.MAX_LIVES || 5;

  if (!clickInside) {
    // PUSH wall outward: spend a life
    if (state.player.lives < 1) return;

    // Auto-pull farthest wall if only 1 life left
    if (state.player.lives === 1) {
      const pullWall = findAutoPullWall(state);
      if (!pullWall) return;

      doUnshiftWall(state, pullWall.dir);
      state.player.lives += 1; // refund from auto-pull
      pendingOpenHeart = 'cell';

      launchFlyingHeart(pullWall.midX, pullWall.midY, wall.midX, wall.midY, () => {
        pendingOpenHeart = false;
        state.player.lives -= 1; // spend on push
        doShiftWall(state, wall.dir);
        saveCurrentGame();
      });
      return;
    }

    const heartIndex = state.player.lives - 1;
    state.player.lives -= 1;
    pendingOpenHeart = 'hud';

    const hudCoords = getHudHeartCoords(state, heartIndex);
    const worldFrom = camera ? camera.screenToWorld(hudCoords.x, hudCoords.y) : { x: hudCoords.x, y: hudCoords.y };
    launchFlyingHeart(worldFrom.x, worldFrom.y, wall.midX, wall.midY, () => {
      pendingOpenHeart = false;
      doShiftWall(state, wall.dir);
      saveCurrentGame();
    });
  } else {
    // PULL wall inward: refund a life
    if (state.wallShifts[wall.dir] < SHIFT_STEP) return; // wall not shifted
    if (state.player.lives >= maxLives) return;

    pendingOpenHeart = 'hud';
    const heartIndex = state.player.lives;

    launchFlyingHeart(wall.midX, wall.midY, 0, 0, () => {
      pendingOpenHeart = false;
      doUnshiftWall(state, wall.dir);
      state.player.lives += 1;
      saveCurrentGame();
    }, () => {
      const hudCoords = getHudHeartCoords(state, heartIndex);
      return camera ? camera.screenToWorld(hudCoords.x, hudCoords.y) : hudCoords;
    });
  }
}
