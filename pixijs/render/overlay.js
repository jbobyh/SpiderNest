// ============================================================
// OVERLAY — cursed-choice PixiJS panel in the HUD layer.
//
// DOM game-over / level-complete screens live in index.html;
// their visibility is toggled by game-loop.js via element IDs:
//   #game-over-screen  / #restart-btn
//   #level-complete-screen / #next-level-btn
//
// This module manages only the in-game cursed-choice panel.
//
// initOverlay(hudLayer)
// updateOverlay(state, playerProgress)  — call each frame
// destroyOverlay()
//
// Globals: CONFIG, CURSED_UPGRADE_TYPES (from config.js)
// ============================================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { applyCursedChoice } from '../game/collectibles.js';

const VW = CONFIG.VIEW_W;
const VH = CONFIG.VIEW_H;

// ── Module state ──────────────────────────────────────────────

let _hud   = null;
let _panel = null;
let _ctx   = null; // { state, playerProgress } while panel is open

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

// ── Public API ────────────────────────────────────────────────

export function initOverlay(hudLayer) {
  _hud   = hudLayer;
  _panel = null;
  _ctx   = null;
}

export function destroyOverlay() {
  _hidePanel();
  _hud = null;
}

/**
 * Call each frame from the game loop.
 * Shows the cursed-choice panel when state._cursedChoiceState.active === true.
 */
export function updateOverlay(state, playerProgress) {
  if (!_hud) return;

  const cc = state._cursedChoiceState;

  if (cc?.active && !_panel) {
    _showCursedChoice(state, playerProgress);
  } else if (!cc?.active && _panel) {
    _hidePanel();
  }
}

/** Returns true while the cursed-choice panel is visible (game logic should pause). */
export function isOverlayActive() {
  return _panel !== null;
}

// ── Cursed choice panel ───────────────────────────────────────

const PANEL_W = 430;
const PANEL_H = 250;
const BTN_W   = 120;
const BTN_H   = 120;
const BTN_GAP = 18;

function _showCursedChoice(state, playerProgress) {
  const choices = _pickChoices();
  _ctx = { state, playerProgress, choices };

  const px = (VW - PANEL_W) / 2;
  const py = (VH - PANEL_H) / 2;

  const cont = new Container({ label: 'cursed-choice' });

  // Full-screen dim
  const dim = new Graphics();
  dim.rect(0, 0, VW, VH).fill({ color: 0x000000, alpha: 0.6 });
  cont.addChild(dim);

  // Panel background
  const panel = new Graphics();
  panel.rect(px, py, PANEL_W, PANEL_H)
       .fill({ color: 0x160020, alpha: 0.97 })
       .stroke({ color: 0x9900ff, alpha: 0.9, width: 2 });
  cont.addChild(panel);

  // Title
  const title = new Text({ text: '⚠ ПРОКЛЯТЫЙ СУНДУК ⚠', style: ST_TITLE });
  title.anchor.set(0.5, 0);
  title.position.set(VW / 2, py + 14);
  cont.addChild(title);

  // Hint
  const hint = new Text({ text: 'Выбери одно из проклятых улучшений:', style: ST_HINT });
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
  const _drawNormal = () =>
    btn.clear()
       .rect(bx, by, BTN_W, BTN_H)
       .fill({ color: 0x1a0030, alpha: 0.95 })
       .stroke({ color: accent, alpha: 0.8, width: 1.5 });
  const _drawHover = () =>
    btn.clear()
       .rect(bx, by, BTN_W, BTN_H)
       .fill({ color: 0x2d0050, alpha: 0.98 })
       .stroke({ color: accent, alpha: 1, width: 2 });

  _drawNormal();
  btn.eventMode = 'static';
  btn.cursor    = 'pointer';
  btn.hitArea   = { contains: (x, y) => x >= bx && x <= bx + BTN_W && y >= by && y <= by + BTN_H };
  btn.on('pointerover', _drawHover);
  btn.on('pointerout',  _drawNormal);
  btn.on('pointerdown', () => _onChoice(ch.id));
  cont.addChild(btn);

  // Icon emoji
  const icon = new Text({
    text: ch.icon ?? '?',
    style: new TextStyle({ fill: ch.color ?? '#cc66ff', fontSize: 30, fontFamily: 'sans-serif' }),
  });
  icon.anchor.set(0.5, 0);
  icon.position.set(bx + BTN_W / 2, by + 8);
  cont.addChild(icon);

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
  lbl.position.set(bx + BTN_W / 2, by + 50);
  cont.addChild(lbl);

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
  desc.position.set(bx + BTN_W / 2, by + 72);
  cont.addChild(desc);
}

function _onChoice(id) {
  if (!_ctx) return;
  const { state, playerProgress } = _ctx;
  applyCursedChoice(state, playerProgress, id);
  _hidePanel();
}

function _hidePanel() {
  if (_panel) {
    _panel.destroy({ children: true });
    _panel = null;
  }
  _ctx = null;
}

// ── Helpers ───────────────────────────────────────────────────

function _pickChoices() {
  const pool = (typeof CURSED_UPGRADE_TYPES !== 'undefined') ? [...CURSED_UPGRADE_TYPES] : [];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function _hexToNum(str) {
  if (!str) return 0xffffff;
  return parseInt(str.replace('#', ''), 16);
}
