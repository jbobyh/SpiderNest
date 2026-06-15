// ============================================================
// ENEMY AI — updateEnemyAI(), enemyCollisions(), spawnCorpse()
// Works for both play-mode (scale=1) and battle-mode (BATTLE_SCALE).
// CONFIG / PLEVAKA_ANIMS are globals from config.js.
// ============================================================

import { cellOf, cellKey, inRoom, crossesWall, CELL_PX } from '../world/constants.js';
import { Sounds } from '../core/sound.js';
import { dealPlayerDamage } from './upgrades.js';

// ── Shared constants ──────────────────────────────────────────

const SHOOTER_STOP_DIST_CELLS  = () => CONFIG.SHOOTER_STOP_DIST_CELLS  * CELL_PX;
const SHOOTER_SHOOT_RANGE_CELLS = () => CONFIG.SHOOTER_SHOOT_RANGE_CELLS * CELL_PX;
const BULL_CHARGE_DIST_CELLS   = () => (CONFIG.BULL_CHARGE_DIST_CELLS ?? 1.5) * CELL_PX;
const BULL_DASH_DIST_CELLS     = () => (CONFIG.BULL_DASH_DISTANCE_CELLS ?? 3) * CELL_PX;

// ── Spawn corpse ──────────────────────────────────────────────

const CORPSE_DURATION = 2.0;

