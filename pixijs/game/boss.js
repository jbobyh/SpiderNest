// ============================================================
// BOSS — phase boss AI (boss_phase type)
// Called from the battle update loop for entities where g.isBoss.
// BOSS_DEFS / CONFIG are globals from config.js.
// ============================================================

import { cellKey, cellOf, CELL_PX, crossesWall, inRoom } from '../world/constants.js';
import { Sounds } from '../core/sound.js';
import { dealPlayerDamage, showUpgradePopup } from './upgrades.js';

// ── Entry point: update single boss entity ────────────────────

export function updateBoss(g, b, state, playerProgress, dt, currentLevel) {
  if (!g || !g.isBoss) return;

  const bossDef = (typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[currentLevel]) || _fallbackDef();

  // Hit flash / stun
  if (g.hitFlash  > 0) g.hitFlash  -= dt;
  if (g.stunTimer > 0) g.stunTimer -= dt;

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
  const bossSpd = CONFIG.SPIDER_SPEED * (bossDef.speedMult || 1.0);
  const dx      = state.player.x - g.x;
  const dy      = state.player.y - g.y;
  const dist    = Math.hypot(dx, dy);

  let newX = g.x, newY = g.y;

  // ── Phase behaviour ──────────────────────────────────────────
  if (phase.id === 'pause') {
    // do nothing

  } else if (phase.id === 'soldier') {
    if (g.stunTimer <= 0 && freezeTimer <= 0 && dist > 0) {
      newX += (dx / dist) * bossSpd * dt;
      newY += (dy / dist) * bossSpd * dt;
    }

  } else if (phase.id === 'buldyga') {
    _updateBossInertia(g, state, phase, dx, dy, dist, dt, freezeTimer);
    newX = g.x; newY = g.y;

  } else if (phase.id === 'bull_limited') {
    _updateBossBullLimited(g, state, playerProgress, phase, dx, dy, dist, dt, freezeTimer);
    newX = g.x; newY = g.y;

  } else if (phase.id === 'shooter') {
    _updateBossShooter(g, state, phase, dx, dy, dist, dt, freezeTimer);
    newX = g.x; newY = g.y;
  }

  // ── Move with wall check ──────────────────────────────────────
  if (phase.id !== 'bull_limited' && phase.id !== 'shooter' && phase.id !== 'buldyga') {
    const nc = cellOf(newX, newY);
    if (state.openCells.has(cellKey(nc.x, nc.y)) &&
        !crossesWall(state.removedWalls, g.x, g.y, newX, newY)) {
      g.x = newX; g.y = newY;
    }
  }

  // ── Touch player ─────────────────────────────────────────────
  if (dist < (g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.PLAYER_RADIUS) {
    dealPlayerDamage(state, playerProgress, true);
    _playerHitParticles(state.particles, state.player.x, state.player.y);
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

function _updateBossInertia(g, state, phase, dx, dy, dist, dt, freezeTimer) {
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
    const tvx = (dx / dist) * g.currentSpeed, tvy = (dy / dist) * g.currentSpeed;
    const acc = CONFIG.BULDYGA_ACCEL * accelMult * dt;
    g.vx += (tvx - g.vx) * Math.min(1, acc / g.currentSpeed);
    g.vy += (tvy - g.vy) * Math.min(1, acc / g.currentSpeed);
  } else if (freezeTimer > 0) {
    g.vx *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * frictionMult * dt);
    g.vy *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * frictionMult * dt);
  }

  const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
  const nc = cellOf(nx, ny);
  if (state.openCells.has(cellKey(nc.x, nc.y)) &&
      !crossesWall(state.removedWalls, g.x, g.y, nx, ny)) {
    g.x = nx; g.y = ny;
  } else { g.vx *= -0.3; g.vy *= -0.3; }
}

function _updateBossShooter(g, state, phase, dx, dy, dist, dt, freezeTimer) {
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
      const strafeSpd = CONFIG.BOSS_STRAFE_SPEED ?? 60;
      const sx = (-dy / dist) * strafeSpd * g.strafeDir * dt;
      const sy = ( dx / dist) * strafeSpd * g.strafeDir * dt;
      const nx = g.x + sx, ny = g.y + sy;
      const nc = cellOf(nx, ny);
      if (state.openCells.has(cellKey(nc.x, nc.y)) &&
          !crossesWall(state.removedWalls, g.x, g.y, nx, ny)) {
        g.x = nx; g.y = ny;
      } else {
        g.strafeDir *= -1;
        g.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME ?? 2;
      }
    }
  }

  if (g.shootCd > 0) g.shootCd -= dt;
  const shootRange = CONFIG.SHOOTER_SHOOT_RANGE_CELLS * CELL_PX * 10;
  if (dist <= shootRange && g.shootCd <= 0 && freezeTimer <= 0 && dist > 0) {
    g.shootCd = CONFIG.SHOOTER_SHOOT_CD * shootCdMult;
    state.enemyBullets.push({
      x: g.x, y: g.y,
      vx: (dx / dist) * CONFIG.SHOOTER_BULLET_SPEED * bulletSpeedMult,
      vy: (dy / dist) * CONFIG.SHOOTER_BULLET_SPEED * bulletSpeedMult,
      life: 6,
    });
  }
}

function _updateBossBullLimited(g, state, playerProgress, phase, dx, dy, dist, dt, freezeTimer) {
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
        let nx = g.x + (dx / dist) * CONFIG.BULL_SPEED * dt;
        let ny = g.y + (dy / dist) * CONFIG.BULL_SPEED * dt;
        const nc = cellOf(nx, ny);
        if (state.openCells.has(cellKey(nc.x, nc.y)) &&
            !crossesWall(state.removedWalls, g.x, g.y, nx, ny)) {
          g.x = nx; g.y = ny;
        }
      } else if (dist <= chargeDist) {
        g.state = 'prepare'; g.stateTimer = CONFIG.BULL_PREPARE_TIME;
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
      const spd = CONFIG.BULL_SPEED * 3 * dt;
      let nx = g.x + g.dashDirX * spd, ny = g.y + g.dashDirY * spd;
      const nc = cellOf(nx, ny);
      const wall = !state.openCells.has(cellKey(nc.x, nc.y)) ||
                   crossesWall(state.removedWalls, g.x, g.y, nx, ny);
      g.stateTimer += Math.hypot(nx - g.x, ny - g.y);
      if (wall || g.stateTimer >= g.dashDistance) {
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
        g.dashCount = (g.dashCount || 0) + 1;
        if (g.dashCount >= (phase.maxDashes || 3)) _advancePhase(g, _bossDefForCurrentLevel());
      } else { g.x = nx; g.y = ny; }
      if (Math.hypot(state.player.x - g.x, state.player.y - g.y) < hitDist) {
        dealPlayerDamage(state, playerProgress, true);
        _playerHitParticles(state.particles, state.player.x, state.player.y);
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
        g.dashCount = (g.dashCount || 0) + 1;
        if (g.dashCount >= (phase.maxDashes || 3)) _advancePhase(g, _bossDefForCurrentLevel());
      }
      break;
    }
    case 'rest':
      g.stateTimer -= dt;
      if (g.stateTimer <= 0) g.state = 'chase';
      break;
  }
}

// ── Boss kill handler ─────────────────────────────────────────

export function handleBossKilled(g, state, playerProgress) {
  state.bossDefeated = true;
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
