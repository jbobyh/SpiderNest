// ============================================================
// BATTLE MODE — per-frame update + state creation/exit
//
// Unified coordinate system: everything in world-coords (CELL_PX).
// state.battle is a thin metadata container — no separate coord space.
// Enemies live in state.activeSpiders, bullets in state.bullets, etc.
//
// createBattleState(state, openedCellKey)   — normal room battle
// createBossBattleState(state, level)       — boss battle
// updateBattleMode(state, playerProgress, camera, dt, callbacks)
// exitBattleMode(state)                     — back to play
//
// Globals: CONFIG, WEAPON_DEFS, BOSS_DEFS (from config.js)
// ============================================================

import { keys, mouse }                    from '../core/input.js';
import { Sounds }                         from '../core/sound.js';
import {
  cellOf, cellKey, cellFromKey,
  getConnectedCells, getCellBounds,
  CELL_PX,
} from '../world/constants.js';
import { spawnRoomRewards } from '../game/collectibles.js';
import { spawnPurifyWave } from '../render/particles.js';
import { updateRevealedRoomsOnPurify } from '../game/state.js';
import { updatePlayMode, handleWeaponPickup } from './play-mode.js';

// ── Battle state creation ─────────────────────────────────────

/**
 * Start a normal room fight.
 * Adds room enemies to state.activeSpiders (world-coords).
 * Sets state.phase = 'battle'.
 *
 * @param {object} state          — play state
 * @param {string} openedCellKey  — cell key that triggered the battle
 */
export function createBattleState(state, openedCellKey) {
  const CP = CELL_PX;

  const allOpenCells = new Set([...state.openCells]);
  allOpenCells.add(openedCellKey);

  const playerCell  = cellOf(state.player.x, state.player.y);
  const playerKey   = cellKey(playerCell.x, playerCell.y);
  const battleCells = getConnectedCells(allOpenCells, playerKey);
  const { minX, minY, maxX, maxY } = getCellBounds(battleCells);

  // Compute camera zoom to fit battle region on screen
  const bCols   = maxX - minX + 1;
  const bRows   = maxY - minY + 1;
  const wallPad = CP * 0.125;
  const scaleX  = CONFIG.VIEW_W / (bCols * CP + wallPad * 2);
  const scaleY  = CONFIG.VIEW_H / (bRows * CP + wallPad * 2);
  const zoom    = Math.min(scaleX, scaleY) * CONFIG.BATTLE_ZOOM_MULTIPLIER;
  const centerX = (minX + bCols / 2) * CP;
  const centerY = (minY + bRows / 2) * CP;

  // Find room center cell for reward / content lookup
  const roomCenter    = _getRoomCenterCell(state, openedCellKey);
  const roomCenterKey = cellKey(roomCenter.x, roomCenter.y);
  const openedContent = state.cellContents.get(roomCenterKey);

  // Spawn pending room enemies into world-space
  const pendingSpawns = [];
  if (openedContent?.enemyCount && !openedContent.enemiesReleased) {
    openedContent.enemiesReleased = true;

    const enemiesToSpawn = [];
    for (let i = state.spiders.length - 1; i >= 0; i--) {
      const g = state.spiders[i];
      if (g.homeX === roomCenter.x && g.homeY === roomCenter.y) {
        enemiesToSpawn.push(g);
        state.spiders.splice(i, 1);
      }
    }

    // Collect open cells belonging to the opened room
    const roomOpenCells = [];
    const openedRoom = state.rooms?.find(r => r.cells.some(c => c.k === openedCellKey));
    if (openedRoom) {
      for (const cell of openedRoom.cells) {
        if (battleCells.has(cell.k)) {
          roomOpenCells.push(cell);
        }
      }
    }
    // Fallback to battleCells if room not found
    if (roomOpenCells.length === 0) {
      for (const k of battleCells) {
        roomOpenCells.push({ x: cellFromKey(k).x, y: cellFromKey(k).y, k });
      }
    }

    const margin = CP * 0.15;
    for (let i = 0; i < enemiesToSpawn.length; i++) {
      const g = enemiesToSpawn[i];
      const cell = roomOpenCells[Math.floor(Math.random() * roomOpenCells.length)];
      const off = CP * 0.1;
      const spawnX = cell.x * CP + margin + Math.random() * (CP - margin * 2);
      const spawnY = cell.y * CP + margin + Math.random() * (CP - margin * 2);
      pendingSpawns.push({
        enemy: _enemyCopy(g, spawnX + (Math.random() - 0.5) * off, spawnY + (Math.random() - 0.5) * off),
        spawnDelay: 1.0 + i * 0.5,
      });
    }
  }

  state.battle = {
    battleCells,
    openedCellKey,
    roomCellKey: roomCenterKey,
    isBossBattle: false,
    pendingSpawns,
    freezeTimer: state.upgrades.freeze ? 1.5 : 0,
    zoom,
    centerX,
    centerY,
  };

  // External walls are already set up for full blobCells in play mode
  // Don't re-sync them here - battleCells is a subset and would remove walls

  state.phase = 'battle';
}

