// ============================================================
// BOSS — phase boss AI (boss_phase type)
// Called from the battle update loop for entities where g.isBoss.
// BOSS_DEFS / CONFIG are globals from config.js.
// ============================================================

import { cellKey, cellOf, CELL_PX, getRoomBonus } from '../world/constants.js';
import { createEnemyBody, destroyBody, setBodyVelocity } from '../world/physics.js';
import { getEnemyMoveDir } from './flow-field.js';
import { Sounds } from '../core/sound.js';
import { dealPlayerDamage, showUpgradePopup } from './upgrades.js';
import { enemyBulletRange } from './combat.js';

// ── Room speed multiplier ────────────────────────────────────

function _getRoomSpeedMult(state, x, y) {
  const cell = { x: Math.floor(x / CELL_PX), y: Math.floor(y / CELL_PX) };
  const ck = cellKey(cell.x, cell.y);
  const roomBonus = getRoomBonus(state, ck);
  if (roomBonus === 'speedup') {
    const bonusDef = (typeof ROOM_BONUS_TYPES !== 'undefined') && ROOM_BONUS_TYPES.find(bt => bt.id === 'speedup');
    return bonusDef?.speedMult || 1.5;
  }
  if (roomBonus === 'speeddown') {
    const bonusDef = (typeof ROOM_BONUS_TYPES !== 'undefined') && ROOM_BONUS_TYPES.find(bt => bt.id === 'speeddown');
    return bonusDef?.speedMult || 0.5;
  }
  return 1.0;
}

// ── Entry point: update single boss entity ────────────────────

export function updateBoss(g, b, state, playerProgress, dt, currentLevel) {
  if (!g || !g.isBoss) return;

  const bossDef = (typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[currentLevel]) || _fallbackDef();

  // Hit flash / stun
  if (g.hitFlash  > 0) g.hitFlash  -= dt;
  if (g.stunTimer > 0) g.stunTimer -= dt;

  if (!g.body) {
    g.body = createEnemyBody(g.x, g.y, g.radius || CONFIG.SPIDER_RADIUS, g, 'boss');
  }

  const freezeTimer = b?.freezeTimer ?? 0;

  // Phase timer advance
  if (freezeTimer <= 0) {
    const cp = bossDef.phases[g.phaseIndex];
    if (cp.id !== 'bull_limited' && cp.duration !== undefined) {
      g.phaseTimer -= dt;
      if (g.phaseTimer <= 0) _advancePhase(g, bossDef);
    }
  }

  const phase   = bossDef.phases[g.phaseIndex] || bossDef.phases[0];
  const roomMult = _getRoomSpeedMult(state, g.x, g.y);
  const bossSpd = CONFIG.SPIDER_SPEED * (bossDef.speedMult || 1.0) * roomMult;
  const dx      = state.player.x - g.x;
  const dy      = state.player.y - g.y;
  const dist    = Math.hypot(dx, dy);

  let newX = g.x, newY = g.y;

  // ── Phase behaviour ──────────────────────────────────────────
  if (phase.id === 'pause') {
    setBodyVelocity(g.body, 0, 0);

  } else if (phase.id === 'soldier') {
    if (g.stunTimer <= 0 && freezeTimer <= 0 && dist > 0) {
      const dir = getEnemyMoveDir(g.x, g.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
      setBodyVelocity(g.body, dir.dx * bossSpd, dir.dy * bossSpd);
    } else {
      setBodyVelocity(g.body, 0, 0);
    }

  } else if (phase.id === 'buldyga') {
    _updateBossInertia(g, state, phase, dx, dy, dist, dt, freezeTimer, roomMult);

  } else if (phase.id === 'bull_limited') {
    _updateBossBullLimited(g, state, playerProgress, phase, dx, dy, dist, dt, freezeTimer, roomMult);

  } else if (phase.id === 'shooter') {
    _updateBossShooter(g, state, phase, dx, dy, dist, dt, freezeTimer, bossSpd);
  }

  // ── Touch player ─────────────────────────────────────────────
  if (dist < (g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.PLAYER_RADIUS) {
    // Contact damage handled by onCollision in physics.js
  }
}

// ── Create boss entity ────────────────────────────────────────

export function createBossEntity(level, cx, cy) {
  const bossDef = (typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[level]) || _fallbackDef();
  return {
    x: cx, y: cy,
    vx: 0, vy: 0,
    hp: bossDef.hp,
    maxHp: bossDef.hp,
    radius: bossDef.radius || CONFIG.SPIDER_RADIUS,
    visualScale: bossDef.visualScale || 4.0,
    type: 'boss_phase',
    isBoss: true,
    shootCd: 0,
    hitFlash: 0,
    stunTimer: 0,
    phaseIndex: 0,
    phaseTimer: bossDef.phases[0]?.duration ?? Infinity,
    dashCount: 0,
    state: 'chase',
    stateTimer: 0,
    dashDirX: 0, dashDirY: 0, dashDistance: 0,
    currentSpeed: undefined,
    speedAccumulator: 0,
    strafeDir: 1,
    strafeSwitchTimer: CONFIG.BOSS_STRAFE_SWITCH_TIME ?? 2,
    stuckTimer: 0,
    lastX: cx, lastY: cy,
  };
}

// ── Private helpers ───────────────────────────────────────────

function _advancePhase(g, bossDef) {
  g.phaseIndex = (g.phaseIndex + 1) % bossDef.phases.length;
  const next   = bossDef.phases[g.phaseIndex];
  g.phaseTimer = next.duration ?? Infinity;
  g.dashCount  = 0;
  g.state      = 'chase';
  g.stateTimer = 0;
  // Reset inertia
  g.vx = 0; g.vy = 0;
  g.currentSpeed = undefined;
  g.speedAccumulator = 0;
}

function _updateBossInertia(g, state, phase, dx, dy, dist, dt, freezeTimer, roomMult = 1.0) {
  const accelMult    = phase.accelMult   || 1.0;
  const frictionMult = phase.frictionMult || 1.0;
  if (g.currentSpeed    === undefined) g.currentSpeed    = CONFIG.BULDYGA_SPEED;
  if (g.speedAccumulator === undefined) g.speedAccumulator = 0;
  if (g.vx === undefined) { g.vx = 0; g.vy = 0; }

  g.speedAccumulator += dt;
  if (g.speedAccumulator >= 1.0) {
    const s = Math.floor(g.speedAccumulator);
    g.currentSpeed    += CONFIG.BULDYGA_SPEED_INCREMENT * s;
    g.speedAccumulator -= s;
  }

  const stunned = g.stunTimer > 0;
  if (!stunned && freezeTimer <= 0 && dist > 0) {
    const tvx = (dx / dist) * g.currentSpeed * roomMult, tvy = (dy / dist) * g.currentSpeed * roomMult;
    const acc = CONFIG.BULDYGA_ACCEL * accelMult * dt;
    g.vx += (tvx - g.vx) * Math.min(1, acc / g.currentSpeed);
    g.vy += (tvy - g.vy) * Math.min(1, acc / g.currentSpeed);
  } else if (freezeTimer > 0) {
    g.vx *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * frictionMult * dt);
    g.vy *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * frictionMult * dt);
  }

  if (g.body) {
    const prevSpd = Math.hypot(g.body.velocity.x, g.body.velocity.y);
    const targSpd = Math.hypot(g.vx, g.vy);
    if (targSpd > 10 && prevSpd < targSpd * 0.5) { g.vx *= -0.3; g.vy *= -0.3; }
  }
  setBodyVelocity(g.body, g.vx, g.vy);
}

