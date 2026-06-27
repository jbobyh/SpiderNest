// ============================================================
// OVERLAY — cursed-choice and game-over PixiJS panels in the HUD layer.
//
// This module manages:
//   - Cursed-choice panel (in-game cursed chest)
//   - Game-over screen (player death)
//
// initOverlay(hudLayer)
// updateOverlay(state, playerProgress)  — call each frame
// showGameOver(state, playerProgress, onRestart) — show death screen
// hideGameOver() — hide death screen
// isOverlayActive() — cursed choice active
// isGameOverActive() — game over screen active
// destroyOverlay()
//
// Globals: CONFIG, CURSED_UPGRADE_TYPES (from config.js)
// ============================================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { applySpecialChoice, applyUpgradeChoice, applyRoomBonusChoice } from '../game/collectibles.js';

const VW = CONFIG.VIEW_W;
const VH = CONFIG.VIEW_H;

// ── Module state ──────────────────────────────────────────────

let _hud   = null;
let _panel = null;
let _ctx   = null; // { state, playerProgress } while panel is open
let _gameOverPanel = null;
let _gameOverCallback = null; // onRestart callback
let _onEnterBattle = null; // callback for upgrade chest choice

// ── Text styles ───────────────────────────────────────────────

const ST_TITLE = new TextStyle({
  fill: '#cc66ff', fontSize: 18,
  fontFamily: 'Huninn, monospace', fontWeight: 'bold', align: 'center',
});
const ST_HINT = new TextStyle({
  fill: '#ccaae8', fontSize: 11,
  fontFamily: 'Huninn, monospace', align: 'center',
  wordWrap: true, wordWrapWidth: 380,
});

// Game-over styles
const ST_GO_TITLE = new TextStyle({
  fill: '#ff4444', fontSize: 32,
  fontFamily: 'Huninn, monospace', fontWeight: 'bold', align: 'center',
});
const ST_GO_SUB = new TextStyle({
  fill: '#aaccbb', fontSize: 14,
  fontFamily: 'Huninn, monospace', align: 'center',
});
const ST_GO_BTN = new TextStyle({
  fill: '#ffffff', fontSize: 14, fontWeight: 'bold',
  fontFamily: 'Huninn, monospace', align: 'center',
});

// ── Public API ────────────────────────────────────────────────

export function initOverlay(hudLayer) {
  _hud   = hudLayer;
  _panel = null;
  _ctx   = null;
  _gameOverPanel = null;
  _gameOverCallback = null;
}

export function destroyOverlay() {
  _hidePanel();
  hideGameOver();
  _hud = null;
}

/**
 * Call each frame from the game loop.
 * Shows choice panels when active.
 */
export function updateOverlay(state, playerProgress, callbacks = {}) {
  if (!_hud) return;

  // Store callback for upgrade chest
  if (callbacks.onEnterBattle) _onEnterBattle = callbacks.onEnterBattle;

  const sc = state._specialChoiceState;
  const uc = state._upgradeChoiceState;
  const rc = state._roomBonusChoiceState;

  // Special choice (spatial/cursed) takes priority
  if (sc?.active && !_panel) {
    _showSpecialChoice(state, playerProgress);
  } else if (uc?.active && !_panel) {
    _showUpgradeChoice(state, playerProgress);
  } else if (rc?.active && !_panel) {
    _showRoomBonusChoice(state, playerProgress);
  } else if (!sc?.active && !uc?.active && !rc?.active && _panel) {
    _hidePanel();
  }
}

/** Returns true while any choice panel is visible (game logic should pause). */
export function isOverlayActive() {
  return _panel !== null;
}

/** Returns true while the game-over screen is visible (game logic should pause). */
export function isGameOverActive() {
  return _gameOverPanel !== null;
}

/**
 * Show the game-over screen in canvas.
 * @param {object} state - game state
 * @param {object} playerProgress - player progress
 * @param {function} onRestart - callback when restart button is clicked
 */
