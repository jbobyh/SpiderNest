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

import { keys, mouse, getMovementDir, isInteractPressed } from '../core/input.js';
import { Sounds }                       from '../core/sound.js';
import { app }                          from '../core/app.js';
import { getCurrentLevel, saveCurrentGame } from '../game-loop.js';
import {
  cellOf, cellKey, getWallAtPoint, getRoomBonus, getRoomSpeedMultiplier, getRoomSpeedVectorMultiplier,
} from '../world/constants.js';
import { setBodyVelocity, updatePlayerCollision } from '../world/physics.js';
import { bulletManager } from '../game/bullet-manager.js';
import {
  shoot, pickupWeapon, startReload, finishReload, enemyBulletRange, ENEMY_BULLET_COLOR, getSpatialBonus,
} from '../game/combat.js';
import { updateEnemyAI } from '../game/enemy-ai.js';
import { handleBossKilled } from '../game/boss.js';
import { dealPlayerDamage } from '../game/upgrades.js';
import {
  updateCollectibles, checkAltarActivation, isNearAltar,
  checkUpgradeChestActivation, isNearUpgradeChest,
  checkSpatialChestActivation, isNearSpatialChest,
  checkRoomBonusAltarActivation, isNearRoomBonusAltar,
} from '../game/collectibles.js';
import { tickUpgradePopupTimer, hideUpgradePopup } from '../game/upgrades.js';
import {
  handleWallToggle, updateFlyingHeart, isWallInteractionPending,
} from '../game/walls.js';
import { spawnParticles } from '../render/particles.js';
import { clearBullets, syncBullets, initBulletRenderer } from '../render/bullet-renderer.js';

// ── Public API ────────────────────────────────────────────────

/**
 * Update everything that belongs to the play phase.
 *
 * @param {object}   state          — game state (phase === 'play')
 * @param {object}   playerProgress — cross-level upgrade state
 * @param {import('../render/camera.js').Camera} camera
 * @param {number}   dt             — delta time in seconds
 * @param {object}   callbacks      — { onEnterBattle, onPlayerDead }
 * @param {object}   options        — { isBattle: false }
 */
