// ============================================================
// PARTICLES — ParticleContainer-backed particle system
//
// initParticles(layer)          — create ParticleContainer and dot texture
// syncParticles(stateParticles) — sync to state.particles array each frame
// clearParticles()              — remove all active particles
//
// State particle shape: { x, y, vx, vy, life, maxLife, color: '#rrggbb' }
// Physics (vx/vy) is advanced by game logic; this module only renders.
//
// Globals: CONFIG (from config.js)
// ============================================================

import { ParticleContainer, Particle, Graphics, Rectangle } from 'pixi.js';
import { app } from '../core/app.js';

let _container  = null;
let _dotTexture = null;

// Pool of idle Particle objects to avoid GC pressure
const _pool = [];
// Currently active Particle objects (parallel to last synced stateParticles)
const _active = [];

// ── Public API ────────────────────────────────────────────────

/**
 * Create the ParticleContainer and white dot texture.
 * Must be called after initApp() so app.renderer is available.
 * @param {import('pixi.js').Container} particlesLayer
 */
export function initParticles(particlesLayer) {
  _dotTexture = _createDotTexture(1.5);

  _container = new ParticleContainer({
    texture: _dotTexture,
    boundsArea: new Rectangle(0, 0, CONFIG.VIEW_W * 20, CONFIG.VIEW_H * 20),
    dynamicProperties: {
      position: true,
      color:    true,  // drives both alpha and tint per-particle
      rotation: false,
      uvs:      false,
      scale:    false,
    },
  });

  // Pre-warm the pool
  for (let i = 0; i < CONFIG.PARTICLE_POOL_MAX_SIZE; i++) {
    _pool.push(_makeParticle());
  }

  particlesLayer.addChild(_container);
}

/**
 * Sync the ParticleContainer to the current state particles array.
 * Called every frame.
 * @param {object[]} stateParticles
 */
export function syncParticles(stateParticles) {
  if (!_container) return;

  // Return all currently active back to pool in bulk (cheap array op)
  if (_active.length > 0) {
    _container.particleChildren.length = 0;
    _container.update();
    for (const p of _active) _pool.push(p);
    _active.length = 0;
  }

  if (stateParticles.length === 0) return;

  // Re-add from current state
  for (const sp of stateParticles) {
    const alpha = Math.max(0, Math.min(1, sp.life / sp.maxLife));
    const pp = _pool.pop() ?? _makeParticle();
    pp.x     = sp.x;
    pp.y     = sp.y;
    pp.tint  = _parseCSSColor(sp.color);
    pp.alpha = alpha;
    _active.push(pp);
  }

  // Batch push + single update call
  _container.particleChildren.push(..._active);
  _container.update();
}

/**
 * Remove all active particles (e.g., on level reset).
 */
export function clearParticles() {
  if (!_container) return;
  _container.particleChildren.length = 0;
  _container.update();
  for (const p of _active) _pool.push(p);
  _active.length = 0;
}

// ── Data helper (no rendering) ────────────────────────────────

/**
 * Push particle data into a state.particles array.
 * baseAngle + spread describe the emission cone; use 0 + Math.PI*2 for radial.
 */
export function spawnParticles(particles, x, y, count, baseAngle, spread, speedMin, speedMax, life, color) {
  for (let i = 0; i < count; i++) {
    const a   = baseAngle + (Math.random() - 0.5) * spread;
    const spd = speedMin + Math.random() * (speedMax - speedMin);
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life, maxLife: life, color });
  }
}

/**
 * Spawn a radial purification wave that fills the room in ~0.5 s.
 * All particles burst from the origin and fly outward; wave speed is set
 * so the front reaches the farthest room cell in WAVE_DURATION seconds.
 *
 * @param {object[]} particles  - state.particles array to push into
 * @param {number}   ox         - wave origin world X
 * @param {number}   oy         - wave origin world Y
 * @param {object[]} roomCells  - array of { k, x, y } (cell grid coords)
 * @param {number}   CELL_PX    - pixels per cell (126)
 * @param {number}   [count=80]
 */
export function spawnPurifyWave(particles, ox, oy, roomCells, CELL_PX, count = 80) {
  if (!roomCells || roomCells.length === 0) return;

  const WAVE_DURATION = 0.3;

  // Max distance from origin to farthest cell center → drives wave speed
  let maxDist = 1;
  for (const cell of roomCells) {
    const d = Math.hypot((cell.x + 0.5) * CELL_PX - ox, (cell.y + 0.5) * CELL_PX - oy);
    if (d > maxDist) maxDist = d;
  }

  const waveSpeed = WAVE_DURATION * 1000;
  const life = WAVE_DURATION * 5;

  // Build a Set of valid cell keys for out-of-room culling
  const roomMask = new Set(roomCells.map(c => `${c.x},${c.y}`));

  for (let i = 0; i < count; i++) {
    const a   = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI * 2 / count);
    const spd = waveSpeed * (0.85 + Math.random() * 0.3);
    particles.push({
      x: ox, y: oy,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life, maxLife: life,
      color: '#ffffff',
      roomMask,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────

function _makeParticle() {
  return new Particle({
    texture: _dotTexture,
    anchorX: 0.5,
    anchorY: 0.5,
  });
}

/**
 * Generate a 6×6 white circle texture using the renderer.
 * @param {number} radius
 * @returns {import('pixi.js').Texture}
 */
function _createDotTexture(radius) {
  const d = radius * 2 + 2;
  const g = new Graphics()
    .circle(radius + 1, radius + 1, radius)
    .fill(0xffffff);
  const tex = app.renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, d, d) });
  g.destroy();
  return tex;
}

/**
 * Convert CSS hex color string to integer (e.g. '#00ff44' → 0x00ff44).
 * @param {string|number} css
 * @returns {number}
 */
function _parseCSSColor(css) {
  if (typeof css === 'number') return css;
  if (typeof css === 'string' && css.startsWith('#')) {
    return parseInt(css.slice(1), 16);
  }
  return 0xffffff;
}
