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

const H             = CONFIG.WALL_3D_HEIGHT;  // wall height in world-pixels
const CAM_Z         = CONFIG.WALL_3D_CAM_Z;   // virtual camera altitude — higher = weaker perspective
const CAP_DZ        = H * 0.18;               // extra Z for top-cap edge
const CAM_THRESHOLD = 0.5;                    // min camera movement (px) to trigger redraw

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

  // Painter's algorithm: sort far→near so closer walls draw on top
  const sorted = _segments
    .filter(s => !s.isRemoved)
    .map(s => {
      let cx = 0, cy = 0;
      for (const v of s.verts) { cx += v.x; cy += v.y; }
      cx /= s.verts.length; cy /= s.verts.length;
      const dx = camX - cx, dy = camY - cy;
      return { seg: s, dist2: dx * dx + dy * dy };
    })
    .sort((a, b) => b.dist2 - a.dist2);

  for (const { seg } of sorted) {
    const { verts, edgeNormals } = seg;
    const n = verts.length;

    // ── Side faces ───────────────────────────────────
    for (let i = 0; i < n; i++) {
      const en = edgeNormals[i];
      const b1 = verts[i];
      const b2 = verts[(i + 1) % n];

      // Face midpoint for dot-product culling
      const mx = (b1.x + b2.x) / 2;
      const my = (b1.y + b2.y) / 2;
      const dot = (camX - mx) * en.nx + (camY - my) * en.ny;
      if (dot <= 0) continue; // back-face, skip

      const t1 = _project(b1.x, b1.y, H, camX, camY);
      const t2 = _project(b2.x, b2.y, H, camX, camY);

      _gSide
        .poly([
          b1.x, b1.y,
          b2.x, b2.y,
          t2.x, t2.y,
          t1.x, t1.y,
        ])
        .fill({ color: en.color, alpha: en.alpha })
        .stroke({ color: en.strokeColor, alpha: en.strokeAlpha, width: 0.5 });
    }

    // ── Top cap: project all verts at wz=H ────────────────
    const topPts = [];
    for (let i = 0; i < n; i++) {
      const t = _project(verts[i].x, verts[i].y, H, camX, camY);
      topPts.push(t.x, t.y);
    }
    const en0 = edgeNormals[0];
    _gCap
      .poly(topPts)
      .fill({ color: en0.capColor, alpha: en0.capAlpha });
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
