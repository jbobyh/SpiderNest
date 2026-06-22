// ============================================================
// WALL-3D — pseudo-3D wall face renderer
//
// Each wall segment is a line on the floor plane with two possible
// normals. Per frame (when camera moves), the face whose normal
// points toward the camera is drawn as a vertical quad.
//
// Usage:
//   initWall3D(layers.walls3d, segments, camX, camY)
//   updateWall3D(camX, camY)   — call every frame; skips if cam unchanged
//   destroyWall3D()
// ============================================================

import { Graphics } from 'pixi.js';
import { CELL_PX }  from '../world/constants.js';

const H             = CELL_PX / 3;  // wall height in world-pixels
const CAM_Z         = CELL_PX * 6;   // virtual camera altitude — higher = weaker perspective
const CAP_DZ        = H * 0.18;      // extra Z for top-cap edge
const CAM_THRESHOLD = 0.5;           // min camera movement (px) to trigger redraw

// Project a 3D world point (wx, wy, wz) onto the 2D world plane.
// Floor (wz=0) stays in place; higher points push away from the camera.
function _project(wx, wy, wz, camX, camY) {
  const f = (CAM_Z + wz) / CAM_Z;
  return { x: camX + (wx - camX) * f, y: camY + (wy - camY) * f };
}

// ── Module state ──────────────────────────────────────────────
let _container  = null;
let _segments   = null;
let _gSide      = null;
let _gCap       = null;
let _lastCamX   = null;
let _lastCamY   = null;

// ── Public API ────────────────────────────────────────────────

/**
 * Initialise (or reinitialise) the 3D wall renderer.
 * @param {import('pixi.js').Container} container — layers.walls3d
 * @param {Array} segments — from extractWallSegments()
 * @param {number} camX — current camera world X
 * @param {number} camY — current camera world Y
 */
export function initWall3D(container, segments, camX, camY) {
  destroyWall3D();

  _container = container;
  _segments  = segments;
  _gSide     = new Graphics();
  _gCap      = new Graphics();
  _container.addChild(_gSide, _gCap);

  _lastCamX = null;
  _lastCamY = null;
  updateWall3D(camX ?? 0, camY ?? 0);
}

/**
 * Redraw wall faces for the given camera world position.
 * No-op if camera hasn't moved since last call.
 * @param {number} camX
 * @param {number} camY
 */
export function updateWall3D(camX, camY) {
  if (!_gSide || !_segments) return;
  if (_lastCamX !== null &&
      Math.abs(camX - _lastCamX) < CAM_THRESHOLD &&
      Math.abs(camY - _lastCamY) < CAM_THRESHOLD) return;

  _lastCamX = camX;
  _lastCamY = camY;

  _gSide.clear();
  _gCap.clear();

  for (const seg of _segments) {
    const { x1, y1, x2, y2, normals } = seg;

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    // Pick the normal facing the camera (positive dot product)
    let chosen = null;
    for (const n of normals) {
      const dot = (camX - mx) * n.nx + (camY - my) * n.ny;
      if (dot > 0) { chosen = n; break; }
    }
    if (!chosen) continue; // edge-on or behind — skip

    // Project top vertices toward the camera using perspective
    const t1 = _project(x1, y1, H, camX, camY);
    const t2 = _project(x2, y2, H, camX, camY);

    // Side face quad: floor base → projected top
    _gSide
      .poly([
        x1,    y1,
        x2,    y2,
        t2.x,  t2.y,
        t1.x,  t1.y,
      ])
      .fill({ color: chosen.color, alpha: chosen.alpha })
      .stroke({ color: chosen.strokeColor, alpha: chosen.strokeAlpha, width: 0.5 });

    // Top cap — project a slightly higher Z for the far edge
    const t1c = _project(x1, y1, H + CAP_DZ, camX, camY);
    const t2c = _project(x2, y2, H + CAP_DZ, camX, camY);
    _gCap
      .poly([
        t1.x,  t1.y,
        t2.x,  t2.y,
        t2c.x, t2c.y,
        t1c.x, t1c.y,
      ])
      .fill({ color: chosen.capColor, alpha: chosen.capAlpha });
  }
}

/**
 * Destroy Graphics objects and reset module state.
 */
export function destroyWall3D() {
  if (_gSide)  { _gSide.destroy();  _gSide  = null; }
  if (_gCap)   { _gCap.destroy();   _gCap   = null; }
  _container = null;
  _segments  = null;
  _lastCamX  = null;
  _lastCamY  = null;
}
