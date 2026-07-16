// ============================================================
// GAME STATE — createGameState(), playerProgress, save/load
// CONFIG is a global (loaded via <script> in index.html)
// ============================================================

import {
  cellKey, cellFromKey, cellOf, CELL_PX,
  CARDINAL_DIRECTIONS,
  recomputeOpenCells, wallKeyFromStr,
  computeOpenRect, computeOpenCells, SHIFT_STEP,
} from '../world/constants.js';
import { generateLevel, spawnBattleCycle } from '../world/level-gen.js';
import { EnemyFactory } from './enemy-factory.js';

// ── Default player progress (cross-level persistent state) ────

export function createDefaultProgress(chosenWeapon) {
  const wId = chosenWeapon || 'pistol';
  const magSize = (typeof WEAPON_DEFS !== 'undefined' && WEAPON_DEFS[wId]) ? WEAPON_DEFS[wId].magazineSize : 12;
  return {
    totalLives: CONFIG.INITIAL_LIVES,
    totalHeartsCollected: 0,
    souls: 0,
    upgrades: {
      pellets: 0,
      extraBulletChance: 0,
      damageMult: 0,
      penetrate: 0,
      cooldownMult: 1.0,
      speedMult: 1.0,
      spreadMult: 1.0,
      bulletSpeedMult: 1.0,
      critChance: 0,
      critDamage: 0,
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
      hitStun: 0,
      incendiaryChance: 0,
      freezeChance: 0,
      bloomReduction: 0,
      // Spatial upgrades
      spatialReloadRooms: false,
      spatialReloadHearts: false,
      spatialRangeRooms: false,
      spatialRangeHearts: false,
      spatialAccuracyRooms: false,
      spatialAccuracyHearts: false,
      spatialBulletSpeedRooms: false,
      spatialBulletSpeedHearts: false,
      spatialSpeedRooms: false,
      spatialSpeedHearts: false,
      spatialCritChanceRooms: false,
      spatialCritChanceHearts: false,
      spatialCritDamageRooms: false,
      spatialCritDamageHearts: false,
      spatialPenetrateRooms: false,
      spatialPenetrateHearts: false,
    },
    spawnedUpgrades: {},
    upgradeLevels: {},
    spawnedWeapons: [],
    weaponSlots: [wId, null],
    activeSlot: 0,
    maxSlots: 1,
    ammo: [magSize, 0],
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
    upgradeChests,
    spatialChests,
    trappedSpiders,
    roomBonusAltars,
    roomBonuses,
    fixedWalls,
    roomColors,
    startCell,
    disabledCells,
    purified,
    gridSize,
  } = generateLevel(level, playerProgress);

  const cx = startCell.x;
  const cy = startCell.y;

  // Build cellToRoom map
  const cellToRoom = new Map();
  for (let i = 0; i < rooms.length; i++) {
    for (const cell of rooms[i].cells) {
      cellToRoom.set(cell.k, i);
    }
  }

  const initOpen         = new Set([cellKey(cx, cy)]);
  const initEverOpened   = new Set([cellKey(cx, cy)]);
  const initEverRevealed = new Set([cellKey(cx, cy)]);

  const wallShifts = { N: 0, S: 0, E: 0, W: 0 };
  const openRect   = computeOpenRect(wallShifts, startCell);

  const state = {
    level,
    souls: playerProgress.souls || 0,
    gridSize,
    rooms,
    blobCells,
    openCells: initOpen,
    removedWalls: roomRemovedWalls,
    internalWalls: roomInternalWalls,
    fixedWalls,
    roomColors,
    wallShifts,
    openRect,
    playerRemovedWalls: 0,
    everRevealedCells: initEverRevealed,
    everOpenedCells: initEverOpened,
    permanentlyClosed: new Set(),
    disabledCells,
    startCell: { x: cx, y: cy },
    exitCell: null,
    revealedExit: false,
    cellContents,
    upgradeChests,
    spatialChests,
    upgradeLevels: { ...playerProgress.upgradeLevels },
    upgrades: { ...playerProgress.upgrades },
    battleCount: 0,
    requiredRegularBattles: (LEVEL_CONFIG[level] || LEVEL_CONFIG[1]).battleCount - 1,
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
    spiders: [],
    activeSpiders: [],
    deathCorpses: [],
    shootCooldown: 0,
    maxShootCooldown: 0,
    weaponShootAnim: 0,
    weaponShootAnimMax: 0,
    weaponReloadAnim: 0,
    weaponReloadAnimMax: 0,
    bloomSpread: 0,
    burstCooldown: 0,
    burstRemaining: 0,
    burstWeaponId: null,
    reloadCooldown: 0,
    isReloading: false,
    reloadingSlot: -1,
    particles: [],
    damageNumbers: [],
    time: 0,
    keys: {},
    mouse: { x: (cx + 0.5) * CP, y: (cy + 0.5) * CP },
    phase: 'play',
    battle: null,
    weaponSlots: [...playerProgress.weaponSlots],
    activeSlot: playerProgress.activeSlot,
    maxSlots: playerProgress.maxSlots,
    ammo: _initAmmo(playerProgress),
    roomBonusAltars,
    roomBonuses,
    purified,
    cellToRoom,
    revealedRooms: new Set(),
    purifyWaveFired: new Set(),
    pendingNextCycle: false,
  };

  // Spawn first battle cycle (enemies + chest in start room)
  spawnBattleCycle(state, level, false);

  return state;
}

