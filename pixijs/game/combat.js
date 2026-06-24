// ============================================================
// COMBAT — shoot(), updateBullets(), updateEnemyBullets()
// Works for both play-mode (scale=1) and battle-mode (scale=BATTLE_SCALE).
// CONFIG / WEAPON_DEFS are globals loaded from config.js.
// ============================================================

import { inRoom, cellOf, cellKey, CELL_PX, crossesWall, getRoomBonus } from '../world/constants.js';
import { Sounds } from '../core/sound.js';
import { spawnParticles } from '../render/particles.js';
import { spawnDamageNumber } from '../render/damage-numbers.js';

// ── Weapon helpers ────────────────────────────────────────────

export function getActiveWeapon(state) {
  const weaponId = state.weaponSlots[state.activeSlot];
  return weaponId ? WEAPON_DEFS[weaponId] : null;
}

// ── Shoot (play-mode) ─────────────────────────────────────────

export function shoot(state) {
  if (state.shootCooldown > 0) return;

  const weapon = getActiveWeapon(state);
  if (!weapon) return;

  // Burst continuation check
  if (state.burstRemaining > 0 && state.burstWeaponId === weapon.id) {
    if (state.burstCooldown > 0) return;
  } else if (state.burstRemaining > 0) {
    state.burstRemaining = 0;
    state.burstWeaponId  = null;
    state.burstCooldown  = 0;
  }

  const killAccelMult = state.upgrades.killAccel
    ? Math.max(0.1, 1 - state.upgrades.killAccelPercent / 100)
    : 1.0;
  const cooldown = weapon.cooldown * state.upgrades.cooldownMult * killAccelMult;

  const dx = state.mouse.x - state.player.x;
  const dy = state.mouse.y - state.player.y;
  const baseAngle = Math.atan2(dy, dx);

  const isBurstWeapon = weapon.burstSize && weapon.burstSize > 1;
  const pellets       = isBurstWeapon ? weapon.pellets : weapon.pellets + state.upgrades.pellets;
  const burstTotal    = isBurstWeapon ? weapon.burstSize + state.upgrades.pellets : weapon.burstSize;
  const burstDelay    = _burstStepDelay(weapon, burstTotal);
  let   totalSpread   = weapon.spread * state.upgrades.spreadMult;
  const bulletSpeed   = weapon.bulletSpeed * state.upgrades.bulletSpeedMult;

  // Sniper upgrade: perfect accuracy when ≤2 rooms
  if (state.upgrades.sniper && state.battle?.openCells) {
    const roomCount = state.battle.openCells.size;
    if (roomCount <= 2)   totalSpread = 0;
    else                  totalSpread *= 1 + 0.10 * (roomCount - 2);
  }

  Sounds.shot(weapon.id);

  for (let i = 0; i < pellets; i++) {
    const spread = (Math.random() - 0.5) * totalSpread;
    _createBullet(state, weapon, baseAngle + spread, bulletSpeed);
  }

  // Muzzle flash particles
  spawnParticles(state.particles, state.player.x, state.player.y,
    CONFIG.MUZZLE_PARTICLES_COUNT, baseAngle, CONFIG.MUZZLE_PARTICLES_SPREAD,
    CONFIG.MUZZLE_PARTICLES_SPEED_MIN, CONFIG.MUZZLE_PARTICLES_SPEED_MAX,
    CONFIG.MUZZLE_PARTICLES_LIFE, '#ffff00');

  _applyBurstCooldown(state, weapon, isBurstWeapon, burstTotal, burstDelay, cooldown);
}

// ── shootBattle (battle-mode) ─────────────────────────────────