function _updateBossShooter(g, state, phase, dx, dy, dist, dt, freezeTimer, bossSpd) {
  const shootCdMult     = phase.shootCdMult     || 0.5;
  const bulletSpeedMult = phase.bulletSpeedMult || 1.0;

  if (g.stunTimer <= 0 && freezeTimer <= 0) {
    if (g.strafeSwitchTimer === undefined) g.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME ?? 2;
    g.strafeSwitchTimer -= dt;
    if (g.strafeSwitchTimer <= 0) {
      g.strafeDir *= -1;
      g.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME ?? 2;
    }
    if (dist > 0) {
      const bvx = (-dy / dist) * bossSpd * g.strafeDir;
      const bvy = ( dx / dist) * bossSpd * g.strafeDir;
      
      const body    = g.body;
      const hitWall = body && Math.hypot(body.velocity.x, body.velocity.y) < bossSpd * 0.3;
      if (hitWall) {
        g.strafeDir *= -1;
        g.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME ?? 2;
      }
      setBodyVelocity(body, bvx, bvy);
    }
  } else {
    setBodyVelocity(g.body, 0, 0);
  }

  if (g.shootCd > 0) g.shootCd -= dt;
  const shootRange = CONFIG.SHOOTER_SHOOT_RANGE_CELLS * CELL_PX * 10;
  if (dist <= shootRange && g.shootCd <= 0 && freezeTimer <= 0 && dist > 0) {
    g.shootCd = CONFIG.SHOOTER_SHOOT_CD * shootCdMult;
    const ebx = (dx / dist) * CONFIG.SHOOTER_BULLET_SPEED * bulletSpeedMult;
    const eby = (dy / dist) * CONFIG.SHOOTER_BULLET_SPEED * bulletSpeedMult;
    state.enemyBullets.push({
      x: g.x, y: g.y,
      vx: ebx,
      vy: eby,
      _baseVx: ebx,
      _baseVy: eby,
      maxRange: enemyBulletRange(ebx, eby),
      distanceTraveled: 0,
    });
  }
}

