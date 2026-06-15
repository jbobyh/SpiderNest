// ============================================================
// PLAY MODE — per-frame update for the play phase
//
// updatePlayMode(state, playerProgress, camera, dt)
//
// Handles: player movement / dash, shooting, bullet physics,
// enemy AI, enemy↔player contact, collectibles, weapon slots,
// boss-summon check.  Camera follows the player at zoom=1.
//
// Globals: CONFIG (from config.js)
// ============================================================

import { keys, mouse, getMovementDir } from '../core/input.js';
import { Sounds }                       from '../core/sound.js';
import { app }                          from '../core/app.js';
import {
  cellOf, cellKey, inRoom, crossesWall, getWallAtPoint,
} from '../world/constants.js';
import {
  shoot, updateBullets, updateEnemyBullets, pickupWeapon,
} from '../game/combat.js';
import {
  updateEnemyAI, resolveEnemyCollisions,
} from '../game/enemy-ai.js';
import {
  updateCollectibles, checkAltarActivation, isNearAltar,
} from '../game/collectibles.js';
import { tickUpgradePopupTimer, hideUpgradePopup } from '../game/upgrades.js';
import {
  handleWallToggle, updateFlyingHeart, isWallInteractionPending,
} from '../game/walls.js';
import { spawnParticles } from '../render/particles.js';

// ── Public API ────────────────────────────────────────────────

/**
 * Update everything that belongs to the play phase.
 *
 * @param {object}   state          — game state (phase === 'play')
 * @param {object}   playerProgress — cross-level upgrade state
 * @param {import('../render/camera.js').Camera} camera
 * @param {number}   dt             — delta time in seconds
 * @param {object}   callbacks      — { onEnterBattle, onPlayerDead }
 */
export function updatePlayMode(state, playerProgress, camera, dt, callbacks = {}) {
  if (state.phase !== 'play') return;

  const { onEnterBattle, onPlayerDead } = callbacks;

  state.time += dt;

  // ── Invulnerability timer ─────────────────────────────────
  if (state.player.invulnerable > 0) state.player.invulnerable -= dt;

  // ── Dash cooldown ─────────────────────────────────────────
  if (state.player.dashCooldown > 0) state.player.dashCooldown -= dt;

  // Dash trail particles
  _updateDashTrails(state, dt);

  // ── Player movement / dash ────────────────────────────────
  if (state.player.isDashing) {
    _stepDash(state, dt);
  } else {
    _stepMovement(state, dt);

    // Initiate dash on shift
    if (keys['shift'] && state.player.dashCooldown <= 0) {
      _startDash(state);
    }
  }

  // Sync keys/mouse into state (game logic reads state.keys / state.mouse)
  _syncInput(state, camera);

  // ── Shoot ─────────────────────────────────────────────────
  state.shootCooldown  = Math.max(0, state.shootCooldown  - dt);
  state.burstCooldown  = Math.max(0, state.burstCooldown  - dt);

  const wDef       = _getActiveWeapon(state);
  const burstActive = wDef && wDef.burstSize > 1 &&
                      state.burstRemaining > 0 &&
                      state.burstWeaponId === wDef.id;
  if ((mouse.held || burstActive) && state.shootCooldown <= 0) {
    shoot(state);
  }

  // ── Wall toggle (right-click) ─────────────────────────────
  if (state.phase === 'play' && !isWallInteractionPending()) {
    handleWallToggle(state, state.mouse.x, state.mouse.y, mouse.rightHeld);
  }

  // ── Flying heart animation ─────────────────────────────────
  updateFlyingHeart(dt);

  // ── Cursor update ───────────────────────────────────────────
  _updateCursor(state, camera);

  // ── Weapon slot switch ────────────────────────────────────
  _handleWeaponSwitch(state);

  // ── Altar check (F key, priority over weapon pickup) ───────────────
  {
    const fDown = keys['f'] || keys['F'] || keys['а'] || keys['А'];
    const altarActivated = checkAltarActivation(state, fDown && !_fWasPressed, (ck) => {
      if (onEnterBattle) onEnterBattle(ck);
    });
    if (altarActivated) _fWasPressed = true;
  }

  // ── Weapon pickup (F key) ─────────────────────────────────
  _handleWeaponPickup(state, playerProgress, keys);

  // ── Bullets ───────────────────────────────────────────────
  updateBullets(state, dt, _onEnemyKilled.bind(null, state, playerProgress), null);
  updateEnemyBullets(state, dt, _onPlayerHit.bind(null, state, playerProgress, onPlayerDead));

  // ── Particles ─────────────────────────────────────────────
  _stepParticles(state.particles, dt);

  // ── Enemy AI ──────────────────────────────────────────────
  updateEnemyAI(state, playerProgress, dt, _onPlayerHit.bind(null, state, playerProgress, onPlayerDead));
  resolveEnemyCollisions(state.activeSpiders, state.openCells);

  // ── Corpse decay ──────────────────────────────────────────
  for (let i = state.deathCorpses.length - 1; i >= 0; i--) {
    state.deathCorpses[i].life -= dt;
    if (state.deathCorpses[i].life <= 0) state.deathCorpses.splice(i, 1);
  }

  // ── Collectibles + altar check ────────────────────────────
  updateCollectibles(state, playerProgress,
    (x, y, count, color) => spawnParticles(state.particles, x, y, count, 0, Math.PI * 2, 20, 60, 0.5, color),
    null,
  );

  // ── Boss summon readiness ─────────────────────────────────
  state.bossSummonReady =
    state.summonSphereCollected && state.phase === 'play' && !state.bossDefeated;

  // ── Upgrade popup timer ───────────────────────────────────
  const remaining = tickUpgradePopupTimer(dt);
  if (remaining <= 0) hideUpgradePopup();

  // ── Camera ───────────────────────────────────────────────
  camera.setZoom(1);
  camera.pan(state.player.x, state.player.y);
  camera.update(dt);
}

