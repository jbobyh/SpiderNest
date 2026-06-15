// ============================================================
// AUTOSAVE — periodic save during the game loop.
//
// startAutosave(opts)  — begin interval saves
// stopAutosave()       — stop interval
// tickAutosave(dt)     — call each frame (seconds)
//
// Re-exports from game/state.js for convenience:
//   hasSave, loadGame, deleteSave
// ============================================================

export { hasSave, loadGame, deleteSave } from '../game/state.js';
import { saveGame } from '../game/state.js';

const DEFAULT_INTERVAL_S = 30;

let _timer    = 0;
let _interval = DEFAULT_INTERVAL_S;
let _getState    = null;
let _getLevel    = null;
let _getProgress = null;

/**
 * Begin periodic autosaves.
 *
 * @param {object}        opts
 * @param {()=>object}    opts.getState    — returns current game state
 * @param {()=>number}    opts.getLevel    — returns current level
 * @param {()=>object}    opts.getProgress — returns playerProgress
 * @param {number}        [opts.interval]  — seconds between saves (default 30)
 */
export function startAutosave({ getState, getLevel, getProgress, interval = DEFAULT_INTERVAL_S } = {}) {
  _getState    = getState;
  _getLevel    = getLevel;
  _getProgress = getProgress;
  _interval    = interval;
  _timer       = interval; // first save after one full interval
}

export function stopAutosave() {
  _getState    = null;
  _getLevel    = null;
  _getProgress = null;
  _timer       = 0;
}

/**
 * Advance autosave timer. Call every frame from the game loop.
 * @param {number} dt — delta time in seconds
 */
export function tickAutosave(dt) {
  if (!_getState) return;
  _timer -= dt;
  if (_timer <= 0) {
    _timer = _interval;
    _doSave();
  }
}

function _doSave() {
  try {
    const state    = _getState?.();
    const level    = _getLevel?.();
    const progress = _getProgress?.();
    if (!state || !progress) return;
    if (state.phase === 'dead' || state.phase === 'win') return;
    saveGame(state, level, progress);
  } catch (e) {
    console.warn('[AutoSave] failed:', e);
  }
}