export function shootBattle(state) {
  const b = state.battle;
  if (!b || state.shootCooldown > 0) return;

  const weapon = getActiveWeapon(state);
  if (!weapon) return;

  const BS = CONFIG.BATTLE_SCALE;

  if (state.burstRemaining > 0 && state.burstWeaponId === weapon.id) {
    if (state.burstCooldown > 0) return;
  } else if (state.burstRemaining > 0) {
    state.burstRemaining = 0;
    state.burstWeaponId  = null;
    state.burstCooldown  = 0;
  }

  const killAccelMult = state.upgrades.killAccel
    ? Math.max(0.1, 1 - state.upgrades.killAccelPercent / 100)
    : 1.0;
  const cooldown    = weapon.cooldown * state.upgrades.cooldownMult * killAccelMult;
  const isBurstWeapon = weapon.burstSize && weapon.burstSize > 1;
  const pellets       = isBurstWeapon ? weapon.pellets : weapon.pellets + state.upgrades.pellets;
  const burstTotal    = isBurstWeapon ? weapon.burstSize + state.upgrades.pellets : weapon.burstSize;
  const burstDelay    = _burstStepDelay(weapon, burstTotal);
  let   totalSpread   = weapon.spread * state.upgrades.spreadMult;
  const bulletSpeed   = weapon.bulletSpeed * state.upgrades.bulletSpeedMult * BS;

  if (state.upgrades.sniper && b?.openCells) {
    const roomCount = b.openCells.size;
    if (roomCount <= 2)  totalSpread = 0;
    else                 totalSpread *= 1 + 0.10 * (roomCount - 2);
  }

  const dx = state.mouse.x - b.player.x;
  const dy = state.mouse.y - b.player.y;
  const baseAngle = Math.atan2(dy, dx);

  Sounds.shot(weapon.id);

  for (let i = 0; i < pellets; i++) {
    const spread = (Math.random() - 0.5) * totalSpread;
    _createBattleBullet(state, b, weapon, baseAngle + spread, bulletSpeed, BS);
  }

  spawnParticles(b.particles, b.player.x, b.player.y,
    CONFIG.MUZZLE_PARTICLES_COUNT, baseAngle, CONFIG.MUZZLE_PARTICLES_SPREAD,
    CONFIG.MUZZLE_PARTICLES_SPEED_MIN * BS, CONFIG.MUZZLE_PARTICLES_SPEED_MAX * BS,
    CONFIG.MUZZLE_PARTICLES_LIFE, '#ffff00');

  _applyBurstCooldown(state, weapon, isBurstWeapon, burstTotal, burstDelay, cooldown);
}

// ── Update bullets (play-mode) ────────────────────────────────

