// ============================================================
// TRANSITIONS — zoom-in / zoom-out animations
//
// startZoomIn(state, camera, targetCellKey, isBoss)
//   Call when an altar is activated: animates zoom from play
//   view → battle scale, then calls onComplete with the cellKey.
//
// startZoomOut(state, camera)
//   Call when a battle is won: animates zoom from battle scale
//   back to play view, then calls onComplete.
//
// updateTransition(dt, camera, onComplete)
//   Advance the active transition; call every frame while
//   state.phase === 'zoom_in' or 'zoom_out'.
//
// Globals: CONFIG (from config.js)
// ============================================================

import { easeInOutQuad } from '../world/constants.js';
import { Sounds }        from '../core/sound.js';

// Active transition state (null = idle)
let _transition = null;

// Duration of each zoom animation in seconds
const ZOOM_DURATION = 0.55;

// ── Public API ────────────────────────────────────────────────

/**
 * Start the zoom-in animation (play → battle scale).
 *
 * @param {object}  state
 * @param {import('../render/camera.js').Camera} camera
 * @param {string|null}  pendingCellKey — null for boss battle
 * @param {boolean} isBoss
 */
export function startZoomIn(state, camera, pendingCellKey, isBoss = false) {
  const CP = CONFIG.CELL_PX;
  const VW = CONFIG.VIEW_W;
  const VH = CONFIG.VIEW_H;

  // Determine battle area bounds (rough — from openCells + pending cell)
  const { bCols, bRows, bCenterX, bCenterY } = _battleBounds(state, pendingCellKey, CP);

  // Target zoom: fit battle region in world-coords (no BATTLE_SCALE)
  const wallPad = CP * 0.125;
  const scaleX  = VW / (bCols * CP + wallPad * 2);
  const scaleY  = VH / (bRows * CP + wallPad * 2);
  const toZoom  = Math.min(scaleX, scaleY);

  _transition = {
    type:         'zoom_in',
    fromZoom:     camera.zoom,
    toZoom,
    fromWorldX:   camera.worldX,
    fromWorldY:   camera.worldY,
    toWorldX:     bCenterX,
    toWorldY:     bCenterY,
    t:            0,
    duration:     ZOOM_DURATION,
    pendingCellKey,
    isBoss,
  };

  state.phase = 'zoom_in';
  Sounds.zoom?.();
}

/**
 * Start the zoom-out animation (battle scale → play view).
 *
 * @param {object}  state
 * @param {import('../render/camera.js').Camera} camera
 */
export function startZoomOut(state, camera) {
  if (!state.battle) return;

  _transition = {
    type:       'zoom_out',
    fromZoom:   camera.zoom,
    toZoom:     CONFIG.CAMERA.playZoom,
    fromWorldX: camera.worldX,
    fromWorldY: camera.worldY,
    toWorldX:   state.player.x,
    toWorldY:   state.player.y,
    t:          0,
    duration:   ZOOM_DURATION,
  };

  state.phase = 'zoom_out';
  Sounds.zoom?.();
}

/**
 * Advance the current transition.
 * Call every frame while state.phase is 'zoom_in' or 'zoom_out'.
 *
 * @param {number}   dt
 * @param {import('../render/camera.js').Camera} camera
 * @param {function} onComplete — called with (transition) when done
 */
export function updateTransition(dt, camera, onComplete) {
  if (!_transition) return;

  const tr = _transition;
  tr.t = Math.min(1, tr.t + dt / tr.duration);
  const ease = easeInOutQuad(tr.t);

  const zoom   = tr.fromZoom  + (tr.toZoom   - tr.fromZoom)  * ease;
  const worldX = tr.fromWorldX + (tr.toWorldX - tr.fromWorldX) * ease;
  const worldY = tr.fromWorldY + (tr.toWorldY - tr.fromWorldY) * ease;

  camera.setZoom(zoom, worldX, worldY);

  if (tr.t >= 1) {
    const completed = _transition;
    _transition = null;
    if (onComplete) onComplete(completed);
  }
}

// ── Private helpers ───────────────────────────────────────────

function _battleBounds(state, pendingCellKey, CP) {
  const openCells = new Set([...state.openCells]);
  if (pendingCellKey) openCells.add(pendingCellKey);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of openCells) {
    const [x, y] = k.split(',').map(Number);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

  const bCols   = maxX - minX + 1;
  const bRows   = maxY - minY + 1;
  const bCenterX = (minX + bCols / 2) * CP;
  const bCenterY = (minY + bRows / 2) * CP;

  return { bCols, bRows, bCenterX, bCenterY };
}
