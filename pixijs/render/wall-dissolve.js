// ============================================================
// WALL-DISSOLVE — noise-based dissolve animation for opening walls
//
// Usage:
//   startWallDissolve(wallKey, container)  — call when wall opens
//   updateWallDissolve(dt, camX, camY)     — call every frame
//   destroyWallDissolve()                  — cleanup
// ============================================================

import { Container, Filter, Graphics, Mesh, MeshGeometry } from 'pixi.js';
import {
  projectPoint, WALL_H, WALL_CAM_Z, U_TILES, V_TILES,
  getSegments, getTextures, getDissolveLayer,
} from './wall-3d.js';

const DISSOLVE_VERT = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

const DISSOLVE_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uThreshold;
uniform float uNoiseScale;
uniform float uDistScale;
uniform float uDistWeight;
uniform float uFadeStart;
uniform float uFadeEnd;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  if (color.a < 0.01) discard;

  float n = noise(vTextureCoord * uNoiseScale);
  float dist = length(vTextureCoord - vec2(0.5)) * uDistScale;
  float edge = uThreshold - dist * uDistWeight;
  if (n < edge) discard;

  float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, uThreshold);
  finalColor = color * fade;
}
`;

// Build one face quad Mesh for dissolve container (same logic as wall-3d.js)
function _buildFaceMesh(b1, b2, t1, t2, tex, alpha) {
  const geom = new MeshGeometry({
    positions: new Float32Array([
      b1.x, b1.y,
      b2.x, b2.y,
      t2.x, t2.y,
      t1.x, t1.y,
    ]),
    uvs: new Float32Array([
      0,       V_TILES,
      U_TILES, V_TILES,
      U_TILES, 0,
      0,       0,
    ]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
  const mesh = new Mesh({ geometry: geom, texture: tex });
  mesh.alpha = alpha;
  return mesh;
}

// Build top-cap Graphics for dissolve container
function _buildCapGraphics(verts, camX, camY, capColor, capAlpha) {
  const g = new Graphics();
  const topPts = [];
  for (const v of verts) {
    const t = projectPoint(v.x, v.y, WALL_H, camX, camY);
    topPts.push(t.x, t.y);
  }
  g.poly(topPts).fill({ color: capColor, alpha: capAlpha });
  return g;
}

// ── Module state ──────────────────────────────────────────────
const _anims   = new Map();  // wallKey → { container, filter, t, duration }
let   _layer   = null;       // layers.walls3d reference

// ── Public API ────────────────────────────────────────────────

export function initWallDissolve(wallsLayer) {
  _layer = wallsLayer;
  _anims.clear();
}

/**
 * Kick off a dissolve animation for the wall identified by wallKey.
 * Snaps the current 3D geometry of that segment into a temporary Container,
 * applies the DissolveFilter, and animates it to completion.
 */
export function startWallDissolve(wk, camX, camY) {
  if (!_layer) return;

  const segments = getSegments();
  if (!segments) return;

  // Find the segment matching this wallKey
  const seg = segments.find(s => s.wk === wk);
  if (!seg) return;

  // If already animating this wall, restart
  if (_anims.has(wk)) {
    const old = _anims.get(wk);
    old.container.destroy({ children: true });
    _anims.delete(wk);
  }

  const { wallTex, wallTexDark } = getTextures();
  const { verts, edgeNormals } = seg;
  const n = verts.length;

  const container = new Container({ label: `dissolve-${wk}` });

  // Build face meshes for all edges (same as updateWall3D but all faces, not culled)
  for (let i = 0; i < n; i++) {
    const en = edgeNormals[i];

    // Back-face cull based on current camera
    const b1 = verts[i];
    const b2 = verts[(i + 1) % n];
    const mx = (b1.x + b2.x) / 2;
    const my = (b1.y + b2.y) / 2;
    const dot = (camX - mx) * en.nx + (camY - my) * en.ny;
    if (dot <= 0) continue;

    const t1 = projectPoint(b1.x, b1.y, WALL_H, camX, camY);
    const t2 = projectPoint(b2.x, b2.y, WALL_H, camX, camY);

    const faceTex = (en.isPurifiedSide ? wallTex : wallTexDark) ?? wallTex ?? wallTexDark;
    if (faceTex) {
      container.addChild(_buildFaceMesh(b1, b2, t1, t2, faceTex, en.alpha));
    } else {
      const g = new Graphics();
      g.poly([b1.x, b1.y, b2.x, b2.y, t2.x, t2.y, t1.x, t1.y])
        .fill({ color: en.color, alpha: en.alpha });
      container.addChild(g);
    }
  }

  // Top cap
  const en0 = edgeNormals[0];
  container.addChild(_buildCapGraphics(verts, camX, camY, en0.capColor, en0.capAlpha));

  // Dissolve filter
  const filter = Filter.from({
    gl: { vertex: DISSOLVE_VERT, fragment: DISSOLVE_FRAG },
    resources: {
      dissolveUniforms: {
        uThreshold:   { value: 0.0,                                  type: 'f32' },
        uNoiseScale:  { value: CONFIG.WALL_DISSOLVE_NOISE_SCALE,     type: 'f32' },
        uDistScale:   { value: CONFIG.WALL_DISSOLVE_DIST_SCALE,      type: 'f32' },
        uDistWeight:  { value: CONFIG.WALL_DISSOLVE_DIST_WEIGHT,     type: 'f32' },
        uFadeStart:   { value: CONFIG.WALL_DISSOLVE_FADE_START,      type: 'f32' },
        uFadeEnd:     { value: CONFIG.WALL_DISSOLVE_FADE_END,        type: 'f32' },
      },
    },
  });
  container.filters = [filter];

  const dl = getDissolveLayer();
  if (dl) dl.addChild(container);
  else _layer.addChild(container);
  _anims.set(wk, {
    container,
    filter,
    t:        0,
    duration: CONFIG.WALL_DISSOLVE_DURATION,
    fadeEnd:  CONFIG.WALL_DISSOLVE_FADE_END,
  });
}

/**
 * Advance all active dissolve animations.
 * Call every frame from _render().
 */
export function updateWallDissolve(dt) {
  if (_anims.size === 0) return;

  for (const [wk, anim] of _anims) {
    anim.t += dt;
    const progress = Math.min(anim.t / anim.duration, 1.0);
    anim.filter.resources.dissolveUniforms.uniforms.uThreshold = progress * anim.fadeEnd;

    if (anim.t >= anim.duration) {
      anim.container.destroy({ children: true });
      _anims.delete(wk);
    }
  }
}

export function destroyWallDissolve() {
  for (const anim of _anims.values()) {
    if (!anim.container.destroyed) anim.container.destroy({ children: true });
  }
  _anims.clear();
  const dl = getDissolveLayer();
  if (dl && !dl.destroyed) dl.destroy({ children: true });
  _layer = null;
}
