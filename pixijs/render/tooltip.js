// ============================================================
// TOOLTIP — hover tooltips for upgrades and weapons
//
// initTooltip(hudLayer)    — creates tooltip container
// updateTooltip(state, camera)  — checks hover and shows/hides tooltip
// showTooltip(x, y, label, description, color)  — display tooltip at screen coords
// hideTooltip()            — hide tooltip
// ============================================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { mouse } from '../core/input.js';
import {
  VW, VH, STYLE_TOOLTIP_LABEL, STYLE_TOOLTIP_DESC,
  STYLE_TOOLTIP_STAT_LABEL, STYLE_TOOLTIP_STAT_VALUE,
  createPanel, clearContainer, hexToNum,
} from './ui-shared.js';

// ── Module state ──────────────────────────────────────────────

let _hud   = null;
let _panel = null; // Container with background + text
let _hoverSource = null; // 'world' or 'hud'

// ── Public API ───────────────────────────────────────────────

export function initTooltip(hudLayer) {
  _hud = hudLayer;
  _panel = null;
}

export function destroyTooltip() {
  hideTooltip();
  _hud = null;
}

/**
 * Call each frame from render loop.
 * Checks if mouse is hovering over upgrade or weapon, shows/hides tooltip.
 */
export function updateTooltip(state, camera) {
  if (!_hud) return;

  const inBattle = state.phase === 'battle' || state.phase === 'zoom_out';
  const hoverR = CONFIG.CELL_PX * 0.2;

  // Convert screen mouse to world coords
  const worldMouse = camera.screenToWorld(mouse.x, mouse.y);

  // Only hide if the current tooltip is from the world
  if (_hoverSource === 'world') {
    hideTooltip();
  }
}

export function showTooltip(screenX, screenY, label, description, color, source = 'hud', stats = null) {
  if (!_hud) return;

  _hoverSource = source;

  if (!_panel) {
    _panel = new Container({ label: 'tooltip' });
    _panel.eventMode = 'none'; // Ensure clicks pass through the tooltip
    _hud.addChild(_panel);
  }

  clearContainer(_panel);

  const pad = 10;
  const lineGap = 6;
  const statLineGap = 3;
  const boxW = 240;

  // Label
  const lbl = new Text({ text: label, style: STYLE_TOOLTIP_LABEL });
  lbl.position.set(pad, pad);
  _panel.addChild(lbl);

  const lblBounds = lbl.getLocalBounds();

  // Description
  const desc = new Text({ 
    text: description, 
    style: STYLE_TOOLTIP_DESC,
    wordWrap: true,
    wordWrapWidth: boxW - pad * 2,
    breakWords: true,
  });
  
  const descBounds = desc.getLocalBounds();

  let cursorY = pad + lblBounds.height + lineGap;
  desc.position.set(pad, cursorY);
  _panel.addChild(desc);
  cursorY += descBounds.height + lineGap;

  // Stats rows
  if (stats && stats.length > 0) {
    const valueW = 80;
    for (const s of stats) {
      const sLbl = new Text({ text: s.label, style: STYLE_TOOLTIP_STAT_LABEL });
      sLbl.position.set(pad, cursorY);
      _panel.addChild(sLbl);

      const sVal = new Text({ text: s.value, style: STYLE_TOOLTIP_STAT_VALUE });
      sVal.anchor.set(1, 0);
      sVal.position.set(boxW - pad, cursorY);
      _panel.addChild(sVal);

      cursorY += sLbl.getLocalBounds().height + statLineGap;
    }
    cursorY -= statLineGap; // remove trailing gap
  }

  const realH = cursorY + pad;
  const boxH = Math.max(realH, 40);

  // Background (add at index 0)
  const bg = createPanel({
    x: 0, y: 0,
    width: boxW, height: boxH,
    bgColor: 0x050a0f, bgAlpha: 0.95,
    strokeColor: hexToNum(color), strokeAlpha: 1, strokeWidth: 1.5
  });
  _panel.addChildAt(bg, 0);

  let tx = screenX + 24;
  let ty = screenY - boxH / 2;

  // Keep on screen
  if (tx + boxW > VW - 4) tx = screenX - boxW - 24;
  if (ty < 4) ty = 4;
  if (ty + boxH > VH - 4) ty = VH - 4 - boxH;

  _panel.position.set(tx, ty);
}

function _buildWeaponStats(def) {
  const stats = [
    { label: 'Урон', value: String(def.damage) },
    { label: 'Пули', value: String(def.pellets) },
    { label: 'Разброс', value: `${Math.round(def.spread * 180 / Math.PI)}°` },
    { label: 'Скорость пули', value: String(def.bulletSpeed) },
    { label: 'Дальность', value: `${def.range} кл.` },
    { label: 'Пробитие', value: String(def.penetrate) },
    { label: 'Обойма', value: String(def.magazineSize) },
    { label: 'Перезарядка', value: `${def.reloadTime}с` },
  ];
  if (def.burstSize && def.burstSize > 1) {
    stats.push({ label: 'Очередь', value: String(def.burstSize) });
  }
  return stats;
}

export function hideTooltip(source = null) {
  // If source is provided, only hide if it matches current hover source
  if (source && _hoverSource !== source) return;

  if (_panel) {
    _panel.destroy({ children: true });
    _panel = null;
  }
  _hoverSource = null;
}
