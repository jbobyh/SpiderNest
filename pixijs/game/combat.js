// ============================================================
// COMBAT — shoot()
// Works for both play-mode (scale=1) and battle-mode (scale=BATTLE_SCALE).
// CONFIG / WEAPON_DEFS are globals loaded from config.js.
// ============================================================

import { bulletManager } from './bullet-manager.js';
import { cellOf, cellKey, CELL_PX } from '../world/constants.js';
import { Sounds } from '../core/sound.js';
import { spawnParticles } from '../render/particles.js';

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
    _spawnPlayerBullet(state, weapon, baseAngle + spread, bulletSpeed, 1);
  }

  // Muzzle flash particles
  spawnParticles(state.particles, state.player.x, state.player.y,
    CONFIG.MUZZLE_PARTICLES_COUNT, baseAngle, CONFIG.MUZZLE_PARTICLES_SPREAD,
    CONFIG.MUZZLE_PARTICLES_SPEED_MIN, CONFIG.MUZZLE_PARTICLES_SPEED_MAX,
    CONFIG.MUZZLE_PARTICLES_LIFE, '#ffff00');

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
    CONFIG.PICKUP_PARTICLES_COUNT, 0, Math.PI * 2,
    CONFIG.PICKUP_PARTICLES_SPEED * scale, CONFIG.PICKUP_PARTICLES_SPEED * scale,
    CONFIG.PICKUP_PARTICLES_LIFE, wDef ? wDef.color : '#ffffff');
}

// ── Internal helpers ──────────────────────────────────────────

function _spawnPlayerBullet(state, weapon, angle, bulletSpeed, scale, battleState = null) {
  const isCrit = Math.random() < state.upgrades.critChance;
  let damage = weapon.damage + state.upgrades.damage;
  if (isCrit) damage *= 2;

  const basePenetrate = state.upgrades.infinitePenetrate ? Infinity : weapon.penetrate + state.upgrades.penetrate;
  const vx = Math.cos(angle) * bulletSpeed;
  const vy = Math.sin(angle) * bulletSpeed;
  
  const player = battleState ? battleState.player : state.player;

  bulletManager.spawn({
    x: player.x, y: player.y,
    vx: vx,
    vy: vy,
    owner: 'player',
    damage: damage,
    penetrate: basePenetrate,
    ricochet: !!state.upgrades.ricochet,
    maxRange: _bulletRange(state, weapon, scale),
    color: PLAYER_BULLET_COLOR,
    isCrit: isCrit
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