export function showGameOver(state, playerProgress, onRestart) {
  if (_gameOverPanel) return; // Already showing
  _gameOverCallback = onRestart;

  const cont = new Container({ label: 'game-over' });

  // Full-screen dim
  const dim = new Graphics();
  dim.rect(0, 0, VW, VH).fill({ color: 0x0a0404, alpha: 0.88 });
  cont.addChild(dim);

  // Title
  const title = new Text({ text: 'ВЫ ПОГИБЛИ', style: ST_GO_TITLE });
  title.anchor.set(0.5, 0);
  title.position.set(VW / 2, VH / 2 - 40);
  cont.addChild(title);

  // Subtitle
  const sub = new Text({ text: 'Пауки победили...', style: ST_GO_SUB });
  sub.anchor.set(0.5, 0);
  sub.position.set(VW / 2, VH / 2 + 10);
  cont.addChild(sub);

  // Restart button
  const btnW = 200;
  const btnH = 50;
  const btnX = (VW - btnW) / 2;
  const btnY = VH / 2 + 50;

  const btn = new Graphics();
  const _drawNormal = () =>
    btn.clear()
       .rect(btnX, btnY, btnW, btnH)
       .fill({ color: 0x1a0030, alpha: 0.95 })
       .stroke({ color: 0xff4444, alpha: 0.8, width: 2 });
  const _drawHover = () =>
    btn.clear()
       .rect(btnX, btnY, btnW, btnH)
       .fill({ color: 0x2d0050, alpha: 0.98 })
       .stroke({ color: 0xff6666, alpha: 1, width: 2 });

  _drawNormal();
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.hitArea = { contains: (x, y) => x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH };
  btn.on('pointerover', _drawHover);
  btn.on('pointerout', _drawNormal);
  btn.on('pointerdown', () => {
    if (_gameOverCallback) _gameOverCallback();
  });
  cont.addChild(btn);

  const btnText = new Text({ text: 'НАЧАТЬ ЗАНОВО', style: ST_GO_BTN });
  btnText.anchor.set(0.5, 0.5);
  btnText.position.set(VW / 2, btnY + btnH / 2);
  cont.addChild(btnText);

  _hud.addChild(cont);
  _gameOverPanel = cont;
}

export function hideGameOver() {
  if (_gameOverPanel) {
    _gameOverPanel.destroy({ children: true });
    _gameOverPanel = null;
  }
  _gameOverCallback = null;
}

// ── Choice panel layout constants ────────────────────────────

const PANEL_W = 430;
const PANEL_H = 250;
const BTN_W   = 120;
const BTN_H   = 120;
const BTN_GAP = 18;

const UPGRADE_BTN_W = 120;
const UPGRADE_BTN_H = 110;
const DECLINE_BTN_W = 180;
const DECLINE_BTN_H = 36;

// ── Special choice panel (Spatial / Cursed) ───────────────────

function _showSpecialChoice(state, playerProgress) {
  const type = state._specialChoiceState.type;
  const choices = _pickSpecialChoices(state, type);
  _ctx = { state, playerProgress, choices };

  const px = (VW - PANEL_W) / 2;
  const py = (VH - PANEL_H) / 2;

  const cont = new Container({ label: 'special-choice' });

  // Full-screen dim
  const dim = new Graphics();
  dim.rect(0, 0, VW, VH).fill({ color: 0x000000, alpha: 0.6 });
  cont.addChild(dim);

  // Panel background
  const panel = new Graphics();
  const accentColor = type === 'spatial' ? 0x00d4ff : 0x9900ff;
  panel.rect(px, py, PANEL_W, PANEL_H)
       .fill({ color: 0x160020, alpha: 0.97 })
       .stroke({ color: accentColor, alpha: 0.9, width: 2 });
  cont.addChild(panel);

  // Title
  const titleText = type === 'spatial' ? '✨ ПРОСТРАНСТВЕННЫЙ СУНДУК ✨' : '⚠ ПРОКЛЯТЫЙ БОНУС ⚠';
  const title = new Text({ text: titleText, style: ST_TITLE });
  title.anchor.set(0.5, 0);
  title.position.set(VW / 2, py + 14);
  cont.addChild(title);

  // Hint
  const hintText = type === 'spatial' ? 'Выбери пространственное улучшение:' : 'Выбери одно из проклятых улучшений:';
  const hint = new Text({ text: hintText, style: ST_HINT });
  hint.anchor.set(0.5, 0);
  hint.position.set(VW / 2, py + 42);
  cont.addChild(hint);

  // Choice buttons
  const totalW  = choices.length * BTN_W + (choices.length - 1) * BTN_GAP;
  const startX  = (VW - totalW) / 2;
  const btnY    = py + 75;

  for (let i = 0; i < choices.length; i++) {
    _addChoiceBtn(cont, choices[i], startX + i * (BTN_W + BTN_GAP), btnY);
  }

  _hud.addChild(cont);
  _panel = cont;
}

