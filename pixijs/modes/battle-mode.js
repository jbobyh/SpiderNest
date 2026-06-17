// ============================================================
// BATTLE MODE — per-frame update + state creation/exit
//
// Unified coordinate system: everything in world-coords (CELL_PX).
// state.battle is a thin metadata container — no separate coord space.
// Enemies live in state.activeSpiders, bullets in state.bullets, etc.
//
// createBattleState(state, openedCellKey)   — normal room battle
// createBossBattleState(state, level)       — boss battle
// updateBattleMode(state, playerProgress, camera, dt, callbacks)
// exitBattleMode(state)                     — back to play
//
// Globals: CONFIG, WEAPON_DEFS, BOSS_DEFS (from config.js)
// ============================================================

import { keys, mouse }                    from '../core/input.js';
import { Sounds }                         from '../core/sound.js';
import {
  cellOf, cellKey, cellFromKey,
  getConnectedCells, getCellBounds,
  crossesWall, CELL_PX,
} from '../world/constants.js';
import {
  shoot,
  updateBullets,
  updateEnemyBullets,
} from '../game/combat.js';
import {
  updateEnemyAI, resolveEnemyCollisions,
} from '../game/enemy-ai.js';
import { updateBoss }                      from '../game/boss.js';
import { updateCollectibles, spawnRoomRewards } from '../game/collectibles.js';
import { tickUpgradePopupTimer, hideUpgradePopup } from '../game/upgrades.js';
import { spawnParticles } from '../render/particles.js';
import { updateRevealedRoomsOnPurify } from '../game/state.js';

// ── Battle state creation ─────────────────────────────────────

/**
 * Start a normal room fight.
 * Adds room enemies to state.activeSpiders (world-coords).
 * Sets state.phase = 'battle'.
 *
 * @param {object} state          — play state
 * @param {string} openedCellKey  — cell key that triggered the battle
 */
export function createBattleState(state, openedCellKey) {
  const CP = CELL_PX;

  const allOpenCells = new Set([...state.openCells]);
  allOpenCells.add(openedCellKey);

  const playerCell  = cellOf(state.player.x, state.player.y);
  const playerKey   = cellKey(playerCell.x, playerCell.y);
  const battleCells = getConnectedCells(allOpenCells, playerKey);
  const { minX, minY, maxX, maxY } = getCellBounds(battleCells);

  // Compute camera zoom to fit battle region on screen
  const bCols   = maxX - minX + 1;
  const bRows   = maxY - minY + 1;
  const wallPad = CP * 0.125;
  const scaleX  = CONFIG.VIEW_W / (bCols * CP + wallPad * 2);
  const scaleY  = CONFIG.VIEW_H / (bRows * CP + wallPad * 2);
  const zoom    = Math.min(scaleX, scaleY) * CONFIG.BATTLE_ZOOM_MULTIPLIER;
  const centerX = (minX + bCols / 2) * CP;
  const centerY = (minY + bRows / 2) * CP;

  // Find room center cell for reward / content lookup
  const roomCenter    = _getRoomCenterCell(state, openedCellKey);
  const roomCenterKey = cellKey(roomCenter.x, roomCenter.y);
  const openedContent = state.cellContents.get(roomCenterKey);

  // Spawn pending room enemies into world-space
  const pendingSpawns = [];
  if (openedContent?.enemyCount && !openedContent.enemiesReleased) {
    openedContent.enemiesReleased = true;

    const enemiesToSpawn = [];
    for (let i = state.spiders.length - 1; i >= 0; i--) {
      const g = state.spiders[i];
      if (g.homeX === roomCenter.x && g.homeY === roomCenter.y) {
        enemiesToSpawn.push(g);
        state.spiders.splice(i, 1);
      }
    }

    // Room corners in world-coords
    let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
    const openedRoom = state.rooms?.find(r => r.cells.some(c => c.k === openedCellKey));
    if (openedRoom) {
      for (const cell of openedRoom.cells) {
        if (battleCells.has(cell.k)) {
          rMinX = Math.min(rMinX, cell.x); rMinY = Math.min(rMinY, cell.y);
          rMaxX = Math.max(rMaxX, cell.x); rMaxY = Math.max(rMaxY, cell.y);
        }
      }
    }
    if (rMinX === Infinity) { rMinX = minX; rMinY = minY; rMaxX = maxX; rMaxY = maxY; }

    const margin = CP * 0.15;
    const corners = [
      { x: rMinX * CP + margin,          y: rMinY * CP + margin },
      { x: (rMaxX + 1) * CP - margin,    y: rMinY * CP + margin },
      { x: rMinX * CP + margin,          y: (rMaxY + 1) * CP - margin },
      { x: (rMaxX + 1) * CP - margin,    y: (rMaxY + 1) * CP - margin },
    ];

    for (let i = 0; i < enemiesToSpawn.length; i++) {
      const g   = enemiesToSpawn[i];
      const cor = corners[i % 4];
      const off = CP * 0.1;
      pendingSpawns.push({
        enemy: _enemyCopy(g, cor.x + (Math.random() - 0.5) * off, cor.y + (Math.random() - 0.5) * off),
        spawnDelay: 1.0 + i * 0.5,
      });
    }
  }

  state.battle = {
    battleCells,
    openedCellKey,
    roomCellKey: roomCenterKey,
    isBossBattle: false,
    pendingSpawns,
    freezeTimer: state.upgrades.freeze ? 1.5 : 0,
    zoom,
    centerX,
    centerY,
  };

  state.phase = 'battle';
}

