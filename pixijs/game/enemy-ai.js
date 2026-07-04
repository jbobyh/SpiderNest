// ============================================================
// ENEMY AI — updateEnemyAI(), enemyCollisions(), spawnCorpse()
// Works for both play-mode (scale=1) and battle-mode (BATTLE_SCALE).
// CONFIG / SPRITE_SHEETS.shooter.anims are globals from config.js.
// ============================================================

import { cellOf, cellKey, CELL_PX, getRoomBonus } from '../world/constants.js';
import { createEnemyBody, destroyBody, setBodyVelocity } from '../world/physics.js';
import { getEnemyMoveDir, hasLineOfSight } from './flow-field.js';
import { Sounds } from '../core/sound.js';
import { dealPlayerDamage } from './upgrades.js';
import { enemyBulletRange } from './combat.js';
import { EnemyFactory } from './enemy-factory.js';

// ── Play-mode enemy AI (no scale) ─────────────────────────────

export function updateEnemyAI(state, playerProgress, dt, onPlayerDamaged) {
  const s   = state;

  for (let i = s.activeSpiders.length - 1; i >= 0; i--) {
    const g = s.activeSpiders[i];

    // Stasis enemies: skip AI update but still handle death cleanup
    if (g.stasis) {
      if (g.isDead || g.hp <= 0) {
        if (!g.isDead) g.die(state, true);
        spawnCorpse(s.deathCorpses, g, g.radius);
        _deathParticles(s.particles, g.x, g.y, 1, g.isBoss);
        if (g.body) { destroyBody(g.body); g.body = null; }
        s.activeSpiders.splice(i, 1);
      }
      continue;
    }

    // If for some reason it's not a class instance yet (e.g. newly spawned in a way that missed factory)
    if (typeof g.update !== 'function') {
      s.activeSpiders[i] = EnemyFactory.fromObject(g);
      continue;
    }

    // Set callback for cocoon spawn
    if (g.type === 'cocoon' && !g.onSpawnRequested) {
      g.onSpawnRequested = (type, x, y) => {
        const spawned = EnemyFactory.create(type, x, y);
        s.activeSpiders.push(spawned);
      };
    }

    g.update(dt, state);

    if (g.isDead || g.hp <= 0) {
      if (!g.isDead) g.die(state, true); // Ensure die() is called if hp <= 0
      
      spawnCorpse(s.deathCorpses, g, g.radius);
      _deathParticles(s.particles, g.x, g.y, 1, g.isBoss);
      
      if (g.body) {
        destroyBody(g.body);
        g.body = null;
      }
      
      s.activeSpiders.splice(i, 1);
      continue;
    }
  }
}

// ── Private helpers ───────────────────────────────────────────

// ── Particle helpers ──────────────────────────────────────────

function _deathParticles(particles, x, y, scale, isBoss = false) {
  const count = isBoss ? CONFIG.PARTICLES.death.count * 3 : CONFIG.PARTICLES.death.count;
  for (let k = 0; k < count; k++) {
    const a   = Math.random() * Math.PI * 2;
    const spd = CONFIG.PARTICLES.death.speedMin + Math.random() * (CONFIG.PARTICLES.death.speedMax - CONFIG.PARTICLES.death.speedMin);
    particles.push({ x, y, vx: Math.cos(a) * spd * scale, vy: Math.sin(a) * spd * scale,
      life: CONFIG.PARTICLES.death.life, maxLife: CONFIG.PARTICLES.death.life,
      color: Math.random() < 0.5 ? '#cc2822' : '#ff5a44' });
  }
}

function _makeSoldier(x, y) {
  return EnemyFactory.create('soldier', x, y);
}

const CORPSE_DURATION = 2.0;

const CORPSE_TYPES = new Set(['soldier', 'bat', 'shooter', 'bull', 'buldyga', 'bloated', 'wallshooter', 'ghost']);

export function spawnCorpse(corpseArray, g, radius) {
  if (!CORPSE_TYPES.has(g.type || 'soldier')) return;
  Sounds.death();
  corpseArray.push({
    x: g.x, y: g.y,
    type: g.type,
    radius,
    visualScale: g.visualScale || 3.2,
    life: CORPSE_DURATION,
    maxLife: CORPSE_DURATION,
  });
}
