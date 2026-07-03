import { ParticleContainer, Particle, Graphics, Rectangle } from 'pixi.js';
import { app } from '../core/app.js';

const BULLET_R = CONFIG.BULLET_RENDER?.radius ?? 2.5;
const GLOW_R  = CONFIG.BULLET_RENDER?.glowRadius ?? 4;
const GLOW_A  = CONFIG.BULLET_RENDER?.glowAlpha ?? 0.2;

const PLAYER_EDGE = 0xffff00;
const ENEMY_EDGE  = 0xff0000;

const _slots = {
  playerCore: { container: null, texture: null, map: new Map(), pool: [] },
  enemyCore:  { container: null, texture: null, map: new Map(), pool: [] },
};

function _slotFor(b) {
  const isPlayer = b.owner === 'player' && !b.isCrit;
  return isPlayer ? 'player' : 'enemy';
}

function _createCoreTexture(edgeColor, scale = 1) {
  const br = BULLET_R * scale;
  const g = new Graphics();
  const steps = 6;
  const er = (edgeColor >> 16) & 0xff;
  const eg = (edgeColor >> 8) & 0xff;
  const eb = edgeColor & 0xff;
  for (let i = steps; i >= 1; i--) {
    const r = (br * i) / steps;
    const t = (i - 1) / (steps - 1);
    const r2 = Math.round(0xff + (er - 0xff) * t);
    const g2 = Math.round(0xff + (eg - 0xff) * t);
    const b2 = Math.round(0xff + (eb - 0xff) * t);
    g.circle(0, 0, r).fill({ color: (r2 << 16) | (g2 << 8) | b2 });
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export function initBulletRenderer(parent) {
  for (const key of Object.keys(_slots)) {
    const s = _slots[key];
    if (s.container) {
      if (s.container.parent) s.container.parent.removeChild(s.container);
      s.container.destroy({ children: true });
    }
    s.map.clear();
    s.pool.length = 0;
  }

  _slots.playerCore.texture = _createCoreTexture(PLAYER_EDGE);
  _slots.enemyCore.texture  = _createCoreTexture(ENEMY_EDGE);

  const order = ['enemyCore', 'playerCore'];
  for (const key of order) {
    const s = _slots[key];
    s.container = new ParticleContainer({
      texture: s.texture,
      dynamicProperties: {
        position: true,
        color: false,
        rotation: false,
        uvs: false,
      },
      boundsArea: new Rectangle(-5000, -5000, 10000, 10000),
    });
    s.container.blendMode = 'normal';
    parent.addChild(s.container);
  }
}

export function syncBullets(bullets) {
  for (const key of Object.keys(_slots)) {
    const s = _slots[key];
    if (!s.container) continue;

    for (const [bullet, particle] of s.map) {
      if (bullet.isDead || !bullets.includes(bullet)) {
        s.container.removeParticle(particle);
        s.pool.push(particle);
        s.map.delete(bullet);
      }
    }
  }

  for (const b of bullets) {
    const prefix = _slotFor(b);
    for (const layer of ['Core']) {
      const key = prefix + layer;
      const s = _slots[key];
      if (!s.container) continue;

      let p = s.map.get(b);
      if (!p) {
        p = s.pool.pop() ?? new Particle({ texture: s.texture });
        p.anchorX = 0.5;
        p.anchorY = 0.5;
        s.container.addParticle(p);
        s.map.set(b, p);
      }

      p.x = b.x;
      p.y = b.y;
    }
  }
}

export function clearBullets() {
  for (const key of Object.keys(_slots)) {
    const s = _slots[key];
    if (s.container) {
      s.container.removeParticles();
    }
    s.map.clear();
    s.pool.length = 0;
  }
}