// ── Save / Load ───────────────────────────────────────────────

const SAVE_KEY = 'spidernest_save';
const SAVE_VERSION = 5;

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
      state: state ? _serializeState(state) : null,
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
    if (progress.souls === undefined) progress.souls = 0;
    if (!progress.ammo) {
      progress.ammo = [];
      for (let i = 0; i < (progress.weaponSlots || []).length; i++) {
        const wId = progress.weaponSlots[i];
        progress.ammo[i] = (wId && WEAPON_DEFS[wId]) ? WEAPON_DEFS[wId].magazineSize : 0;
      }
    }

    return {
      currentLevel: save.currentLevel,
      playerProgress: progress,
      state: save.state ? _deserializeState(save.state) : null,
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
  // Only save lives if player is alive; on death, totalLives stays as is
  if (state.player.lives > 0) {
    // Include lives invested in opened walls so they carry to next level
    playerProgress.totalLives = state.player.lives + (state.playerRemovedWalls || 0);
  }
  playerProgress.weaponSlots          = [...(state.weaponSlots || ['pistol', null])];
  playerProgress.activeSlot           = state.activeSlot || 0;
  playerProgress.maxSlots             = state.maxSlots || 1;
  playerProgress.souls                = state.souls || 0;
  playerProgress.ammo                 = [...(state.ammo || [])];
}

// ── Revealed rooms helpers ───────────────────────────────────

/**
 * Update revealedRooms when a room becomes purified.
 * Adds all rooms adjacent to the newly purified room to revealedRooms.
 */
export function updateRevealedRoomsOnPurify(state, purifiedRoomIdx) {
  if (!state.rooms || !state.cellToRoom) return;

  const purifiedRoom = state.rooms[purifiedRoomIdx];
  if (!purifiedRoom) return;

  // Collect all cell keys from the purified room
  const purifiedCellKeys = new Set();
  for (const cell of purifiedRoom.cells) {
    purifiedCellKeys.add(cell.k);
  }

  // Find adjacent rooms (rooms that share any wall with this purified room)
  const adjacentRoomIndices = new Set();

  for (const pk of purifiedCellKeys) {
    const { x, y } = cellFromKey(pk);
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nx = x + dx, ny = y + dy;
      const nk = cellKey(nx, ny);
      // Skip if it's part of the same (purified) room
      if (purifiedCellKeys.has(nk)) continue;

      // Find which room this neighbor belongs to
      const neighborRoomIdx = state.cellToRoom.get(nk);
      if (neighborRoomIdx !== undefined &&
          neighborRoomIdx !== purifiedRoomIdx &&
          !state.purified.has(neighborRoomIdx)) {
        adjacentRoomIndices.add(neighborRoomIdx);
      }
    }
  }

  // Add all adjacent rooms to revealedRooms and write their cells into everRevealedCells
  for (const roomIdx of adjacentRoomIndices) {
    state.revealedRooms.add(roomIdx);
    for (const cell of state.rooms[roomIdx].cells) {
      state.everRevealedCells.add(cell.k);
    }
  }
}

// ── Wall open/close helper (used by input layer) ──────────────

function _playerSeedKey(state) {
  const { x, y } = cellOf(state.player.x, state.player.y);
  const pk = cellKey(x, y);
  return state.blobCells.has(pk) ? pk : cellKey(state.startCell.x, state.startCell.y);
}