/**
 * Start the boss fight.
 * Sets state.phase = 'battle'.
 *
 * @param {object} state
 * @param {number} currentLevel
 */
export function createBossBattleState(state, currentLevel) {
  const CP = CELL_PX;

  const battleCells = new Set([...state.openCells]);
  const { minX, minY, maxX, maxY } = getCellBounds(battleCells);

  const bCols   = maxX - minX + 1;
  const bRows   = maxY - minY + 1;
  const wallPad = CP * 0.125;
  const scaleX  = CONFIG.VIEW_W / (bCols * CP + wallPad * 2);
  const scaleY  = CONFIG.VIEW_H / (bRows * CP + wallPad * 2);
  const zoom    = Math.min(scaleX, scaleY) * CONFIG.BATTLE_ZOOM_MULTIPLIER;
  const centerX = (minX + bCols / 2) * CP;
  const centerY = (minY + bRows / 2) * CP;

  // Spawn boss at cell farthest from player
  const bossDef = (typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[currentLevel]) || BOSS_DEFS[1];
  let farthestCell = null, maxDist = -1;
  for (const k of battleCells) {
    const { x, y } = cellFromKey(k);
    const d = Math.hypot((x + 0.5) * CP - state.player.x, (y + 0.5) * CP - state.player.y);
    if (d > maxDist) { maxDist = d; farthestCell = { x, y }; }
  }

  const margin = CONFIG.SPIDER_RADIUS + 20;
  let bossX = centerX, bossY = centerY;
  if (farthestCell) {
    const fcx = (farthestCell.x + 0.5) * CP;
    const fcy = (farthestCell.y + 0.5) * CP;
    const relX = state.player.x - farthestCell.x * CP;
    const relY = state.player.y - farthestCell.y * CP;
    bossX = farthestCell.x * CP + (relX < CP / 2 ? CP - margin : margin);
    bossY = farthestCell.y * CP + (relY < CP / 2 ? CP - margin : margin);
    void fcx; void fcy;
  }

  const bossHp = bossDef.hp !== undefined
    ? bossDef.hp
    : (bossDef.hpBase === 'buldyga' ? CONFIG.BULDYGA_HP : CONFIG.SPIDER_HP) * (bossDef.hpMult || 1);

  state.activeSpiders.push({
    x: bossX, y: bossY, vx: 0, vy: 0,
    radius: CONFIG.SPIDER_RADIUS * (bossDef.radiusMult || 1),
    hp: bossHp, maxHp: bossHp,
    type: bossDef.type || 'boss_phase', isBoss: true,
    shootCd: 0, state: 'chase', stateTimer: 0,
    dashTargetX: 0, dashTargetY: 0,
    dashDirX: 0, dashDirY: 0, dashDistance: 0,
    currentSpeed: undefined, speedAccumulator: 0,
    stunTimer: 0, hitFlash: 0,
    phaseIndex: 0,
    phaseTimer: bossDef.phases?.[0]?.duration ?? 0,
    strafeDir: 1,
    strafeSwitchTimer: CONFIG.BOSS_STRAFE_SWITCH_TIME,
    dashCount: 0,
    bullState: 'chase', bullStateTimer: 0,
    bullDashDirX: 0, bullDashDirY: 0, bullDashDistance: 0,
  });

  state.battle = {
    battleCells,
    openedCellKey: null,
    roomCellKey: null,
    isBossBattle: true,
    pendingSpawns: [],
    freezeTimer: state.upgrades.freeze ? 1.5 : 0,
    zoom,
    centerX,
    centerY,
  };

  state.bossSummonReady = false;
  state.phase = 'battle';
}

// ── Per-frame update ──────────────────────────────────────────