function _addChoiceBtn(cont, ch, bx, by) {
  const accent = ch.color ? _hexToNum(ch.color) : 0x9900ff;

  // Draw button background (redrawn on hover via closure)
  const btn = new Graphics();
  btn.position.set(bx, by);
  const _drawNormal = () =>
    btn.clear()
       .rect(0, 0, BTN_W, BTN_H)
       .fill({ color: 0x1a0030, alpha: 0.95 })
       .stroke({ color: accent, alpha: 0.8, width: 1.5 });
  const _drawHover = () =>
    btn.clear()
       .rect(0, 0, BTN_W, BTN_H)
       .fill({ color: 0x2d0050, alpha: 0.98 })
       .stroke({ color: accent, alpha: 1, width: 2 });

  _drawNormal();
  btn.eventMode = 'static';
  btn.cursor    = 'pointer';
  btn.hitArea   = { contains: (x, y) => x >= 0 && x <= BTN_W && y >= 0 && y <= BTN_H };
  btn.on('pointerover', _drawHover);
  btn.on('pointerout',  _drawNormal);
  btn.on('pointerdown', () => _onSpecialChoice(ch.id));
  cont.addChild(btn);

  // Icon emoji
  const icon = new Text({
    text: ch.icon ?? '?',
    style: new TextStyle({ fill: ch.color ?? '#cc66ff', fontSize: 30, fontFamily: 'sans-serif' }),
  });
  icon.anchor.set(0.5, 0);
  icon.position.set(BTN_W / 2, 8);
  btn.addChild(icon);

  // Label
  const lbl = new Text({
    text: ch.label ?? ch.id,
    style: new TextStyle({
      fill: '#ffffff', fontSize: 10, fontWeight: 'bold',
      fontFamily: 'Huninn, monospace', align: 'center',
      wordWrap: true, wordWrapWidth: BTN_W - 8,
    }),
  });
  lbl.anchor.set(0.5, 0);
  lbl.position.set(BTN_W / 2, 50);
  btn.addChild(lbl);

  // Short description
  const desc = new Text({
    text: ch.description ?? '',
    style: new TextStyle({
      fill: '#ccaae8', fontSize: 8,
      fontFamily: 'Huninn, monospace', align: 'center',
      wordWrap: true, wordWrapWidth: BTN_W - 8,
    }),
  });
  desc.anchor.set(0.5, 0);
  desc.position.set(BTN_W / 2, 72);
  btn.addChild(desc);
}

function _onSpecialChoice(id) {
  if (!_ctx) return;
  const { state, playerProgress } = _ctx;
  applySpecialChoice(state, playerProgress, id);
  _hidePanel();
}

// ── Upgrade choice panel ───────────────────────────────────────