/**
 * Start the boss fight.
 * Sets state.phase = 'battle'.
 *
 * @param {object} state
 * @param {number} currentLevel
 */
export function createBossBattleState(state, currentLevel) {
  const CP = CELL_PX;

  const battleCells = new Set([...state.openCells]);
  const { minX, minY, maxX, maxY } = getCellBounds(battleCells);

  const bCols   = maxX - minX + 1;
  const bRows   = maxY - minY + 1;
  const wallPad = CP * 0.125;
  const scaleX  = CONFIG.VIEW_W / (bCols * CP + wallPad * 2);
  const scaleY  = CONFIG.VIEW_H / (bRows * CP + wallPad * 2);
  const zoom    = Math.min(scaleX, scaleY) * CONFIG.BATTLE_ZOOM_MULTIPLIER;
  const centerX = (minX + bCols / 2) * CP;
  const centerY = (minY + bRows / 2) * CP;

  // Spawn boss at cell farthest from player
  const bossDef = (typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[currentLevel]) || BOSS_DEFS[1];
  let farthestCell = null, maxDist = -1;
  for (const k of battleCells) {
    const { x, y } = cellFromKey(k);
    const d = Math.hypot((x + 0.5) * CP - state.player.x, (y + 0.5) * CP - state.player.y);
    if (d > maxDist) { maxDist = d; farthestCell = { x, y }; }
  }

  const margin = CONFIG.SPIDER_RADIUS + 20;
  let bossX = centerX, bossY = centerY;
  if (farthestCell) {
    const relX = state.player.x - farthestCell.x * CP;
    const relY = state.player.y - farthestCell.y * CP;
    bossX = farthestCell.x * CP + (relX < CP / 2 ? CP - margin : margin);
    bossY = farthestCell.y * CP + (relY < CP / 2 ? CP - margin : margin);
  }

  const bossHp = bossDef.hp !== undefined
    ? bossDef.hp
    : (bossDef.hpBase === 'buldyga' ? CONFIG.BULDYGA_HP : CONFIG.SPIDER_HP) * (bossDef.hpMult || 1);

  state.activeSpiders.push({
    x: bossX, y: bossY, vx: 0, vy: 0,
    radius: CONFIG.SPIDER_RADIUS * (bossDef.radiusMult || 1),
    hp: bossHp, maxHp: bossHp,
    type: bossDef.type || 'boss_phase', isBoss: true,
    shootCd: 0, state: 'chase', stateTimer: 0,
    dashTargetX: 0, dashTargetY: 0,
    dashDirX: 0, dashDirY: 0, dashDistance: 0,
    currentSpeed: undefined, speedAccumulator: 0,
    stunTimer: 0, hitFlash: 0,
    phaseIndex: 0,
    phaseTimer: bossDef.phases?.[0]?.duration ?? 0,
    strafeDir: 1,
    strafeSwitchTimer: CONFIG.BOSS_STRAFE_SWITCH_TIME,
    dashCount: 0,
    bullState: 'chase', bullStateTimer: 0,
    bullDashDirX: 0, bullDashDirY: 0, bullDashDistance: 0,
  });

  state.battle = {
    battleCells,
    openedCellKey: null,
    roomCellKey: null,
    isBossBattle: true,
    pendingSpawns: [],
    freezeTimer: state.upgrades.freeze ? 1.5 : 0,
    zoom,
    centerX,
    centerY,
  };

  // External walls are already set up for full blobCells in play mode
  // Don't re-sync them here - battleCells is a subset and would remove walls

  state.bossSummonReady = false;
  state.phase = 'battle';
}

// ── Per-frame update ──────────────────────────────────────────

