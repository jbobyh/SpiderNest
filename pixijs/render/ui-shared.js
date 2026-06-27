import { TextStyle, Graphics } from 'pixi.js';

export const VW = CONFIG.VIEW_W;
export const VH = CONFIG.VIEW_H;

// ── Shared Colors ─────────────────────────────────────────────

export const UI_COLORS = {
  CYAN: 0x00d4ff,
  ORANGE: 0xffaa00,
  RED: 0xff4444,
  GREEN: 0x44ff88,
  PURPLE: 0xaa44ff,
  BG_DARK: 0x050a0f,
  BG_CURSED: 0x0a0514,
  STROKE_DEFAULT: 0x1a3a5c,
  TEXT_DIM: 0x8ca0b4,
};

// ── Shared Styles ─────────────────────────────────────────────

export const BASE_STYLE = {
  fontFamily: 'Huninn, monospace',
};

export const STYLE_LEVEL = new TextStyle({
  ...BASE_STYLE,
  fill: '#00d4ff',
  fontSize: 13,
  fontWeight: 'bold',
});

export const STYLE_SLOT_LBL = new TextStyle({
  ...BASE_STYLE,
  fill: '#00d4ff',
  fontSize: 9,
  fontWeight: 'bold',
});

export const STYLE_HINT = new TextStyle({
  ...BASE_STYLE,
  fill: 'rgba(180,160,130,0.8)',
  fontSize: 9,
});

export const STYLE_UPG_LVL = new TextStyle({
  ...BASE_STYLE,
  fill: '#ffffff',
  fontSize: 8,
  fontWeight: 'bold',
});

export const STYLE_STATS_LABEL = new TextStyle({
  ...BASE_STYLE,
  fill: 'rgba(140,160,180,0.8)',
  fontSize: 12,
});

export const STYLE_STATS_VALUE = new TextStyle({
  fontFamily: 'Orbitron, sans-serif',
  fontSize: 14,
  fontWeight: 'bold',
});

export const STYLE_TOOLTIP_LABEL = new TextStyle({
  ...BASE_STYLE,
  fill: '#ffffff',
  fontSize: 13,
  fontWeight: 'bold',
});

export const STYLE_TOOLTIP_DESC = new TextStyle({
  ...BASE_STYLE,
  fill: '#ffffff',
  fontSize: 11,
});

// ── Shared Helpers ────────────────────────────────────────────

/**
 * Creates a standard UI panel background.
 */
export function createPanel({
  x = 0, y = 0,
  width, height,
  bgColor = UI_COLORS.BG_DARK,
  bgAlpha = 0.75,
  strokeColor = UI_COLORS.STROKE_DEFAULT,
  strokeAlpha = 0.7,
  strokeWidth = 1,
  radius = 0
}) {
  const g = new Graphics();
  
  if (radius > 0) {
    g.roundRect(0, 0, width, height, radius);
  } else {
    g.rect(0, 0, width, height);
  }
  
  g.fill({ color: bgColor, alpha: bgAlpha })
   .stroke({ color: strokeColor, alpha: strokeAlpha, width: strokeWidth });
  
  g.position.set(x, y);
  return g;
}

/**
 * Destroys all children of a container and removes them.
 */
export function clearContainer(container) {
  if (!container) return;
  container.removeChildren().forEach(c => c.destroy({ children: true }));
}

/**
 * Converts hex string or number to number.
 */
export function hexToNum(val) {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 0xffffff;
  return parseInt(val.replace('#', ''), 16);
}
