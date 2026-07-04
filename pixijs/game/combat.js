// ============================================================
// COMBAT — shoot()
// Works for both play-mode (scale=1) and battle-mode (scale=BATTLE_SCALE).
// CONFIG / WEAPON_DEFS are globals loaded from config.js.
// ============================================================

import { bulletManager } from './bullet-manager.js';
import { cellOf, cellKey, CELL_PX } from '../world/constants.js';
import { Sounds } from '../core/sound.js';
import { spawnParticles } from '../render/particles.js';
import { spawnShootVfx } from '../render/shoot-vfx.js';

// ── Weapon helpers ────────────────────────────────────────────

export function getActiveWeapon(state) {
  const weaponId = state.weaponSlots[state.activeSlot];
  return weaponId ? WEAPON_DEFS[weaponId] : null;
}

// ── Spatial bonus helper ───────────────────────────────────────

/**
 * Calculates a dynamic bonus based on SPATIAL_UPGRADE_TYPES.
 * @param {object} state 
 * @param {string} axis - 'reload', 'range', 'accuracy', 'bulletSpeed', 'speed', 'critChance', 'critDamage', 'penetrate'
 * @returns {number}
 */
export function getSpatialBonus(state, axis) {
  if (!state.upgrades) return 0;

  // Count open rooms
  let roomCount = 1;
  if (state.rooms && state.openCells) {
    let openedRooms = 0;
    for (const room of state.rooms) {
      if (room.cells.some(c => state.openCells.has(c.k))) {
        openedRooms++;
      }
    }
    roomCount = Math.max(1, openedRooms);
  }

  const heartCount = state.player?.lives || 0;
  
  let total = 0;
  const spatialPool = (typeof SPATIAL_UPGRADE_TYPES !== 'undefined') ? SPATIAL_UPGRADE_TYPES : [];
  
  for (const def of spatialPool) {
    if (def.axis === axis && state.upgrades[def.id]) {
      if (def.source === 'rooms') {
        const effectVal = def.effects[`${axis}PerRoom`];
        if (effectVal != null) total += effectVal * roomCount;
      } else if (def.source === 'hearts') {
        const effectVal = def.effects[`${axis}PerHeart`];
        if (effectVal != null) total += effectVal * heartCount;
      }
    }
  }
  return total;
}

// ── Total spread calculation (shared) ─────────────────────────

export function getTotalSpread(state) {
  const weapon = getActiveWeapon(state);
  if (!weapon) return 0;

  const spatialAccuracy = getSpatialBonus(state, 'accuracy');
  let totalSpread = weapon.spread * state.upgrades.spreadMult * Math.max(0, 1 - spatialAccuracy);

  if (state.upgrades.sniper) {
    let roomCount = 1;
    if (state.battle && state.battle.battleCells && state.rooms) {
      let participatingRooms = 0;
      for (const room of state.rooms) {
        if (room.cells.some(c => state.battle.battleCells.has(c.k))) {
          participatingRooms++;
        }
      }
      roomCount = participatingRooms;
    }
    if (roomCount <= 2) totalSpread = 0;
    else                totalSpread *= 1 + 0.10 * (roomCount - 2);
  }

  return totalSpread;
}

// ── Shoot (play-mode) ─────────────────────────────────────────

export function shoot(state, camera = null) {
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
  
  // Spatial Reload Bonus
  const spatialReload = getSpatialBonus(state, 'reload');
  const cooldown = weapon.cooldown * state.upgrades.cooldownMult * killAccelMult * Math.max(0.1, 1 - spatialReload);

  const dx = state.mouse.x - state.player.x;
  const dy = state.mouse.y - state.player.y;
  const baseAngle = Math.atan2(dy, dx);

  const isBurstWeapon = weapon.burstSize && weapon.burstSize > 1;
  const pellets       = isBurstWeapon ? weapon.pellets : weapon.pellets + state.upgrades.pellets;
  const burstTotal    = isBurstWeapon ? weapon.burstSize + state.upgrades.pellets : weapon.burstSize;
  const burstDelay    = _burstStepDelay(weapon, burstTotal) * state.upgrades.cooldownMult * killAccelMult;
  
  const totalSpread = getTotalSpread(state);

  const spatialBulletSpeed = getSpatialBonus(state, 'bulletSpeed');
  const bulletSpeed   = weapon.bulletSpeed * state.upgrades.bulletSpeedMult * (1 + spatialBulletSpeed);

  Sounds.shot(weapon.id);

  // Aim crit: find enemy under cursor at moment of shot
  let aimCritTarget = null;
  for (const g of state.activeSpiders) {
    if (g.isDead || g.hp <= 0) continue;
    const dist = Math.hypot(state.mouse.x - g.x, state.mouse.y - g.y);
    if (dist <= (g.radius || CONFIG.ENEMY_STATS.soldier.radius)) {
      aimCritTarget = g;
      break;
    }
  }

  for (let i = 0; i < pellets; i++) {
    const spread = (Math.random() - 0.5) * totalSpread;
    _spawnPlayerBullet(state, weapon, baseAngle + spread, bulletSpeed, 1, null, aimCritTarget);
  }

  // Shoot VFX sprite animation
  const drawSize = CONFIG.PLAYER_SPRITE_RADIUS * 2;
  const offsetDist = drawSize * CONFIG.SHOOT_VFX.offsetMult;
  spawnShootVfx(
    state.player.x + Math.cos(baseAngle) * offsetDist,
    state.player.y + Math.sin(baseAngle) * offsetDist,
    baseAngle
  );

  if (camera && weapon.shakeAmount >= CONFIG.CAMERA.shakeMin) {
    camera.shake(weapon.shakeAmount * CONFIG.CAMERA.shakeScale, baseAngle);
  }

  _applyBurstCooldown(state, weapon, isBurstWeapon, burstTotal, burstDelay, cooldown);
}


