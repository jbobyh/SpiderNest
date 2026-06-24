// ============================================================
// GAME LOOP — Ticker + phase dispatcher + render sync
//
// startGameLoop(options) — wire everything and start the ticker.
// stopGameLoop()         — remove the ticker callback.
//
// Phase flow:
//   play  ──startZoomIn──►  zoom_in  ──►  battle
//   battle ──win──startZoomOut──►  zoom_out  ──►  play  (next level/continue)
//   any   ──player dead──►  dead
//   play  ──exit reached──►  win
//
// Globals: CONFIG (from config.js)
// ============================================================

import { app }           from './core/app.js';
import { loadMusicBundle } from './core/assets.js';
import { Camera }        from './render/camera.js';
import { initLayers, clearWorldLayers, layers } from './render/layers.js';
import { buildTileLayer }   from './render/tiles.js';
import { initEntityPool }   from './render/entity-pool.js';
import {
  initPlayerRenderer, updatePlayerSprite, destroyPlayerRenderer,
} from './render/player-renderer.js';
import {
  syncEnemySprites, clearEnemySprites,
} from './render/enemy-renderer.js';
import {
  syncBullets, clearBullets, initBulletRenderer,
} from './render/bullet-renderer.js';
import { bulletManager } from './game/bullet-manager.js';
import {
  initParticles, syncParticles, clearParticles,
} from './render/particles.js';
import {
  initDamageNumbers, updateAndSyncDamageNumbers, clearDamageNumbers,
} from './render/damage-numbers.js';
import { initHud, updateHud, updateBossHpBar, showLevelComplete, hideLevelComplete, destroyHud }   from './render/hud.js';
import {
  initCollectibleRenderer, syncCollectibles, clearCollectibles,
} from './render/collectible-renderer.js';
import {
  initFlyingHeartRenderer, syncFlyingHeart, destroyFlyingHeartRenderer,
} from './render/flying-heart.js';
import {
  initOverlay, updateOverlay, destroyOverlay, isOverlayActive,
  showGameOver, hideGameOver, isGameOverActive,
} from './render/overlay.js';
import {
  initTooltip, updateTooltip, destroyTooltip,
} from './render/tooltip.js';
import { initInput, destroyInput } from './core/input.js';
import { Sounds }               from './core/sound.js';
import {
  createGameState, createDefaultProgress, saveGame, savePlayerProgress, deleteSave,
} from './game/state.js';
import { updatePlayMode, isNearWeapon, isNearAltar, isNearUpgradeChest, isNearCursedChest, isNearRoomBonusAltar } from './modes/play-mode.js';
import {
  createBattleState, createBossBattleState,
  updateBattleMode, exitBattleMode,
} from './modes/battle-mode.js';
import {
  startZoomIn, startZoomOut, updateTransition,
} from './modes/transitions.js';
import {
  createEngine, clearEngine, stepEngine,
  createPlayerBody, destroyBody,
  syncWallBodies, syncExternalWallBodies, onCollision,
} from './world/physics.js';
import { computeFlowField, FLOW_SUB_PX } from './game/flow-field.js';
import { getCellBounds } from './world/constants.js';
import { spawnCorpse } from './game/enemy-ai.js';
import { spawnParticles } from './render/particles.js';

// ── Module state ──────────────────────────────────────────────

let _camera            = null;
let _state             = null;
let _playerProgress    = null;
let _levelStartProgress = null;  // Snapshot of progress at level start (for restart)
let _currentLevel      = 1;
let _tickerFn          = null;
let _running           = false;

// ── Public API ────────────────────────────────────────────────

/**
 * Initialise all subsystems and start the game loop.
 *
 * @param {object} opts
 * @param {number}  [opts.level=1]            — starting level
 * @param {object}  [opts.playerProgress]     — resume with existing progress
 * @param {object}  [opts.savedState]         — resume with serialised state
 * @param {boolean} [opts.freshStart=true]
 */
