// ============================================================
// HUD — screen-space UI container
//
// initHud(parentContainer)  — creates all sub-containers
// updateHud(gameState)       — syncs display to current state
//
// Layout (matches original drawHUD):
//   Top-left:    level label + heart row + shield row
//   Top-right:   upgrade icon panel(s)
//   Bottom-left: weapon slots
//   Bottom-right: controls hint panel
// ============================================================

import {
  Container, Sprite, Texture, Text, TextStyle, Graphics,
} from 'pixi.js';

const VW = CONFIG.VIEW_W;
const VH = CONFIG.VIEW_H;

// ── Shared text styles ───────────────────────────────────────

const STYLE_LEVEL   = new TextStyle({ fill: '#00d4ff', fontSize: 13, fontFamily: 'Huninn, monospace', fontWeight: 'bold' });
const STYLE_SLOT_LBL = new TextStyle({ fill: '#00d4ff', fontSize: 9,  fontFamily: 'Huninn, monospace', fontWeight: 'bold' });
const STYLE_HINT    = new TextStyle({ fill: 'rgba(180,160,130,0.8)', fontSize: 9, fontFamily: 'Huninn, monospace' });
const STYLE_UPG_LVL = new TextStyle({ fill: '#ffffff', fontSize: 8, fontFamily: 'Huninn, monospace', fontWeight: 'bold' });
const STYLE_UPG_ICN = new TextStyle({ fill: '#ffffff', fontSize: 20, fontFamily: 'sans-serif' });

// ── Internal HUD state ───────────────────────────────────────

let _parent      = null;

const dom = {
  levelLabel:   null,
  heartsRow:    null,
  shieldsRow:   null,
  upgradePanel: null,
  weaponPanel:  null,
  hintsPanel:   null,
  pickupHint:   null, // dynamic hint for weapon pickup
  bossSummonHint: null, // hint for boss summon (space key)
  bossHpBar:    null, // boss HP bar (top center)
  levelComplete: null, // level complete screen overlay
  fpsCounter:   null, // FPS counter (bottom right)
};

// ── Init ──────────────────────────────────────────────────────

export function initHud(parentContainer) {
  _parent = parentContainer;
  _parent.removeChildren().forEach(c => c.destroy({ children: true }));

  // Level label (top-left)
  dom.levelLabel = new Text({ text: 'Уровень 1', style: STYLE_LEVEL });
  dom.levelLabel.position.set(8, 8);
  _parent.addChild(dom.levelLabel);

  // Hearts row (positioned in updateHud)
  dom.heartsRow = new Container({ label: 'hearts-row' });
  _parent.addChild(dom.heartsRow);

  // Shields row
  dom.shieldsRow = new Container({ label: 'shields-row' });
  _parent.addChild(dom.shieldsRow);

  // Upgrade icon panel (top-right)
  dom.upgradePanel = new Container({ label: 'upgrades' });
  _parent.addChild(dom.upgradePanel);

  // Weapon slots (bottom-left)
  dom.weaponPanel = new Container({ label: 'weapons' });
  _parent.addChild(dom.weaponPanel);

  // Controls hint (bottom-right)
  dom.hintsPanel = new Container({ label: 'hints' });
  _parent.addChild(dom.hintsPanel);

  // Pickup hint (center, shows when near weapon)
  dom.pickupHint = new Container({ label: 'pickup-hint' });
  dom.pickupHint.visible = false;
  _parent.addChild(dom.pickupHint);
  _buildPickupHint();

  // Boss summon hint (center, shows when sphere collected)
  dom.bossSummonHint = new Container({ label: 'boss-summon-hint' });
  dom.bossSummonHint.visible = false;
  _parent.addChild(dom.bossSummonHint);
  _buildBossSummonHint();

  // Boss HP bar (top center, shows during boss battle)
  dom.bossHpBar = new Container({ label: 'boss-hp-bar' });
  dom.bossHpBar.visible = false;
  _parent.addChild(dom.bossHpBar);
  _buildBossHpBar();

  // Level complete screen overlay
  dom.levelComplete = new Container({ label: 'level-complete' });
  dom.levelComplete.visible = false;
  _parent.addChild(dom.levelComplete);

  // FPS Counter (bottom right)
  dom.fpsCounter = new Text({ text: 'FPS: 60', style: STYLE_HINT });
  dom.fpsCounter.anchor.set(1, 1);
  dom.fpsCounter.position.set(VW - 8, VH - 8);
  dom.fpsCounter.visible = CONFIG.SHOW_FPS === true;
  _parent.addChild(dom.fpsCounter);

  _buildLevelComplete();

  _buildHintsPanel();
}