function _showUpgradeChoice(state, playerProgress) {
  const choices = _pickUpgradeChoices(state);
  _ctx = { state, playerProgress, choices };

  const px = (VW - PANEL_W) / 2;
  const py = (VH - PANEL_H) / 2;

  const cont = new Container({ label: 'upgrade-choice' });

  // Full-screen dim
  const dim = new Graphics();
  dim.rect(0, 0, VW, VH).fill({ color: 0x000000, alpha: 0.6 });
  cont.addChild(dim);

  // Panel background
  const panel = new Graphics();
  panel.rect(px, py, PANEL_W, PANEL_H)
       .fill({ color: 0x102020, alpha: 0.97 })
       .stroke({ color: 0x44aaff, alpha: 0.9, width: 2 });
  cont.addChild(panel);

  // Title
  const title = new Text({ text: '⚡ СУНДУК С БОНУСАМИ ⚡', style: ST_TITLE });
  title.anchor.set(0.5, 0);
  title.position.set(VW / 2, py + 14);
  cont.addChild(title);

  // Hint
  const hint = new Text({ text: 'Выбери один из трех бонусов:', style: ST_HINT });
  hint.anchor.set(0.5, 0);
  hint.position.set(VW / 2, py + 42);
  cont.addChild(hint);

  // Choice buttons
  const totalW  = choices.length * UPGRADE_BTN_W + (choices.length - 1) * BTN_GAP;
  const startX  = (VW - totalW) / 2;
  const btnY    = py + 75;

  for (let i = 0; i < choices.length; i++) {
    _addUpgradeChoiceBtn(cont, choices[i], startX + i * (UPGRADE_BTN_W + BTN_GAP), btnY);
  }

  // Decline button
  const declineX = (VW - DECLINE_BTN_W) / 2;
  const declineY = btnY + UPGRADE_BTN_H + 15;
  _addDeclineBtn(cont, declineX, declineY);

  _hud.addChild(cont);
  _panel = cont;
}

function _addUpgradeChoiceBtn(cont, ch, bx, by) {
  const accent = ch.color ? _hexToNum(ch.color) : 0x44aaff;

  const btn = new Graphics();
  btn.position.set(bx, by);
  const _drawNormal = () =>
    btn.clear()
       .rect(0, 0, UPGRADE_BTN_W, UPGRADE_BTN_H)
       .fill({ color: 0x1a2a30, alpha: 0.95 })
       .stroke({ color: accent, alpha: 0.8, width: 1.5 });
  const _drawHover = () =>
    btn.clear()
       .rect(0, 0, UPGRADE_BTN_W, UPGRADE_BTN_H)
       .fill({ color: 0x2d4050, alpha: 0.98 })
       .stroke({ color: accent, alpha: 1, width: 2 });

  _drawNormal();
  btn.eventMode = 'static';
  btn.cursor    = 'pointer';
  btn.hitArea   = { contains: (x, y) => x >= 0 && x <= UPGRADE_BTN_W && y >= 0 && y <= UPGRADE_BTN_H };
  btn.on('pointerover', _drawHover);
  btn.on('pointerout',  _drawNormal);
  btn.on('pointerdown', () => _onUpgradeChoice(ch.id));
  cont.addChild(btn);

  // Icon emoji
  const icon = new Text({
    text: ch.icon ?? '?',
    style: new TextStyle({ fill: ch.color ?? '#44aaff', fontSize: 28, fontFamily: 'sans-serif' }),
  });
  icon.anchor.set(0.5, 0);
  icon.position.set(UPGRADE_BTN_W / 2, 8);
  btn.addChild(icon);

  // Label
  const lbl = new Text({
    text: ch.label ?? ch.id,
    style: new TextStyle({
      fill: '#ffffff', fontSize: 10, fontWeight: 'bold',
      fontFamily: 'Huninn, monospace', align: 'center',
      wordWrap: true, wordWrapWidth: UPGRADE_BTN_W - 8,
    }),
  });
  lbl.anchor.set(0.5, 0);
  lbl.position.set(UPGRADE_BTN_W / 2, 45);
  btn.addChild(lbl);

  // Short description
  const desc = new Text({
    text: ch.description ?? '',
    style: new TextStyle({
      fill: '#aaccdd', fontSize: 8,
      fontFamily: 'Huninn, monospace', align: 'center',
      wordWrap: true, wordWrapWidth: UPGRADE_BTN_W - 8,
    }),
  });
  desc.anchor.set(0.5, 0);
  desc.position.set(UPGRADE_BTN_W / 2, 68);
  btn.addChild(desc);
}