export function tryPurifyRoomIfEmpty(state, k) {
  if (!state.cellToRoom || !state.rooms || !state.purified) return false;
  const roomIdx = state.cellToRoom.get(k);
  if (roomIdx === undefined || state.purified.has(roomIdx)) return false;
  const room = state.rooms[roomIdx];
  if (!room) return false;
  const isEmpty = room.cells.every(cell => {
    const c = state.cellContents?.get(cell.k);
    return !c || !c.enemyCount || c.enemyCount <= 0;
  });
  console.log('tryPurifyRoomIfEmpty:', { roomIdx, isEmpty, cellKey: k });
  if (!isEmpty) return false;
  state.purified.add(roomIdx);
  updateRevealedRoomsOnPurify(state, roomIdx);
  return true;
}

export function doShiftWall(state, dir) {
  state.wallShifts[dir] += SHIFT_STEP;
  state.openRect   = computeOpenRect(state.wallShifts, state.startCell);
  state.openCells  = computeOpenCells(state.openRect);
  state.playerRemovedWalls = (state.wallShifts.N + state.wallShifts.S + state.wallShifts.E + state.wallShifts.W) / SHIFT_STEP;
}

export function doUnshiftWall(state, dir) {
  state.wallShifts[dir] = Math.max(0, state.wallShifts[dir] - SHIFT_STEP);
  state.openRect   = computeOpenRect(state.wallShifts, state.startCell);
  state.openCells  = computeOpenCells(state.openRect);
  state.playerRemovedWalls = (state.wallShifts.N + state.wallShifts.S + state.wallShifts.E + state.wallShifts.W) / SHIFT_STEP;
}

// ── Internal serialization ────────────────────────────────────

function _initAmmo(playerProgress) {
  const slots = playerProgress.weaponSlots || ['pistol', null];
  const savedAmmo = playerProgress.ammo || [];
  const ammo = [];
  for (let i = 0; i < slots.length; i++) {
    const wId = slots[i];
    if (wId && WEAPON_DEFS[wId]) {
      ammo[i] = (savedAmmo[i] !== undefined) ? savedAmmo[i] : WEAPON_DEFS[wId].magazineSize;
    } else {
      ammo[i] = 0;
    }
  }
  return ammo;
}

function _serializeState(s) {
  return {
    level:            s.level,
    souls:            s.souls || 0,
    gridSize:         s.gridSize,
    rooms:            s.rooms || [],
    blobCells:        [...s.blobCells],
    openCells:        [...s.openCells],
    removedWalls:     [...s.removedWalls],
    internalWalls:    [...s.internalWalls],
    fixedWalls:       [...(s.fixedWalls || [])],
    roomColors:       [...s.roomColors],
    wallShifts:       { ...(s.wallShifts || { N: 0, S: 0, E: 0, W: 0 }) },
    openRect:         s.openRect || null,
    playerRemovedWalls: s.playerRemovedWalls || 0,
    everRevealedCells: [...s.everRevealedCells],
    everOpenedCells:  [...s.everOpenedCells],
    permanentlyClosed: [...s.permanentlyClosed],
    disabledCells:    [...s.disabledCells],
    startCell:        s.startCell,
    exitCell:         s.exitCell,
    revealedExit:     s.revealedExit,
    battleCount:      s.battleCount || 0,
    requiredRegularBattles: s.requiredRegularBattles || 0,
    player: {
      x: s.player.x, y: s.player.y,
      lives: s.player.lives,
      invulnerable: 0,
      dashCooldown: s.player.dashCooldown || 0,
      isDashing: false,
      dashDirX: 0, dashDirY: 0, dashProgress: 0,
    },
    cellContents:  [...s.cellContents].map(([k, v]) => [k, v]),
    upgradeChests: s.upgradeChests || [],
    spatialChests:     s.spatialChests || [],
    upgrades:      { ...s.upgrades },
    upgradeLevels: { ...s.upgradeLevels },
    spiders:       s.spiders.map(g => (g.serialize ? g.serialize() : { ...g })),
    activeSpiders: s.activeSpiders.map(g => (g.serialize ? g.serialize() : { ...g })),
    weaponSlots:   s.weaponSlots ? [...s.weaponSlots] : ['pistol', null],
    activeSlot:    s.activeSlot || 0,
    maxSlots:      s.maxSlots || 1,
    ammo:          s.ammo ? [...s.ammo] : [],
    reloadCooldown: s.reloadCooldown || 0,
    isReloading:   s.isReloading || false,
    reloadingSlot: s.reloadingSlot ?? -1,
    time:          s.time,
    roomBonusAltars: s.roomBonusAltars || [],
    roomBonuses:     s.roomBonuses || [],
    purified:      [...(s.purified || [])],
    purifyWaveFired: [...(s.purifyWaveFired || [])],
    pendingNextCycle: s.pendingNextCycle || false,
    cellToRoom:    [...(s.cellToRoom || [])],
    revealedRooms: [...(s.revealedRooms || [])],
  };
}