export function startGameLoop({
  level = 1,
  playerProgress = null,
  savedState     = null,
} = {}) {
  if (_running) stopGameLoop();

  _currentLevel   = level;
  _playerProgress = playerProgress ?? createDefaultProgress();

  // Save snapshot of progress at level start (for restart after death)
  const defaults = createDefaultProgress();
  _levelStartProgress = {
    totalLives: _playerProgress.totalLives,
    totalHeartsCollected: _playerProgress.totalHeartsCollected,
    upgrades: { ..._playerProgress.upgrades },
    spawnedUpgrades: { ..._playerProgress.spawnedUpgrades },
    spawnedWeapons: [...(_playerProgress.spawnedWeapons || [])],
    weaponSlots: [...(_playerProgress.weaponSlots || defaults.weaponSlots)],
    activeSlot: _playerProgress.activeSlot ?? 0,
    maxSlots: _playerProgress.maxSlots ?? 1,
  };

  // Build or restore game state
  _state = savedState ?? createGameState(_currentLevel, _playerProgress);

  // Initialize lazy-rebuild tracking
  _state._lastPurifiedSize = _state.purified?.size ?? 0;
  _state._lastEverRevealedSize = _state.everRevealedCells?.size ?? 0;

  // Physics engine
  createEngine();
  syncWallBodies(_state.blobCells, _state.removedWalls);
  const visibleCells = new Set([..._state.openCells, ..._state.everRevealedCells]);
  syncExternalWallBodies(_state.blobCells, visibleCells);
  _state.player.body = createPlayerBody(_state.player.x, _state.player.y, _state.player);

  // Register collision handler
  onCollision((pairs) => _handlePhysicsCollision(pairs));

  // Flow field state
  _state.flowField       = null;
  _state._ff_scx         = -1;
  _state._ff_scy         = -1;
  _state.blockedSubNodes = new Set();

  // Renderer init
  _camera = new Camera();
  initLayers(_camera);
  initEntityPool();
  initParticles(layers.particles);
  initDamageNumbers(layers.damageNumbers);
  initPlayerRenderer(layers.entities);
  initBulletRenderer(layers.entities);
  initCollectibleRenderer(layers.entities);
  initFlyingHeartRenderer(layers.particles);
  initHud(layers.hud);
  initOverlay(layers.hud);
  initTooltip(layers.hud);

  // Tile layer for current level
  buildTileLayer(layers.tiles, {
    blobCells:          _state.blobCells,
    openCells:          _state.openCells,
    everRevealedCells:  _state.everRevealedCells,
    everOpenedCells:   _state.everOpenedCells,
    removedWalls:       _state.removedWalls,
    internalWalls:      _state.internalWalls,
    permanentlyClosed:  _state.permanentlyClosed,
    disabledCells:      _state.disabledCells,
    rooms:              _state.rooms,
    purified:           _state.purified,
    chestObjs:          _state.chestObjs,
    hearts:             _state.hearts,
    upgradeChests:      _state.upgradeChests,
    summonSphere:       _state.summonSphere,
    roomBonuses:        _state.roomBonuses,
    roomBonusAltars:     _state.roomBonusAltars,
  }, _currentLevel);

  // Input
  initInput(app.canvas);

  // Save once at level start
  saveGame(_state, _currentLevel, _playerProgress);

  // Music — load bundle first (large files), then start playback
  loadMusicBundle()
    .then(() => { if (_running) Sounds.playLevelMusic(_currentLevel); })
    .catch(() => {});

  // Ticker
  _tickerFn = (ticker) => _loop(ticker.deltaMS / 1000);
  app.ticker.add(_tickerFn);
  _running = true;
}

/**
 * Stop the ticker and clean up render objects.
 * Does NOT destroy the PixiJS app.
 */
