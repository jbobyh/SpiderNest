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

import { Assets, Container, Graphics, Mesh, MeshGeometry } from 'pixi.js';
import { CELL_PX, FLOOR_TILES_PER_CELL } from '../world/constants.js';

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

const U_TILES = FLOOR_TILES_PER_CELL;                    // texture repeats across wall width
const V_TILES = H * FLOOR_TILES_PER_CELL / CELL_PX;     // texture repeats across wall height

// ── Module state ──────────────────────────────────────────────
let _container      = null;
let _segments       = null;
let _meshContainer  = null;
let _gCap           = null;
let _dissolveLayer  = null;
let _wallTex        = null;
let _wallTexDark    = null;
let _lastCamX       = null;
let _lastCamY       = null;

// ── Public API ────────────────────────────────────────────────

/**
 * Initialise (or reinitialise) the 3D wall renderer.
 * @param {import('pixi.js').Container} container — layers.walls3d
 * @param {Array} segments — from extractWallSegments()
 * @param {number} camX — current camera world X
 * @param {number} camY — current camera world Y
 */
export function initWall3D(container, segments, camX, camY) {
  // Preserve dissolve layer across reinits so in-flight animations survive
  const prevDissolveLayer = _dissolveLayer;
  const prevContainer     = _container;
  destroyWall3D();

  _container     = container;
  _segments      = segments;
  _meshContainer = new Container({ label: 'wall-meshes' });
  _gCap          = new Graphics();

  if (prevDissolveLayer && !prevDissolveLayer.destroyed && prevContainer === container) {
    // Reuse existing dissolve layer — keep its children (active anims)
    _dissolveLayer = prevDissolveLayer;
    _container.addChild(_meshContainer, _gCap);
    // Ensure dissolve layer is last
    if (_dissolveLayer.parent !== _container) _container.addChild(_dissolveLayer);
    else _container.setChildIndex(_dissolveLayer, _container.children.length - 1);
  } else {
    _dissolveLayer = new Container({ label: 'wall-dissolve' });
    _container.addChild(_meshContainer, _gCap, _dissolveLayer);
  }

  // Get textures and enable repeat wrapping
  _wallTex = Assets.get('wall-3d-side');
  if (_wallTex) _wallTex.source.wrapMode = 'repeat';
  _wallTexDark = Assets.get('wall-3d-side-dark');
  if (_wallTexDark) _wallTexDark.source.wrapMode = 'repeat';

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
  if (!_meshContainer || !_segments) return;
  if (_lastCamX !== null &&
      Math.abs(camX - _lastCamX) < CAM_THRESHOLD &&
      Math.abs(camY - _lastCamY) < CAM_THRESHOLD) return;

  _lastCamX = camX;
  _lastCamY = camY;

  // Destroy old face meshes
  _meshContainer.removeChildren().forEach(m => m.destroy());
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

      const faceTex = (en.isPurifiedSide ? _wallTex : _wallTexDark) ?? _wallTex ?? _wallTexDark;
      if (faceTex) {
        // Textured face via Mesh
        const geom = new MeshGeometry({
          positions: new Float32Array([
            b1.x, b1.y,   // 0 bottom-left
            b2.x, b2.y,   // 1 bottom-right
            t2.x, t2.y,   // 2 top-right
            t1.x, t1.y,   // 3 top-left
          ]),
          uvs: new Float32Array([
            0,       V_TILES,   // 0 bottom-left
            U_TILES, V_TILES,   // 1 bottom-right
            U_TILES, 0,         // 2 top-right
            0,       0,         // 3 top-left
          ]),
          indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
        });
        const mesh = new Mesh({ geometry: geom, texture: faceTex });
        mesh.alpha = en.alpha;
        _meshContainer.addChild(mesh);
      } else {
        // Fallback: solid color Graphics
        _gCap
          .poly([b1.x, b1.y, b2.x, b2.y, t2.x, t2.y, t1.x, t1.y])
          .fill({ color: en.color, alpha: en.alpha })
          .stroke({ color: en.strokeColor, alpha: en.strokeAlpha, width: 0.5 });
      }
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

export function getSegments()     { return _segments; }
export function getTextures()     { return { wallTex: _wallTex, wallTexDark: _wallTexDark }; }
export function getDissolveLayer() { return _dissolveLayer; }
export { _project as projectPoint, H as WALL_H, CAM_Z as WALL_CAM_Z, U_TILES, V_TILES };

/**
 * Destroy Graphics objects and reset module state.
 */
export function destroyWall3D() {
  if (_meshContainer) { _meshContainer.destroy({ children: true }); _meshContainer = null; }
  if (_gCap)          { _gCap.destroy();                            _gCap          = null; }
  // _dissolveLayer is intentionally NOT destroyed here — initWall3D preserves it across reinits
  _container = null;
  _segments  = null;
  _wallTex     = null;
  _wallTexDark = null;
  _lastCamX  = null;
  _lastCamY  = null;
}