export function updatePlayMode(state, playerProgress, camera, dt, callbacks = {}, options = { isBattle: false }) {
  const { isBattle } = options;
  if (!isBattle && state.phase !== 'play') return;
  if (isBattle && state.phase !== 'battle') return;

  const { onEnterBattle, onPlayerDead, currentLevel } = callbacks;
  const b = isBattle ? state.battle : null;

  state.time += dt;

  // ── Freeze timer (Battle only) ─────────────────────────────
  if (isBattle && b && b.freezeTimer > 0) b.freezeTimer -= dt;

  // ── Pending spawns (Battle only) ───────────────────────────
  if (isBattle && b) _processPendingSpawns(b, state, dt);

  // ── Invulnerability timer ─────────────────────────────────
  if (state.player.invulnerable > 0) state.player.invulnerable -= dt;
  if (state.player.body) {
    updatePlayerCollision(state.player.body, state.player.isDashing, state.player.invulnerable > 0);
  }

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
  state.weaponShootAnim  = Math.max(0, (state.weaponShootAnim || 0)  - dt);
  state.weaponReloadAnim = Math.max(0, (state.weaponReloadAnim || 0) - dt);

  // ── Bloom recovery ────────────────────────────────────────
  if (state.bloomSpread > 0) {
    const wDef = WEAPON_DEFS[state.weaponSlots[state.activeSlot]];
    if (wDef) {
      const recoveryTime = wDef.bloomRecoveryTime || 1;
      state.bloomSpread *= Math.exp(-dt / recoveryTime);
      if (state.bloomSpread < 0.001) state.bloomSpread = 0;
    } else {
      state.bloomSpread = 0;
    }
  }

  // ── Reload tick ───────────────────────────────────────────
  if (state.isReloading) {
    state.reloadCooldown -= dt;
    if (state.reloadCooldown <= 0) {
      finishReload(state);
    }
  }

  // ── Manual reload (R key) ─────────────────────────────────
  const rPressed = keys['r'] || keys['к'];
  if (rPressed && !keys._rWas) {
    keys._rWas = true;
    if (!state.isReloading) {
      const slot = state.activeSlot;
      const wId = state.weaponSlots[slot];
      if (wId && WEAPON_DEFS[wId] && state.ammo[slot] < WEAPON_DEFS[wId].magazineSize) {
        startReload(state);
      }
    }
  }
  if (!rPressed) keys._rWas = false;

  const wDef       = _getActiveWeapon(state);
  const burstActive = wDef && wDef.burstSize > 1 &&
                      state.burstRemaining > 0 &&
                      state.burstWeaponId === wDef.id;
  if ((mouse.held || burstActive) && state.shootCooldown <= 0 && !state.isReloading) {
    shoot(state, camera);
  }

  // Interaction check (F key)
  const interactTriggered = isInteractPressed() && !_fWasPressed;
  if (isInteractPressed()) _fWasPressed = true;
  else _fWasPressed = false;

  // ── Play-only interactions ────────────────────────────────
  if (!isBattle) {
    // Wall toggle (right-click)
    if (!isWallInteractionPending()) {
      handleWallToggle(state, state.mouse.x, state.mouse.y, mouse.rightHeld, camera);
    }

    // Cursor update
    _updateCursor(state, camera);

    // Upgrade chest check
    checkUpgradeChestActivation(state, interactTriggered, (ck) => {
      if (onEnterBattle) onEnterBattle(ck);
    });

    // Spatial chest check
    checkSpatialChestActivation(state, interactTriggered, (ck) => {
      if (onEnterBattle) onEnterBattle(ck);
    });

    // Room bonus altar check
    checkRoomBonusAltarActivation(state, interactTriggered, (ck) => {
      if (onEnterBattle) onEnterBattle(ck);
    });

    // Altar check
    checkAltarActivation(state, interactTriggered, (ck) => {
      if (onEnterBattle) onEnterBattle(ck);
    });

    // Boss summon readiness
    state.bossSummonReady =
      state.summonSphereCollected && state.phase === 'play' && !state.bossDefeated;

    // Boss summon (Space key)
    if (keys[' '] && !_spaceWasPressed && state.bossSummonReady) {
      _spaceWasPressed = true;
      if (onEnterBattle) onEnterBattle(null);
    }
    if (!keys[' ']) _spaceWasPressed = false;
  }

  // ── Flying heart animation ─────────────────────────────────
  updateFlyingHeart(dt);

  // ── Weapon slot switch ────────────────────────────────────
  _handleWeaponSwitch(state);

  // ── Weapon pickup (F key) ─────────────────────────────────
  handleWeaponPickup(state, playerProgress, interactTriggered);

  // ── Bullets ───────────────────────────────────────────────
  const onStasisTriggered = isBattle ? null : (enemy) => {
    if (state.phase !== 'play') return;
    if (!enemy.stasis) return;
    const room = state.rooms?.[enemy.stasisRoomIdx];
    if (room && onEnterBattle) onEnterBattle(room.cells[0].k);
  };
  bulletManager.update(state, dt, _onEnemyKilled.bind(null, state, playerProgress), _onPlayerHit.bind(null, state, playerProgress, onPlayerDead), false, onStasisTriggered);

  // ── Particles ─────────────────────────────────────────────
  _stepParticles(state.particles, dt);

  // ── Enemy AI (includes Bosses) ──────────────────────────
  updateEnemyAI(state, playerProgress, dt, _onPlayerHit.bind(null, state, playerProgress, onPlayerDead));

  // ── Corpse decay ──────────────────────────────────────────
  for (let i = state.deathCorpses.length - 1; i >= 0; i--) {
    state.deathCorpses[i].life -= dt;
    if (state.deathCorpses[i].life <= 0) state.deathCorpses.splice(i, 1);
  }

  // ── Collectibles ──────────────────────────────────────────
  updateCollectibles(state, playerProgress,
    (x, y, count, color) => spawnParticles(state.particles, x, y, count, 0, Math.PI * 2, 20, 60, 0.5, color),
    null,
  );

  // ── Upgrade popup timer ───────────────────────────────────
  const remaining = tickUpgradePopupTimer(dt);
  if (remaining <= 0) hideUpgradePopup();

  // ── Camera ───────────────────────────────────────────────
  {
    let dx = state.mouse.x - state.player.x;
    let dy = state.mouse.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CONFIG.CAMERA.maxOffset) {
      dx *= CONFIG.CAMERA.maxOffset / dist;
      dy *= CONFIG.CAMERA.maxOffset / dist;
    }
    camera.setTargetZoom(CONFIG.CAMERA.playZoom);
    camera.moveTo(
      state.player.x + dx * CONFIG.CAMERA.cursorWeight,
      state.player.y + dy * CONFIG.CAMERA.cursorWeight,
    );
  }
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
  const spatialSpeed = (typeof getSpatialBonus !== 'undefined') ? getSpatialBonus(state, 'speed') : 0;
  let spd = CONFIG.PLAYER_SPEED * state.upgrades.speedMult * (1 + spatialSpeed);

  // Apply room bonus speed modifier (directional for wind)
  const playerCell = cellOf(state.player.x, state.player.y);
  const playerCellKey = cellKey(playerCell.x, playerCell.y);

  let { mvx, mvy } = getMovementDir();

  spd *= getRoomSpeedVectorMultiplier(state, playerCellKey, mvx, mvy);

  if (mvx !== 0 || mvy !== 0) Sounds.footstep(dt);
  else                         Sounds._footstepTimer = 0;

  setBodyVelocity(state.player.body, mvx * spd, mvy * spd);
}