// ── Update (call every frame or on state change) ─────────────

export function updateHud(gameState, currentLevel, nearWeapon = false, nearAltar = false, bossSummonReady = false, nearChest = false, nearSpatialChest = false, nearRoomBonusAltar = false) {
  if (!_parent || !gameState) return;

  dom.levelLabel.text = `Уровень ${currentLevel}`;

  _updateHearts(gameState);
  _updateShields(gameState);
  _updateUpgrades(gameState);
  _updateWeaponSlots(gameState);

  // Show/hide pickup hint (reuse panel, swap text)
  // Priority: room bonus altar > spatial chest > chest > altar > weapon
  const showHint = nearWeapon || nearAltar || nearChest || nearSpatialChest || nearRoomBonusAltar;
  dom.pickupHint.visible = showHint;
  if (showHint) {
    let hintText = 'подобрать';
    if (nearRoomBonusAltar) hintText = 'Активировать алтарь комнаты';
    else if (nearSpatialChest) hintText = 'Открыть пространственный сундук';
    else if (nearChest) hintText = 'Открыть сундук';
    else if (nearAltar) hintText = 'Призвать врагов';
    _setPickupHintText(hintText);
  }

  // Show/hide boss summon hint
  dom.bossSummonHint.visible = bossSummonReady && !showHint;
}

// ── Hearts ────────────────────────────────────────────────────

function _updateHearts(s) {
  dom.heartsRow.removeChildren().forEach(c => c.destroy());

  const filled    = s.player.lives;
  const removedWt = s.playerRemovedWalls || 0;
  const total     = Math.max(filled + removedWt, filled);
  if (total <= 0) return;

  const ICON = 20, GAP = 4;
  const ROW_Y = 30;

  for (let i = 0; i < total; i++) {
    const x = 8 + i * (ICON + GAP);

    // Container sprite
    try {
      const ctr = new Sprite(Texture.from('heart-container'));
      ctr.width = ctr.height = ICON;
      ctr.position.set(x, ROW_Y);
      dom.heartsRow.addChild(ctr);
    } catch { /* texture not loaded yet */ }

    // Filled heart
    if (i < filled) {
      try {
        const h = new Sprite(Texture.from('heart'));
        h.width = h.height = ICON;
        h.position.set(x, ROW_Y);
        dom.heartsRow.addChild(h);
      } catch { /* texture not loaded yet */ }
    }
  }
}

// ── Shields ───────────────────────────────────────────────────

function _updateShields(s) {
  dom.shieldsRow.removeChildren().forEach(c => c.destroy());
  const count = s.upgrades?.shield || 0;
  if (count <= 0) return;

  const ICON = 20, GAP = 4;
  const filled    = s.player.lives;
  const removedWt = s.playerRemovedWalls || 0;
  const total     = Math.max(filled + removedWt, filled);
  const rowY      = 30 + ICON + 4 + 4; // below hearts row

  for (let i = 0; i < count; i++) {
    try {
      const spr = new Sprite(Texture.from('shield'));
      spr.width = spr.height = ICON;
      spr.position.set(8 + i * (ICON + GAP), rowY);
      dom.shieldsRow.addChild(spr);
    } catch { /* */ }
  }
}

// ── Upgrade icon panel ────────────────────────────────────────