/**
 * Update everything in the battle phase.
 * Delegates most logic to updatePlayMode with isBattle=true.
 *
 * @param {object} state
 * @param {object} playerProgress
 * @param {import('../render/camera.js').Camera} camera
 * @param {number} dt
 * @param {object} callbacks — { onBattleWon, onPlayerDead, currentLevel }
 */
export function updateBattleMode(state, playerProgress, camera, dt, callbacks = {}) {
  if (state.phase !== 'battle') return;

  const { onBattleWon } = callbacks;

  // Run shared game logic via play-mode update
  updatePlayMode(state, playerProgress, camera, dt, callbacks, { isBattle: true });

  // Win check
  const b = state.battle;
  if (b.pendingSpawns.length === 0 && state.activeSpiders.length === 0) {
    if (onBattleWon) onBattleWon(state, playerProgress);
  }
}

/**
 * End the battle and return to play phase.
 *
 * @param {object} state
 */
export function exitBattleMode(state) {
  if (!state.battle) return;
  const b = state.battle;

  // Spawn room rewards
  if (b.roomCellKey) {
    spawnRoomRewards(state, b.roomCellKey);
  }

  // Mark room as purified after battle victory
  let purifiedRoomIdx = null;
  if (b.roomCellKey && state.rooms && state.purified) {
    for (let i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].cells.some(c => c.k === b.roomCellKey)) {
        state.purified.add(i);
        purifiedRoomIdx = i;
        break;
      }
    }
  }

  // Reveal adjacent rooms when a room becomes purified
  if (purifiedRoomIdx !== null) {
    updateRevealedRoomsOnPurify(state, purifiedRoomIdx);

    // Purify wave from altar position or room geometric center
    const room = state.rooms[purifiedRoomIdx];
    if (!state.purifyWaveFired?.has(purifiedRoomIdx)) {
      state.purifyWaveFired?.add(purifiedRoomIdx);
      const altar = state.roomAltars?.find(a => a.roomIdx === purifiedRoomIdx);
      let ox, oy;
      if (altar) {
        ox = altar.x;
        oy = altar.y;
      } else {
        // Geometric center of room cells
        let sx = 0, sy = 0;
        for (const c of room.cells) { sx += (c.x + 0.5) * CELL_PX; sy += (c.y + 0.5) * CELL_PX; }
        ox = sx / room.cells.length;
        oy = sy / room.cells.length;
      }
      spawnPurifyWave(state.particles, ox, oy, room.cells, CELL_PX);
    }
  }

  // If boss was defeated, open exit cell
  if (state.bossDefeated && state.exitCell) {
    const ek = cellKey(state.exitCell.x, state.exitCell.y);
    state.openCells.add(ek);
    state.everRevealedCells.add(ek);
    state.everOpenedCells.add(ek);
  }

  state.battle = null;
  state.phase  = 'play';
}

// ── Internal helpers ──────────────────────────────────────────

function _getRoomCenterCell(state, ck) {
  if (!state.rooms?.length) return cellFromKey(ck);
  for (const room of state.rooms) {
    if (!room.cells.some(c => c.k === ck)) continue;
    let sx = 0, sy = 0;
    for (const c of room.cells) { sx += c.x; sy += c.y; }
    return {
      x: Math.floor(sx / room.cells.length + 0.5),
      y: Math.floor(sy / room.cells.length + 0.5),
    };
  }
  return cellFromKey(ck);
}

function _enemyCopy(g, bx, by) {
  const isPlevaka = g.type === 'plevaka' || g.type === 'shooter';
  const isBat = g.type === 'bat';
  return {
    x: bx, y: by, vx: 0, vy: 0,
    hp: g.hp, maxHp: g.maxHp,
    type: g.type, phase: g.phase, wobble: g.wobble,
    shootCd: g.shootCd || 0,
    radius: g.radius, visualScale: g.visualScale,
    state: g.state, stateTimer: g.stateTimer,
    dashTargetX: g.dashTargetX, dashTargetY: g.dashTargetY,
    dashDirX: g.dashDirX, dashDirY: g.dashDirY,
    dashDistance: g.dashDistance,
    currentSpeed: g.currentSpeed, speedAccumulator: g.speedAccumulator,
    stunTimer: g.stunTimer || 0, hitFlash: 0,
    animState: isPlevaka ? (g.animState || 'idle') : (isBat ? (g.animState || 'fly') : null),
    animFrame: (isPlevaka || isBat) ? (g.animFrame || 0) : null,
    animTimer: (isPlevaka || isBat) ? (g.animTimer || 0) : null,
  };
}


