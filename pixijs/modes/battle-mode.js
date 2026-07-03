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
  cellKey, cellFromKey,
  getConnectedCells, getCellBounds,
  CELL_PX, cellOf,
} from '../world/constants.js';
import { spawnRoomRewards } from '../game/collectibles.js';
import { spawnPurifyWave } from '../render/particles.js';
import { updateRevealedRoomsOnPurify } from '../game/state.js';
import { updatePlayMode, handleWeaponPickup } from './play-mode.js';
import { EnemyFactory } from '../game/enemy-factory.js';

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
  const zoom    = Math.min(scaleX, scaleY) * CONFIG.CAMERA.battleZoomMult;
  const centerX = (minX + bCols / 2) * CP;
  const centerY = (minY + bRows / 2) * CP;

  // Find room center cell for reward / content lookup
  const roomCenter    = _getRoomCenterCell(state, openedCellKey);
  const roomCenterKey = cellKey(roomCenter.x, roomCenter.y);
  console.log('Battle triggered for cell:', openedCellKey, 'Room center:', roomCenterKey);
  const openedContent = state.cellContents.get(roomCenterKey);

  // Activate stasis enemies in all connected rooms
  const pendingSpawns = [];

  // Mark enemiesReleased for ALL cells in battleCells that have enemy content
  for (const k of battleCells) {
    const content = state.cellContents.get(k);
    if (content && content.enemyCount && content.enemyCount > 0) {
      content.enemiesReleased = true;
    }
  }

  // Unset stasis for all enemies in all connected open rooms
  for (const g of state.activeSpiders) {
    if (!g.stasis) continue;
    const gc = cellOf(g.x, g.y);
    const gk = cellKey(gc.x, gc.y);
    if (battleCells.has(gk)) {
      g.stasis = false;
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
  const zoom    = Math.min(scaleX, scaleY) * CONFIG.CAMERA.battleZoomMult;
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

  const margin = CONFIG.ENEMY_STATS.spider.radius + 20;
  let bossX = centerX, bossY = centerY;
  if (farthestCell) {
    const relX = state.player.x - farthestCell.x * CP;
    const relY = state.player.y - farthestCell.y * CP;
    bossX = farthestCell.x * CP + (relX < CP / 2 ? CP - margin : margin);
    bossY = farthestCell.y * CP + (relY < CP / 2 ? CP - margin : margin);
  }

  const bossHp = bossDef.hp !== undefined
    ? bossDef.hp
    : (bossDef.hpBase === 'buldyga' ? CONFIG.ENEMY_STATS.buldyga.hp : CONFIG.ENEMY_STATS.spider.hp) * (bossDef.hpMult || 1);

  state.activeSpiders.push(EnemyFactory.create(bossDef.type || 'boss_phase', bossX, bossY, {
    level: currentLevel,
    hp: bossHp,
    maxHp: bossHp,
    radius: CONFIG.ENEMY_STATS.spider.radius * (bossDef.radiusMult || 1),
    isBoss: true,
    phaseIndex: 0,
    phaseTimer: bossDef.phases?.[0]?.duration ?? 0,
  }));

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
  if (b.pendingSpawns.length === 0 && state.activeSpiders.filter(g => !g.stasis).length === 0) {
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

  // Spawn rewards + purify ALL rooms that had enemies in battleCells
  if (b.battleCells && state.rooms && state.purified) {
    for (let ri = 0; ri < state.rooms.length; ri++) {
      const room = state.rooms[ri];
      const hasEnemyContent = room.cells.some(c => {
        const content = state.cellContents.get(c.k);
        return content && content.enemyCount && content.enemyCount > 0;
      });
      if (!hasEnemyContent) continue;
      const inBattle = room.cells.some(c => b.battleCells.has(c.k));
      if (!inBattle) continue;
      if (state.purified.has(ri)) continue;

      // Spawn rewards for this room
      spawnRoomRewards(state, room.cells[0].k);

      // Mark as purified
      state.purified.add(ri);

      // Reveal adjacent rooms
      updateRevealedRoomsOnPurify(state, ri);

      // Purify wave
      if (!state.purifyWaveFired?.has(ri)) {
        state.purifyWaveFired?.add(ri);
        const altar = state.roomAltars?.find(a => a.roomIdx === ri);
        let ox, oy;
        if (altar) {
          ox = altar.x;
          oy = altar.y;
        } else {
          let sx = 0, sy = 0;
          for (const c of room.cells) { sx += (c.x + 0.5) * CELL_PX; sy += (c.y + 0.5) * CELL_PX; }
          ox = sx / room.cells.length;
          oy = sy / room.cells.length;
        }
        spawnPurifyWave(state.particles, ox, oy, room.cells, CELL_PX);
      }
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
  const copy = EnemyFactory.create(g.type, bx, by, g);
  copy.stuckTimer = 0;
  copy.lastX = bx;
  copy.lastY = by;
  return copy;
}


