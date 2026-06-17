// ============================================================
// WALLS — open/close toggle with flying heart animation
// ============================================================

import { Sounds } from '../core/sound.js';
import { doOpenWall, doCloseWall } from './state.js';
import { spawnRoomRewards } from './collectibles.js';
import { getWallAtPoint, cellKey } from '../world/constants.js';

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

// Find a previously opened wall to auto-close when lives === 1
function findAutoCloseWall(state, excludeWk) {
  const pc = cellKey(Math.floor(state.player.x / 126), Math.floor(state.player.y / 126));
  let best = null;
  let bestDist = Infinity;

  for (const wk of state.removedWalls) {
    if (wk === excludeWk) continue;
    if (state.internalWalls.has(wk)) continue;

    const { ax, ay, bx, by } = (() => {
      const [l, r] = wk.split('|');
      const [ax, ay] = l.split(',').map(Number);
      const [bx, by] = r.split(',').map(Number);
      return { ax, ay, bx, by };
    })();

    const aKey = cellKey(ax, ay);
    const bKey = cellKey(bx, by);
    const aOpen = state.openCells.has(aKey);
    const bOpen = state.openCells.has(bKey);
    if (!aOpen && !bOpen) continue;

    const midX = (ax + bx + 1) * 126 / 2;
    const midY = (ay + by + 1) * 126 / 2;
    const dist = Math.hypot(midX - state.player.x, midY - state.player.y);

    if (dist > bestDist) continue;
    bestDist = dist;
    best = { wk, midX, midY };
  }
  return best;
}

// Launch flying heart animation
function launchFlyingHeart(fromX, fromY, toX, toY, onArrive, getTarget) {
  const dist = Math.hypot(toX - fromX, toY - fromY);
  const duration = Math.max(0.18, Math.min(0.45, dist / (126 * 2.5)));
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

// Handle right-click wall toggle
export function handleWallToggle(state, mx, my, rightHeld) {
  // Debounce: trigger only on rising edge
  if (!rightHeld) {
    _rightWasHeld = false;
    return;
  }
  if (_rightWasHeld) return; // already processing
  _rightWasHeld = true;

  // Block if heart is flying
  if (flyingHeart) return;

  const wall = getWallAtPoint(state.blobCells, mx, my);
  if (!wall) return;

  const aKey = cellKey(wall.ax, wall.ay);
  const bKey = cellKey(wall.bx, wall.by);
  const aOpen = state.openCells.has(aKey);
  const bOpen = state.openCells.has(bKey);

  // Can't interact with internal walls
  if (state.internalWalls.has(wall.wk)) return;

  // Can only interact if at least one side is open
  if (!aOpen && !bOpen) return;

  const wallMidX = (wall.ax + wall.bx + 1) * 126 / 2;
  const wallMidY = (wall.ay + wall.by + 1) * 126 / 2;

  if (!state.removedWalls.has(wall.wk)) {
    // OPEN wall: spend a life
    const aKey = cellKey(wall.ax, wall.ay);
    const bKey = cellKey(wall.bx, wall.by);

    // Check for cursed chest in adjacent cells
    const aContent = state.cellContents.get(aKey);
    const bContent = state.cellContents.get(bKey);
    const hasCursedChest = (aContent?.type === 'cursed') || (bContent?.type === 'cursed');
    const cost = hasCursedChest ? 2 : 1;

    if (state.player.lives < cost) return;

    // Check purified before spending life
    const roomA = state.cellToRoom?.get(aKey);
    const roomB = state.cellToRoom?.get(bKey);
    const purifiedA = roomA !== undefined && state.purified?.has(roomA);
    const purifiedB = roomB !== undefined && state.purified?.has(roomB);
    if (!purifiedA && !purifiedB) return; // Deny interaction

    // Auto-close far wall if only 1 life left (not for cursed rooms)
    if (state.player.lives === 1 && !hasCursedChest) {
      const wallToClose = findAutoCloseWall(state, wall.wk);
      if (!wallToClose) return;

      doCloseWall(state, wallToClose.wk);
      state.player.lives++;
      pendingOpenHeart = 'cell';

      launchFlyingHeart(wallToClose.midX, wallToClose.midY, wallMidX, wallMidY, () => {
        pendingOpenHeart = false;
        state.player.lives--;
        doOpenWall(state, wall.wk);
        _spawnRewardsForNewlyPurified(state, wall);
      });
      return;
    }

    const heartIndex = state.player.lives - cost;
    state.player.lives -= cost;
    pendingOpenHeart = 'hud';

    const hudCoords = getHudHeartCoords(state, heartIndex);
    launchFlyingHeart(hudCoords.x, hudCoords.y, wallMidX, wallMidY, () => {
      pendingOpenHeart = false;
      doOpenWall(state, wall.wk);
      _spawnRewardsForNewlyPurified(state, wall);
    });
  } else {
    // CLOSE wall: recover lives
    if (state.player.lives >= 5) return; // max lives cap

    // Check purified before recovering life
    const aKey = cellKey(wall.ax, wall.ay);
    const bKey = cellKey(wall.bx, wall.by);

    // Check for cursed chest in adjacent cells
    const aContent = state.cellContents.get(aKey);
    const bContent = state.cellContents.get(bKey);
    const hasCursedChest = (aContent?.type === 'cursed') || (bContent?.type === 'cursed');
    const refund = hasCursedChest ? 2 : 1;

    const roomA = state.cellToRoom?.get(aKey);
    const roomB = state.cellToRoom?.get(bKey);
    const purifiedA = roomA !== undefined && state.purified?.has(roomA);
    const purifiedB = roomB !== undefined && state.purified?.has(roomB);
    if (!purifiedA && !purifiedB) return; // Deny interaction

    pendingOpenHeart = 'hud';
    const heartIndex = state.player.lives;

    launchFlyingHeart(wallMidX, wallMidY, 0, 0, () => {
      pendingOpenHeart = false;
      doCloseWall(state, wall.wk);
      state.player.lives += refund;
    }, () => getHudHeartCoords(state, heartIndex));
  }
}

function _spawnRewardsForNewlyPurified(state, wall) {
  for (const k of [cellKey(wall.ax, wall.ay), cellKey(wall.bx, wall.by)]) {
    const roomIdx = state.cellToRoom?.get(k);
    if (roomIdx !== undefined && state.purified?.has(roomIdx)) {
      spawnRoomRewards(state, k);
    }
  }
}

// Get pending heart state for HUD rendering
export function getPendingHeartState() {
  return { flyingHeart, pendingOpenHeart };
}
