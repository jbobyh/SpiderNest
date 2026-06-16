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
  syncBullets, clearBullets,
} from './render/bullet-renderer.js';
import {
  initParticles, syncParticles, clearParticles,
} from './render/particles.js';
import { initHud, updateHud, updateBossHpBar, showLevelComplete, hideLevelComplete }   from './render/hud.js';
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
  startAutosave, stopAutosave, tickAutosave,
} from './core/save.js';
import {
  createGameState, createDefaultProgress, saveGame, savePlayerProgress,
} from './game/state.js';
import { updatePlayMode, isNearWeapon, isNearAltar } from './modes/play-mode.js';
import {
  createBattleState, createBossBattleState,
  updateBattleMode, exitBattleMode,
} from './modes/battle-mode.js';
import {
  startZoomIn, startZoomOut, updateTransition,
} from './modes/transitions.js';

// ── Module state ──────────────────────────────────────────────

let _camera         = null;
let _state          = null;
let _playerProgress = null;
let _currentLevel   = 1;
let _tickerFn       = null;
let _running        = false;

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

  // Build or restore game state
  _state = savedState ?? createGameState(_currentLevel, _playerProgress);

  // Renderer init
  _camera = new Camera();
  initLayers(_camera);
  initEntityPool();
  initParticles(layers.particles);
  initPlayerRenderer(layers.entities);
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
    permanentlyClosed:  _state.permanentlyClosed,
    disabledCells:      _state.disabledCells,
    rooms:              _state.rooms,
    purified:           _state.purified,
    chestObjs:          _state.chestObjs,
    hearts:             _state.hearts,
  }, _currentLevel);

  // Input
  initInput(app.canvas);

  // Music — load bundle first (large files), then start playback
  loadMusicBundle()
    .then(() => { if (_running) Sounds.playLevelMusic(_currentLevel); })
    .catch(() => {});

  // Autosave every 30 s during play
  startAutosave({
    getState:    () => _state,
    getLevel:    () => _currentLevel,
    getProgress: () => _playerProgress,
  });

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
  stopAutosave();
  destroyInput();
  destroyPlayerRenderer();
  clearEnemySprites();
  clearBullets();
  clearParticles();
  clearCollectibles();
  destroyFlyingHeartRenderer();
  destroyOverlay();
  destroyTooltip();
  clearWorldLayers();
  _running = false;
}

// ── Main loop ─────────────────────────────────────────────────

function _loop(dt) {
  if (!_state || !_camera) return;

  // Clamp dt to avoid spiral-of-death on tab-switch
  const safeDt = Math.min(dt, 0.1);
  const phase  = _state.phase;

  // Tick autosave timer
  tickAutosave(safeDt);

  // Update overlay (cursed-choice panel) — must run before phase dispatch
  updateOverlay(_state, _playerProgress);

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

  syncBullets(_state.bullets, _state.enemyBullets, layers.entities);
  syncParticles(_state.particles);
  syncCollectibles(_state);
  syncFlyingHeart();
  updateTooltip(_state, _camera);
  const nearWeapon = _state.phase === 'play' ? isNearWeapon(_state) : false;
  const nearAltar  = _state.phase === 'play' ? isNearAltar(_state)  : false;
  const bossSummonReady = _state.phase === 'play' ? _state.bossSummonReady : false;
  updateHud(_state, _currentLevel, nearWeapon, nearAltar, bossSummonReady);

  // Update boss HP bar during boss battle
  if (_state.battle?.isBossBattle) {
    updateBossHpBar(_state);
  }

  // Rebuild tile layer when walls change (lazy: track removedWalls size)
  if (_state._lastRemovedWallsSize !== _state.removedWalls.size) {
    _state._lastRemovedWallsSize = _state.removedWalls.size;
    buildTileLayer(layers.tiles, {
      blobCells:          _state.blobCells,
      openCells:          _state.openCells,
      everRevealedCells:  _state.everRevealedCells,
      everOpenedCells:   _state.everOpenedCells,
      removedWalls:       _state.removedWalls,
      permanentlyClosed:  _state.permanentlyClosed,
      disabledCells:      _state.disabledCells,
      rooms:              _state.rooms,
      purified:           _state.purified,
      chestObjs:          _state.chestObjs,
      hearts:             _state.hearts,
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
    permanentlyClosed:  _state.permanentlyClosed,
    disabledCells:      _state.disabledCells,
    rooms:              _state.rooms,
    purified:           _state.purified,
    chestObjs:          _state.chestObjs,
    hearts:             _state.hearts,
  }, _currentLevel);
}

function _onPlayerDead(state, playerProgress) {
  state.phase = 'dead';
  Sounds.stopGameMusic();
  savePlayerProgress(state, playerProgress);
  // Show canvas game-over overlay
  showGameOver(state, playerProgress, () => {
    hideGameOver();
    restartLevel();
  });
}

function _onLevelComplete(state, playerProgress) {
  state.phase = 'win';
  Sounds.stopGameMusic();
  savePlayerProgress(state, playerProgress);
  saveGame(state, _currentLevel, playerProgress);
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
  _playerProgress.totalLives = Math.max(1, _playerProgress.totalLives);
  startGameLoop({ level: _currentLevel, playerProgress: _playerProgress });
}

/**
 * Advance to the next level.
 */
export function nextLevel() {
  stopGameLoop();
  _currentLevel = Math.min(_currentLevel + 1, CONFIG.MAX_LEVELS ?? 3);
  startGameLoop({ level: _currentLevel, playerProgress: _playerProgress });
}