// ── Private helpers ───────────────────────────────────────────

function _syncInput(state, camera) {
  // Mirror input module → state (renderers and logic read from state)
  state.keys = keys;
  // Convert screen-space mouse → world-space so aiming math works correctly
  if (camera) {
    const w = camera.screenToWorld(mouse.x, mouse.y);
    state.mouse = { x: w.x, y: w.y, held: mouse.held };
  } else {
    state.mouse = mouse;
  }
}

function _getActiveWeapon(state) {
  const id = state.weaponSlots?.[state.activeSlot];
  return id ? WEAPON_DEFS[id] : null;
}

function _stepMovement(state, dt) {
  const spd = CONFIG.PLAYER_SPEED * state.upgrades.speedMult;
  let { mvx, mvy } = getMovementDir();

  if (mvx !== 0 || mvy !== 0) Sounds.footstep(dt);
  else                         Sounds._footstepTimer = 0;

  const newX = state.player.x + mvx * spd * dt;
  const newY = state.player.y + mvy * spd * dt;
  const rw   = state.removedWalls;

  const cx = cellOf(newX, state.player.y);
  if (state.openCells.has(cellKey(cx.x, cx.y)) &&
      !crossesWall(rw, state.player.x, state.player.y, newX, state.player.y)) {
    state.player.x = newX;
  }

  const cy = cellOf(state.player.x, newY);
  if (state.openCells.has(cellKey(cy.x, cy.y)) &&
      !crossesWall(rw, state.player.x, state.player.y, state.player.x, newY)) {
    state.player.y = newY;
  }
}

function _startDash(state) {
  const { mvx, mvy } = getMovementDir();
  const dirX = mvx || Math.cos(Math.atan2(state.mouse.y - state.player.y, state.mouse.x - state.player.x));
  const dirY = mvy || Math.sin(Math.atan2(state.mouse.y - state.player.y, state.mouse.x - state.player.x));
  const len  = Math.hypot(dirX, dirY);
  if (len === 0) return;

  state.player.isDashing    = true;
  state.player.dashDirX     = dirX / len;
  state.player.dashDirY     = dirY / len;
  state.player.dashProgress = 0;
  state.player.dashCooldown = CONFIG.PLAYER_DASH_COOLDOWN;
  Sounds.dash?.();
}

function _stepDash(state, dt) {
  const dashMove = CONFIG.PLAYER_DASH_SPEED * dt;
  state.player.dashProgress += dashMove;

  const newX = state.player.x + state.player.dashDirX * dashMove;
  const newY = state.player.y + state.player.dashDirY * dashMove;

  const c  = cellOf(newX, newY);
  const rw = state.removedWalls;
  if (!state.openCells.has(cellKey(c.x, c.y)) ||
      crossesWall(rw, state.player.x, state.player.y, newX, newY)) {
    state.player.isDashing = false;
  } else {
    state.player.x = newX;
    state.player.y = newY;
  }

  if (state.player.dashProgress >= CONFIG.PLAYER_DASH_DISTANCE) {
    state.player.isDashing = false;
  }
}

function _updateDashTrails(state, dt) {
  if (!state.player.dashTrails) return;
  for (let i = state.player.dashTrails.length - 1; i >= 0; i--) {
    state.player.dashTrails[i].life -= dt;
    if (state.player.dashTrails[i].life <= 0) state.player.dashTrails.splice(i, 1);
  }
  if (state.player.isDashing) {
    state.player.dashTrailTimer = (state.player.dashTrailTimer || 0) + dt;
    if (state.player.dashTrailTimer >= 0.04) {
      state.player.dashTrailTimer = 0;
      state.player.dashTrails.push({
        x: state.player.x, y: state.player.y,
        life: 0.12, maxLife: 0.12,
      });
    }
  }
}