function _deserializeState(data) {
  const state = {
    level:              data.level,
    souls:              data.souls || 0,
    gridSize:           data.gridSize || 21,
    rooms:              data.rooms || [],
    blobCells:          new Set(data.blobCells || []),
    openCells:          new Set(data.openCells),
    removedWalls:       new Set(data.removedWalls || []),
    internalWalls:      new Set(data.internalWalls || []),
    fixedWalls:         new Set(data.fixedWalls || []),
    roomColors:         new Map(data.roomColors || []),
    wallShifts:         data.wallShifts || { N: 0, S: 0, E: 0, W: 0 },
    openRect:           data.openRect || computeOpenRect(data.wallShifts || { N: 0, S: 0, E: 0, W: 0 }, data.startCell),
    playerRemovedWalls: data.playerRemovedWalls || 0,
    everRevealedCells:  new Set(data.everRevealedCells),
    everOpenedCells:    new Set(data.everOpenedCells),
    openCells:          new Set(data.openCells || []),
    permanentlyClosed:  new Set(data.permanentlyClosed || []),
    disabledCells:      new Set(data.disabledCells),
    startCell:          data.startCell,
    exitCell:           data.exitCell,
    revealedExit:       data.revealedExit,
    battleCount:        data.battleCount || 0,
    requiredRegularBattles: data.requiredRegularBattles || 0,
    player: {
      ...data.player,
      isDashing: false, dashDirX: 0, dashDirY: 0, dashProgress: 0,
      dashTrails: [], dashTrailTimer: 0,
    },
    cellContents:  new Map(data.cellContents),
    upgradeChests: (data.upgradeChests || []).map(c => ({ ...c, spawned: c.spawned !== false })),
    spatialChests:     (data.spatialChests || []).map(c => ({ ...c, spawned: c.spawned !== false })),
    upgrades:      { ...data.upgrades },
    upgradeLevels: data.upgradeLevels || {},
    spiders:       data.spiders.map(g => EnemyFactory.fromObject(g)),
    activeSpiders: (data.activeSpiders || []).map(g => EnemyFactory.fromObject(g)),
    weaponSlots:   data.weaponSlots ? [...data.weaponSlots] : ['pistol', null],
    activeSlot:    data.activeSlot || 0,
    maxSlots:      data.maxSlots || 1,
    ammo:          data.ammo ? [...data.ammo] : [],
    reloadCooldown: data.reloadCooldown || 0,
    isReloading:   data.isReloading || false,
    reloadingSlot: data.reloadingSlot ?? -1,
    deathCorpses:  [],
    particles:     [],
    damageNumbers: [],
    shootCooldown: 0,
    maxShootCooldown: 0,
    weaponShootAnim: 0,
    weaponShootAnimMax: 0,
    weaponReloadAnim: 0,
    weaponReloadAnimMax: 0,
    bloomSpread: 0,
    burstCooldown: 0,
    burstRemaining: 0,
    burstWeaponId: null,
    keys:          {},
    mouse:         { x: data.player.x, y: data.player.y },
    time:          data.time || 0,
    phase:         'play',
    battle:        null,
    roomBonusAltars: data.roomBonusAltars || [],
    roomBonuses:     data.roomBonuses || [],
    purified:         new Set(data.purified || []),
    cellToRoom:        new Map(data.cellToRoom || []),
    revealedRooms:     new Set(data.revealedRooms || []),
    purifyWaveFired:   new Set(data.purifyWaveFired || []),
    pendingNextCycle: data.pendingNextCycle || false,
  };

  // Recompute openCells from openRect for consistency
  if (state.openRect) {
    state.openCells = computeOpenCells(state.openRect);
  }

  // Restore battle cycle: if pendingNextCycle or no stasis enemies in start room, respawn
  const hasStasisEnemies = (state.activeSpiders || []).some(g => g.stasis);
  if (state.pendingNextCycle || !hasStasisEnemies) {
    const isBoss = state.battleCount >= state.requiredRegularBattles;
    spawnBattleCycle(state, state.level, isBoss);
  }

  return state;
}