function _startDash(state) {
  const { mvx, mvy } = getMovementDir();
  const isMoving = mvx !== 0 || mvy !== 0;
  
  let dirX, dirY;
  if (isMoving) {
    dirX = mvx;
    dirY = mvy;
  } else {
    const angle = Math.atan2(state.mouse.y - state.player.y, state.mouse.x - state.player.x);
    dirX = Math.cos(angle);
    dirY = Math.sin(angle);
  }
  
  const len  = Math.hypot(dirX, dirY);
  if (len === 0) return;

  state.player.isDashing    = true;
  state.player.dashDirX     = dirX / len;
  state.player.dashDirY     = dirY / len;
  state.player.dashProgress = 0;
  state.player.dashCooldown = CONFIG.PLAYER_DASH_COOLDOWN;
  Sounds.dash?.();
  if (state.player.body) {
    updatePlayerCollision(state.player.body, true, state.player.invulnerable > 0);
    setBodyVelocity(state.player.body,
      state.player.dashDirX * CONFIG.PLAYER_DASH_SPEED,
      state.player.dashDirY * CONFIG.PLAYER_DASH_SPEED);
  }
}

function _stepDash(state, dt) {
  state.player.dashProgress += CONFIG.PLAYER_DASH_SPEED * dt;

  const body    = state.player.body;
  const hitWall = body && Math.hypot(body.velocity.x, body.velocity.y) < CONFIG.PLAYER_DASH_SPEED * 0.3;

  if (state.player.dashProgress >= CONFIG.PLAYER_DASH_DISTANCE || hitWall) {
    state.player.isDashing = false;
    if (body) { updatePlayerCollision(body, false, state.player.invulnerable > 0); setBodyVelocity(body, 0, 0); }
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
  const switchPressed = keys['q'] || keys['й'];
  if (switchPressed) {
    if (!keys._qWas) {
      state.activeSlot = (state.activeSlot + 1) % state.maxSlots;
      keys._qWas = true;
      // Cancel reload on weapon switch
      state.isReloading = false;
      state.reloadingSlot = -1;
      state.reloadCooldown = 0;
      state.burstRemaining = 0;
      state.burstWeaponId = null;
    }
  } else {
    keys._qWas = false;
  }
}

function _stepParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.delay > 0) {
      p.delay -= dt;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.roomMask) {
      const ck = `${Math.floor(p.x / 126)},${Math.floor(p.y / 126)}`;
      if (!p.roomMask.has(ck)) { particles.splice(i, 1); continue; }
    }
  }
}

