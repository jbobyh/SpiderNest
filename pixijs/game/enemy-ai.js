// ============================================================
// ENEMY AI — updateEnemyAI(), enemyCollisions(), spawnCorpse()
// Works for both play-mode (scale=1) and battle-mode (BATTLE_SCALE).
// CONFIG / PLEVAKA_ANIMS are globals from config.js.
// ============================================================

import { cellOf, cellKey, CELL_PX, getRoomBonus } from '../world/constants.js';
import { createEnemyBody, destroyBody, setBodyVelocity } from '../world/physics.js';
import { getEnemyMoveDir, hasLineOfSight } from './flow-field.js';
import { Sounds } from '../core/sound.js';
import { dealPlayerDamage } from './upgrades.js';
import { enemyBulletRange } from './combat.js';

// ── Shared constants ──────────────────────────────────────────

const SHOOTER_STOP_DIST_CELLS  = () => CONFIG.SHOOTER_STOP_DIST_CELLS  * CELL_PX;
const SHOOTER_SHOOT_RANGE_CELLS = () => CONFIG.SHOOTER_SHOOT_RANGE_CELLS * CELL_PX;
const BULL_CHARGE_DIST_CELLS   = () => (CONFIG.BULL_CHARGE_DIST_CELLS ?? 1.5) * CELL_PX;
const BULL_DASH_DIST_CELLS     = () => (CONFIG.BULL_DASH_DISTANCE_CELLS ?? 3) * CELL_PX;

// Get room speed multiplier for a position
function _getRoomSpeedMult(state, x, y) {
  const cell = cellOf(x, y);
  const ck = cellKey(cell.x, cell.y);
  const roomBonus = getRoomBonus(state, ck);
  if (roomBonus === 'speedup') {
    const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speedup');
    return bonusDef?.speedMult || 1.3;
  }
  if (roomBonus === 'speeddown') {
    const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speeddown');
    return bonusDef?.speedMult || 0.7;
  }
  return 1.0;
}

// ── Spawn corpse ──────────────────────────────────────────────

const CORPSE_DURATION = 2.0;

const CORPSE_TYPES = new Set(['soldier', 'chaser', 'bat', 'plevaka', 'shooter', 'bull', 'buldyga', 'bloated']);

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

// ── Play-mode enemy AI (no scale) ─────────────────────────────