export function updateBullets(state, dt, onEnemyKilled, onPlayerHit) {
  const bullets = state.bullets;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const prevX = b.x, prevY = b.y;
    b.x    += b.vx * dt;
    b.y    += b.vy * dt;
    b.distanceTraveled += Math.hypot(b.x - prevX, b.y - prevY);

    // Check room bonus for speed/penetrate
    const bulletCell = cellOf(b.x, b.y);
    const bulletCellKey = cellKey(bulletCell.x, bulletCell.y);
    const roomBonus = getRoomBonus(state, bulletCellKey);
    
    if (roomBonus !== b._lastRoomBonus) {
      // Speed bonus
      if (roomBonus === 'speedup' && b._lastRoomBonus !== 'speedup') {
        const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speedup');
        const mult = bonusDef?.speedMult || 1.3;
        b.vx = b._baseVx * mult;
        b.vy = b._baseVy * mult;
      } else if (roomBonus === 'speeddown' && b._lastRoomBonus !== 'speeddown') {
        const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speeddown');
        const mult = bonusDef?.speedMult || 0.7;
        b.vx = b._baseVx * mult;
        b.vy = b._baseVy * mult;
      } else if (b._lastRoomBonus === 'speedup' || b._lastRoomBonus === 'speeddown') {
        // Exiting speed bonus room
        b.vx = b._baseVx;
        b.vy = b._baseVy;
      }
      
      // Penetrate bonus
      if (roomBonus === 'penetrate') {
        b.penetrate = Infinity;
      } else if (b._lastRoomBonus === 'penetrate') {
        b.penetrate = b._basePenetrate;
      }
      
      b._lastRoomBonus = roomBonus;
    }

    if (b.distanceTraveled >= b.maxRange) {
      Sounds.wallhit();
      spawnParticles(state.particles, b.x, b.y,
        CONFIG.WALL_HIT_PARTICLES_COUNT, 0, Math.PI * 2,
        CONFIG.WALL_HIT_PARTICLES_SPEED, CONFIG.WALL_HIT_PARTICLES_SPEED,
        CONFIG.WALL_HIT_PARTICLES_LIFE, '#88aaff');
      bullets.splice(i, 1);
      continue;
    }

    // Check partition wall crossing
    const hitsPartition = crossesWall(state.removedWalls, prevX, prevY, b.x, b.y);

    if (!inRoom(b.x, b.y, state.openCells) || hitsPartition) {
      if (b.ricochet && !b._ricocheted) {
        b._ricocheted = true;
        const px = b.x - b.vx * dt, py = b.y - b.vy * dt;

        // Determine bounce direction by checking which cell boundary was crossed
        const c0x = Math.floor(prevX / CELL_PX);
        const c0y = Math.floor(prevY / CELL_PX);
        const c1x = Math.floor(b.x / CELL_PX);
        const c1y = Math.floor(b.y / CELL_PX);

        if (c0x !== c1x && c0y !== c1y) {
          // Hit corner - bounce both
          b.vx = -b.vx; b.vy = -b.vy; b.x = px; b.y = py;
        } else if (c0x !== c1x) {
          // Crossed vertical cell boundary - bounce X
          b.vx = -b.vx; b.x = px;
        } else {
          // Crossed horizontal cell boundary - bounce Y
          b.vy = -b.vy; b.y = py;
        }

        b.hitSpiders = undefined;
        Sounds.wallhit();
        spawnParticles(state.particles, b.x, b.y, CONFIG.WALL_HIT_PARTICLES_COUNT, 0, Math.PI * 2,
          CONFIG.WALL_HIT_PARTICLES_SPEED, CONFIG.WALL_HIT_PARTICLES_SPEED,
          CONFIG.WALL_HIT_PARTICLES_LIFE, '#22ffdd');
      } else {
        Sounds.wallhit();
        spawnParticles(state.particles, b.x, b.y, CONFIG.WALL_HIT_PARTICLES_COUNT, 0, Math.PI * 2,
          CONFIG.WALL_HIT_PARTICLES_SPEED, CONFIG.WALL_HIT_PARTICLES_SPEED,
          CONFIG.WALL_HIT_PARTICLES_LIFE, '#88aaff');
        bullets.splice(i, 1);
        continue;
      }
    } else {
      b._ricocheted = false;
    }

    // Hit enemies
    let removed = false;
    for (let j = state.activeSpiders.length - 1; j >= 0; j--) {
      const g = state.activeSpiders[j];
      if (b.hitSpiders && b.hitSpiders.has(j)) continue;
      const dist = Math.hypot(b.x - g.x, b.y - g.y);
      if (dist >= (g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.BULLET_RADIUS) continue;

      // Enhanced pierce double-damage
      if (b.hitCount > 0 && state.upgrades.enhancedPierce && b.enhancedPierceActive) {
        b.damage *= 2;
      }

      const damage = b.damage || CONFIG.BULLET_DAMAGE;
      if (g.takeDamage) {
        g.takeDamage(damage, b.isCrit);
      } else {
        g.hp      -= damage;
        g.hitFlash = CONFIG.ENEMY_HIT_FLASH_DURATION;
        if (!g.isBoss) g.stunTimer = CONFIG.ENEMY_STUN_DURATION;
        Sounds.hit();
      }
      spawnDamageNumber(state, g.x, g.y - (g.radius || CONFIG.SPIDER_RADIUS), damage, b.isCrit, 1);

      const bAngle = Math.atan2(b.vy, b.vx);
      for (let k = 0; k < CONFIG.HIT_PARTICLES_COUNT; k++) {
        const sp = bAngle + (Math.random() - 0.5) * CONFIG.HIT_PARTICLES_SPREAD;
        const spd = CONFIG.HIT_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.HIT_PARTICLES_SPEED_MAX - CONFIG.HIT_PARTICLES_SPEED_MIN);
        state.particles.push({ x: g.x, y: g.y, vx: Math.cos(sp) * spd, vy: Math.sin(sp) * spd,
          life: CONFIG.HIT_PARTICLES_LIFE, maxLife: CONFIG.HIT_PARTICLES_LIFE, color: CONFIG.HIT_PARTICLES_COLOR });
      }

      if (g.hp <= 0) {
        if (onEnemyKilled) onEnemyKilled(g, state);
      }

      b.hitCount++;
      if (!b.hitSpiders) b.hitSpiders = new Set();
      b.hitSpiders.add(j);
      if (b.hitCount === 1 && state.upgrades.enhancedPierce && !b.enhancedPierceActive) {
        b.enhancedPierceActive = Math.random() < 0.5;
      }
      if (b.hitCount > b.penetrate) {
        bullets.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (removed) continue;
  }
}

// ── Update bullets (battle-mode) ──────────────────────────────

export function updateBattleBullets(state, dt, onEnemyKilled) {
  const b       = state.battle;
  const BS      = CONFIG.BATTLE_SCALE;
  const CPB     = CELL_PX * BS; // battle cell size in px
  const bullets = b.bullets;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bul = bullets[i];
    const bulDx = bul.vx * dt;
    const bulDy = bul.vy * dt;
    bul.x    += bulDx;
    bul.y    += bulDy;
    bul.distanceTraveled += Math.hypot(bulDx, bulDy);

    // Check room bonus for speed/penetrate (convert battle coords to world coords)
    const bcx = Math.floor(bul.x / CPB) + b.cellOffsetX;
    const bcy = Math.floor(bul.y / CPB) + b.cellOffsetY;
    const bulletCellKey = cellKey(bcx, bcy);
    const roomBonus = getRoomBonus(state, bulletCellKey);
    
    if (roomBonus !== bul._lastRoomBonus) {
      // Speed bonus
      if (roomBonus === 'speedup' && bul._lastRoomBonus !== 'speedup') {
        const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speedup');
        const mult = bonusDef?.speedMult || 1.3;
        bul.vx = bul._baseVx * mult;
        bul.vy = bul._baseVy * mult;
      } else if (roomBonus === 'speeddown' && bul._lastRoomBonus !== 'speeddown') {
        const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speeddown');
        const mult = bonusDef?.speedMult || 0.7;
        bul.vx = bul._baseVx * mult;
        bul.vy = bul._baseVy * mult;
      } else if (bul._lastRoomBonus === 'speedup' || bul._lastRoomBonus === 'speeddown') {
        // Exiting speed bonus room
        bul.vx = bul._baseVx;
        bul.vy = bul._baseVy;
      }
      
      // Penetrate bonus
      if (roomBonus === 'penetrate') {
        bul.penetrate = Infinity;
      } else if (bul._lastRoomBonus === 'penetrate') {
        bul.penetrate = bul._basePenetrate;
      }
      
      bul._lastRoomBonus = roomBonus;
    }

    if (bul.distanceTraveled >= bul.maxRange) {
      _battleWallHit(b, bul);
      bullets.splice(i, 1);
      continue;
    }

    const oob = bul.x < 0 || bul.x > b.width || bul.y < 0 || bul.y > b.height;
    let bouncedThisFrame = false;
    if (oob) {
      if (bul.ricochet && !bul._ricocheted) {
        bul._ricocheted = true;
        bouncedThisFrame = true;
        if (bul.x < 0 || bul.x > b.width)   { bul.vx = -bul.vx; bul.x = bul.x < 0 ? 0.1 : b.width - 0.1; }
        if (bul.y < 0 || bul.y > b.height)  { bul.vy = -bul.vy; bul.y = bul.y < 0 ? 0.1 : b.height - 0.1; }
        bul.hitSpiders = undefined;
        _battleWallHitRico(b, bul, BS);
      } else {
        _battleWallHit(b, bul, BS);
        bullets.splice(i, 1);
        continue;
      }
    }

    if (!bouncedThisFrame) {
      const bcx = Math.floor(bul.x / CPB) + b.cellOffsetX;
      const bcy = Math.floor(bul.y / CPB) + b.cellOffsetY;
      const prevX = bul.x - bul.vx * dt;
      const prevY = bul.y - bul.vy * dt;
      const hitsPartition = _battleCrossesWall(b, CPB, prevX, prevY, bul.x, bul.y);

      if (!b.openCells.has(cellKey(bcx, bcy)) || hitsPartition) {
        if (bul.ricochet && !bul._ricocheted) {
          bul._ricocheted = true;
          const px2 = bul.x - bul.vx * dt, py2 = bul.y - bul.vy * dt;
          const cx1 = Math.floor(bul.x / CPB) + b.cellOffsetX;
          const cy1 = Math.floor(py2  / CPB) + b.cellOffsetY;
          const cx2 = Math.floor(px2  / CPB) + b.cellOffsetX;
          const cy2 = Math.floor(bul.y / CPB) + b.cellOffsetY;
          const xOk = b.openCells.has(cellKey(cx1, cy1));
          const yOk = b.openCells.has(cellKey(cx2, cy2));
          if (xOk)      { bul.vy = -bul.vy; bul.y = py2; }
          else if (yOk) { bul.vx = -bul.vx; bul.x = px2; }
          else          { bul.vx = -bul.vx; bul.vy = -bul.vy; bul.x = px2; bul.y = py2; }
          bul.hitSpiders = undefined;
          _battleWallHitRico(b, bul, BS);
        } else {
          _battleWallHit(b, bul, BS);
          bullets.splice(i, 1);
          continue;
        }
      } else {
        bul._ricocheted = false;
      }
    }

    // Hit enemies
    let removed = false;
    for (let j = b.activeSpiders.length - 1; j >= 0; j--) {
      const g = b.activeSpiders[j];
      if (bul.hitSpiders && bul.hitSpiders.has(j)) continue;
      const dist = Math.hypot(bul.x - g.x, bul.y - g.y);
      if (dist >= ((g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.BULLET_RADIUS) * BS) continue;

      const damage = bul.damage || CONFIG.BULLET_DAMAGE;
      if (bul.hitCount > 0 && state.upgrades.enhancedPierce && bul.enhancedPierceActive) {
        bul.damage *= 2;
      }

      if (g.takeDamage) {
        g.takeDamage(damage, bul.isCrit);
      } else {
        g.hp      -= damage;
        g.hitFlash = CONFIG.ENEMY_HIT_FLASH_DURATION;
        if (!g.isBoss) g.stunTimer = CONFIG.ENEMY_STUN_DURATION;
        Sounds.hit();
      }

      const bAngle = Math.atan2(bul.vy, bul.vx);
      for (let k = 0; k < CONFIG.HIT_PARTICLES_COUNT; k++) {
        const sp = bAngle + (Math.random() - 0.5) * CONFIG.HIT_PARTICLES_SPREAD;
        const spd = CONFIG.HIT_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.HIT_PARTICLES_SPEED_MAX - CONFIG.HIT_PARTICLES_SPEED_MIN);
        b.particles.push({ x: g.x, y: g.y, vx: Math.cos(sp) * spd * BS, vy: Math.sin(sp) * spd * BS,
          life: CONFIG.HIT_PARTICLES_LIFE, maxLife: CONFIG.HIT_PARTICLES_LIFE, color: CONFIG.HIT_PARTICLES_COLOR });
      }

      if (g.hp <= 0) {
        if (onEnemyKilled) onEnemyKilled(g, state, b, j);
      }

      bul.hitCount++;
      if (!bul.hitSpiders) bul.hitSpiders = new Set();
      bul.hitSpiders.add(j);
      if (bul.hitCount === 1 && state.upgrades.enhancedPierce && !bul.enhancedPierceActive) {
        bul.enhancedPierceActive = Math.random() < 0.5;
      }
      if (bul.hitCount > bul.penetrate) {
        bullets.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (removed) continue;
  }
}

// ── Update enemy bullets (play-mode) ──────────────────────────

export function updateEnemyBullets(state, dt, onPlayerHit) {
  const ebs = state.enemyBullets;
  for (let i = ebs.length - 1; i >= 0; i--) {
    const eb = ebs[i];
    const prevX = eb.x, prevY = eb.y;
    eb.x += eb.vx * dt;
    eb.y += eb.vy * dt;
    eb.distanceTraveled += Math.hypot(eb.x - prevX, eb.y - prevY);

    // Check room bonus for speed
    const bulletCell = cellOf(eb.x, eb.y);
    const bulletCellKey = cellKey(bulletCell.x, bulletCell.y);
    const roomBonus = getRoomBonus(state, bulletCellKey);
    if (roomBonus !== eb._lastRoomBonus) {
      if (roomBonus === 'speedup' && eb._lastRoomBonus !== 'speedup') {
        const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speedup');
        const mult = bonusDef?.speedMult || 1.3;
        eb.vx = eb._baseVx * mult;
        eb.vy = eb._baseVy * mult;
      } else if (roomBonus === 'speeddown' && eb._lastRoomBonus !== 'speeddown') {
        const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speeddown');
        const mult = bonusDef?.speedMult || 0.7;
        eb.vx = eb._baseVx * mult;
        eb.vy = eb._baseVy * mult;
      } else if (eb._lastRoomBonus === 'speedup' || eb._lastRoomBonus === 'speeddown') {
        eb.vx = eb._baseVx;
        eb.vy = eb._baseVy;
      }
      eb._lastRoomBonus = roomBonus;
    }

    // Check partition wall crossing
    const hitsPartition = crossesWall(state.removedWalls, prevX, prevY, eb.x, eb.y);

    if (!inRoom(eb.x, eb.y, state.openCells) || hitsPartition || eb.distanceTraveled >= eb.maxRange) {
      for (let j = 0; j < 4; j++) {
        const a = Math.random() * Math.PI * 2;
        state.particles.push({ x: eb.x, y: eb.y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30,
          life: 0.25, maxLife: 0.25, color: '#ff6600' });
      }
      ebs.splice(i, 1);
      continue;
    }

    const pd = Math.hypot(eb.x - state.player.x, eb.y - state.player.y);
    if (pd < CONFIG.PLAYER_RADIUS + CONFIG.BULLET_RADIUS) {
      if (!state.player.isDashing) {
        if (onPlayerHit) onPlayerHit(state, false);
        ebs.splice(i, 1);
        _playerHitParticles(state.particles, state.player.x, state.player.y, 1);
      }
    }
  }
}

// ── Update enemy bullets (battle-mode) ────────────────────────

export function updateBattleEnemyBullets(state, dt, onPlayerHit) {
  const b   = state.battle;
  const BS  = CONFIG.BATTLE_SCALE;
  const CPB = CELL_PX * BS;
  const ebs = b.enemyBullets;

  for (let i = ebs.length - 1; i >= 0; i--) {
    const eb = ebs[i];
    const prevX = eb.x, prevY = eb.y;
    eb.x += eb.vx * dt;
    eb.y += eb.vy * dt;
    eb.distanceTraveled += Math.hypot(eb.x - prevX, eb.y - prevY);

    // Check room bonus for speed (convert battle coords to world coords)
    const bcx = Math.floor(eb.x / CPB) + b.cellOffsetX;
    const bcy = Math.floor(eb.y / CPB) + b.cellOffsetY;
    const bulletCellKey = cellKey(bcx, bcy);
    const roomBonus = getRoomBonus(state, bulletCellKey);
    if (roomBonus !== eb._lastRoomBonus) {
      if (roomBonus === 'speedup' && eb._lastRoomBonus !== 'speedup') {
        const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speedup');
        const mult = bonusDef?.speedMult || 1.3;
        eb.vx = eb._baseVx * mult;
        eb.vy = eb._baseVy * mult;
      } else if (roomBonus === 'speeddown' && eb._lastRoomBonus !== 'speeddown') {
        const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speeddown');
        const mult = bonusDef?.speedMult || 0.7;
        eb.vx = eb._baseVx * mult;
        eb.vy = eb._baseVy * mult;
      } else if (eb._lastRoomBonus === 'speedup' || eb._lastRoomBonus === 'speeddown') {
        eb.vx = eb._baseVx;
        eb.vy = eb._baseVy;
      }
      eb._lastRoomBonus = roomBonus;
    }

    const oob = eb.x < 0 || eb.x > b.width || eb.y < 0 || eb.y > b.height;
    const hitsPartition = _battleCrossesWall(b, CPB, prevX, prevY, eb.x, eb.y);

    if (!b.openCells.has(cellKey(bcx, bcy)) || oob || hitsPartition || eb.distanceTraveled >= eb.maxRange) {
      for (let j = 0; j < 4; j++) {
        const a = Math.random() * Math.PI * 2;
        b.particles.push({ x: eb.x, y: eb.y, vx: Math.cos(a) * 30 * BS, vy: Math.sin(a) * 30 * BS,
          life: 0.25, maxLife: 0.25, color: '#ff6600' });
      }
      ebs.splice(i, 1);
      continue;
    }

    const pd = Math.hypot(eb.x - b.player.x, eb.y - b.player.y);
    if (pd < (CONFIG.PLAYER_RADIUS + CONFIG.BULLET_RADIUS) * BS) {
      if (!b.player.isDashing) {
        if (onPlayerHit) onPlayerHit(state, true);
        ebs.splice(i, 1);
        _playerHitParticles(b.particles, b.player.x, b.player.y, BS);
      }
    }
  }
}

// ── Reflection bullets ────────────────────────────────────────

export function fireReflectionBullets(state) {
  const weapon = getActiveWeapon(state);
  if (!weapon) return;

  const px = state.player.x;
  const py = state.player.y;

  const nearest = [...state.activeSpiders]
    .map(e => ({ e, d: Math.hypot(e.x - px, e.y - py) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);

  const bulletSpeed = weapon.bulletSpeed * state.upgrades.bulletSpeedMult;
  const damage      = weapon.damage + state.upgrades.damage;

  for (const { e } of nearest) {
    const angle = Math.atan2(e.y - py, e.x - px);
    const baseVx = Math.cos(angle) * bulletSpeed;
    const baseVy = Math.sin(angle) * bulletSpeed;
    const basePenetrate = state.upgrades.infinitePenetrate ? Infinity : weapon.penetrate + state.upgrades.penetrate;
    state.bullets.push({
      x: px, y: py,
      vx: baseVx,
      vy: baseVy,
      maxRange: _bulletRange(state, weapon, 1),
      distanceTraveled: 0,
      damage, penetrate: basePenetrate,
      _baseVx: baseVx,
      _baseVy: baseVy,
      _basePenetrate: basePenetrate,
      _lastRoomBonus: null,
      hitCount: 0, isCrit: false, enhancedPierceActive: false,
      ricochet: !!state.upgrades.ricochet,
    });
  }
}

// ── Weapon pickup ─────────────────────────────────────────────

export function pickupWeapon(state, weaponId, particles, px, py, scale, dropPlayX, dropPlayY) {
  scale = scale ?? 1;
  let freeSlot = -1;
  for (let i = 0; i < state.maxSlots; i++) {
    if (!state.weaponSlots[i]) { freeSlot = i; break; }
  }

  if (freeSlot >= 0) {
    state.weaponSlots[freeSlot] = weaponId;
    state.activeSlot            = freeSlot;
  } else {
    const droppedId = state.weaponSlots[state.activeSlot];
    if (droppedId) {
      const dox = dropPlayX ?? px;
      const doy = dropPlayY ?? py;
      const wc  = cellOf(dox, doy);
      state.droppedWeapons.push({ x: dox, y: doy, weaponId: droppedId, cellKey: cellKey(wc.x, wc.y) });
    }
    state.weaponSlots[state.activeSlot] = weaponId;
  }

  Sounds.weaponcollect();
  const wDef = WEAPON_DEFS[weaponId];
  spawnParticles(particles, px, py,
    CONFIG.PICKUP_PARTICLES_COUNT, 0, Math.PI * 2,
    CONFIG.PICKUP_PARTICLES_SPEED * scale, CONFIG.PICKUP_PARTICLES_SPEED * scale,
    CONFIG.PICKUP_PARTICLES_LIFE, wDef ? wDef.color : '#ffffff');
}

// ── Internal helpers ──────────────────────────────────────────

function _createBullet(state, weapon, angle, bulletSpeed) {
  const isCrit  = Math.random() < state.upgrades.critChance;
  let   damage  = weapon.damage + state.upgrades.damage;
  if (isCrit) damage *= 2;

  const basePenetrate = state.upgrades.infinitePenetrate ? Infinity : weapon.penetrate + state.upgrades.penetrate;
  const baseVx = Math.cos(angle) * bulletSpeed;
  const baseVy = Math.sin(angle) * bulletSpeed;

  state.bullets.push({
    x: state.player.x, y: state.player.y,
    vx: baseVx,
    vy: baseVy,
    maxRange: _bulletRange(state, weapon, 1),
    distanceTraveled: 0,
    damage, penetrate: basePenetrate,
    _baseVx: baseVx,
    _baseVy: baseVy,
    _basePenetrate: basePenetrate,
    _lastRoomBonus: null,
    hitCount: 0, isCrit, enhancedPierceActive: false,
    ricochet: !!state.upgrades.ricochet,
  });
}

function _createBattleBullet(state, b, weapon, angle, bulletSpeed, BS) {
  const isCrit = Math.random() < state.upgrades.critChance;
  let   damage = weapon.damage + state.upgrades.damage;
  if (isCrit) damage *= 2;

  const basePenetrate = state.upgrades.infinitePenetrate ? Infinity : weapon.penetrate + state.upgrades.penetrate;
  const baseVx = Math.cos(angle) * bulletSpeed;
  const baseVy = Math.sin(angle) * bulletSpeed;

  b.bullets.push({
    x: b.player.x, y: b.player.y,
    vx: baseVx,
    vy: baseVy,
    maxRange: _bulletRange(state, weapon, BS),
    distanceTraveled: 0,
    damage, penetrate: basePenetrate,
    _baseVx: baseVx,
    _baseVy: baseVy,
    _basePenetrate: basePenetrate,
    _lastRoomBonus: null,
    hitCount: 0, isCrit, enhancedPierceActive: false,
    ricochet: !!state.upgrades.ricochet,
  });
}

function _bulletRange(state, weapon, scale) {
  if (state.upgrades.infiniteRange) return Infinity;
  const RANGE_SCALE = CELL_PX / 10;
  let range = (weapon.range != null
    ? weapon.range * RANGE_SCALE * scale
    : CONFIG.BULLET_LIFE * weapon.bulletSpeed * scale);
  if (state.upgrades.ricochet) range *= 1.5;
  if (state.upgrades.longRange && state.openCells) {
    range *= 1 + 0.20 * state.openCells.size;
  }
  return range;
}

export const ENEMY_BULLET_TIME = 6;

export function enemyBulletRange(vx, vy) {
  return Math.hypot(vx, vy) * ENEMY_BULLET_TIME;
}

function _burstStepDelay(weapon, total) {
  if (!weapon.burstDuration || total <= 1) return 0;
  return weapon.burstDuration / (total - 1);
}

function _applyBurstCooldown(state, weapon, isBurstWeapon, burstTotal, burstDelay, cooldown) {
  if (!isBurstWeapon) {
    state.shootCooldown    = cooldown;
    state.maxShootCooldown = cooldown;
    return;
  }
  if (state.burstRemaining === 0) {
    state.burstRemaining = burstTotal - 1;
    state.burstWeaponId  = weapon.id;
    state.burstCooldown  = burstDelay;
    state.shootCooldown  = 0;
  } else {
    state.burstRemaining--;
    if (state.burstRemaining > 0) {
      state.burstCooldown = burstDelay;
      state.shootCooldown = 0;
    } else {
      state.burstWeaponId    = null;
      state.shootCooldown    = cooldown;
      state.maxShootCooldown = cooldown;
    }
  }
}

function _battleWallHit(b, bul, BS = 1) {
  Sounds.wallhit();
  for (let k = 0; k < 5; k++) {
    const a = Math.random() * Math.PI * 2;
    b.particles.push({ x: bul.x, y: bul.y, vx: Math.cos(a) * 40 * BS, vy: Math.sin(a) * 40 * BS,
      life: 0.3, maxLife: 0.3, color: '#888888' });
  }
}

function _battleWallHitRico(b, bul, BS) {
  Sounds.wallhit();
  for (let k = 0; k < 5; k++) {
    const a = Math.random() * Math.PI * 2;
    b.particles.push({ x: bul.x, y: bul.y, vx: Math.cos(a) * 40 * BS, vy: Math.sin(a) * 40 * BS,
      life: 0.3, maxLife: 0.3, color: '#22ffdd' });
  }
}

function _playerHitParticles(particles, px, py, scale) {
  for (let k = 0; k < 8; k++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({ x: px, y: py, vx: Math.cos(a) * 70 * scale, vy: Math.sin(a) * 70 * scale,
      life: 0.4, maxLife: 0.4, color: '#ff4444' });
  }
}

function _battleCrossesWall(b, CPB, x0, y0, x1, y1) {
  const c0x = Math.floor(x0 / CPB) + b.cellOffsetX;
  const c0y = Math.floor(y0 / CPB) + b.cellOffsetY;
  const c1x = Math.floor(x1 / CPB) + b.cellOffsetX;
  const c1y = Math.floor(y1 / CPB) + b.cellOffsetY;
  if (c0x === c1x && c0y === c1y) return false;
  return !b.removedWalls.has(_wallKey(c0x, c0y, c1x, c1y));
}

function _wallKey(ax, ay, bx, by) {
  if (ax > bx || (ax === bx && ay > by)) return `${bx},${by}|${ax},${ay}`;
  return `${ax},${ay}|${bx},${by}`;
}