export function stopGameLoop() {
  if (_tickerFn) {
    app.ticker.remove(_tickerFn);
    _tickerFn = null;
  }
  destroyInput();
  destroyPlayerRenderer();
  clearEnemySprites();
  bulletManager.clear();
  clearBullets();
  clearParticles();
  clearDamageNumbers();
  clearCollectibles();
  destroyFlyingHeartRenderer();
  destroyOverlay();
  destroyHud();
  destroyTooltip();
  clearWorldLayers();

  // Physics cleanup
  if (_state) {
    if (_state.player?.body) destroyBody(_state.player.body);
    for (const g of (_state.activeSpiders || [])) if (g.body) destroyBody(g.body);
  }
  clearEngine();

  _running = false;
}

// ── Physics Collisions ────────────────────────────────────────

function _handlePhysicsCollision(pairs) {
  if (!_state || _state.phase !== 'play' && _state.phase !== 'battle') return;

  for (const pair of pairs) {
    const { bodyA, bodyB } = pair;
    const entA = bodyA._entity;
    const entB = bodyB._entity;

    if (!entA || !entB) continue;

    // Player <-> Enemy
    const player = (entA.lives !== undefined) ? entA : (entB.lives !== undefined ? entB : null);
    const enemy  = (entA.hp !== undefined && entA !== player) ? entA : (entB.hp !== undefined && entB !== player ? entB : null);

    if (player && enemy) {
      _handlePlayerEnemyContact(player, enemy);
    }
  }
}

function _handlePlayerEnemyContact(player, enemy) {
  if (player.invulnerable > 0 || player.isDashing) return;

  // Damage player
  const onPlayerDead = _onPlayerDead;
  
  if (enemy.isBoss) {
    // Boss contact damage
    player.lives--;
    player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME;
    Sounds.playerhit?.();
    spawnParticles(_state.particles, player.x, player.y, 12, 0, Math.PI*2, 20, 60, 0.5, '#ff4444');
    if (player.lives <= 0) onPlayerDead(_state, _playerProgress);
    return;
  }

  // Regular enemy contact damage
  if (player.lives > 0) {
    const idx = _state.activeSpiders.indexOf(enemy);
    if (idx !== -1) {
      // Shooter/Plevaka don't die on contact or deal contact damage usually? 
      // Actually, in the old code plevaka/shooter didn't have contact damage block.
      // But they are ranged. Let's keep it consistent with old logic.
      if (enemy.type !== 'shooter' && enemy.type !== 'plevaka') {
        spawnCorpse(_state.deathCorpses, enemy, enemy.radius || CONFIG.SPIDER_RADIUS);
        destroyBody(enemy.body);
        _state.activeSpiders.splice(idx, 1);
        
        spawnParticles(_state.particles, player.x, player.y, 8, 0, Math.PI*2, 20, 40, 0.5, '#ff4444');
        
        player.lives--;
        player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME;
        Sounds.playerhit?.();
        
        if (player.lives <= 0) onPlayerDead(_state, _playerProgress);
      }
    }
  }
}