/**
 * Update everything in the battle phase.
 * All coordinates are world-coords — identical to play-mode logic.
 *
 * @param {object} state
 * @param {object} playerProgress
 * @param {import('../render/camera.js').Camera} camera
 * @param {number} dt
 * @param {object} callbacks — { onBattleWon, onPlayerDead, currentLevel }
 */
export function updateBattleMode(state, playerProgress, camera, dt, callbacks = {}) {
  if (state.phase !== 'battle') return;

  const { onBattleWon, onPlayerDead, currentLevel } = callbacks;
  const b = state.battle;

  state.time += dt;

  // Freeze timer
  if (b.freezeTimer > 0) b.freezeTimer -= dt;

  // Pending spawns (with delay)
  _processPendingSpawns(b, state, dt);

  // ── Player movement (reuses play-mode helpers) ─────────────
  _stepBattlePlayer(state, dt);

  // Mouse sync
  if (camera) {
    const w = camera.screenToWorld(mouse.x, mouse.y);
    state.mouse = { x: w.x, y: w.y, held: mouse.held };
  } else {
    state.mouse = mouse;
  }

  // Invulnerability
  if (state.player.invulnerable > 0) state.player.invulnerable -= dt;

  // Dash
  if (state.player.dashCooldown > 0) state.player.dashCooldown -= dt;
  _updateDashTrails(state, dt);
  if (state.player.isDashing) {
    _stepDash(state, dt);
  } else if (keys && keys['shift'] && state.player.dashCooldown <= 0) {
    _startDash(state);
  }

  // ── Shoot ─────────────────────────────────────────────────
  state.shootCooldown = Math.max(0, state.shootCooldown - dt);
  state.burstCooldown = Math.max(0, state.burstCooldown - dt);

  const wDef       = _getActiveWeapon(state);
  const burstActive = wDef && wDef.burstSize > 1 &&
                      state.burstRemaining > 0 &&
                      state.burstWeaponId === wDef.id;
  if ((mouse.held || burstActive) && state.shootCooldown <= 0) {
    shoot(state);
  }

  // ── Bullets (play-mode functions work identically) ─────────
  updateBullets(state, dt, _onEnemyKilled.bind(null, state, playerProgress));
  updateEnemyBullets(state, dt, _onPlayerHit.bind(null, state, playerProgress, onPlayerDead));

  // ── Particles ─────────────────────────────────────────────
  _stepParticles(state.particles, dt);

  // ── Enemy AI ──────────────────────────────────────────────
  updateEnemyAI(state, playerProgress, dt,
    _onPlayerHit.bind(null, state, playerProgress, onPlayerDead));
  resolveEnemyCollisions(state.activeSpiders, state.openCells);

  // Boss entities
  for (const g of state.activeSpiders) {
    if (g.isBoss) updateBoss(g, b, state, playerProgress, dt, currentLevel);
  }

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

  // ── Win check ─────────────────────────────────────────────
  if (b.pendingSpawns.length === 0 && state.activeSpiders.length === 0) {
    if (onBattleWon) onBattleWon(state, playerProgress);
  }

  // ── Camera: keep zoom on battle region ────────────────────
  camera.setZoom(b.zoom, b.centerX, b.centerY);
  camera.update(dt);
}

/**
 * End the battle and return to play phase.
 *
 * @param {object} state
 */
export function exitBattleMode(state) {
  if (!state.battle) return;
  const b = state.battle;

  // Spawn room rewards
  if (b.roomCellKey) {
    spawnRoomRewards(state, b.roomCellKey);
  }

  // Mark room as purified after battle victory
  let purifiedRoomIdx = null;
  if (b.roomCellKey && state.rooms && state.purified) {
    for (let i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].cells.some(c => c.k === b.roomCellKey)) {
        state.purified.add(i);
        purifiedRoomIdx = i;
        break;
      }
    }
  }

  // Reveal adjacent rooms when a room becomes purified
  if (purifiedRoomIdx !== null) {
    updateRevealedRoomsOnPurify(state, purifiedRoomIdx);
  }

  // If boss was defeated, open exit cell
  if (state.bossDefeated && state.exitCell) {
    const ek = cellKey(state.exitCell.x, state.exitCell.y);
    state.openCells.add(ek);
    state.everRevealedCells.add(ek);
    state.everOpenedCells.add(ek);
  }

  state.battle = null;
  state.phase  = 'play';
}

// ── Internal helpers ──────────────────────────────────────────

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