const UPGRADE_LEVEL_MAP = [
  { id: 'pellets',       get: u => u.pellets || 0 },
  { id: 'damage',        get: u => u.damage || 0 },
  { id: 'penetrate',     get: u => u.penetrate || 0 },
  { id: 'bulletSpeed',   get: u => u.bulletSpeedMult > 1 ? 1 : 0 },
  { id: 'critChance',    get: u => u.critChance > 0 ? Math.ceil(u.critChance * 20) : 0 },
  { id: 'killAccel',     get: u => u.killAccel ? 1 : 0 },
  { id: 'enhancedPierce',get: u => u.enhancedPierce ? 1 : 0 },
  { id: 'shield',        get: u => u.shield || 0 },
  { id: 'retreat',       get: u => u.retreat > 0 ? 1 : 0 },
  { id: 'reflection',    get: u => u.reflection ? 1 : 0 },
  { id: 'cooldown',      get: u => u.cooldownMult < 1 ? Math.ceil((1 - u.cooldownMult) * 6.67) : 0 },
  { id: 'speed',         get: u => u.speedMult > 1 ? Math.ceil((u.speedMult - 1) * 10) : 0 },
  // Spatial Upgrades
  { id: 'spatialReloadRooms',   get: u => u.spatialReloadRooms ? 1 : 0 },
  { id: 'spatialReloadHearts',  get: u => u.spatialReloadHearts ? 1 : 0 },
  { id: 'spatialRangeRooms',    get: u => u.spatialRangeRooms ? 1 : 0 },
  { id: 'spatialRangeHearts',   get: u => u.spatialRangeHearts ? 1 : 0 },
  { id: 'spatialAccuracyRooms', get: u => u.spatialAccuracyRooms ? 1 : 0 },
  { id: 'spatialAccuracyHearts',get: u => u.spatialAccuracyHearts ? 1 : 0 },
  { id: 'spatialBulletSpeedRooms',  get: u => u.spatialBulletSpeedRooms ? 1 : 0 },
  { id: 'spatialBulletSpeedHearts', get: u => u.spatialBulletSpeedHearts ? 1 : 0 },
  { id: 'spatialSpeedRooms',    get: u => u.spatialSpeedRooms ? 1 : 0 },
  { id: 'spatialSpeedHearts',   get: u => u.spatialSpeedHearts ? 1 : 0 },
  { id: 'spatialCritChanceRooms',   get: u => u.spatialCritChanceRooms ? 1 : 0 },
  { id: 'spatialCritChanceHearts',  get: u => u.spatialCritChanceHearts ? 1 : 0 },
  { id: 'spatialCritDamageRooms',   get: u => u.spatialCritDamageRooms ? 1 : 0 },
  { id: 'spatialCritDamageHearts',  get: u => u.spatialCritDamageHearts ? 1 : 0 },
  { id: 'spatialPenetrateRooms',    get: u => u.spatialPenetrateRooms ? 1 : 0 },
  { id: 'spatialPenetrateHearts',   get: u => u.spatialPenetrateHearts ? 1 : 0 },
];

function _updateUpgrades(s) {
  dom.upgradePanel.removeChildren().forEach(c => c.destroy());
  if (!s.upgrades || !UPGRADE_TYPES) return;

  const ICON = 20, GAP = 4, PER_ROW = 10;
  const PAD_X = 8, PAD_Y = 6, ROW_H = ICON + 4;

  const active = [];
  for (const { id, get } of UPGRADE_LEVEL_MAP) {
    const lv = get(s.upgrades);
    if (lv <= 0) continue;
    const def = UPGRADE_TYPES.find(u => u.id === id) || (typeof SPATIAL_UPGRADE_TYPES !== 'undefined' ? SPATIAL_UPGRADE_TYPES.find(u => u.id === id) : null);
    if (def) active.push({ ...def, level: Math.min(lv, def.max || 1) });
  }
  if (active.length === 0) return;

  const rows   = Math.ceil(active.length / PER_ROW);
  const cols   = Math.min(active.length, PER_ROW);
  const panelW = cols * ICON + (cols - 1) * GAP + PAD_X * 2;
  const panelH = rows * ROW_H + PAD_Y * 2;
  const panelX = VW - panelW;
  const panelY = 0;

  const bg = new Graphics();
  bg.rect(0, 0, panelW, panelH)
    .fill({ color: 0x050a0f, alpha: 0.72 })
    .stroke({ color: 0x1a3a5c, alpha: 0.6, width: 1 });
  bg.position.set(panelX, panelY);
  dom.upgradePanel.addChild(bg);

  for (let i = 0; i < active.length; i++) {
    const upg = active[active.length - 1 - i]; // latest upgrades in bottom-right
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const ix  = panelX + panelW - PAD_X - col * (ICON + GAP) - ICON;
    const iy  = panelY + panelH - PAD_Y - row * ROW_H - ICON;

    const iconTxt = new Text({ text: upg.icon, style: new TextStyle({ fill: upg.color, fontSize: ICON, fontFamily: 'sans-serif' }) });
    iconTxt.position.set(ix, iy);
    dom.upgradePanel.addChild(iconTxt);

    if (upg.level > 1) {
      const lvlTxt = new Text({ text: String(upg.level), style: STYLE_UPG_LVL });
      lvlTxt.anchor.set(1, 1);
      lvlTxt.position.set(ix + ICON, iy + ICON);
      dom.upgradePanel.addChild(lvlTxt);
    }
  }
}