function _loop(dt) {
  if (!_state || !_camera) return;

  // Clamp dt to avoid spiral-of-death on tab-switch
  const safeDt = Math.min(dt, 0.1);
  const phase  = _state.phase;

  // Step physics engine (wall + dynamic bodies)
  stepEngine(safeDt * 1000);

  // Sync entity positions from physics bodies
  if (_state.player?.body) {
    _state.player.x = _state.player.body.position.x;
    _state.player.y = _state.player.body.position.y;
  }
  for (const g of _state.activeSpiders) {
    if (g.body) { g.x = g.body.position.x; g.y = g.body.position.y; }
  }

  // Flow field: recompute when player moves to a different sub-cell
  if (phase === 'play' || phase === 'battle') {
    const pSubCX = Math.floor(_state.player.x / FLOW_SUB_PX);
    const pSubCY = Math.floor(_state.player.y / FLOW_SUB_PX);
    if (pSubCX !== _state._ff_scx || pSubCY !== _state._ff_scy) {
      _state._ff_scx = pSubCX;
      _state._ff_scy = pSubCY;
      _state.flowField = computeFlowField(
        _state.openCells, _state.removedWalls,
        _state.player.x, _state.player.y,
        _state.blockedSubNodes,
      );
    }
  }

  // Update overlay (choice panels) — must run before phase dispatch
  updateOverlay(_state, _playerProgress, { onEnterBattle: _onEnterBattle });

  // If the cursed-choice or game-over overlay is open, skip game logic but still render
  if (isOverlayActive() || isGameOverActive()) {
    _render(safeDt);
    return;
  }

  // ── Phase dispatch ────────────────────────────────────────
  if (phase === 'play') {
    updatePlayMode(_state, _playerProgress, _camera, safeDt, {
      onEnterBattle: _onEnterBattle,
      onPlayerDead:  _onPlayerDead,
    });

  } else if (phase === 'battle') {
    updateBattleMode(_state, _playerProgress, _camera, safeDt, {
      onBattleWon:   _onBattleWon,
      onPlayerDead:  _onPlayerDead,
      currentLevel:  _currentLevel,
    });

  } else if (phase === 'zoom_in') {
    updateTransition(safeDt, _camera, _onZoomInComplete);

  } else if (phase === 'zoom_out') {
    updateTransition(safeDt, _camera, _onZoomOutComplete);

  } else if (phase === 'dead') {
    // Game-over screen is handled by DOM overlay; loop idles
    return;

  } else if (phase === 'win') {
    // Level-complete screen; loop idles
    return;
  }

  // ── Render sync ───────────────────────────────────────────
  _render(safeDt);
}

// ── Render ────────────────────────────────────────────────────

function _render(dt) {
  // Unified coords: all entities always in state.activeSpiders / state.bullets etc.
  updatePlayerSprite(_state, dt);

  syncEnemySprites(
    _state.activeSpiders,
    _state.deathCorpses,
    layers.entities,
    _state.time,
    _state.player.x,
  );

  syncBullets(bulletManager.bullets);
  syncParticles(_state.particles);
  updateAndSyncDamageNumbers(_state, dt, _camera);
  syncCollectibles(_state);
  syncFlyingHeart();
  updateTooltip(_state, _camera);
  const nearWeapon = _state.phase === 'play' ? isNearWeapon(_state) : false;
  const nearAltar  = _state.phase === 'play' ? isNearAltar(_state)  : false;
  const nearChest  = _state.phase === 'play' ? isNearUpgradeChest(_state) : false;
  const nearCursedChest = _state.phase === 'play' ? isNearCursedChest(_state) : false;
  const nearRoomBonusAltar = _state.phase === 'play' ? isNearRoomBonusAltar(_state) : false;
  const bossSummonReady = _state.phase === 'play' ? _state.bossSummonReady : false;
  updateHud(_state, _currentLevel, nearWeapon, nearAltar, bossSummonReady, nearChest, nearCursedChest, nearRoomBonusAltar);

  // Update boss HP bar during boss battle
  if (_state.battle?.isBossBattle) {
    updateBossHpBar(_state);
  }

  // Rebuild tile layer and sync physics walls when walls, purified, or revealed cells change
  const purifiedSize      = _state.purified?.size ?? 0;
  const everRevealedSize  = _state.everRevealedCells?.size ?? 0;
  if (_state._lastRemovedWallsSize !== _state.removedWalls.size ||
      _state._lastPurifiedSize     !== purifiedSize ||
      _state._lastEverRevealedSize !== everRevealedSize) {
    
    // Sync physics walls if walls changed
    if (_state._lastRemovedWallsSize !== _state.removedWalls.size) {
      syncWallBodies(_state.blobCells, _state.removedWalls);
    }
    
    // Sync external walls if revealed cells changed
    if (_state._lastEverRevealedSize !== everRevealedSize) {
      const visibleCells = new Set([..._state.openCells, ..._state.everRevealedCells]);
      syncExternalWallBodies(_state.blobCells, visibleCells);
    }

    _state._lastRemovedWallsSize = _state.removedWalls.size;
    _state._lastPurifiedSize     = purifiedSize;
    _state._lastEverRevealedSize = everRevealedSize;
    buildTileLayer(layers.tiles, {
      blobCells:          _state.blobCells,
      openCells:          _state.openCells,
      everRevealedCells:  _state.everRevealedCells,
      everOpenedCells:   _state.everOpenedCells,
      removedWalls:       _state.removedWalls,
      internalWalls:      _state.internalWalls,
      permanentlyClosed:  _state.permanentlyClosed,
      disabledCells:      _state.disabledCells,
      rooms:              _state.rooms,
      purified:           _state.purified,
      chestObjs:          _state.chestObjs,
      hearts:             _state.hearts,
      upgradeChests:      _state.upgradeChests,
      summonSphere:       _state.summonSphere,
      roomBonuses:        _state.roomBonuses,
    }, _currentLevel);
  }
}