function _enemyCopy(g, bx, by) {
  const isPlevaka = g.type === 'plevaka' || g.type === 'shooter';
  return {
    x: bx, y: by, vx: 0, vy: 0,
    hp: g.hp, maxHp: g.maxHp,
    type: g.type, phase: g.phase, wobble: g.wobble,
    shootCd: g.shootCd || 0,
    radius: g.radius, visualScale: g.visualScale,
    state: g.state, stateTimer: g.stateTimer,
    dashTargetX: g.dashTargetX, dashTargetY: g.dashTargetY,
    dashDirX: g.dashDirX, dashDirY: g.dashDirY,
    dashDistance: g.dashDistance,
    currentSpeed: g.currentSpeed, speedAccumulator: g.speedAccumulator,
    stunTimer: g.stunTimer || 0, hitFlash: 0,
    animState: isPlevaka ? (g.animState || 'idle') : null,
    animFrame: isPlevaka ? (g.animFrame || 0) : null,
    animTimer: isPlevaka ? (g.animTimer || 0) : null,
  };
}

function _stepBattlePlayer(state, dt) {
  if (state.player.isDashing) return;
  const spd = CONFIG.PLAYER_SPEED * state.upgrades.speedMult;
  const k   = state.keys || {};
  let mvx = 0, mvy = 0;
  if (k['w'] || k['ц'] || k['arrowup'])    mvy -= 1;
  if (k['s'] || k['ы'] || k['arrowdown'])  mvy += 1;
  if (k['a'] || k['ф'] || k['arrowleft'])  mvx -= 1;
  if (k['d'] || k['в'] || k['arrowright']) mvx += 1;
  if (mvx && mvy) { mvx *= Math.SQRT1_2; mvy *= Math.SQRT1_2; }

  const rw  = state.removedWalls;
  const newX = state.player.x + mvx * spd * dt;
  const newY = state.player.y + mvy * spd * dt;

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

  if (mvx !== 0 || mvy !== 0) Sounds.footstep(dt);
  else                         Sounds._footstepTimer = 0;
}

function _startDash(state) {
  const k = state.keys || {};
  let mvx = 0, mvy = 0;
  if (k['w'] || k['ц'] || k['arrowup'])    mvy -= 1;
  if (k['s'] || k['ы'] || k['arrowdown'])  mvy += 1;
  if (k['a'] || k['ф'] || k['arrowleft'])  mvx -= 1;
  if (k['d'] || k['в'] || k['arrowright']) mvx += 1;
  if (mvx && mvy) { mvx *= Math.SQRT1_2; mvy *= Math.SQRT1_2; }
  
  const isMoving = mvx !== 0 || mvy !== 0;
  
  let dirX, dirY;
  if (isMoving) {
    dirX = mvx;
    dirY = mvy;
  } else {
    const mx   = (state.mouse || mouse).x;
    const my   = (state.mouse || mouse).y;
    const angle = Math.atan2(my - state.player.y, mx - state.player.x);
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
  if (!state.player.dashTrails) { state.player.dashTrails = []; }
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

function _stepParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function _getRoomCenterCell(state, ck) {
  if (!state.rooms?.length) return cellFromKey(ck);
  for (const room of state.rooms) {
    if (!room.cells.some(c => c.k === ck)) continue;
    let sx = 0, sy = 0;
    for (const c of room.cells) { sx += c.x; sy += c.y; }
    return {
      x: Math.floor(sx / room.cells.length + 0.5),
      y: Math.floor(sy / room.cells.length + 0.5),
    };
  }
  return cellFromKey(ck);
}

function _getActiveWeapon(state) {
  const id = state.weaponSlots?.[state.activeSlot];
  return id ? WEAPON_DEFS[id] : null;
}

function _onEnemyKilled(state, playerProgress, g) {
  if (state.upgrades.killAccel) {
    state.upgrades.killAccelPercent =
      Math.min(80, (state.upgrades.killAccelPercent || 0) + 5);
  }
  if (g.isBoss) {
    state.bossDefeated = true;
    Sounds.bossdeath?.();
  }
  // Bloated death shot
  if (g.type === 'bloated') {
    const b = state;
    const BS = CONFIG.BATTLE_SCALE;
    const pdx = b.player.x - g.x;
    const pdy = b.player.y - g.y;
    const pdist = Math.hypot(pdx, pdy);
    if (pdist > 0) {
      b.enemyBullets.push({
        x: g.x, y: g.y,
        vx: (pdx / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED * BS,
        vy: (pdy / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED * BS,
        life: 6,
      });
    }
  }
}

function _onPlayerHit(state, playerProgress, onPlayerDead) {
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
  if (state.player.lives <= 0 && onPlayerDead) onPlayerDead(state, playerProgress);
}