export function updateEnemyAI(state, playerProgress, dt, onPlayerDamaged) {
  const s   = state;
  const CP  = CELL_PX;

  const STOP_DIST   = SHOOTER_STOP_DIST_CELLS();
  const SHOOT_RANGE = SHOOTER_SHOOT_RANGE_CELLS();
  const CHARGE_DIST = BULL_CHARGE_DIST_CELLS();
  const DASH_DIST   = BULL_DASH_DIST_CELLS();

  for (let i = s.activeSpiders.length - 1; i >= 0; i--) {
    const g = s.activeSpiders[i];

    if (g.isBoss) continue; // handled by boss.js updateBoss

    if (g.hitFlash > 0) g.hitFlash -= dt;
    if (g.stunTimer  > 0) g.stunTimer -= dt;
    if (g.type === 'bat') _tickBatAnim(g, dt);
    if (!g.body) g.body = createEnemyBody(g.x, g.y, g.radius || CONFIG.SPIDER_RADIUS, g);

    // Stuck detection
    if (g.type !== 'cocoon' && g.type !== 'plevaka' && g.type !== 'shooter' && g.type !== 'bull') {
      if (g.lastX === undefined) { g.lastX = g.x; g.lastY = g.y; g.stuckTimer = 0; }
      const moved = Math.hypot(g.x - g.lastX, g.y - g.lastY);
      if (moved < 1) {
        g.stuckTimer += dt;
        if (g.stuckTimer >= 5) {
          spawnCorpse(s.deathCorpses, g, g.radius || CONFIG.SPIDER_RADIUS);
          _deathParticles(s.particles, g.x, g.y, 1);
          destroyBody(g.body);
          s.activeSpiders.splice(i, 1);
          continue;
        }
      } else {
        g.stuckTimer = 0; g.lastX = g.x; g.lastY = g.y;
      }
    }

    const dx   = s.player.x - g.x;
    const dy   = s.player.y - g.y;
    const dist = Math.hypot(dx, dy);

    if (g.type === 'plevaka' || g.type === 'shooter') {
      _tickPlevakaAnim(g, dt);
      const hasLos = hasLineOfSight(s.openCells, s.removedWalls, g.x, g.y, s.player.x, s.player.y);
      const isStunned = g.stunTimer > 0;

      if (g.shootCd > 0) g.shootCd -= dt;

      // Shoot only if has line of sight and in range (stun does not prevent shooting)
      if (hasLos && dist <= SHOOT_RANGE && g.shootCd <= 0 && dist > 0) {
        g.shootCd = CONFIG.SHOOTER_SHOOT_CD;
        if (g.animState !== null) { g.animState = 'shoot'; g.animFrame = 0; g.animTimer = 0; }
        const ebx = (dx / dist) * CONFIG.SHOOTER_BULLET_SPEED;
        const eby = (dy / dist) * CONFIG.SHOOTER_BULLET_SPEED;
        s.enemyBullets.push({
          x: g.x, y: g.y,
          vx: ebx,
          vy: eby,
          _baseVx: ebx,
          _baseVy: eby,
          maxRange: enemyBulletRange(ebx, eby),
          distanceTraveled: 0,
        });
      }

      // Stun freezes movement, but shooting still happens above
      if (isStunned) {
        setBodyVelocity(g.body, 0, 0);
      } else if (!hasLos || dist > STOP_DIST) {
        if (dist > 0) {
          const dir = getEnemyMoveDir(g.x, g.y, s.player.x, s.player.y, s.flowField, s.openCells, s.removedWalls);
          const speedMult = _getRoomSpeedMult(s, g.x, g.y);
          setBodyVelocity(g.body, dir.dx * CONFIG.SHOOTER_SPEED * speedMult, dir.dy * CONFIG.SHOOTER_SPEED * speedMult);
          if (g.animState !== null && g.animState !== 'shoot') g.animState = 'run';
        }
      } else {
        setBodyVelocity(g.body, 0, 0);
        if (g.animState !== null && g.animState !== 'shoot') g.animState = 'idle';
      }

    } else if (g.type === 'bull') {
      _updateBullPlay(g, s, dx, dy, dist, dt, CHARGE_DIST, DASH_DIST, CP, playerProgress, onPlayerDamaged, i);
      continue; // bull manages its own splicing

    } else if (g.type === 'buldyga') {
      _updateBuldygaPlay(g, s, dx, dy, dist, dt, CP, playerProgress, onPlayerDamaged, i);
      continue;

    } else if (g.type === 'bloated') {
      if (g.stunTimer <= 0 && dist > 0) {
        const dir = getEnemyMoveDir(g.x, g.y, s.player.x, s.player.y, s.flowField, s.openCells, s.removedWalls);
        const speedMult = _getRoomSpeedMult(s, g.x, g.y);
        setBodyVelocity(g.body, dir.dx * CONFIG.BLOATED_SPEED * speedMult, dir.dy * CONFIG.BLOATED_SPEED * speedMult);
      } else if (g.stunTimer > 0) {
        setBodyVelocity(g.body, 0, 0);
      }
      if (dist < (g.radius || CONFIG.BLOATED_RADIUS) + CONFIG.PLAYER_RADIUS) {
        // Contact damage handled by onCollision in physics.js
        continue;
      }

    } else if (g.type === 'cocoon') {
      _updateCocoonPlay(g, s, dt, i);
      continue;

    } else {
      // Soldier / chaser / bat
      if (g.stunTimer <= 0 && dist > 0) {
        const dir = getEnemyMoveDir(g.x, g.y, s.player.x, s.player.y, s.flowField, s.openCells, s.removedWalls);
        const speedMult = _getRoomSpeedMult(s, g.x, g.y);
        const spd = g.type === 'bat' ? CONFIG.BAT_SPEED : CONFIG.SPIDER_SPEED;
        setBodyVelocity(g.body, dir.dx * spd * speedMult, dir.dy * spd * speedMult);
      } else if (g.stunTimer > 0) {
        setBodyVelocity(g.body, 0, 0);
      }
      if (dist < (g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.PLAYER_RADIUS) {
        // Contact damage handled by onCollision in physics.js
        continue;
      }
    }
  }
}

// ── Private helpers ───────────────────────────────────────────

function _tickPlevakaAnim(g, dt) {
  if (g.animState === null || typeof PLEVAKA_ANIMS === 'undefined') return;
  g.animTimer += dt;
  const cfg = PLEVAKA_ANIMS[g.animState];
  if (!cfg) return;
  if (g.animTimer >= 1 / cfg.fps) {
    g.animTimer = 0;
    g.animFrame = (g.animFrame + 1) % cfg.frames;
    if (g.animState === 'shoot' && g.animFrame === 0) { g.animState = 'idle'; g.animFrame = 0; }
  }
}

function _tickBatAnim(g, dt) {
  if (g.animState === null || typeof BAT_ANIM === 'undefined') return;
  g.animTimer += dt;
  const cfg = BAT_ANIM;
  if (g.animTimer >= 1 / cfg.fps) {
    g.animTimer = 0;
    g.animFrame = (g.animFrame + 1) % cfg.frames;
  }
}

function _updateBullPlay(g, s, dx, dy, dist, dt, CHARGE_DIST, DASH_DIST, CP, playerProgress, onPlayerDamaged, i) {
  if (!g.state) g.state = 'chase';
  if (g.stateTimer === undefined) g.stateTimer = 0;
  const effectiveR = g.radius || CONFIG.BULL_RADIUS;
  const hitDist    = effectiveR + CONFIG.PLAYER_RADIUS;
  const isStunned  = g.stunTimer > 0;

  switch (g.state) {
    case 'chase':
      if (isStunned) {
        setBodyVelocity(g.body, 0, 0);
      } else if (dist > CHARGE_DIST && dist > 0) {
        const dir = getEnemyMoveDir(g.x, g.y, s.player.x, s.player.y, s.flowField, s.openCells, s.removedWalls);
        const speedMult = _getRoomSpeedMult(s, g.x, g.y);
        setBodyVelocity(g.body, dir.dx * CONFIG.BULL_SPEED * speedMult, dir.dy * CONFIG.BULL_SPEED * speedMult);
      } else if (dist <= CHARGE_DIST) {
        g.state = 'prepare'; g.stateTimer = CONFIG.BULL_PREPARE_TIME;
        setBodyVelocity(g.body, 0, 0);
      }
      break;
    case 'prepare':
      g.stateTimer -= dt;
      if (g.stateTimer <= 0) {
        g.state = 'dash';
        const d2 = Math.hypot(s.player.x - g.x, s.player.y - g.y);
        if (d2 > 0) { g.dashDirX = (s.player.x - g.x) / d2; g.dashDirY = (s.player.y - g.y) / d2; }
        else        { g.dashDirX = dx / dist; g.dashDirY = dy / dist; }
        g.dashDistance = DASH_DIST; g.stateTimer = 0;
      }
      break;
    case 'dash': {
      const BULL_DASH_SPD = CONFIG.BULL_SPEED * 4;
      const speedMult = _getRoomSpeedMult(s, g.x, g.y);
      setBodyVelocity(g.body, g.dashDirX * BULL_DASH_SPD * speedMult, g.dashDirY * BULL_DASH_SPD * speedMult);
      g.stateTimer += BULL_DASH_SPD * speedMult * dt;
      const hitWall = g.body && Math.hypot(g.body.velocity.x, g.body.velocity.y) < BULL_DASH_SPD * speedMult * 0.3;
      if (hitWall || g.stateTimer >= g.dashDistance) {
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
        setBodyVelocity(g.body, 0, 0);
      }
      const nd = Math.hypot(s.player.x - g.x, s.player.y - g.y);
      if (nd < hitDist) {
        if (!s.player.isDashing && onPlayerDamaged) onPlayerDamaged(s, playerProgress, false);
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
        setBodyVelocity(g.body, 0, 0);
      }
      break;
    }
    case 'rest':
      g.stateTimer -= dt;
      setBodyVelocity(g.body, 0, 0);
      if (g.stateTimer <= 0) g.state = 'chase';
      break;
  }

  if (g.state !== 'dash' && dist < hitDist) {
    // Contact damage handled by onCollision in physics.js
  }
}

function _updateBuldygaPlay(g, s, dx, dy, dist, dt, CP, playerProgress, onPlayerDamaged, i) {
  if (g.currentSpeed === undefined) g.currentSpeed = CONFIG.BULDYGA_SPEED;
  if (g.speedAccumulator === undefined) g.speedAccumulator = 0;
  if (g.vx === undefined) { g.vx = 0; g.vy = 0; }

  if (g.stunTimer > 0) {
    g.vx = 0; g.vy = 0;
    setBodyVelocity(g.body, 0, 0);
    return;
  }

  g.speedAccumulator += dt;
  if (g.speedAccumulator >= 1.0) {
    const secs = Math.floor(g.speedAccumulator);
    g.currentSpeed    += CONFIG.BULDYGA_SPEED_INCREMENT * secs;
    g.speedAccumulator -= secs;
  }

  // Apply room speed modifier to current speed
  const speedMult = _getRoomSpeedMult(s, g.x, g.y);
  const effectiveSpeed = g.currentSpeed * speedMult;

  if (dist > 0) {
    // For Buldyga, direct vector often works better for "missing" the player
    // than flow-field which is too precise.
    const tvx = (dx / dist) * effectiveSpeed;
    const tvy = (dy / dist) * effectiveSpeed;

    // Apply acceleration (inertia)
    // We use a much lower effective acceleration to ensure "heavy" feel
    const acc = (CONFIG.BULDYGA_ACCEL * 0.1) * dt;
    const dvx = tvx - g.vx;
    const dvy = tvy - g.vy;
    const dLen = Math.hypot(dvx, dvy);

    if (dLen > 0) {
      const step = Math.min(dLen, acc);
      g.vx += (dvx / dLen) * step;
      g.vy += (dvy / dLen) * step;
    }
  } else {
    const friction = 1 - CONFIG.BULDYGA_FRICTION * dt;
    g.vx *= Math.max(0, friction);
    g.vy *= Math.max(0, friction);
  }

  // Sync with physics body
  if (g.body) {
    const bv = g.body.velocity;
    const bSpd = Math.hypot(bv.x, bv.y);
    const vSpd = Math.hypot(g.vx, g.vy);
    
    // If we hit a wall (stopped), kill internal velocity
    if (vSpd > 0.5 && bSpd < vSpd * 0.2) {
      g.vx = bv.x;
      g.vy = bv.y;
    }
  }
  
  setBodyVelocity(g.body, g.vx, g.vy);

  if (dist < (g.radius || CONFIG.BULDYGA_RADIUS) + CONFIG.PLAYER_RADIUS) {
    // Contact damage handled by onCollision in physics.js
  }
}

function _updateCocoonPlay(g, s, dt, i) {
  const cx = Math.floor(g.x / CELL_PX), cy = Math.floor(g.y / CELL_PX);
  if (!s.openCells.has(cellKey(cx, cy))) {
    s.activeSpiders.splice(i, 1);
    _deathParticles(s.particles, g.x, g.y, 1);
    return;
  }
  if (g.spawnTimer === undefined) g.spawnTimer = CONFIG.COCOON_SPAWN_INTERVAL;
  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0) {
    g.spawnTimer = CONFIG.COCOON_SPAWN_INTERVAL;
    const a = Math.random() * Math.PI * 2;
    const d = (g.radius || CONFIG.COCOON_RADIUS) + CONFIG.SPIDER_RADIUS + 5;
    s.activeSpiders.push(_makeSoldier(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d));
  }
}

