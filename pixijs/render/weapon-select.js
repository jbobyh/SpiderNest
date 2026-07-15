// ============================================================
// WEAPON SELECT — canvas overlay for choosing starting weapon
// ============================================================

import { Container, Graphics, Text, TextStyle, Sprite, Assets } from 'pixi.js';
import { weaponTextures } from './entity-pool.js';

const VW = CONFIG.VIEW_W;
const VH = CONFIG.VIEW_H;

let _hud = null;
let _panel = null;
let _onChosen = null;

const ST_TITLE = new TextStyle({
  fill: '#7ec97e', fontSize: 28,
  fontFamily: 'BoldPixels, sans-serif', fontWeight: 'bold', align: 'center',
});
const ST_SUB = new TextStyle({
  fill: '#aaccbb', fontSize: 12,
  fontFamily: 'BoldPixels, sans-serif', align: 'center',
});
const ST_NAME = new TextStyle({
  fill: '#ffffff', fontSize: 14, fontWeight: 'bold',
  fontFamily: 'BoldPixels, sans-serif', align: 'center',
});
const ST_DESC = new TextStyle({
  fill: '#aaccbb', fontSize: 10,
  fontFamily: 'BoldPixels, sans-serif', align: 'center',
  wordWrap: true, wordWrapWidth: 140,
});
const ST_STATS = new TextStyle({
  fill: '#88aabb', fontSize: 9,
  fontFamily: 'BoldPixels, sans-serif', align: 'left',
});

const CARD_W = 160;
const CARD_H = 210;
const CARD_GAP = 16;
const PANEL_PAD = 30;

export function showWeaponSelect(hudLayer, onChosen) {
  _hud = hudLayer;
  _onChosen = onChosen;

  const weaponIds = Object.keys(WEAPON_DEFS);
  const totalW = weaponIds.length * CARD_W + (weaponIds.length - 1) * CARD_GAP;
  const panelW = totalW + PANEL_PAD * 2;
  const panelH = CARD_H + 120;
  const px = (VW - panelW) / 2;
  const py = (VH - panelH) / 2;

  const cont = new Container({ label: 'weapon-select' });

  // Full-screen dim
  const dim = new Graphics();
  dim.rect(0, 0, VW, VH).fill({ color: 0x000000, alpha: 0.7 });
  cont.addChild(dim);

  // Panel background
  const bg = new Graphics();
  bg.roundRect(px, py, panelW, panelH, 12)
    .fill({ color: 0x0a0e16, alpha: 0.95 })
    .stroke({ color: 0x2a5a3a, alpha: 0.8, width: 2 });
  cont.addChild(bg);

  // Title
  const title = new Text({ text: 'ВЫБЕРИ ОРУЖИЕ', style: ST_TITLE });
  title.anchor.set(0.5, 0);
  title.position.set(VW / 2, py + 20);
  cont.addChild(title);

  // Subtitle
  const sub = new Text({ text: 'Оружие останется с тобой до конца забега', style: ST_SUB });
  sub.anchor.set(0.5, 0);
  sub.position.set(VW / 2, py + 55);
  cont.addChild(sub);

  // Weapon cards
  const startX = px + PANEL_PAD;
  const cardY = py + 80;

  for (let i = 0; i < weaponIds.length; i++) {
    const wId = weaponIds[i];
    const def = WEAPON_DEFS[wId];
    const cx = startX + i * (CARD_W + CARD_GAP);
    _addWeaponCard(cont, wId, def, cx, cardY);
  }

  _hud.addChild(cont);
  _panel = cont;
}

function _addWeaponCard(cont, wId, def, bx, by) {
  const accent = _hexToNum(def.color || '#334455');

  const card = new Container();
  card.position.set(bx, by);

  const bg = new Graphics();

  const _drawNormal = () =>
    bg.clear()
      .roundRect(0, 0, CARD_W, CARD_H, 8)
      .fill({ color: 0x12161e, alpha: 0.95 })
      .stroke({ color: accent, alpha: 0.6, width: 1.5 });
  const _drawHover = () =>
    bg.clear()
      .roundRect(0, 0, CARD_W, CARD_H, 8)
      .fill({ color: 0x1a2230, alpha: 0.98 })
      .stroke({ color: accent, alpha: 1, width: 2.5 });

  _drawNormal();
  card.addChild(bg);

  card.eventMode = 'static';
  card.cursor = 'pointer';
  card.hitArea = { contains: (x, y) => x >= 0 && x <= CARD_W && y >= 0 && y <= CARD_H };
  card.on('pointerover', _drawHover);
  card.on('pointerout', _drawNormal);
  card.on('pointerdown', () => {
    const cb = _onChosen;
    hideWeaponSelect();
    if (cb) cb(wId);
  });

  // Weapon icon
  const tex = weaponTextures[wId];
  if (tex) {
    const icon = new Sprite(tex);
    icon.anchor.set(0.5, 0.5);
    const maxIconW = CARD_W - 20;
    const maxIconH = 80;
    const sc = Math.min(maxIconW / tex.width, maxIconH / tex.height);
    icon.width = tex.width * sc;
    icon.height = tex.height * sc;
    icon.position.set(CARD_W / 2, 50);
    card.addChild(icon);
  }

  // Weapon name
  const name = new Text({ text: def.label || wId, style: ST_NAME });
  name.anchor.set(0.5, 0);
  name.position.set(CARD_W / 2, 100);
  card.addChild(name);

  // Weapon description
  const desc = new Text({ text: def.description || '', style: ST_DESC });
  desc.anchor.set(0.5, 0);
  desc.position.set(CARD_W / 2, 125);
  card.addChild(desc);

  // Stats summary
  const stats = _buildStatsText(def);
  const statsText = new Text({ text: stats, style: ST_STATS });
  statsText.position.set(12, 155);
  card.addChild(statsText);

  cont.addChild(card);
}

function _buildStatsText(def) {
  const lines = [];
  lines.push(`УРОН: ${def.damage}`);
  lines.push(`СКОРОСТРЕЛЬ: ${(1 / def.cooldown).toFixed(1)}/с`);
  lines.push(`ОБОЙМА: ${def.magazineSize}`);
  if (def.pellets > 1) lines.push(`ДРОБЬ: ${def.pellets}`);
  if (def.penetrate > 0) lines.push(`ПРОБИТИЕ: ${def.penetrate}`);
  lines.push(`ДАЛЬНОСТЬ: ${def.range}`);
  return lines.join('\n');
}

export function hideWeaponSelect() {
  if (_panel) {
    _panel.destroy({ children: true });
    _panel = null;
  }
  _onChosen = null;
}

export function isWeaponSelectActive() {
  return _panel !== null;
}

export function destroyWeaponSelect() {
  hideWeaponSelect();
  _hud = null;
}

function _hexToNum(str) {
  if (!str) return 0xffffff;
  return parseInt(str.replace('#', ''), 16);
}