function _updateBossBullLimited(g, state, playerProgress, phase, dx, dy, dist, dt, freezeTimer, roomMult = 1.0) {
  const dashCellsPx = (phase.dashCells || (CONFIG.BULL_DASH_DISTANCE_CELLS ?? 3)) * CELL_PX;
  const chargeDist  = (CONFIG.BULL_CHARGE_DIST_CELLS ?? 1.5) * CELL_PX * 8;
  const dashDist    = dashCellsPx;
  const effectiveR  = g.radius || CONFIG.SPIDER_RADIUS;
  const hitDist     = effectiveR + CONFIG.PLAYER_RADIUS;

  if (!g.state)              g.state      = 'chase';
  if (g.stateTimer === undefined) g.stateTimer = 0;

  switch (g.state) {
    case 'chase':
      if (g.stunTimer <= 0 && freezeTimer <= 0 && dist > chargeDist && dist > 0) {
        const dir = getEnemyMoveDir(g.x, g.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
        setBodyVelocity(g.body, dir.dx * CONFIG.BULL_SPEED * roomMult, dir.dy * CONFIG.BULL_SPEED * roomMult);
      } else if (dist <= chargeDist) {
        g.state = 'prepare'; g.stateTimer = CONFIG.BULL_PREPARE_TIME;
        setBodyVelocity(g.body, 0, 0);
      }
      break;
    case 'prepare':
      g.stateTimer -= dt;
      if (g.stateTimer <= 0) {
        g.state = 'dash';
        if (dist > 0) { g.dashDirX = dx / dist; g.dashDirY = dy / dist; }
        else          { g.dashDirX = 1; g.dashDirY = 0; }
        g.dashDistance = dashDist; g.stateTimer = 0;
      }
      break;
    case 'dash': {
      const BULL_DASH_SPD = CONFIG.BULL_SPEED * 3 * roomMult;
      setBodyVelocity(g.body, g.dashDirX * BULL_DASH_SPD, g.dashDirY * BULL_DASH_SPD);
      g.stateTimer += BULL_DASH_SPD * dt;
      const hitWall = g.body && Math.hypot(g.body.velocity.x, g.body.velocity.y) < BULL_DASH_SPD * 0.3;
      if (hitWall || g.stateTimer >= g.dashDistance) {
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
        setBodyVelocity(g.body, 0, 0);
        g.dashCount = (g.dashCount || 0) + 1;
        if (g.dashCount >= (phase.maxDashes || 3)) _advancePhase(g, _bossDefForCurrentLevel());
      }
      if (Math.hypot(state.player.x - g.x, state.player.y - g.y) < hitDist) {
        // Damage handled by onCollision in physics.js
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
        setBodyVelocity(g.body, 0, 0);
        g.dashCount = (g.dashCount || 0) + 1;
        if (g.dashCount >= (phase.maxDashes || 3)) _advancePhase(g, _bossDefForCurrentLevel());
      }
      break;
    }
    case 'rest':
      g.stateTimer -= dt;
      setBodyVelocity(g.body, 0, 0);
      if (g.stateTimer <= 0) g.state = 'chase';
      break;
  }
}

// ── Boss kill handler ─────────────────────────────────────────

export function handleBossKilled(g, state, playerProgress) {
  state.bossDefeated = true;
  destroyBody(g.body);
  const bossCellX = Math.floor(g.x / CELL_PX);
  const bossCellY = Math.floor(g.y / CELL_PX);
  state.exitCell = { x: bossCellX, y: bossCellY };
  Sounds.stopBossMusic?.();
  showUpgradePopup('БОСС ПОБЕЖДЕН!', '#ff4400');
}

// ── Freeze upgrade ────────────────────────────────────────────

export function applyFreezeUpgrade(b, state) {
  if (!state.upgrades.freeze) return;
  if (b?.freezeTimer > 0) return;
  if (b) b.freezeTimer = CONFIG.FREEZE_DURATION ?? 3;
  Sounds.play?.('shield');
}

// ── Utility ───────────────────────────────────────────────────

function _fallbackDef() {
  return {
    hp: 30, speedMult: 1.2, radius: CONFIG.SPIDER_RADIUS * 2,
    visualScale: 4.0,
    phases: [{ id: 'soldier', duration: 6 }, { id: 'pause', duration: 1 }],
  };
}

function _bossDefForCurrentLevel() {
  const lv = typeof currentLevel !== 'undefined' ? currentLevel : 1;
  return (typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[lv]) || _fallbackDef();
}

function _playerHitParticles(particles, px, py) {
  for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({ x: px, y: py,
      vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
      vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
      life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE,
      color: '#ff4444' });
  }
}
