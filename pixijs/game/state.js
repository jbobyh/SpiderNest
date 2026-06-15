// ============================================================
// GAME STATE — createGameState(), playerProgress, save/load
// CONFIG is a global (loaded via <script> in index.html)
// ============================================================

import {
  cellKey, cellFromKey, cellOf, CELL_PX,
  CARDINAL_DIRECTIONS, shuffleInPlace,
  recomputeOpenCells, getConnectedCells, getCellBounds,
  wallKey, wallKeyFromStr,
} from '../world/constants.js';
import { generateLevel } from '../world/level-gen.js';

// ── Default player progress (cross-level persistent state) ────

export function createDefaultProgress() {
  return {
    totalLives: 3,
    totalHeartsCollected: 0,
    upgrades: {
      pellets: 0,
      damage: 0,
      penetrate: 0,
      cooldownMult: 1.0,
      speedMult: 1.0,
      spreadMult: 1.0,
      bulletSpeedMult: 1.0,
      critChance: 0,
      killAccel: false,
      killAccelPercent: 0,
      enhancedPierce: false,
      shield: 0,
      retreat: 0,
      reflection: false,
      infinitePenetrate: false,
      infiniteRange: false,
      ricochet: false,
      lastLife: false,
      battleSpeed: false,
      freeze: false,
      randomBonus: false,
      farSight: false,
      longRange: false,
      sniper: false,
    },
    spawnedUpgrades: {},
    spawnedWeapons: [],
    weaponSlots: ['pistol', null],
    activeSlot: 0,
    maxSlots: 1,
  };
}

// ── createGameState ───────────────────────────────────────────
// Pure function; no rendering side-effects.

export function createGameState(level, playerProgress) {
  const CP = CELL_PX;

  const {
    rooms,
    blobCells,
    removedWalls: roomRemovedWalls,
    internalWalls: roomInternalWalls,
    cellContents,
    hearts,
    upgradeObjs,
    chestObjs,
    droppedWeapons,
    summonSphere,
    trappedSpiders,
    roomAltars,
    roomColors,
    startCell,
    disabledCells,
  } = generateLevel(level, playerProgress);

  const cx = startCell.x;
  const cy = startCell.y;

  const initOpen         = new Set([cellKey(cx, cy)]);
  const initEverOpened   = new Set([cellKey(cx, cy)]);
  const initEverRevealed = new Set([cellKey(cx, cy)]);

  // Reveal starting room cells
  for (const cell of rooms[0].cells) initEverRevealed.add(cell.k);

  // Reveal adjacent cells from start
  _revealAdjacentCells(initEverRevealed, cx, cy, disabledCells, new Set());

  return {
    gridSize: CONFIG.GRID_SIZE,
    rooms,
    blobCells,
    openCells: initOpen,
    removedWalls: roomRemovedWalls,
    internalWalls: roomInternalWalls,
    roomColors,
    playerRemovedWalls: 0,
    everRevealedCells: initEverRevealed,
    everOpenedCells: initEverOpened,
    permanentlyClosed: new Set(),
    disabledCells,
    startCell: { x: cx, y: cy },
    exitCell: null,
    revealedExit: false,
    cellContents,
    hearts,
    heartsCollected: 0,
    summonSphere,
    summonSphereCollected: false,
    upgradeObjs,
    chestObjs,
    bossSummonReady: false,
    bossDefeated: false,
    upgrades: { ...playerProgress.upgrades },
    player: {
      x: (cx + 0.5) * CP,
      y: (cy + 0.5) * CP,
      lives: playerProgress.totalLives,
      invulnerable: 0,
      dashCooldown: 0,
      isDashing: false,
      dashDirX: 0,
      dashDirY: 0,
      dashProgress: 0,
      dashTrails: [],
      dashTrailTimer: 0,
    },
    spiders: trappedSpiders,
    activeSpiders: [],
    deathCorpses: [],
    bullets: [],
    enemyBullets: [],
    shootCooldown: 0,
    maxShootCooldown: 0,
    burstCooldown: 0,
    burstRemaining: 0,
    burstWeaponId: null,
    particles: [],
    time: 0,
    keys: {},
    mouse: { x: (cx + 0.5) * CP, y: (cy + 0.5) * CP },
    phase: 'play',
    battle: null,
    droppedWeapons,
    weaponSlots: [...playerProgress.weaponSlots],
    activeSlot: playerProgress.activeSlot,
    maxSlots: playerProgress.maxSlots,
    roomAltars,
  };
}

// ── Save / Load ───────────────────────────────────────────────

const SAVE_KEY = 'spidernest_save';
const SAVE_VERSION = 2;

