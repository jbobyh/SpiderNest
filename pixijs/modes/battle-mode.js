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
  CELL_PX, getRoomBonus,
} from '../world/constants.js';
import { setBodyVelocity, setPlayerDashing } from '../world/physics.js';
import {
  shoot,
  updateBullets,
  updateEnemyBullets,
  enemyBulletRange,
} from '../game/combat.js';
import {
  updateEnemyAI,
} from '../game/enemy-ai.js';
import { updateBoss }                      from '../game/boss.js';
import { updateCollectibles, spawnRoomRewards } from '../game/collectibles.js';
import { tickUpgradePopupTimer, hideUpgradePopup } from '../game/upgrades.js';
import { spawnParticles, spawnPurifyWave } from '../render/particles.js';
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

    // Collect open cells belonging to the opened room
    const roomOpenCells = [];
    const openedRoom = state.rooms?.find(r => r.cells.some(c => c.k === openedCellKey));
    if (openedRoom) {
      for (const cell of openedRoom.cells) {
        if (battleCells.has(cell.k)) {
          roomOpenCells.push(cell);
        }
      }
    }
    // Fallback to battleCells if room not found
    if (roomOpenCells.length === 0) {
      for (const k of battleCells) {
        roomOpenCells.push({ x: cellFromKey(k).x, y: cellFromKey(k).y, k });
      }
    }

    const margin = CP * 0.15;
    for (let i = 0; i < enemiesToSpawn.length; i++) {
      const g = enemiesToSpawn[i];
      const cell = roomOpenCells[Math.floor(Math.random() * roomOpenCells.length)];
      const off = CP * 0.1;
      const spawnX = cell.x * CP + margin + Math.random() * (CP - margin * 2);
      const spawnY = cell.y * CP + margin + Math.random() * (CP - margin * 2);
      pendingSpawns.push({
        enemy: _enemyCopy(g, spawnX + (Math.random() - 0.5) * off, spawnY + (Math.random() - 0.5) * off),
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

  // External walls are already set up for full blobCells in play mode
  // Don't re-sync them here - battleCells is a subset and would remove walls

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

  // External walls are already set up for full blobCells in play mode
  // Don't re-sync them here - battleCells is a subset and would remove walls

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

    // Purify wave from altar position or room geometric center
    const room = state.rooms[purifiedRoomIdx];
    if (!state.purifyWaveFired?.has(purifiedRoomIdx)) {
      state.purifyWaveFired?.add(purifiedRoomIdx);
      const altar = state.roomAltars?.find(a => a.roomIdx === purifiedRoomIdx);
      let ox, oy;
      if (altar) {
        ox = altar.x;
        oy = altar.y;
      } else {
        // Geometric center of room cells
        let sx = 0, sy = 0;
        for (const c of room.cells) { sx += (c.x + 0.5) * CELL_PX; sy += (c.y + 0.5) * CELL_PX; }
        ox = sx / room.cells.length;
        oy = sy / room.cells.length;
      }
      spawnPurifyWave(state.particles, ox, oy, room.cells, CELL_PX);
    }
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
  let spd = CONFIG.PLAYER_SPEED * state.upgrades.speedMult;

  // Apply room bonus speed modifier
  const playerCell = cellOf(state.player.x, state.player.y);
  const playerCellKey = cellKey(playerCell.x, playerCell.y);
  const roomBonus = getRoomBonus(state, playerCellKey);
  if (roomBonus === 'speedup') {
    const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speedup');
    spd *= bonusDef?.speedMult || 1.3;
  } else if (roomBonus === 'speeddown') {
    const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === 'speeddown');
    spd *= bonusDef?.speedMult || 0.7;
  }

  const k   = state.keys || {};
  let mvx = 0, mvy = 0;
  if (k['w'] || k['ц'] || k['arrowup'])    mvy -= 1;
  if (k['s'] || k['ы'] || k['arrowdown'])  mvy += 1;
  if (k['a'] || k['ф'] || k['arrowleft'])  mvx -= 1;
  if (k['d'] || k['в'] || k['arrowright']) mvx += 1;
  if (mvx && mvy) { mvx *= Math.SQRT1_2; mvy *= Math.SQRT1_2; }

  if (mvx !== 0 || mvy !== 0) Sounds.footstep(dt);
  else                         Sounds._footstepTimer = 0;

  setBodyVelocity(state.player.body, mvx * spd, mvy * spd);
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
  if (state.player.body) {
    setPlayerDashing(state.player.body, true);
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
    if (body) { setPlayerDashing(body, false); setBodyVelocity(body, 0, 0); }
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
    if (p.delay > 0) {
      p.delay -= dt;
    } else {
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.roomMask) {
      const ck = `${Math.floor(p.x / 126)},${Math.floor(p.y / 126)}`;
      if (!p.roomMask.has(ck)) { particles.splice(i, 1); continue; }
    }
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
      const ebx = (pdx / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED * BS;
      const eby = (pdy / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED * BS;
      b.enemyBullets.push({
        x: g.x, y: g.y,
        vx: ebx,
        vy: eby,
        _baseVx: ebx,
        _baseVy: eby,
        maxRange: enemyBulletRange(ebx, eby),
        distanceTraveled: 0,
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