// ── Weapon slots ──────────────────────────────────────────────

function _updateWeaponSlots(s) {
  dom.weaponPanel.removeChildren().forEach(c => c.destroy());

  const SLOT  = 44, SGAP = 6, PAD = 8, LABEL_H = 14;
  const totalH = SLOT + LABEL_H + PAD * 2;
  const maxSlots = s.maxSlots || 1;
  const totalW  = maxSlots * SLOT + (maxSlots - 1) * SGAP + PAD * 2;
  const MARGIN  = 8;
  const panelX  = MARGIN;
  const panelY  = VH - totalH - MARGIN;

  const bg = new Graphics();
  bg.rect(0, 0, totalW, totalH)
    .fill({ color: 0x050a0f, alpha: 0.75 })
    .stroke({ color: 0x1a3a5c, alpha: 0.7, width: 1 });
  bg.position.set(panelX, panelY);
  dom.weaponPanel.addChild(bg);

  for (let i = 0; i < maxSlots; i++) {
    const sx     = panelX + PAD + i * (SLOT + SGAP);
    const sy     = panelY + PAD;
    const wId    = s.weaponSlots[i];
    const active = i === s.activeSlot;

    const slotBg = new Graphics();
    slotBg.rect(sx, sy, SLOT, SLOT)
      .fill({ color: active ? 0x00b4ff : 0x000000, alpha: active ? 0.12 : 0.3 })
      .stroke({ color: active ? 0x00d4ff : 0x1a3a5c, alpha: 0.9, width: active ? 1.5 : 1 });
    dom.weaponPanel.addChild(slotBg);

    if (wId) {
      try {
        const tex = Texture.from(`weapon-${wId}`);
        const img = new Sprite(tex);
        const M   = 6;
        img.x       = sx + M;
        img.y       = sy + M;
        img.width   = SLOT - M * 2;
        img.height  = SLOT - M * 2;
        img.alpha   = active ? 1 : 0.6;
        dom.weaponPanel.addChild(img);
      } catch { /* texture not loaded yet */ }
    }

    const lbl = new Text({ text: String(i + 1), style: new TextStyle({
      fill:       active ? '#00d4ff' : 'rgba(42,74,106,1)',
      fontSize:   9,
      fontFamily: 'Huninn, monospace',
      fontWeight: 'bold',
    })});
    lbl.anchor.set(0.5, 0);
    lbl.position.set(sx + SLOT / 2, sy + SLOT + 2);
    dom.weaponPanel.addChild(lbl);
  }
}

// ── Controls hint panel ───────────────────────────────────────

const HINTS = [
  { alias: 'ctrl-f',     label: 'подобрать' },
  { alias: 'ctrl-shift', label: 'рывок' },
  { alias: 'ctrl-tab',   label: 'характ.' },
  { alias: 'mouse-left', label: 'выстрел' },
  { alias: 'mouse-right',label: 'откр/закр' },
];

