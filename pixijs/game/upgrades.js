// ============================================================
// UPGRADES — applyUpgrade(), dealPlayerDamage()
// UPGRADE_TYPES / CURSED_UPGRADE_TYPES are globals from config.js
// ============================================================

import { Sounds } from '../core/sound.js';
import { fireReflectionBullets } from './combat.js';

// ── Upgrade popup (DOM) ───────────────────────────────────────

let _popupTimer = 0;

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

  const def = (typeof UPGRADE_TYPES !== 'undefined' ? UPGRADE_TYPES : [])
    .concat(typeof CURSED_UPGRADE_TYPES !== 'undefined' ? CURSED_UPGRADE_TYPES : [])
    .concat(typeof SPATIAL_UPGRADE_TYPES !== 'undefined' ? SPATIAL_UPGRADE_TYPES : [])
    .find(u => u.id === type);

  if (!def) return;

  // Increment pick count
  state.upgradeLevels[type] = (state.upgradeLevels[type] || 0) + 1;
  playerProgress.upgradeLevels[type] = state.upgradeLevels[type];

  // Set binary flag for the upgrade itself (only if it's a boolean in state)
  if (typeof upg[type] === 'boolean') {
    upg[type] = true;
    pp[type] = true;
  }

  // Mutual exclusion logic (blocks property)
  if (def.blocks) {
    const blockedId = def.blocks;
    upg[blockedId] = false;
    pp[blockedId] = false;
    // If it's a numeric stat being blocked, we should ideally reset it, 
    // but spatial upgrades currently use binary flags + dynamic calc in combat.js.
  }

  // Apply declarative effects
  if (def.effects) {
    for (const [key, value] of Object.entries(def.effects)) {
      if (typeof value === 'number') {
        // Multipliers/Additions
        if (key.toLowerCase().endsWith('mult')) {
          upg[key] += value;
        } else {
          upg[key] += value;
        }
        pp[key] = upg[key];
      } else {
        // Flags
        upg[key] = value;
        pp[key]  = value;
      }
    }
  }

  // Special logic for cooldown mult to keep it within bounds if it was a direct decrement before
  if (type === 'cooldown') {
    upg.cooldownMult = Math.max(0.1, upg.cooldownMult);
    pp.cooldownMult = upg.cooldownMult;
  }

  // Apply custom logic
  if (def.onApply) {
    def.onApply(state, playerProgress);
  }

  // Special case for randomBonus (it doesn't have effects/onApply in config to avoid recursion)
  if (type === 'randomBonus') {
    _applyRandomBonus(state, playerProgress, showPopup);
    return;
  }

  if (showPopup) {
    showUpgradePopup(def.label, def.color, def.icon);
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

  if (s.player.invulnerable > 0 || CONFIG.DEBUG.invulnerable) return false;

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
      s.deathCorpses.push({ x: e.x, y: e.y, type: e.type, radius: e.radius || CONFIG.ENEMY_STATS.spider.radius,
        visualScale: e.visualScale || 3.2, life: 2, maxLife: 2 });
      for (let k = 0; k < CONFIG.PARTICLES.death.count; k++) {
        const a = Math.random() * Math.PI * 2;
        const spd = CONFIG.PARTICLES.death.speedMin + Math.random() * (CONFIG.PARTICLES.death.speedMax - CONFIG.PARTICLES.death.speedMin);
        s.particles.push({ x: e.x, y: e.y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
          life: CONFIG.PARTICLES.death.life, maxLife: CONFIG.PARTICLES.death.life, color: '#ff4444' });
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
    if (onDead) onDead(state, playerProgress);
  }

  return true;
}