function _addDeclineBtn(cont, bx, by) {
  const btn = new Graphics();
  btn.position.set(bx, by);
  const _drawNormal = () =>
    btn.clear()
       .rect(0, 0, DECLINE_BTN_W, DECLINE_BTN_H)
       .fill({ color: 0x302020, alpha: 0.95 })
       .stroke({ color: 0x888888, alpha: 0.6, width: 1 });
  const _drawHover = () =>
    btn.clear()
       .rect(0, 0, DECLINE_BTN_W, DECLINE_BTN_H)
       .fill({ color: 0x403030, alpha: 0.98 })
       .stroke({ color: 0xaaaaaa, alpha: 0.8, width: 1.5 });

  _drawNormal();
  btn.eventMode = 'static';
  btn.cursor    = 'pointer';
  btn.hitArea   = { contains: (x, y) => x >= 0 && x <= DECLINE_BTN_W && y >= 0 && y <= DECLINE_BTN_H };
  btn.on('pointerover', _drawHover);
  btn.on('pointerout',  _drawNormal);
  btn.on('pointerdown', () => _onUpgradeChoice(null));
  cont.addChild(btn);

  const lbl = new Text({
    text: 'Отказаться',
    style: new TextStyle({
      fill: '#aaaaaa', fontSize: 12,
      fontFamily: 'Huninn, monospace', align: 'center',
    }),
  });
  lbl.anchor.set(0.5, 0.5);
  lbl.position.set(DECLINE_BTN_W / 2, DECLINE_BTN_H / 2);
  btn.addChild(lbl);
}

function _onUpgradeChoice(id) {
  if (!_ctx) return;
  const { state, playerProgress } = _ctx;
  applyUpgradeChoice(state, playerProgress, id);
  _hidePanel();
}

function _pickUpgradeChoices(state) {
  const pool = (typeof UPGRADE_TYPES !== 'undefined') ? UPGRADE_TYPES : [];
  return _pickRandomFromPool(state, pool, 3);
}

// ── Room bonus choice panel ───────────────────────────────────────

function _showRoomBonusChoice(state, playerProgress) {
  const choices = _pickRoomBonusChoices(state);
  _ctx = { state, playerProgress, choices };

  const px = (VW - PANEL_W) / 2;
  const py = (VH - PANEL_H) / 2;

  const cont = new Container({ label: 'room-bonus-choice' });

  // Full-screen dim
  const dim = new Graphics();
  dim.rect(0, 0, VW, VH).fill({ color: 0x000000, alpha: 0.6 });
  cont.addChild(dim);

  // Panel background
  const panel = new Graphics();
  panel.rect(px, py, PANEL_W, PANEL_H)
       .fill({ color: 0x102030, alpha: 0.97 })
       .stroke({ color: 0x44ff88, alpha: 0.9, width: 2 });
  cont.addChild(panel);

  // Title
  const title = new Text({ text: '🌟 БОНУС КОМНАТЫ 🌟', style: ST_TITLE });
  title.anchor.set(0.5, 0);
  title.position.set(VW / 2, py + 14);
  cont.addChild(title);

  // Hint
  const hint = new Text({ text: 'Выбери один из трех бонусов для этой комнаты:', style: ST_HINT });
  hint.anchor.set(0.5, 0);
  hint.position.set(VW / 2, py + 42);
  cont.addChild(hint);

  // Choice buttons
  const totalW  = choices.length * UPGRADE_BTN_W + (choices.length - 1) * BTN_GAP;
  const startX  = (VW - totalW) / 2;
  const btnY    = py + 75;

  for (let i = 0; i < choices.length; i++) {
    _addRoomBonusChoiceBtn(cont, choices[i], startX + i * (UPGRADE_BTN_W + BTN_GAP), btnY);
  }

  // Decline button
  const declineX = (VW - DECLINE_BTN_W) / 2;
  const declineY = btnY + UPGRADE_BTN_H + 15;
  _addDeclineBtn(cont, declineX, declineY);

  _hud.addChild(cont);
  _panel = cont;
}