// ── Phase transition callbacks ────────────────────────────────

function _onEnterBattle(cellKey) {
  if (_state.bossSummonReady && cellKey == null) {
    // Boss summon via boss altar
    startZoomIn(_state, _camera, null, true);
  } else {
    startZoomIn(_state, _camera, cellKey, false);
  }
}

function _onZoomInComplete(tr) {
  if (tr.isBoss) {
    createBossBattleState(_state, _currentLevel);
    Sounds.playBossMusic?.();
  } else {
    createBattleState(_state, tr.pendingCellKey);
  }
}

function _onBattleWon(state, playerProgress) {
  const isBoss = state.battle?.isBossBattle;

  if (isBoss) {
    state.bossDefeated = true;
    // Check win condition (all bosses defeated = level complete)
    _onLevelComplete(state, playerProgress);
    return;
  }

  startZoomOut(state, _camera);
}

function _onZoomOutComplete(_tr) {
  exitBattleMode(_state);
  Sounds.playLevelMusic(_currentLevel);

  // Rebuild tiles (walls may have changed, room purification updated)
  buildTileLayer(layers.tiles, {
    blobCells:          _state.blobCells,
    openCells:          _state.openCells,
    everRevealedCells:  _state.everRevealedCells,
    everOpenedCells:   _state.everOpenedCells,
    removedWalls:       _state.removedWalls,
    internalWalls:      _state.internalWalls,
    permanentlyClosed:  _state.permanentlyClosed,
    disabledCells:      _state.disabledCells,
    rooms:              _state.rooms,
    purified:           _state.purified,
    chestObjs:          _state.chestObjs,
    hearts:             _state.hearts,
    upgradeChests:      _state.upgradeChests,
    summonSphere:       _state.summonSphere,
    roomBonuses:        _state.roomBonuses,
  }, _currentLevel);
}

function _onPlayerDead(state, playerProgress) {
  state.phase = 'dead';
  Sounds.stopGameMusic();
  // Show canvas game-over overlay (don't save progress - restart uses level-start state)
  showGameOver(state, playerProgress, () => {
    hideGameOver();
    restartLevel();
  });
}

function _onLevelComplete(state, playerProgress) {
  state.phase = 'win';
  Sounds.stopGameMusic();
  savePlayerProgress(state, playerProgress);
  deleteSave();
  showLevelComplete(() => {
    hideLevelComplete();
    nextLevel();
  });
}

// ── Level restart / next level (called from DOM buttons) ──────

/**
 * Restart the current level from scratch.
 */
export function restartLevel() {
  stopGameLoop();
  // Use level-start progress snapshot (resets upgrades/weapons collected during level)
  const restartProgress = _levelStartProgress ?? createDefaultProgress();
  restartProgress.totalLives = Math.max(1, restartProgress.totalLives);
  startGameLoop({ level: _currentLevel, playerProgress: restartProgress });
}

/**
 * Advance to the next level.
 */
export function nextLevel() {
  stopGameLoop();
  _currentLevel = Math.min(_currentLevel + 1, CONFIG.MAX_LEVELS ?? 3);
  startGameLoop({ level: _currentLevel, playerProgress: _playerProgress });
}

export function getCurrentLevel() {
  return _currentLevel;
}