// ── Reflection bullets ────────────────────────────────────────

// Reflection bullets use the new manager
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

  for (const { e } of nearest) {
    const angle = Math.atan2(e.y - py, e.x - px);
    _spawnPlayerBullet(state, weapon, angle, bulletSpeed, 1);
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
    CONFIG.PARTICLES.pickup.count, 0, Math.PI * 2,
    CONFIG.PARTICLES.pickup.speed * scale, CONFIG.PARTICLES.pickup.speed * scale,
    CONFIG.PARTICLES.pickup.life, wDef ? wDef.color : '#ffffff');
}

// ── Internal helpers ──────────────────────────────────────────

function _spawnPlayerBullet(state, weapon, angle, bulletSpeed, scale, battleState = null, aimCritTarget = null) {
  const spatialCritChance = getSpatialBonus(state, 'critChance');
  const isCrit = Math.random() < (state.upgrades.critChance + spatialCritChance);
  
  const spatialCritDamage = getSpatialBonus(state, 'critDamage');
  const critMult = 2 + spatialCritDamage;

  let damage = weapon.damage * (1 + state.upgrades.damageMult);
  if (isCrit) {
    damage *= critMult;
  }

  const spatialPenetrate = getSpatialBonus(state, 'penetrate');
  const basePenetrate = state.upgrades.infinitePenetrate ? Infinity : weapon.penetrate + state.upgrades.penetrate + Math.floor(spatialPenetrate);
  const vx = Math.cos(angle) * bulletSpeed;
  const vy = Math.sin(angle) * bulletSpeed;
  
  const player = battleState ? battleState.player : state.player;

  const isIncendiary = state.upgrades.incendiaryChance > 0 && Math.random() < state.upgrades.incendiaryChance;

  bulletManager.spawn({
    x: player.x, y: player.y,
    vx: vx,
    vy: vy,
    owner: 'player',
    damage: damage,
    penetrate: basePenetrate,
    ricochet: !!state.upgrades.ricochet,
    maxRange: getBulletRange(state, weapon, scale),
    color: PLAYER_BULLET_COLOR,
    isCrit: isCrit,
    isIncendiary: isIncendiary,
    aimCritTarget: aimCritTarget,
    aimCritMult: critMult
  });
}

export function getBulletRange(state, weapon, scale) {
  if (state.upgrades.infiniteRange) return Infinity;
  const RANGE_SCALE = CELL_PX / 10;
  let range = (weapon.range != null
    ? weapon.range * RANGE_SCALE * scale
    : CONFIG.BULLET_LIFE * weapon.bulletSpeed * scale);
  if (state.upgrades.ricochet) range *= 1.5;
  
  const spatialRange = getSpatialBonus(state, 'range');
  range *= (1 + spatialRange);

  if (state.upgrades.longRange) {
    let roomCount = 1;
    if (state.battle && state.battle.battleCells && state.rooms) {
      let participatingRooms = 0;
      for (const room of state.rooms) {
        if (room.cells.some(c => state.battle.battleCells.has(c.k))) {
          participatingRooms++;
        }
      }
      roomCount = participatingRooms;
    } else if (state.rooms && state.openCells) {
      let openedRooms = 0;
      for (const room of state.rooms) {
        if (room.cells.some(c => state.openCells.has(c.k))) {
          openedRooms++;
        }
      }
      roomCount = openedRooms;
    }
    range *= 1 + 0.20 * roomCount;
  }
  return range;
}

export const PLAYER_BULLET_COLOR = 0xffff00;
export const ENEMY_BULLET_COLOR  = 0xff4400;
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