export function saveGame(state, currentLevel, playerProgress) {
  try {
    const save = {
      version: SAVE_VERSION,
      currentLevel,
      playerProgress: {
        ...playerProgress,
        upgrades: { ...playerProgress.upgrades },
        spawnedUpgrades: { ...playerProgress.spawnedUpgrades },
      },
      state: _serializeState(state),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || save.version !== SAVE_VERSION) return null;

    const progress = save.playerProgress;

    // Back-compat: ensure new upgrade keys exist
    const upg = progress.upgrades;
    const defaults = createDefaultProgress().upgrades;
    for (const key of Object.keys(defaults)) {
      if (upg[key] === undefined) upg[key] = defaults[key];
    }
    if (!progress.spawnedUpgrades) progress.spawnedUpgrades = {};
    if (!progress.spawnedWeapons)  progress.spawnedWeapons  = [];

    return {
      currentLevel: save.currentLevel,
      playerProgress: progress,
      state: _deserializeState(save.state),
    };
  } catch (e) {
    console.warn('Load failed:', e);
    return null;
  }
}

export function hasSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const save = JSON.parse(raw);
    return save && save.version === SAVE_VERSION;
  } catch (e) { return false; }
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function savePlayerProgress(state, playerProgress) {
  playerProgress.totalLives           = state.player.lives;
  playerProgress.weaponSlots          = [...(state.weaponSlots || ['pistol', null])];
  playerProgress.activeSlot           = state.activeSlot || 0;
  playerProgress.maxSlots             = state.maxSlots || 1;
}

// ── Reveal helpers ────────────────────────────────────────────

export function revealRoom(state, ck) {
  if (!state.rooms || !state.rooms.length) return;
  for (const room of state.rooms) {
    let found = false;
    for (const cell of room.cells) {
      if (cell.k === ck) { found = true; break; }
    }
    if (!found) continue;
    for (const cell of room.cells) {
      state.everRevealedCells.add(cell.k);
      _revealAdjacentCells(state.everRevealedCells, cell.x, cell.y, state.disabledCells, state.permanentlyClosed);
      if (state.upgrades.farSight) {
        _revealDiagonalCells(state.everRevealedCells, cell.x, cell.y, state.disabledCells, state.permanentlyClosed);
      }
    }
    break;
  }
}

function _revealAdjacentCells(revealed, cx, cy, disabled, permanentlyClosed) {
  for (const [dx, dy] of CARDINAL_DIRECTIONS) {
    const nx = cx + dx, ny = cy + dy;
    const nk = cellKey(nx, ny);
    if (disabled && disabled.has(nk)) continue;
    if (permanentlyClosed && permanentlyClosed.has(nk)) continue;
    revealed.add(nk);
  }
}

function _revealDiagonalCells(revealed, cx, cy, disabled, permanentlyClosed) {
  const ALL_DIRS = [[1,1],[-1,1],[1,-1],[-1,-1],...CARDINAL_DIRECTIONS];
  for (const [dx, dy] of ALL_DIRS) {
    const nx = cx + dx, ny = cy + dy;
    const nk = cellKey(nx, ny);
    if (disabled && disabled.has(nk)) continue;
    if (permanentlyClosed && permanentlyClosed.has(nk)) continue;
    revealed.add(nk);
  }
}

// ── Wall open/close helper (used by input layer) ──────────────

function _playerSeedKey(state) {
  const { x, y } = cellOf(state.player.x, state.player.y);
  const pk = cellKey(x, y);
  return state.blobCells.has(pk) ? pk : cellKey(state.startCell.x, state.startCell.y);
}

export function doOpenWall(state, wk) {
  state.removedWalls.add(wk);
  state.playerRemovedWalls++;
  state.openCells = recomputeOpenCells(state.blobCells, state.removedWalls, _playerSeedKey(state));

  const { ax, ay, bx, by } = wallKeyFromStr(wk);
  const aKey = cellKey(ax, ay);
  const bKey = cellKey(bx, by);
  for (const { k, x, y } of [{ k: aKey, x: ax, y: ay }, { k: bKey, x: bx, y: by }]) {
    if (!state.everRevealedCells.has(k)) state.everRevealedCells.add(k);
    if (!state.everOpenedCells.has(k))   state.everOpenedCells.add(k);
    revealRoom(state, k);
    _revealAdjacentCells(state.everRevealedCells, x, y, state.disabledCells, state.permanentlyClosed);
    if (state.upgrades.farSight) _revealDiagonalCells(state.everRevealedCells, x, y, state.disabledCells, state.permanentlyClosed);
  }
}

export function doCloseWall(state, wk) {
  state.removedWalls.delete(wk);
  state.playerRemovedWalls--;
  state.openCells = recomputeOpenCells(state.blobCells, state.removedWalls, _playerSeedKey(state));
}

