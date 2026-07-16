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
  CELL_PX, cellOf,
} from '../world/constants.js';
import { updatePlayMode } from './play-mode.js';
import { app } from '../core/app.js';

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

  const battleCells = new Set([...state.openCells]);

  // Compute camera zoom to fit openRect on screen
  const r = state.openRect;
  const bCols   = (r.maxX - r.minX) / CP;
  const bRows   = (r.maxY - r.minY) / CP;
  const wallPad = CP * 0.125;
  const scaleX  = CONFIG.VIEW_W / (bCols * CP + wallPad * 2);
  const scaleY  = CONFIG.VIEW_H / (bRows * CP + wallPad * 2);
  const zoom    = Math.min(scaleX, scaleY) * CONFIG.CAMERA.battleZoomMult;
  const centerX = (r.minX + r.maxX) / 2;
  const centerY = (r.minY + r.maxY) / 2;

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
    freezeTimer: state.upgrades.freeze ? 1 : 0,
    zoom,
    centerX,
    centerY,
  };

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
  const r = state.openRect;
  const bCols   = (r.maxX - r.minX) / CP;
  const bRows   = (r.maxY - r.minY) / CP;
  const wallPad = CP * 0.125;
  const scaleX  = CONFIG.VIEW_W / (bCols * CP + wallPad * 2);
  const scaleY  = CONFIG.VIEW_H / (bRows * CP + wallPad * 2);
  const zoom    = Math.min(scaleX, scaleY) * CONFIG.CAMERA.battleZoomMult;
  const centerX = (r.minX + r.maxX) / 2;
  const centerY = (r.minY + r.maxY) / 2;

  // Activate stasis boss (already spawned by spawnBattleCycle)
  for (const g of state.activeSpiders) {
    if (g.stasis && g.isBoss) {
      g.stasis = false;
    }
  }

  state.battle = {
    battleCells,
    openedCellKey: null,
    roomCellKey: null,
    isBossBattle: true,
    pendingSpawns: [],
    freezeTimer: 0,
    zoom,
    centerX,
    centerY,
  };

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

  // Custom crosshair cursor (battle mode skips _updateCursor in play-mode)
  if (app?.canvas) app.canvas.style.cursor = "url('img/crosshairs_white.png') 4 4, crosshair";

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