function _buildHintsPanel() {
  dom.hintsPanel.removeChildren().forEach(c => c.destroy());

  const ICON   = 24, GAP = 8, LABEL_H = 12;
  const PAD_X  = 20, PAD_Y = 6;
  const MARGIN_R = 40, MARGIN_B = 8;

  const totalW = HINTS.length * 1.5 * ICON + (HINTS.length - 1) * GAP + PAD_X * 2;
  const totalH = PAD_Y + ICON + 3 + LABEL_H + PAD_Y;

  // Weapon panel height (approx) to sit above it
  const SLOT = 44, LABEL_SLOT_H = 14, PAD_SLOT = 8, SCREEN_MARGIN = 8;
  const weaponPanelH = SLOT + LABEL_SLOT_H + PAD_SLOT * 2 + SCREEN_MARGIN;

  const panelX = VW - totalW - MARGIN_R;
  const panelY = VH - totalH - weaponPanelH - 4;

  const bg = new Graphics();
  bg.rect(0, 0, totalW, totalH)
    .fill({ color: 0x050a0f, alpha: 0.65 })
    .stroke({ color: 0x1a3a5c, alpha: 0.55, width: 1 });
  bg.position.set(panelX, panelY);
  dom.hintsPanel.addChild(bg);

  for (let i = 0; i < HINTS.length; i++) {
    const { alias, label } = HINTS[i];
    const ix = panelX + PAD_X + i * 1.5 * (ICON + GAP);
    const iy = panelY + PAD_Y;

    try {
      const spr = new Sprite(Texture.from(alias));
      spr.width = spr.height = ICON;
      spr.position.set(ix, iy);
      dom.hintsPanel.addChild(spr);
    } catch { /* texture not ready */ }

    const lbl = new Text({ text: label, style: STYLE_HINT });
    lbl.anchor.set(0.5, 0);
    lbl.position.set(ix + ICON / 2, iy + ICON + 3);
    dom.hintsPanel.addChild(lbl);
  }
}

// ── Pickup hint (F key) ──────────────────────────────────────

function _buildPickupHint() {
  dom.pickupHint.removeChildren().forEach(c => c.destroy());

  const KEY_SIZE = 28, GAP = 6;
  const panelW = KEY_SIZE + 80;
  const panelH = KEY_SIZE + 10;

  const bg = new Graphics();
  bg.rect(0, 0, panelW, panelH)
    .fill({ color: 0x050a0f, alpha: 0.75 })
    .stroke({ color: 0x2a5a8c, alpha: 0.8, width: 1 });
  dom.pickupHint.addChild(bg);

  // Key icon
  try {
    const spr = new Sprite(Texture.from('ctrl-f'));
    spr.width = spr.height = KEY_SIZE;
    spr.position.set(5, 5);
    dom.pickupHint.addChild(spr);
  } catch { /* texture not ready */ }

  // Label (tagged so we can swap it later)
  const lbl = new Text({ text: 'подобрать', style: STYLE_HINT, label: 'hint-label' });
  lbl.anchor.set(0, 0.5);
  lbl.position.set(KEY_SIZE + 10, panelH / 2);
  dom.pickupHint.addChild(lbl);

  // Center on screen (above player area)
  dom.pickupHint.position.set((VW - panelW) / 2, VH - 120);
}

function _setPickupHintText(text) {
  for (const child of dom.pickupHint.children) {
    if (child.label === 'hint-label') { child.text = text; break; }
  }
}

// ── Boss summon hint (Space key) ──────────────────────────────

