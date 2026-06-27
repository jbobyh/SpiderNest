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

const VW = CONFIG.VIEW_W;
const VH = CONFIG.VIEW_H;

// ── Module state ──────────────────────────────────────────────

let _hud   = null;
let _panel = null; // Container with background + text
let _hoverSource = null; // 'world' or 'hud'

// ── Text styles ───────────────────────────────────────────────

const STYLE_LABEL = new TextStyle({
  fill: '#ffffff',
  fontSize: 13,
  fontFamily: 'Huninn, monospace',
  fontWeight: 'bold',
});
const STYLE_DESC = new TextStyle({
  fill: '#ffffff',
  fontSize: 11,
  fontFamily: 'Huninn, monospace',
});

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

  // Check dropped weapons
  const weapons = inBattle ? (state.battle?.droppedWeapons || []) : (state.droppedWeapons || []);
  for (const dw of weapons) {
    if (dw.picked) continue;
    const dist = Math.hypot(worldMouse.x - dw.x, worldMouse.y - dw.y);
    if (dist < hoverR) {
      const def = (typeof WEAPON_DEFS !== 'undefined' ? WEAPON_DEFS : {})
        [dw.weaponId];
      if (def) {
        const screenX = (dw.x - camera.worldX) * camera.zoom + VW / 2;
        const screenY = (dw.y - camera.worldY) * camera.zoom + VH / 2;
        showTooltip(screenX, screenY, def.label, def.description, def.color, 'world');
        return;
      }
    }
  }

  // Only hide if the current tooltip is from the world
  if (_hoverSource === 'world') {
    hideTooltip();
  }
}

export function showTooltip(screenX, screenY, label, description, color, source = 'hud') {
  if (!_hud) return;

  _hoverSource = source;

  if (!_panel) {
    _panel = new Container({ label: 'tooltip' });
    _panel.eventMode = 'none'; // Ensure clicks pass through the tooltip
    _hud.addChild(_panel);
  }

  _panel.removeChildren().forEach(c => c.destroy());

  const pad = 10;
  const lineGap = 6;
  const boxW = 220;

  // Label
  const lbl = new Text({ text: label, style: STYLE_LABEL });
  lbl.position.set(pad, pad);
  _panel.addChild(lbl);

  // Description
  const desc = new Text({ 
    text: description, 
    style: STYLE_DESC,
    wordWrap: true,
    wordWrapWidth: boxW - pad * 2,
    breakWords: true, // Handle long Russian words
  });
  
  const lblBounds = lbl.getLocalBounds();
  const descBounds = desc.getLocalBounds();

  desc.position.set(pad, pad + lblBounds.height + lineGap);
  _panel.addChild(desc);

  const realH = pad + lblBounds.height + lineGap + descBounds.height + pad;
  const boxH = Math.max(realH, 40);

  // Background (add at index 0)
  const bg = new Graphics();
  bg.rect(0, 0, boxW, boxH)
    .fill({ color: 0x050a0f, alpha: 0.95 })
    .stroke({ color: _hexToNum(color), alpha: 1, width: 1.5 });
  _panel.addChildAt(bg, 0);

  let tx = screenX + 24; // Offset more to the right to avoid overlap with icon
  let ty = screenY - boxH / 2;

  // Keep on screen
  if (tx + boxW > VW - 4) tx = screenX - boxW - 24;
  if (ty < 4) ty = 4;
  if (ty + boxH > VH - 4) ty = VH - 4 - boxH;

  _panel.position.set(tx, ty);
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

// ── Helpers ───────────────────────────────────────────────────

function _hexToNum(val) {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 0xffffff;
  return parseInt(val.replace('#', ''), 16);
}
