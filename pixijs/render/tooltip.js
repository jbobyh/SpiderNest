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

  // Check upgrades
  const upgrades = inBattle ? (state.battle?.upgrades || []) : (state.upgradeObjs || []);
  for (const upg of upgrades) {
    if (upg.collected || upg.spawned === false) continue;
    const dist = Math.hypot(worldMouse.x - upg.x, worldMouse.y - upg.y);
    if (dist < hoverR) {
      const def = (typeof UPGRADE_TYPES !== 'undefined' ? UPGRADE_TYPES : [])
        .find(u => u.id === upg.upgradeType);
      if (def) {
        // Convert world to screen coords: screen = (world - cam) * zoom + center
        const screenX = (upg.x - camera.worldX) * camera.zoom + VW / 2;
        const screenY = (upg.y - camera.worldY) * camera.zoom + VH / 2;
        showTooltip(screenX, screenY, def.label, def.description, def.color);
        return;
      }
    }
  }

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
        showTooltip(screenX, screenY, def.label, def.description, def.color);
        return;
      }
    }
  }

  hideTooltip();
}

export function showTooltip(screenX, screenY, label, description, color) {
  if (!_hud) return;

  const pad = 10;
  const lineGap = 6;
  const boxW = 200; // fixed width for simplicity
  const boxH = 13 + lineGap + 11 + pad * 2;

  let tx = screenX + 18;
  let ty = screenY - boxH / 2;

  // Keep on screen
  if (tx + boxW > VW - 4) tx = screenX - boxW - 10;
  if (ty < 4) ty = 4;
  if (ty + boxH > VH - 4) ty = VH - 4 - boxH;

  if (!_panel) {
    _panel = new Container({ label: 'tooltip' });
    _hud.addChild(_panel);
  }

  _panel.removeChildren().forEach(c => c.destroy());

  // Background
  const bg = new Graphics();
  bg.rect(0, 0, boxW, boxH)
    .fill({ color: 0x050a0f, alpha: 0.93 })
    .stroke({ color: _hexToNum(color), alpha: 1, width: 1.5 });
  bg.position.set(tx, ty);
  _panel.addChild(bg);

  // Label
  const lbl = new Text({ text: label, style: STYLE_LABEL });
  lbl.position.set(tx + pad, ty + pad);
  _panel.addChild(lbl);

  // Description
  const desc = new Text({ 
    text: description, 
    style: STYLE_DESC,
    wordWrap: true,
    wordWrapWidth: boxW - pad * 2,
  });
  desc.position.set(tx + pad, ty + pad + 13 + lineGap);
  _panel.addChild(desc);
}

export function hideTooltip() {
  if (_panel) {
    _panel.destroy({ children: true });
    _panel = null;
  }
}

// ── Helpers ───────────────────────────────────────────────────

function _hexToNum(str) {
  if (!str) return 0xffffff;
  return parseInt(str.replace('#', ''), 16);
}