function _buildBossSummonHint() {
  dom.bossSummonHint.removeChildren().forEach(c => c.destroy());

  const KEY_SIZE = 28, GAP = 6;
  const panelW = KEY_SIZE + 100;
  const panelH = KEY_SIZE + 10;

  const bg = new Graphics();
  bg.rect(0, 0, panelW, panelH)
    .fill({ color: 0x050a0f, alpha: 0.75 })
    .stroke({ color: 0xff6600, alpha: 0.8, width: 1 });
  dom.bossSummonHint.addChild(bg);

  // Space key icon (draw as rectangle with text)
  const keyBg = new Graphics();
  keyBg.rect(0, 0, KEY_SIZE, KEY_SIZE)
    .fill({ color: 0x1a3a5c, alpha: 0.8 })
    .stroke({ color: 0x00d4ff, alpha: 0.9, width: 1 });
  keyBg.position.set(5, 5);
  dom.bossSummonHint.addChild(keyBg);

  const keyLbl = new Text({ text: 'SPC', style: new TextStyle({
    fill: '#00d4ff',
    fontSize: 10,
    fontFamily: 'Huninn, monospace',
    fontWeight: 'bold',
  })});
  keyLbl.anchor.set(0.5, 0.5);
  keyLbl.position.set(5 + KEY_SIZE / 2, 5 + KEY_SIZE / 2);
  dom.bossSummonHint.addChild(keyLbl);

  // Label
  const lbl = new Text({ text: 'ПРИЗВАТЬ БОССА', style: new TextStyle({
    fill: '#ff6600',
    fontSize: 11,
    fontFamily: 'Huninn, monospace',
    fontWeight: 'bold',
  })});
  lbl.anchor.set(0, 0.5);
  lbl.position.set(KEY_SIZE + 12, panelH / 2);
  dom.bossSummonHint.addChild(lbl);

  // Center on screen (above player area)
  dom.bossSummonHint.position.set((VW - panelW) / 2, VH - 120);
}

// ── Boss HP bar (top center) ───────────────────────────────────

function _buildBossHpBar() {
  dom.bossHpBar.removeChildren().forEach(c => c.destroy());

  const BAR_W = 400;
  const BAR_H = 16;
  const X = (VW - BAR_W) / 2;
  const Y = 20;

  // Background (dark red)
  const bg = new Graphics();
  bg.rect(0, 0, BAR_W, BAR_H)
    .fill({ color: 0x331111, alpha: 0.9 })
    .stroke({ color: 0x662222, alpha: 0.8, width: 1 });
  bg.position.set(X, Y);
  bg.label = 'boss-hp-bg';
  dom.bossHpBar.addChild(bg);

  // HP fill (red, will be resized)
  const fill = new Graphics();
  fill.rect(0, 0, BAR_W, BAR_H)
    .fill({ color: 0xff4444, alpha: 0.95 });
  fill.position.set(X, Y);
  fill.label = 'boss-hp-fill';
  dom.bossHpBar.addChild(fill);

  // HP text
  const hpText = new Text({ text: '1000/1000', style: new TextStyle({
    fill: '#ffffff',
    fontSize: 11,
    fontFamily: 'Huninn, monospace',
    fontWeight: 'bold',
  })});
  hpText.anchor.set(0.5, 0.5);
  hpText.position.set(X + BAR_W / 2, Y + BAR_H / 2 + 1);
  hpText.label = 'boss-hp-text';
  dom.bossHpBar.addChild(hpText);

  // "BOSS" label above bar
  const bossLabel = new Text({ text: 'BOSS', style: new TextStyle({
    fill: '#ff6666',
    fontSize: 12,
    fontFamily: 'Huninn, monospace',
    fontWeight: 'bold',
  })});
  bossLabel.anchor.set(0.5, 1);
  bossLabel.position.set(X + BAR_W / 2, Y - 2);
  bossLabel.label = 'boss-label';
  dom.bossHpBar.addChild(bossLabel);
}

export function updateBossHpBar(gameState) {
  if (!gameState?.battle?.isBossBattle) {
    dom.bossHpBar.visible = false;
    return;
  }

  const boss = gameState.activeSpiders.find(e => e.isBoss);
  if (!boss) {
    dom.bossHpBar.visible = false;
    return;
  }

  dom.bossHpBar.visible = true;

  const BAR_W = 400;
  const hpPercent = Math.max(0, boss.hp / boss.maxHp);

  // Update fill width
  const fill = dom.bossHpBar.getChildByLabel('boss-hp-fill');
  if (fill) {
    fill.clear();
    fill.rect(0, 0, BAR_W * hpPercent, 16)
      .fill({ color: 0xff4444, alpha: 0.95 });
  }

  // Update text
  const hpText = dom.bossHpBar.getChildByLabel('boss-hp-text');
  if (hpText) {
    hpText.text = `${Math.ceil(boss.hp)}/${boss.maxHp}`;
  }
}