function _handleWeaponSwitch(state) {
  if (state.maxSlots <= 1) return;
  if (keys['tab']) {
    if (!keys._tabWas) {
      state.activeSlot = (state.activeSlot + 1) % state.maxSlots;
      keys._tabWas = true;
    }
  } else {
    keys._tabWas = false;
  }
}

function _stepParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function _onEnemyKilled(state, playerProgress, g) {
  if (state.upgrades.killAccel) {
    state.upgrades.killAccelPercent =
      Math.min(80, (state.upgrades.killAccelPercent || 0) + 5);
  }
  // Bloated death shot
  if (g.type === 'bloated') {
    const pdx = state.player.x - g.x;
    const pdy = state.player.y - g.y;
    const pdist = Math.hypot(pdx, pdy);
    if (pdist > 0) {
      state.enemyBullets.push({
        x: g.x, y: g.y,
        vx: (pdx / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED,
        vy: (pdy / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED,
        life: 6,
      });
    }
  }
}

function _onPlayerHit(state, playerProgress, onPlayerDead, _state, isBattle) {
  if (state.player.invulnerable > 0) return;
  if (state.upgrades.shield > 0) {
    state.upgrades.shield--;
    state.player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME;
    Sounds.shieldhit?.();
    return;
  }
  state.player.lives--;
  state.player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME;
  Sounds.playerhit?.();
  if (state.player.lives <= 0 && onPlayerDead) {
    onPlayerDead(state, playerProgress);
  }
}

// ── Cursor update for wall interaction ───────────────────────

function _updateCursor(state, camera) {
  if (!app?.canvas) return;

  const mx = mouse.x + (camera?.x || 0);
  const my = mouse.y + (camera?.y || 0);

  const wall = getWallAtPoint(state.blobCells, mx, my);
  if (wall && !state.internalWalls.has(wall.wk)) {
    const aOpen = state.openCells.has(cellKey(wall.ax, wall.ay));
    const bOpen = state.openCells.has(cellKey(wall.bx, wall.by));
    const adjacentToOpen = aOpen || bOpen;
    if (adjacentToOpen) {
      if (state.removedWalls.has(wall.wk)) {
        app.canvas.style.cursor = "url('img/locked.png') 16 16, pointer";
      } else {
        app.canvas.style.cursor = "url('img/unlocked.png') 16 16, pointer";
      }
      return;
    }
  }
  app.canvas.style.cursor = 'crosshair';
}

// ── Weapon pickup via F key ──────────────────────────────────

const WEAPON_PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.WEAPON_PICKUP_DISTANCE;
let _fWasPressed = false;

function _handleWeaponPickup(state, playerProgress, keys) {
  const fPressed = keys['f'] || keys['F'] || keys['а'] || keys['А'];
  if (!fPressed) {
    _fWasPressed = false;
    return;
  }
  if (_fWasPressed) return; // debounce
  _fWasPressed = true;

  const px = state.player.x, py = state.player.y;

  // Find nearby weapon
  for (let i = state.droppedWeapons.length - 1; i >= 0; i--) {
    const dw = state.droppedWeapons[i];
    if (dw.picked) continue;
    const wc = cellOf(dw.x, dw.y);
    if (!state.openCells.has(cellKey(wc.x, wc.y))) continue;
    const dist = Math.hypot(px - dw.x, py - dw.y);
    if (dist < WEAPON_PICKUP_R) {
      dw.picked = true;
      state.droppedWeapons.splice(i, 1);
      pickupWeapon(state, dw.weaponId, state.particles, px, py, 1, px, py);
      playerProgress.weaponSlots = [...state.weaponSlots];
      playerProgress.activeSlot  = state.activeSlot;
      playerProgress.maxSlots    = state.maxSlots;
      break;
    }
  }
}

// ── Re-export isNearAltar for game-loop ──────────────────────

export { isNearAltar };

// ── Check if player is near a weapon (for HUD hint) ──────────

export function isNearWeapon(state) {
  const px = state.player.x, py = state.player.y;
  for (const dw of (state.droppedWeapons || [])) {
    if (dw.picked) continue;
    const wc = cellOf(dw.x, dw.y);
    if (!state.openCells.has(cellKey(wc.x, wc.y))) continue;
    const dist = Math.hypot(px - dw.x, py - dw.y);
    if (dist < WEAPON_PICKUP_R) return true;
  }
  return false;
}
