import { ParticleContainer, Particle, Graphics, Rectangle } from 'pixi.js';
import { app } from '../core/app.js';

let _container = null;
let _texture = null;
const _particleMap = new Map(); // Bullet -> Particle
const _pool = [];

const BULLET_R = CONFIG.BULLET_RADIUS || 3;

/**
 * Initialize the bullet renderer with a ParticleContainer.
 * @param {import('pixi.js').Container} parent - The layer to add the container to.
 */
export function initBulletRenderer(parent) {
  if (_container) {
    if (_container.parent) _container.parent.removeChild(_container);
    _container.destroy({ children: true });
  }

  // Create a simple circle texture for bullets
  const g = new Graphics().circle(0, 0, BULLET_R).fill({ color: 0xffffff });
  _texture = app.renderer.generateTexture(g);
  g.destroy();

  _container = new ParticleContainer({
    texture: _texture,
    dynamicProperties: {
      position: true,
      color: true,
      rotation: false,
      uvs: false,
    },
    // Set a large enough boundsArea to avoid culling
    boundsArea: new Rectangle(-5000, -5000, 10000, 10000),
  });

  parent.addChild(_container);
}

/**
 * Sync bullet objects from the manager to the ParticleContainer.
 * @param {object[]} bullets - Array of Bullet objects from the manager.
 */
export function syncBullets(bullets) {
  if (!_container) return;

  // 1. Remove particles for dead bullets
  for (const [bullet, particle] of _particleMap) {
    if (bullet.isDead || !bullets.includes(bullet)) {
      _container.removeParticle(particle);
      _pool.push(particle);
      _particleMap.delete(bullet);
    }
  }

  // 2. Add/Update particles
  for (const b of bullets) {
    let p = _particleMap.get(b);
    if (!p) {
      p = _pool.pop() ?? new Particle({ texture: _texture });
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      _container.addParticle(p);
      _particleMap.set(b, p);
    }

    p.x = b.x;
    p.y = b.y;
    p.tint = b.color;
  }
}

/**
 * Destroy all tracked particles and clear maps.
 */
export function clearBullets() {
  if (_container) {
    _container.removeParticles();
  }
  _particleMap.clear();
  _pool.length = 0;
}