export function updateFps(fps) {
  if (!dom.fpsCounter) return;
  dom.fpsCounter.visible = CONFIG.SHOW_FPS === true;
  if (dom.fpsCounter.visible) {
    dom.fpsCounter.text = `FPS: ${Math.round(fps)}`;
  }
}

// ── Level complete screen overlay ─────────────────────────────

let _nextLevelCallback = null;

function _buildLevelComplete() {
  dom.levelComplete.removeChildren().forEach(c => c.destroy());

  // Semi-transparent background
  const bg = new Graphics();
  bg.rect(0, 0, VW, VH)
    .fill({ color: 0x040a04, alpha: 0.88 });
  dom.levelComplete.addChild(bg);

  // Title
  const title = new Text({ text: 'УРОВЕНЬ ПРОЙДЕН!', style: new TextStyle({
    fill: '#44ff88',
    fontSize: 32,
    fontFamily: 'Huninn, monospace',
    fontWeight: 'bold',
    letterSpacing: 4,
  })});
  title.anchor.set(0.5, 0.5);
  title.position.set(VW / 2, VH / 2 - 40);
  title.label = 'level-complete-title';
  dom.levelComplete.addChild(title);

  // Subtitle
  const subtitle = new Text({ text: 'Путь на следующий этаж открыт.', style: new TextStyle({
    fill: '#aaccbb',
    fontSize: 14,
    fontFamily: 'Huninn, monospace',
  })});
  subtitle.anchor.set(0.5, 0.5);
  subtitle.position.set(VW / 2, VH / 2 + 10);
  subtitle.label = 'level-complete-sub';
  dom.levelComplete.addChild(subtitle);

  // Next level button
  const btnW = 200, btnH = 40;
  const btnX = (VW - btnW) / 2;
  const btnY = VH / 2 + 60;

  const btnBg = new Graphics();
  btnBg.rect(0, 0, btnW, btnH)
    .fill({ color: 0x00d4ff, alpha: 0.2 })
    .stroke({ color: 0x00d4ff, alpha: 0.8, width: 2 });
  btnBg.position.set(btnX, btnY);
  btnBg.label = 'level-complete-btn-bg';
  btnBg.eventMode = 'static';
  btnBg.cursor = 'pointer';
  dom.levelComplete.addChild(btnBg);

  const btnText = new Text({ text: 'СЛЕДУЮЩИЙ УРОВЕНЬ', style: new TextStyle({
    fill: '#00d4ff',
    fontSize: 14,
    fontFamily: 'Huninn, monospace',
    fontWeight: 'bold',
  })});
  btnText.anchor.set(0.5, 0.5);
  btnText.position.set(btnX + btnW / 2, btnY + btnH / 2);
  btnText.label = 'level-complete-btn-text';
  btnText.eventMode = 'static';
  dom.levelComplete.addChild(btnText);

  // Click handler
  btnBg.on('pointerdown', () => {
    if (_nextLevelCallback) _nextLevelCallback();
  });
  btnText.on('pointerdown', () => {
    if (_nextLevelCallback) _nextLevelCallback();
  });
}

export function showLevelComplete(onNextLevel) {
  _nextLevelCallback = onNextLevel;
  dom.levelComplete.visible = true;
}

export function hideLevelComplete() {
  dom.levelComplete.visible = false;
  _nextLevelCallback = null;
}

export function destroyHud() {
  if (_parent) {
    _parent.removeChildren().forEach(c => c.destroy({ children: true }));
    _parent = null;
  }
  // Clear dom references
  dom.levelLabel = null;
  dom.heartsRow = null;
  dom.shieldsRow = null;
  dom.upgradePanel = null;
  dom.weaponPanel = null;
  dom.hintsPanel = null;
  dom.pickupHint = null;
  dom.bossSummonHint = null;
  dom.bossHpBar = null;
  dom.levelComplete = null;
  dom.fpsCounter = null;
}