// ── Internal serialization ────────────────────────────────────

function _serializeState(s) {
  return {
    gridSize:         s.gridSize,
    rooms:            s.rooms || [],
    blobCells:        [...s.blobCells],
    openCells:        [...s.openCells],
    removedWalls:     [...s.removedWalls],
    internalWalls:    [...s.internalWalls],
    roomColors:       [...s.roomColors],
    playerRemovedWalls: s.playerRemovedWalls || 0,
    everRevealedCells: [...s.everRevealedCells],
    everOpenedCells:  [...s.everOpenedCells],
    permanentlyClosed: [...s.permanentlyClosed],
    disabledCells:    [...s.disabledCells],
    startCell:        s.startCell,
    exitCell:         s.exitCell,
    revealedExit:     s.revealedExit,
    heartsCollected:  s.heartsCollected,
    summonSphere:     s.summonSphere,
    summonSphereCollected: s.summonSphereCollected || false,
    bossDefeated:     s.bossDefeated || false,
    player: {
      x: s.player.x, y: s.player.y,
      lives: s.player.lives,
      invulnerable: 0,
      dashCooldown: s.player.dashCooldown || 0,
      isDashing: false,
      dashDirX: 0, dashDirY: 0, dashProgress: 0,
    },
    cellContents:  [...s.cellContents].map(([k, v]) => [k, v]),
    hearts:        s.hearts,
    upgradeObjs:   s.upgradeObjs,
    chestObjs:     s.chestObjs || [],
    upgrades:      { ...s.upgrades },
    spiders:       s.spiders.map(g => ({ ...g })),
    activeSpiders: s.activeSpiders.map(g => ({ ...g })),
    droppedWeapons: s.droppedWeapons ? [...s.droppedWeapons] : [],
    weaponSlots:   s.weaponSlots ? [...s.weaponSlots] : ['pistol', null],
    activeSlot:    s.activeSlot || 0,
    maxSlots:      s.maxSlots || 1,
    time:          s.time,
    roomAltars:    s.roomAltars || [],
  };
}

function _deserializeState(data) {
  return {
    gridSize:           data.gridSize || 5,
    rooms:              data.rooms || [],
    blobCells:          new Set(data.blobCells || []),
    openCells:          new Set(data.openCells),
    removedWalls:       new Set(data.removedWalls || []),
    internalWalls:      new Set(data.internalWalls || []),
    roomColors:         new Map(data.roomColors || []),
    playerRemovedWalls: data.playerRemovedWalls || 0,
    everRevealedCells:  new Set(data.everRevealedCells),
    everOpenedCells:    new Set(data.everOpenedCells),
    permanentlyClosed:  new Set(data.permanentlyClosed || []),
    disabledCells:      new Set(data.disabledCells),
    startCell:          data.startCell,
    exitCell:           data.exitCell,
    revealedExit:       data.revealedExit,
    heartsCollected:    data.heartsCollected,
    summonSphere:       data.summonSphere,
    summonSphereCollected: data.summonSphereCollected || false,
    bossDefeated:       data.bossDefeated || false,
    bossSummonReady:    false,
    player: {
      ...data.player,
      isDashing: false, dashDirX: 0, dashDirY: 0, dashProgress: 0,
      dashTrails: [], dashTrailTimer: 0,
    },
    cellContents:  new Map(data.cellContents),
    hearts:        (data.hearts || []).map(h => ({ ...h, spawned: h.spawned !== false })),
    upgradeObjs:   (data.upgradeObjs || []).map(u => ({ ...u, spawned: u.spawned !== false })),
    chestObjs:     (data.chestObjs || []).map(c => ({ ...c, spawned: c.spawned !== false })),
    upgrades:      { ...data.upgrades },
    spiders:       data.spiders.map(g => ({ ...g })),
    activeSpiders: (data.activeSpiders || []).map(g => ({ ...g })),
    droppedWeapons: data.droppedWeapons ? [...data.droppedWeapons] : [],
    weaponSlots:   data.weaponSlots ? [...data.weaponSlots] : ['pistol', null],
    activeSlot:    data.activeSlot || 0,
    maxSlots:      data.maxSlots || 1,
    deathCorpses:  [],
    bullets:       [],
    enemyBullets:  [],
    particles:     [],
    shootCooldown: 0,
    maxShootCooldown: 0,
    burstCooldown: 0,
    burstRemaining: 0,
    burstWeaponId: null,
    keys:          {},
    mouse:         { x: data.player.x, y: data.player.y },
    time:          data.time || 0,
    phase:         'play',
    battle:        null,
    roomAltars:    data.roomAltars || [],
  };
}