// ── Particle helpers ──────────────────────────────────────────

function _deathParticles(particles, x, y, scale) {
  for (let k = 0; k < CONFIG.DEATH_PARTICLES_COUNT; k++) {
    const a   = Math.random() * Math.PI * 2;
    const spd = CONFIG.DEATH_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.DEATH_PARTICLES_SPEED_MAX - CONFIG.DEATH_PARTICLES_SPEED_MIN);
    particles.push({ x, y, vx: Math.cos(a) * spd * scale, vy: Math.sin(a) * spd * scale,
      life: CONFIG.DEATH_PARTICLES_LIFE, maxLife: CONFIG.DEATH_PARTICLES_LIFE,
      color: Math.random() < 0.5 ? '#44cc22' : '#88ff44' });
  }
}

function _playerHitParticles(particles, px, py, scale) {
  for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({ x: px, y: py, vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED * scale,
      vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED * scale,
      life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444' });
  }
}

function _makeSoldier(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    radius: CONFIG.SPIDER_RADIUS,
    hp: CONFIG.SPIDER_HP,
    maxHp: CONFIG.SPIDER_HP,
    visualScale: CONFIG.SPIDER_VISUAL_SCALE,
    type: 'soldier',
    shootCd: 0,
    hitFlash: 0,
    state: 'chase', stateTimer: 0,
    dashTargetX: 0, dashTargetY: 0,
    dashDirX: 0, dashDirY: 0, dashDistance: 0,
    currentSpeed: undefined, speedAccumulator: 0,
    spawnTimer: undefined,
  };
}
