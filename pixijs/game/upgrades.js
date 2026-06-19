// ============================================================
// UPGRADES — applyUpgrade(), dealPlayerDamage()
// UPGRADE_TYPES / CURSED_UPGRADE_TYPES are globals from config.js
// ============================================================

import { Sounds } from '../core/sound.js';
import { fireReflectionBullets } from './combat.js';
import { cellOf, cellKey } from '../world/constants.js';

// ── Upgrade popup (DOM) ───────────────────────────────────────

let _popupTimer = 0;

export function getUpgradePopupTimer()     { return _popupTimer; }
export function tickUpgradePopupTimer(dt)  { _popupTimer = Math.max(0, _popupTimer - dt); return _popupTimer; }

export function showUpgradePopup(text, color, icon = '⬆') {
  const el = document.getElementById('upgrade-popup');
  if (!el) return;
  el.textContent = `${icon} ${text}`;
  el.style.borderColor = color;
  el.style.color       = color;
  el.style.textShadow  = `0 0 12px ${color}`;
  el.style.boxShadow   = `0 0 20px ${color}44`;
  el.classList.add('visible');
  _popupTimer = CONFIG.UPGRADE_POPUP_DURATION;
}

export function hideUpgradePopup() {
  const el = document.getElementById('upgrade-popup');
  if (el) el.classList.remove('visible');
}

// ── Apply upgrade ─────────────────────────────────────────────

export function applyUpgrade(state, playerProgress, type, showPopup = true) {
  const upg = state.upgrades;
  const pp  = playerProgress.upgrades;

  switch (type) {
    case 'pellets':         upg.pellets++; pp.pellets++; break;
    case 'damage':          upg.damage = upg.damage + 2; pp.damage = pp.damage + 2; break;
    case 'penetrate':       upg.penetrate++; pp.penetrate++; break;
    case 'cooldown':
      upg.cooldownMult = Math.max(0.1, upg.cooldownMult - 0.15);
      pp.cooldownMult  = upg.cooldownMult;
      break;
    case 'speed':           upg.speedMult += 0.10; pp.speedMult = upg.speedMult; break;
    case 'spread':          upg.spreadMult += 0.10; pp.spreadMult = upg.spreadMult; break;
    case 'bulletSpeed':     upg.bulletSpeedMult += 0.30; pp.bulletSpeedMult = upg.bulletSpeedMult; break;
    case 'critChance':      upg.critChance += 0.05; pp.critChance = upg.critChance; break;
    case 'killAccel':       upg.killAccel = true; pp.killAccel = true; break;
    case 'enhancedPierce':  upg.enhancedPierce = true; pp.enhancedPierce = true; break;
    case 'shield':          upg.shield++; pp.shield++; break;
    case 'retreat':         upg.retreat++; pp.retreat++; break;
    case 'reflection':      upg.reflection = true; pp.reflection = true; break;
    case 'infinitePenetrate':
      upg.infinitePenetrate = true; pp.infinitePenetrate = true;
      upg.cooldownMult     *= 1.20; pp.cooldownMult = upg.cooldownMult;
      break;
    case 'infiniteRange':
      upg.infiniteRange = true; pp.infiniteRange = true;
      upg.speedMult    *= 0.70; pp.speedMult = upg.speedMult;
      break;
    case 'ricochet':        upg.ricochet = true; pp.ricochet = true; break;
    case 'lastLife':        upg.lastLife = true; pp.lastLife = true; break;
    case 'battleSpeed':     upg.battleSpeed = true; pp.battleSpeed = true; break;
    case 'freeze':          upg.freeze = true; pp.freeze = true; break;
    case 'farSight':        upg.farSight = true; pp.farSight = true; break;
    case 'longRange':       upg.longRange = true; pp.longRange = true; break;
    case 'sniper':          upg.sniper = true; pp.sniper = true; break;
    case 'randomBonus':     _applyRandomBonus(state, playerProgress, showPopup); return;
    default: break;
  }

  if (showPopup) {
    const def = (typeof UPGRADE_TYPES !== 'undefined' ? UPGRADE_TYPES : [])
      .concat(typeof CURSED_UPGRADE_TYPES !== 'undefined' ? CURSED_UPGRADE_TYPES : [])
      .find(u => u.id === type);
    if (def) showUpgradePopup(def.label, def.color, def.icon);
  }
}

function _applyRandomBonus(state, playerProgress, showPopup) {
  const available = [];
  if (typeof UPGRADE_TYPES === 'undefined') return;
  for (const u of UPGRADE_TYPES) {
    const cur = state.upgrades[u.id] || 0;
    if (cur < u.max) available.push(u.id);
  }
  _shuffleInPlace(available);
  const chosen = available.slice(0, 3);
  for (const id of chosen) applyUpgrade(state, playerProgress, id, false);
  if (chosen.length > 0) showUpgradePopup(`ПОЛУЧЕНО БОНУСОВ: ${chosen.length}`, '#ff00ff');
}

function _shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Deal player damage ────────────────────────────────────────

export function dealPlayerDamage(state, playerProgress, _unused, onDead) {
  const s = state;

  if (s.player.invulnerable > 0 || CONFIG.DEBUG_INVULNERABLE) return false;

  // Shield absorbs
  if (s.upgrades.shield > 0) {
    s.upgrades.shield--;
    playerProgress.upgrades.shield--;
    Sounds.shield();
    s.player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME + s.upgrades.retreat;
    if (s.upgrades.reflection) fireReflectionBullets(s);
    return true;
  }

  // Last life
  if (s.upgrades.lastLife && s.player.lives <= 1) {
    s.upgrades.lastLife          = false;
    playerProgress.upgrades.lastLife = false;

    if (s.enemyBullets) {
      for (const eb of s.enemyBullets) {
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2;
          s.particles.push({ x: eb.x, y: eb.y, vx: Math.cos(a)*30, vy: Math.sin(a)*30,
            life: 0.3, maxLife: 0.3, color: '#ff8800' });
        }
      }
      s.enemyBullets.length = 0;
    }

    for (let i = s.activeSpiders.length - 1; i >= 0; i--) {
      const e = s.activeSpiders[i];
      if (!e || e.isBoss) continue;
      s.deathCorpses.push({ x: e.x, y: e.y, type: e.type, radius: e.radius || CONFIG.SPIDER_RADIUS,
        visualScale: e.visualScale || 3.2, life: 2, maxLife: 2 });
      for (let k = 0; k < CONFIG.DEATH_PARTICLES_COUNT; k++) {
        const a = Math.random() * Math.PI * 2;
        const spd = CONFIG.DEATH_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.DEATH_PARTICLES_SPEED_MAX - CONFIG.DEATH_PARTICLES_SPEED_MIN);
        s.particles.push({ x: e.x, y: e.y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
          life: CONFIG.DEATH_PARTICLES_LIFE, maxLife: CONFIG.DEATH_PARTICLES_LIFE, color: '#ff4444' });
      }
      s.activeSpiders.splice(i, 1);
    }

    showUpgradePopup('ПОСЛЕДНЯЯ ЖИЗНЬ АКТИВИРОВАНА!', '#ff0000');
    s.player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME + s.upgrades.retreat;
    return true;
  }

  // Normal damage
  s.player.lives--;
  Sounds.hitonplayer();
  s.player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME + s.upgrades.retreat;
  if (s.upgrades.reflection) fireReflectionBullets(s);

  if (s.player.lives <= 0) {
    s.player.lives = 0;
    s.phase = 'dead';
    if (onDead) onDead();
  }

  return true;
}