function _processPendingSpawns(b, state, dt) {
  if (!b.pendingSpawns?.length) return;
  for (let i = b.pendingSpawns.length - 1; i >= 0; i--) {
    const ps = b.pendingSpawns[i];
    ps.spawnDelay -= dt;
    // Emit particles continuously during the last second before spawn
    if (ps.spawnDelay > 0 && ps.spawnDelay <= 1.0) {
      if (!ps.particleTimer) ps.particleTimer = 0;
      ps.particleTimer += dt;
      if (ps.particleTimer >= 0.1) {
        spawnParticles(state.particles, ps.enemy.x, ps.enemy.y, 1, 0, Math.PI * 2, 20, 40, 0.3, '#ff0000');
        ps.particleTimer = 0;
      }
    }
    if (ps.spawnDelay <= 0) {
      state.activeSpiders.push(ps.enemy);
      b.pendingSpawns.splice(i, 1);
    }
  }
}

function _onEnemyKilled(state, playerProgress, g) {
  if (state.upgrades.killAccel) {
    state.upgrades.killAccelPercent =
      Math.min(80, (state.upgrades.killAccelPercent || 0) + 0.1);
    if (playerProgress && playerProgress.upgrades) {
      playerProgress.upgrades.killAccelPercent = state.upgrades.killAccelPercent;
    }
  }
  if (g.isBoss) {
    handleBossKilled(g, state, playerProgress);
    Sounds.bossdeath?.();
  }
  // Bloated death shot
  if (g.type === 'bloated') {
    const pdx = state.player.x - g.x;
    const pdy = state.player.y - g.y;
    const pdist = Math.hypot(pdx, pdy);
    if (pdist > 0) {
      const ebx = (pdx / pdist) * CONFIG.ENEMY_STATS.bloated.deathShotSpeed;
      const eby = (pdy / pdist) * CONFIG.ENEMY_STATS.bloated.deathShotSpeed;
      bulletManager.spawn({
        x: g.x, y: g.y,
        vx: ebx, vy: eby,
        owner: 'enemy',
        color: ENEMY_BULLET_COLOR,
        maxRange: enemyBulletRange(ebx, eby),
      });
    }
  }
}

function _onPlayerHit(state, playerProgress, onPlayerDead) {
  dealPlayerDamage(state, playerProgress, null, onPlayerDead);
}

// ── Cursor update for wall interaction ───────────────────────

function _updateCursor(state, camera) {
  if (!app?.canvas) return;

  const mx = mouse.x + (camera?.x || 0);
  const my = mouse.y + (camera?.y || 0);

  const wall = getWallAtPoint(state.blobCells, mx, my);
  if (wall && !state.internalWalls.has(wall.wk) && !state.fixedWalls?.has(wall.wk)) {
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
  app.canvas.style.cursor = "url('img/crosshairs_white.png') 4 4, crosshair";
}

// ── Weapon pickup via F key ──────────────────────────────────

const WEAPON_PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.WEAPON_PICKUP_DISTANCE;
let _fWasPressed = false;
let _spaceWasPressed = false;

export function handleWeaponPickup(state, playerProgress, triggered) {
  if (!triggered) return;

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
      playerProgress.ammo        = [...state.ammo];
      saveCurrentGame();
      break;
    }
  }
}

// ── Re-export proximity checks for game-loop ──────────────────────

export { isNearAltar, isNearUpgradeChest, isNearSpatialChest, isNearRoomBonusAltar };

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