function _addRoomBonusChoiceBtn(cont, ch, bx, by) {
  const accent = ch.color ? _hexToNum(ch.color) : 0x44ff88;

  const btn = new Graphics();
  btn.position.set(bx, by);
  const _drawNormal = () =>
    btn.clear()
       .rect(0, 0, UPGRADE_BTN_W, UPGRADE_BTN_H)
       .fill({ color: 0x1a2a30, alpha: 0.95 })
       .stroke({ color: accent, alpha: 0.8, width: 1.5 });
  const _drawHover = () =>
    btn.clear()
       .rect(0, 0, UPGRADE_BTN_W, UPGRADE_BTN_H)
       .fill({ color: 0x2d4050, alpha: 0.98 })
       .stroke({ color: accent, alpha: 1, width: 2 });

  _drawNormal();
  btn.eventMode = 'static';
  btn.cursor    = 'pointer';
  btn.hitArea   = { contains: (x, y) => x >= 0 && x <= UPGRADE_BTN_W && y >= 0 && y <= UPGRADE_BTN_H };
  btn.on('pointerover', _drawHover);
  btn.on('pointerout',  _drawNormal);
  btn.on('pointerdown', () => _onRoomBonusChoice(ch.id));
  cont.addChild(btn);

  // Icon emoji
  const icon = new Text({
    text: ch.icon ?? '?',
    style: new TextStyle({ fill: ch.color ?? '#44ff88', fontSize: 28, fontFamily: 'sans-serif' }),
  });
  icon.anchor.set(0.5, 0);
  icon.position.set(UPGRADE_BTN_W / 2, 8);
  btn.addChild(icon);

  // Label
  const lbl = new Text({
    text: ch.label ?? ch.id,
    style: new TextStyle({
      fill: '#ffffff', fontSize: 10, fontWeight: 'bold',
      fontFamily: 'Huninn, monospace', align: 'center',
      wordWrap: true, wordWrapWidth: UPGRADE_BTN_W - 8,
    }),
  });
  lbl.anchor.set(0.5, 0);
  lbl.position.set(UPGRADE_BTN_W / 2, 45);
  btn.addChild(lbl);

  // Short description
  const desc = new Text({
    text: ch.description ?? '',
    style: new TextStyle({
      fill: '#aaddcc', fontSize: 8,
      fontFamily: 'Huninn, monospace', align: 'center',
      wordWrap: true, wordWrapWidth: UPGRADE_BTN_W - 8,
    }),
  });
  desc.anchor.set(0.5, 0);
  desc.position.set(UPGRADE_BTN_W / 2, 68);
  btn.addChild(desc);
}

function _onRoomBonusChoice(id) {
  if (!_ctx) return;
  const { state, playerProgress } = _ctx;
  applyRoomBonusChoice(state, playerProgress, id);
  _hidePanel();
}

function _pickRoomBonusChoices(state) {
  const pool = (typeof ROOM_BONUS_TYPES !== 'undefined') ? ROOM_BONUS_TYPES : [];
  return _pickRandomFromPool(state, pool, 3);
}

function _hidePanel() {
  if (_panel) {
    _panel.destroy({ children: true });
    _panel = null;
  }
  _ctx = null;
}

// ── Helpers ───────────────────────────────────────────────────

function _pickRandomFromPool(state, pool, count) {
  const available = pool.filter(u => _isUpgradeAvailable(state, u));
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function _isUpgradeAvailable(state, def) {
  if (!def || !state.upgrades || !state.upgradeLevels) return false;
  
  // 1. Check max count (if defined)
  const count = state.upgradeLevels[def.id] || 0;
  if (def.max !== undefined && count >= def.max) return false;

  // 2. Check mutual exclusion (spatial upgrades)
  // If this upgrade is already owned, or its blocker is already owned, it's unavailable.
  if (state.upgrades[def.id] === true) return false;
  if (def.blocks && state.upgrades[def.blocks] === true) return false;

  return true;
}

function _pickSpecialChoices(state, type) {
  let pool = [];
  if (type === 'spatial') {
    pool = (typeof SPATIAL_UPGRADE_TYPES !== 'undefined') ? SPATIAL_UPGRADE_TYPES : [];
  } else {
    pool = (typeof CURSED_UPGRADE_TYPES !== 'undefined') ? CURSED_UPGRADE_TYPES : [];
  }
  return _pickRandomFromPool(state, pool, 3);
}

function _hexToNum(str) {
  if (!str) return 0xffffff;
  return parseInt(str.replace('#', ''), 16);
}