const CORPSE_TYPES = new Set(['soldier', 'chaser', 'plevaka', 'shooter', 'bull', 'buldyga', 'bloated']);

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

    // Stuck detection
    if (g.type !== 'cocoon' && g.type !== 'plevaka' && g.type !== 'shooter' && g.type !== 'bull') {
      if (g.lastX === undefined) { g.lastX = g.x; g.lastY = g.y; g.stuckTimer = 0; }
      const moved = Math.hypot(g.x - g.lastX, g.y - g.lastY);
      if (moved < 1) {
        g.stuckTimer += dt;
        if (g.stuckTimer >= 5) {
          spawnCorpse(s.deathCorpses, g, g.radius || CONFIG.SPIDER_RADIUS);
          _deathParticles(s.particles, g.x, g.y, 1);
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
      if (dist > STOP_DIST && dist > 0) {
        g.x += (dx / dist) * CONFIG.SHOOTER_SPEED * dt;
        g.y += (dy / dist) * CONFIG.SHOOTER_SPEED * dt;
        if (g.animState !== null && g.animState !== 'shoot') g.animState = 'run';
      } else {
        if (g.animState !== null && g.animState !== 'shoot') g.animState = 'idle';
      }
      if (g.shootCd > 0) g.shootCd -= dt;
      if (dist <= SHOOT_RANGE && g.shootCd <= 0 && dist > 0) {
        g.shootCd = CONFIG.SHOOTER_SHOOT_CD;
        if (g.animState !== null) { g.animState = 'shoot'; g.animFrame = 0; g.animTimer = 0; }
        s.enemyBullets.push({
          x: g.x, y: g.y,
          vx: (dx / dist) * CONFIG.SHOOTER_BULLET_SPEED,
          vy: (dy / dist) * CONFIG.SHOOTER_BULLET_SPEED,
          life: 6,
        });
      }

    } else if (g.type === 'bull') {
      _updateBullPlay(g, s, dx, dy, dist, dt, CHARGE_DIST, DASH_DIST, CP, playerProgress, onPlayerDamaged, i);
      continue; // bull manages its own splicing

    } else if (g.type === 'buldyga') {
      _updateBuldygaPlay(g, s, dx, dy, dist, dt, CP, playerProgress, onPlayerDamaged, i);
      continue;

    } else if (g.type === 'bloated') {
      let nx = g.x, ny = g.y;
      if (dist > 0) { nx += (dx / dist) * CONFIG.BLOATED_SPEED * dt; ny += (dy / dist) * CONFIG.BLOATED_SPEED * dt; }
      const nck = cellOf(nx, ny);
      if (s.openCells.has(cellKey(nck.x, nck.y)) && !crossesWall(s.removedWalls, g.x, g.y, nx, ny)) {
        g.x = nx; g.y = ny;
      }
      if (dist < (g.radius || CONFIG.BLOATED_RADIUS) + CONFIG.PLAYER_RADIUS) {
        if (!s.player.isDashing) {
          if (onPlayerDamaged) onPlayerDamaged(state, playerProgress, false);
          s.activeSpiders.splice(i, 1);
          _playerHitParticles(s.particles, s.player.x, s.player.y, 1);
        }
        continue;
      }

    } else if (g.type === 'cocoon') {
      _updateCocoonPlay(g, s, dt, i);
      continue;

    } else {
      // Soldier / chaser
      let nx = g.x, ny = g.y;
      if (dist > 0) { nx += (dx / dist) * CONFIG.SPIDER_SPEED * dt; ny += (dy / dist) * CONFIG.SPIDER_SPEED * dt; }
      const nck = cellOf(nx, ny);
      if (s.openCells.has(cellKey(nck.x, nck.y)) && !crossesWall(s.removedWalls, g.x, g.y, nx, ny)) {
        g.x = nx; g.y = ny;
      }
      if (dist < (g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.PLAYER_RADIUS) {
        if (!s.player.isDashing) {
          spawnCorpse(s.deathCorpses, g, g.radius || CONFIG.SPIDER_RADIUS);
          if (onPlayerDamaged) onPlayerDamaged(state, playerProgress, false);
          s.activeSpiders.splice(i, 1);
          _playerHitParticles(s.particles, s.player.x, s.player.y, 1);
        }
        continue;
      }
    }
  }
}

// ── Battle-mode enemy AI (scaled) ─────────────────────────────

export function updateBattleEnemyAI(state, playerProgress, dt, onPlayerDamaged) {
  const b   = state.battle;
  const BS  = CONFIG.BATTLE_SCALE;
  const CPB = CELL_PX * BS;

  const STOP_DIST   = SHOOTER_STOP_DIST_CELLS()   * BS;
  const SHOOT_RANGE = SHOOTER_SHOOT_RANGE_CELLS()  * BS;
  const CHARGE_DIST = BULL_CHARGE_DIST_CELLS()     * BS;
  const DASH_DIST   = BULL_DASH_DIST_CELLS()       * BS;

  for (let i = b.activeSpiders.length - 1; i >= 0; i--) {
    const g = b.activeSpiders[i];
    if (!g || g.x === undefined) continue;

    if (g.hitFlash > 0)  g.hitFlash  -= dt;
    if (g.stunTimer > 0) g.stunTimer -= dt;

    // Stuck detection
    if (g.type !== 'cocoon' && g.type !== 'plevaka' && g.type !== 'shooter' && g.type !== 'bull' && !g.isBoss) {
      if (g.lastX === undefined) { g.lastX = g.x; g.lastY = g.y; g.stuckTimer = 0; }
      const moved = Math.hypot(g.x - g.lastX, g.y - g.lastY);
      if (moved < 1) {
        g.stuckTimer += dt;
        if (g.stuckTimer >= 7) {
          spawnCorpse(b.deathCorpses, g, (g.radius || CONFIG.SPIDER_RADIUS) * BS);
          _deathParticles(b.particles, g.x, g.y, BS);
          b.activeSpiders.splice(i, 1);
          continue;
        }
      } else {
        g.stuckTimer = 0; g.lastX = g.x; g.lastY = g.y;
      }
    }

    const dx   = b.player.x - g.x;
    const dy   = b.player.y - g.y;
    const dist = Math.hypot(dx, dy);

    if (g.isBoss) continue; // handled by boss.js

    if (g.type === 'plevaka' || g.type === 'shooter') {
      _tickPlevakaAnim(g, dt);
      const stunned = g.stunTimer > 0;
      if (!stunned && b.freezeTimer <= 0 && dist > STOP_DIST && dist > 0) {
        let nx = g.x + (dx / dist) * CONFIG.SHOOTER_SPEED * BS * dt;
        let ny = g.y + (dy / dist) * CONFIG.SHOOTER_SPEED * BS * dt;
        if (_battleCellOk(b, CPB, nx, ny) && !_battleCrossesWall(b, CPB, g.x, g.y, nx, ny)) {
          g.x = nx; g.y = ny;
          if (g.animState !== null && g.animState !== 'shoot') g.animState = 'run';
        }
      } else {
        if (g.animState !== null && g.animState !== 'shoot') g.animState = 'idle';
      }
      if (g.shootCd > 0) g.shootCd -= dt;
      if (dist <= SHOOT_RANGE && g.shootCd <= 0 && b.freezeTimer <= 0 && dist > 0) {
        g.shootCd = CONFIG.SHOOTER_SHOOT_CD;
        if (g.animState !== null) { g.animState = 'shoot'; g.animFrame = 0; g.animTimer = 0; }
        b.enemyBullets.push({
          x: g.x, y: g.y,
          vx: (dx / dist) * CONFIG.SHOOTER_BULLET_SPEED * BS,
          vy: (dy / dist) * CONFIG.SHOOTER_BULLET_SPEED * BS,
          life: 6,
        });
      }

    } else if (g.type === 'bull') {
      _updateBullBattle(g, b, state, dx, dy, dist, dt, BS, CPB, CHARGE_DIST, DASH_DIST, playerProgress, onPlayerDamaged, i);
      continue;

    } else if (g.type === 'buldyga') {
      _updateBuldygaBattle(g, b, state, dx, dy, dist, dt, BS, CPB, playerProgress, onPlayerDamaged, i);
      continue;

    } else if (g.type === 'bloated') {
      if (g.stunTimer <= 0 && b.freezeTimer <= 0 && dist > 0) {
        let nx = g.x + (dx / dist) * CONFIG.BLOATED_SPEED * BS * dt;
        let ny = g.y + (dy / dist) * CONFIG.BLOATED_SPEED * BS * dt;
        if (_battleCellOk(b, CPB, nx, ny) && !_battleCrossesWall(b, CPB, g.x, g.y, nx, ny)) {
          g.x = nx; g.y = ny;
        }
      }
      if (dist < ((g.radius || CONFIG.BLOATED_RADIUS) + CONFIG.PLAYER_RADIUS) * BS) {
        if (!b.player.isDashing) {
          if (onPlayerDamaged) onPlayerDamaged(state, playerProgress, true);
          b.activeSpiders.splice(i, 1);
          _playerHitParticles(b.particles, b.player.x, b.player.y, BS);
        }
        continue;
      }

    } else if (g.type === 'cocoon') {
      _updateCocoonBattle(g, b, dt, BS, CPB, i);
      continue;

    } else {
      // Soldier / chaser
      if (g.stunTimer <= 0 && b.freezeTimer <= 0 && dist > 0) {
        let nx = g.x + (dx / dist) * CONFIG.SPIDER_SPEED * BS * dt;
        let ny = g.y + (dy / dist) * CONFIG.SPIDER_SPEED * BS * dt;
        if (_battleCellOk(b, CPB, nx, ny) && !_battleCrossesWall(b, CPB, g.x, g.y, nx, ny)) {
          g.x = nx; g.y = ny;
        }
      }
      if (dist < ((g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.PLAYER_RADIUS) * BS) {
        if (!b.player.isDashing) {
          spawnCorpse(b.deathCorpses, g, (g.radius || CONFIG.SPIDER_RADIUS) * BS);
          if (onPlayerDamaged) onPlayerDamaged(state, playerProgress, true);
          b.activeSpiders.splice(i, 1);
          _playerHitParticles(b.particles, b.player.x, b.player.y, BS);
        }
        continue;
      }
    }
  }
}

// ── Enemy ↔ enemy separations (play-mode) ─────────────────────

export function resolveEnemyCollisions(activeSpiders, openCells) {
  for (let i = 0; i < activeSpiders.length; i++) {
    const g1 = activeSpiders[i];
    for (let j = i + 1; j < activeSpiders.length; j++) {
      const g2  = activeSpiders[j];
      const dx  = g2.x - g1.x;
      const dy  = g2.y - g1.y;
      const d2  = dx * dx + dy * dy;
      const r1  = g1.radius || CONFIG.SPIDER_RADIUS;
      const r2  = g2.radius || CONFIG.SPIDER_RADIUS;
      const min = r1 + r2;
      if (d2 >= min * min || d2 <= 0) continue;
      const d   = Math.sqrt(d2);
      const ov  = min - d;
      const nx  = dx / d, ny = dy / d;
      const heavy1 = g1.type === 'bull' || g1.type === 'buldyga';
      const heavy2 = g2.type === 'bull' || g2.type === 'buldyga';
      let p1 = 0.5, p2 = 0.5;
      if (heavy1 && !heavy2)       { p1 = 0.3; p2 = 0.7; }
      else if (!heavy1 && heavy2)  { p1 = 0.7; p2 = 0.3; }
      const nx1 = g1.x - nx * ov * p1, ny1 = g1.y - ny * ov * p1;
      const nx2 = g2.x + nx * ov * p2, ny2 = g2.y + ny * ov * p2;
      const c1  = cellOf(nx1, ny1);
      const c2  = cellOf(nx2, ny2);
      if (openCells.has(cellKey(c1.x, c1.y))) { g1.x = nx1; g1.y = ny1; }
      if (openCells.has(cellKey(c2.x, c2.y))) { g2.x = nx2; g2.y = ny2; }
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

function _updateBullPlay(g, s, dx, dy, dist, dt, CHARGE_DIST, DASH_DIST, CP, playerProgress, onPlayerDamaged, i) {
  if (!g.state) g.state = 'chase';
  if (g.stateTimer === undefined) g.stateTimer = 0;
  const effectiveR = g.radius || CONFIG.BULL_RADIUS;
  const hitDist    = effectiveR + CONFIG.PLAYER_RADIUS;

  switch (g.state) {
    case 'chase':
      if (dist > CHARGE_DIST && dist > 0) {
        const nx = g.x + (dx / dist) * CONFIG.BULL_SPEED * dt;
        const ny = g.y + (dy / dist) * CONFIG.BULL_SPEED * dt;
        const nc = cellOf(nx, ny);
        if (s.openCells.has(cellKey(nc.x, nc.y)) && !crossesWall(s.removedWalls, g.x, g.y, nx, ny)) {
          g.x = nx; g.y = ny;
        }
      } else if (dist <= CHARGE_DIST) {
        g.state = 'prepare'; g.stateTimer = CONFIG.BULL_PREPARE_TIME;
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
      const spd = CONFIG.BULL_SPEED * 4 * dt;
      let nx = g.x + g.dashDirX * spd, ny = g.y + g.dashDirY * spd;
      const nc = cellOf(nx, ny);
      const wall = !s.openCells.has(cellKey(nc.x, nc.y));
      g.stateTimer += Math.hypot(nx - g.x, ny - g.y);
      if (wall || g.stateTimer >= g.dashDistance) {
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
      } else { g.x = nx; g.y = ny; }
      const nd = Math.hypot(s.player.x - g.x, s.player.y - g.y);
      if (nd < hitDist) {
        if (!s.player.isDashing && onPlayerDamaged) onPlayerDamaged(s, playerProgress, false);
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
      }
      break;
    }
    case 'rest':
      g.stateTimer -= dt;
      if (g.stateTimer <= 0) g.state = 'chase';
      break;
  }

  if (g.state !== 'dash' && dist < hitDist) {
    spawnCorpse(s.deathCorpses, g, g.radius || CONFIG.BULL_RADIUS);
    if (onPlayerDamaged) onPlayerDamaged(s, playerProgress, false);
    s.activeSpiders.splice(i, 1);
    _playerHitParticles(s.particles, s.player.x, s.player.y, 1);
  }
}

function _updateBuldygaPlay(g, s, dx, dy, dist, dt, CP, playerProgress, onPlayerDamaged, i) {
  if (g.currentSpeed === undefined) g.currentSpeed = CONFIG.BULDYGA_SPEED;
  if (g.speedAccumulator === undefined) g.speedAccumulator = 0;
  if (g.vx === undefined) { g.vx = 0; g.vy = 0; }

  g.speedAccumulator += dt;
  if (g.speedAccumulator >= 1.0) {
    const secs = Math.floor(g.speedAccumulator);
    g.currentSpeed    += CONFIG.BULDYGA_SPEED_INCREMENT * secs;
    g.speedAccumulator -= secs;
  }

  if (dist > 0) {
    const tvx = (dx / dist) * g.currentSpeed;
    const tvy = (dy / dist) * g.currentSpeed;
    const acc = CONFIG.BULDYGA_ACCEL * dt;
    g.vx += (tvx - g.vx) * Math.min(1, acc / g.currentSpeed);
    g.vy += (tvy - g.vy) * Math.min(1, acc / g.currentSpeed);
  } else {
    g.vx *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * dt);
    g.vy *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * dt);
  }

  const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
  const nc = cellOf(nx, ny);
  if (s.openCells.has(cellKey(nc.x, nc.y)) && !crossesWall(s.removedWalls, g.x, g.y, nx, ny)) {
    g.x = nx; g.y = ny;
  } else { g.vx *= -0.3; g.vy *= -0.3; }

  if (dist < (g.radius || CONFIG.BULDYGA_RADIUS) + CONFIG.PLAYER_RADIUS) {
    if (!s.player.isDashing) {
      spawnCorpse(s.deathCorpses, g, g.radius || CONFIG.BULDYGA_RADIUS);
      if (onPlayerDamaged) onPlayerDamaged(s, playerProgress, false);
      s.activeSpiders.splice(i, 1);
      _playerHitParticles(s.particles, s.player.x, s.player.y, 1);
    }
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

function _updateBullBattle(g, b, state, dx, dy, dist, dt, BS, CPB, CHARGE_DIST, DASH_DIST, playerProgress, onPlayerDamaged, i) {
  if (!g.state) g.state = 'chase';
  if (g.stateTimer === undefined) g.stateTimer = 0;
  const effectiveR = (g.radius || CONFIG.BULL_RADIUS) * BS;
  const hitDist    = effectiveR + CONFIG.PLAYER_RADIUS * BS;

  switch (g.state) {
    case 'chase':
      if (g.stunTimer <= 0 && b.freezeTimer <= 0 && dist > CHARGE_DIST && dist > 0) {
        let nx = g.x + (dx / dist) * CONFIG.BULL_SPEED * BS * dt;
        let ny = g.y + (dy / dist) * CONFIG.BULL_SPEED * BS * dt;
        if (_battleCellOk(b, CPB, nx, ny) && !_battleCrossesWall(b, CPB, g.x, g.y, nx, ny)) {
          g.x = nx; g.y = ny;
        }
      } else if (dist <= CHARGE_DIST) {
        g.state = 'prepare'; g.stateTimer = CONFIG.BULL_PREPARE_TIME;
      }
      break;
    case 'prepare':
      g.stateTimer -= dt;
      if (g.stateTimer <= 0) {
        g.state = 'dash';
        if (dist > 0) { g.dashDirX = dx / dist; g.dashDirY = dy / dist; }
        else          { g.dashDirX = 1; g.dashDirY = 0; }
        g.dashDistance = DASH_DIST; g.stateTimer = 0;
      }
      break;
    case 'dash': {
      const spd = CONFIG.BULL_SPEED * 3 * BS * dt;
      let nx = g.x + g.dashDirX * spd, ny = g.y + g.dashDirY * spd;
      const wall = !_battleCellOk(b, CPB, nx, ny) || _battleCrossesWall(b, CPB, g.x, g.y, nx, ny);
      g.stateTimer += Math.hypot(nx - g.x, ny - g.y);
      if (wall || g.stateTimer >= g.dashDistance) {
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
      } else { g.x = nx; g.y = ny; }
      if (Math.hypot(b.player.x - g.x, b.player.y - g.y) < hitDist) {
        if (!b.player.isDashing && onPlayerDamaged) onPlayerDamaged(state, playerProgress, true);
        g.state = 'rest'; g.stateTimer = CONFIG.BULL_REST_TIME;
      }
      break;
    }
    case 'rest':
      g.stateTimer -= dt;
      if (g.stateTimer <= 0) g.state = 'chase';
      break;
  }

  if (g.state !== 'dash' && dist < hitDist) {
    spawnCorpse(b.deathCorpses, g, (g.radius || CONFIG.BULL_RADIUS) * BS);
    if (onPlayerDamaged) onPlayerDamaged(state, playerProgress, true);
    b.activeSpiders.splice(i, 1);
    _playerHitParticles(b.particles, b.player.x, b.player.y, BS);
  }
}

function _updateBuldygaBattle(g, b, state, dx, dy, dist, dt, BS, CPB, playerProgress, onPlayerDamaged, i) {
  if (g.currentSpeed === undefined) g.currentSpeed = CONFIG.BULDYGA_SPEED * BS;
  if (g.speedAccumulator === undefined) g.speedAccumulator = 0;
  if (g.vx === undefined) { g.vx = 0; g.vy = 0; }

  g.speedAccumulator += dt;
  if (g.speedAccumulator >= 1.0) {
    const secs = Math.floor(g.speedAccumulator);
    g.currentSpeed    += CONFIG.BULDYGA_SPEED_INCREMENT * BS * secs;
    g.speedAccumulator -= secs;
  }

  const stunned = g.stunTimer > 0;
  if (!stunned && b.freezeTimer <= 0 && dist > 0) {
    const tvx = (dx / dist) * g.currentSpeed, tvy = (dy / dist) * g.currentSpeed;
    const acc = CONFIG.BULDYGA_ACCEL * BS * dt;
    g.vx += (tvx - g.vx) * Math.min(1, acc / g.currentSpeed);
    g.vy += (tvy - g.vy) * Math.min(1, acc / g.currentSpeed);
  } else if (b.freezeTimer > 0) {
    g.vx *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * dt);
    g.vy *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * dt);
  }

  const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
  if (_battleCellOk(b, CPB, nx, ny) && !_battleCrossesWall(b, CPB, g.x, g.y, nx, ny)) {
    g.x = nx; g.y = ny;
  } else { g.vx *= -0.3; g.vy *= -0.3; }

  if (dist < ((g.radius || CONFIG.BULDYGA_RADIUS) + CONFIG.PLAYER_RADIUS) * BS) {
    if (!b.player.isDashing) {
      spawnCorpse(b.deathCorpses, g, (g.radius || CONFIG.BULDYGA_RADIUS) * BS);
      if (onPlayerDamaged) onPlayerDamaged(state, playerProgress, true);
      b.activeSpiders.splice(i, 1);
      _playerHitParticles(b.particles, b.player.x, b.player.y, BS);
    }
  }
}

function _updateCocoonBattle(g, b, dt, BS, CPB, i) {
  const bcx = Math.floor(g.x / CPB) + b.cellOffsetX;
  const bcy = Math.floor(g.y / CPB) + b.cellOffsetY;
  if (!b.openCells.has(cellKey(bcx, bcy))) {
    b.activeSpiders.splice(i, 1);
    _deathParticles(b.particles, g.x, g.y, BS);
    return;
  }
  if (g.spawnTimer === undefined) g.spawnTimer = CONFIG.COCOON_SPAWN_INTERVAL;
  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0) {
    g.spawnTimer = CONFIG.COCOON_SPAWN_INTERVAL;
    const a = Math.random() * Math.PI * 2;
    const d = ((g.radius || CONFIG.COCOON_RADIUS) + CONFIG.SPIDER_RADIUS + 5) * BS;
    b.activeSpiders.push({
      ..._makeSoldier(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d),
      stunTimer: 0,
    });
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

// ── Battle wall helpers (duplicated to avoid circular import) ──

function _battleCellOk(b, CPB, x, y) {
  const cx = Math.floor(x / CPB) + b.cellOffsetX;
  const cy = Math.floor(y / CPB) + b.cellOffsetY;
  return b.openCells.has(cellKey(cx, cy));
}

function _battleCrossesWall(b, CPB, x0, y0, x1, y1) {
  const c0x = Math.floor(x0 / CPB) + b.cellOffsetX;
  const c0y = Math.floor(y0 / CPB) + b.cellOffsetY;
  const c1x = Math.floor(x1 / CPB) + b.cellOffsetX;
  const c1y = Math.floor(y1 / CPB) + b.cellOffsetY;
  if (c0x === c1x && c0y === c1y) return false;
  const wk = c0x > c1x || (c0x === c1x && c0y > c1y)
    ? `${c1x},${c1y}|${c0x},${c0y}`
    : `${c0x},${c0y}|${c1x},${c1y}`;
  return !b.removedWalls.has(wk);
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
