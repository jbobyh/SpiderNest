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
  Container, Sprite, Texture, Text, TextStyle, Graphics, Rectangle,
} from 'pixi.js';
import { keys } from '../core/input.js';
import { getActiveWeapon, getBulletRange, getSpatialBonus } from '../game/combat.js';
import { getRoomSpeedMultiplier, cellOf, cellKey } from '../world/constants.js';
import { showTooltip, hideTooltip } from './tooltip.js';
import {
  VW, VH, UI_COLORS, STYLE_LEVEL, STYLE_SLOT_LBL, STYLE_HINT, STYLE_UPG_LVL,
  STYLE_STATS_LABEL, STYLE_STATS_VALUE, createPanel, clearContainer, hexToNum,
} from './ui-shared.js';

// ── Internal HUD state ───────────────────────────────────────

let _parent      = null;

const dom = {
  levelLabel:   null,
  heartsRow:    null,
  shieldsRow:   null,
  upgradePanel: null,
  spatialPanel: null,
  cursedPanel:  null,
  weaponPanel:  null,
  hintsPanel:   null,
  pickupHint:   null, // dynamic hint for weapon pickup
  bossSummonHint: null, // hint for boss summon (space key)
  bossHpBar:    null, // boss HP bar (top center)
  levelComplete: null, // level complete screen overlay
  fpsCounter:   null, // FPS counter (bottom right)
  statsPanel:   null, // character stats panel (Tab key)
};

// ── Init ──────────────────────────────────────────────────────

export function initHud(parentContainer) {
  _parent = parentContainer;
  clearContainer(_parent);

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
  dom.upgradePanel.eventMode = 'static';
  _parent.addChild(dom.upgradePanel);

  dom.spatialPanel = new Container({ label: 'spatial-upgrades' });
  dom.spatialPanel.eventMode = 'static';
  _parent.addChild(dom.spatialPanel);

  dom.cursedPanel = new Container({ label: 'cursed-upgrades' });
  dom.cursedPanel.eventMode = 'static';
  _parent.addChild(dom.cursedPanel);

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
  dom.fpsCounter.visible = CONFIG.DEBUG.showFps === true;
  _parent.addChild(dom.fpsCounter);

  // Stats panel (centered)
  dom.statsPanel = new Container({ label: 'stats-panel' });
  dom.statsPanel.visible = false;
  _parent.addChild(dom.statsPanel);

  _parent.eventMode = 'static';

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
  dom.pickupHint.visible = showHint && !bossSummonReady;
  if (showHint && !bossSummonReady) {
    let hintText = 'подобрать';
    if (nearRoomBonusAltar) hintText = 'Активировать алтарь комнаты';
    else if (nearSpatialChest) hintText = 'Открыть пространственный сундук';
    else if (nearChest) hintText = 'Открыть сундук';
    else if (nearAltar) hintText = 'Призвать врагов';
    _setPickupHintText(hintText);
  }

  // Show boss summon hint
  dom.bossSummonHint.visible = bossSummonReady;

  // Stats panel (Tab key)
  const showStats = keys['tab'];
  dom.statsPanel.visible = showStats;
  if (showStats) {
    _updateStatsPanel(gameState);
  }
}

// ── Upgrade State Tracking ────────────────────────────────────

let _lastUpgradesHash = '';
let _lastMaxSlots = 0;

function _getUpgradesHash(s) {
  // Create a simple string hash of active upgrades and their levels
  let hash = '';
  const upg = s.upgrades;
  for (const key in upg) {
    if (upg[key]) hash += `${key}:${upg[key]}|`;
  }
  hash += `maxSlots:${s.maxSlots}`;
  return hash;
}

// ── Character Stats Panel ─────────────────────────────────────

function _updateStatsPanel(s) {
  clearContainer(dom.statsPanel);

  const weapon = getActiveWeapon(s);
  
  // Accuracy calculation (Spread in degrees)
  const spatialAccuracy = getSpatialBonus(s, 'accuracy');
  let totalSpread = (weapon?.spread || 0) * (s.upgrades.spreadMult || 1) * Math.max(0, 1 - spatialAccuracy);
  
  if (s.upgrades.sniper) {
    let roomCount = 1;
    if (s.battle && s.battle.battleCells && s.rooms) {
      let participatingRooms = 0;
      for (const room of s.rooms) {
        if (room.cells.some(c => s.battle.battleCells.has(c.k))) {
          participatingRooms++;
        }
      }
      roomCount = participatingRooms;
    }
    if (roomCount <= 2) totalSpread = 0;
    else totalSpread *= (1 + 0.10 * (roomCount - 2));
  }
  const spreadDeg = Math.round(totalSpread * (180 / Math.PI));

  // Range calculation
  const range = Math.round(getBulletRange(s, weapon || WEAPON_DEFS.pistol, 1));

  // Speed calculation
  const spatialSpeed = getSpatialBonus(s, 'speed');
  const playerCell = cellOf(s.player.x, s.player.y);
  const playerCellKey = cellKey(playerCell.x, playerCell.y);
  const roomSpeedMult = getRoomSpeedMultiplier(s, playerCellKey);
  const totalSpeed = Math.round(CONFIG.PLAYER_SPEED * s.upgrades.speedMult * (1 + spatialSpeed) * roomSpeedMult);

  // Cooldown calculation
  const killAccelMult = s.upgrades.killAccel ? Math.max(0.1, 1 - s.upgrades.killAccelPercent / 100) : 1.0;
  const spatialReload = getSpatialBonus(s, 'reload');
  const cooldown = (weapon?.cooldown || 0.4) * s.upgrades.cooldownMult * killAccelMult * Math.max(0.1, 1 - spatialReload);

  // Damage calculation
  const spatialCritChance = getSpatialBonus(s, 'critChance');
  const critChance = (s.upgrades.critChance + spatialCritChance);
  const damage = Math.round((weapon?.damage || 2) * (1 + s.upgrades.damageMult));

  const spatialCritDamage = getSpatialBonus(s, 'critDamage');
  const critMult = 2 + spatialCritDamage;

  // Penetration
  const spatialPenetrate = getSpatialBonus(s, 'penetrate');
  const penetrate = s.upgrades.infinitePenetrate ? '∞' : (weapon?.penetrate || 0) + s.upgrades.penetrate + Math.floor(spatialPenetrate);

  // Bullet Speed
  const spatialBulletSpeed = getSpatialBonus(s, 'bulletSpeed');
  const bulletSpeed = Math.round((weapon?.bulletSpeed || 300) * s.upgrades.bulletSpeedMult * (1 + spatialBulletSpeed));

  const rows = [
    { label: 'ЖИЗНИ', value: `${s.player.lives}`, color: 0xff4444 },
    { label: 'СКОРОСТЬ БЕГА', value: `${totalSpeed}`, color: 0x44ff88 },
    { label: 'УРОН ПУЛИ', value: `${damage}`, color: 0xff8800 },
    { label: 'ШАНС КРИТА', value: `${Math.round(critChance * 100)}%`, color: 0xff0000 },
    { label: 'КРИТ УРОН', value: `x${critMult.toFixed(1)}`, color: 0xff4400 },
    { label: 'ПУЛЬ ЗА ВЫСТРЕЛ', value: `${(weapon?.pellets || 1) + s.upgrades.pellets}`, color: 0x00d4ff },
    { label: 'ТОЧНОСТЬ', value: spreadDeg === 0 ? 'Идеальная' : `±${spreadDeg}°`, color: 0xff66aa },
    { label: 'ДАЛЬНОСТЬ ПУЛИ', value: `${range}`, color: 0x88ff44 },
    { label: 'ПРОБИТИЕ ВРАГОВ', value: `${penetrate}`, color: 0xaa44ff },
    { label: 'СКОРОСТЬ ПУЛИ', value: `${bulletSpeed}`, color: 0xffff44 },
    { label: 'ПЕРЕЗАРЯДКА', value: `${cooldown.toFixed(2)}с`, color: 0x00ccff },
  ];

  if (s.upgrades.shield > 0) rows.push({ label: 'ЩИТЫ', value: `${s.upgrades.shield}`, color: 0x00aaff });
  if (s.upgrades.killAccel) rows.push({ label: 'РАЗГОН ПЕРЕЗАРЯДКИ', value: `${s.upgrades.killAccelPercent.toFixed(1)}%`, color: 0xff8800 });

  const panelW = 280;
  const lineH = 22;
  const pad = 16;
  const panelH = pad * 2 + rows.length * lineH + 24;
  const panelX = (VW - panelW) / 2;
  const panelY = (VH - panelH) / 2;

  // Background
  const bg = createPanel({
    x: panelX, y: panelY,
    width: panelW, height: panelH,
    bgColor: 0x080c14, bgAlpha: 0.95,
    strokeColor: UI_COLORS.CYAN, strokeAlpha: 0.6, strokeWidth: 2,
    radius: 12
  });
  dom.statsPanel.addChild(bg);

  // Title
  const title = new Text({
    text: 'ХАРАКТЕРИСТИКИ',
    style: new TextStyle({
      fill: '#00d4ff',
      fontSize: 16,
      fontFamily: 'BoldPixels, sans-serif',
      fontWeight: 'bold'
    })
  });
  title.anchor.set(0.5, 0);
  title.position.set(panelX + panelW / 2, panelY + pad);
  dom.statsPanel.addChild(title);

  // Rows
  let y = panelY + pad + 28;
  for (const row of rows) {
    const lbl = new Text({
      text: row.label,
      style: STYLE_STATS_LABEL
    });
    lbl.anchor.set(0, 0.5);
    lbl.position.set(panelX + pad, y + lineH / 2);
    dom.statsPanel.addChild(lbl);

    const val = new Text({
      text: row.value,
      style: new TextStyle({
        fill: row.color,
        fontSize: 14,
        fontFamily: 'BoldPixels, sans-serif',
        fontWeight: 'bold'
      })
    });
    val.anchor.set(1, 0.5);
    val.position.set(panelX + panelW - pad, y + lineH / 2);
    dom.statsPanel.addChild(val);

    y += lineH;
  }
}

// ── Hearts ────────────────────────────────────────────────────

function _updateHearts(s) {
  clearContainer(dom.heartsRow);

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
  clearContainer(dom.shieldsRow);
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

// ── Upgrade icon panels ──────────────────────────────────────

const REGULAR_UPGRADE_IDS = [
  'pellets', 'damage', 'penetrate', 'bulletSpeed', 'critChance',
  'killAccel', 'enhancedPierce', 'shield', 'retreat', 'reflection',
  'cooldown', 'speed'
];

function _updateUpgrades(s) {
  const newHash = _getUpgradesHash(s);
  if (newHash === _lastUpgradesHash) return;
  _lastUpgradesHash = newHash;

  dom.upgradePanel.removeChildren().forEach(c => c.destroy({ children: true }));
  dom.spatialPanel.removeChildren().forEach(c => c.destroy({ children: true }));
  dom.cursedPanel.removeChildren().forEach(c => c.destroy({ children: true }));

  if (!s.upgrades || !UPGRADE_TYPES) return;

  // 1. Regular Upgrades
  const activeRegular = [];
  for (const upg of UPGRADE_TYPES) {
    if (!REGULAR_UPGRADE_IDS.includes(upg.id)) continue;
    let level = 0;
    if (upg.id === 'pellets') level = s.upgrades.pellets || 0;
    else if (upg.id === 'damage') level = s.upgrades.damageMult > 0 ? Math.round(s.upgrades.damageMult / 0.20) : 0;
    else if (upg.id === 'penetrate') level = s.upgrades.penetrate || 0;
    else if (upg.id === 'bulletSpeed') level = s.upgrades.bulletSpeedMult > 1 ? 1 : 0;
    else if (upg.id === 'critChance') level = s.upgrades.critChance > 0 ? Math.ceil(s.upgrades.critChance * 20) : 0;
    else if (upg.id === 'killAccel') level = s.upgrades.killAccel ? 1 : 0;
    else if (upg.id === 'enhancedPierce') level = s.upgrades.enhancedPierce ? 1 : 0;
    else if (upg.id === 'shield') level = s.upgrades.shield || 0;
    else if (upg.id === 'retreat') level = s.upgrades.retreat > 0 ? 1 : 0;
    else if (upg.id === 'reflection') level = s.upgrades.reflection ? 1 : 0;
    else if (upg.id === 'cooldown') level = s.upgrades.cooldownMult < 1 ? Math.ceil((1 - s.upgrades.cooldownMult) * 6.67) : 0;
    else if (upg.id === 'speed') level = s.upgrades.speedMult > 1 ? Math.ceil((s.upgrades.speedMult - 1) * 10) : 0;
    
    if (level > 0) {
      activeRegular.push({ ...upg, level: Math.min(level, upg.max || 1) });
    }
  }

  // 2. Spatial Upgrades
  const activeSpatial = [];
  const spatialPool = (typeof SPATIAL_UPGRADE_TYPES !== 'undefined') ? SPATIAL_UPGRADE_TYPES : [];
  for (const upg of spatialPool) {
    if (s.upgrades[upg.id]) {
      activeSpatial.push({ ...upg, level: 1 });
    }
  }

  // 3. Cursed Upgrades
  const activeCursed = [];
  const cursedPool = (typeof CURSED_UPGRADE_TYPES !== 'undefined') ? CURSED_UPGRADE_TYPES : [];
  for (const upg of cursedPool) {
    let level = 0;
    const val = s.upgrades[upg.id];
    if (upg.id === 'weaponSlot') level = s.maxSlots > 1 ? s.maxSlots - 1 : 0;
    else if (val === true) level = 1;
    else if (typeof val === 'number' && val > 0) level = val;
    
    if (level > 0) {
      activeCursed.push({ ...upg, level: Math.min(level, upg.max || 1) });
    }
  }

  // Build panels and stack them
  let currentY = 0;
  const GAP_BETWEEN_PANELS = 4;

  if (activeRegular.length > 0) {
    currentY += _buildUpgradePanel(dom.upgradePanel, activeRegular, currentY, {
      bgColor: 0x050a0f, bgAlpha: 0.72, strokeColor: 0x1a3a5c
    });
    currentY += GAP_BETWEEN_PANELS;
  }

  if (activeSpatial.length > 0) {
    currentY += _buildUpgradePanel(dom.spatialPanel, activeSpatial, currentY, {
      bgColor: 0x050a0f, bgAlpha: 0.72, strokeColor: 0x1a3a5c
    });
    currentY += GAP_BETWEEN_PANELS;
  }

  if (activeCursed.length > 0) {
    currentY += _buildUpgradePanel(dom.cursedPanel, activeCursed, currentY, {
      bgColor: 0x0a0514, bgAlpha: 0.78, strokeColor: 0x7828b4
    });
  }
}

function _buildUpgradePanel(container, upgrades, startY, theme) {
  const ICON = 20, GAP = 4, PER_ROW = 10;
  const PAD_X = 8, PAD_Y = 6, ROW_H = ICON + 4;

  const rows = Math.ceil(upgrades.length / PER_ROW);
  const cols = Math.min(upgrades.length, PER_ROW);
  const panelW = cols * ICON + (cols - 1) * GAP + PAD_X * 2;
  const panelH = rows * ROW_H + PAD_Y * 2;
  const panelX = VW - panelW;

  const bg = createPanel({
    x: panelX, y: startY,
    width: panelW, height: panelH,
    bgColor: theme.bgColor, bgAlpha: theme.bgAlpha,
    strokeColor: theme.strokeColor, strokeAlpha: 0.6, strokeWidth: 1
  });
  container.addChild(bg);

  for (let i = 0; i < upgrades.length; i++) {
    const upg = upgrades[upgrades.length - 1 - i]; // latest upgrades in bottom-right
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const ix = panelX + panelW - PAD_X - col * (ICON + GAP) - ICON;
    const iy = startY + panelH - PAD_Y - row * ROW_H - ICON;

    const iconCont = new Container();
    iconCont.position.set(ix, iy);
    iconCont.eventMode = 'static';
    iconCont.cursor = 'pointer';
    // Add hit area to ensure the whole icon is hoverable
    iconCont.hitArea = new Rectangle(0, 0, ICON, ICON);
    
    const iconTxt = new Text({
      text: upg.icon,
      style: new TextStyle({ fill: upg.color, fontSize: ICON, fontFamily: 'sans-serif' })
    });
    iconCont.addChild(iconTxt);

    if (upg.level > 1) {
      const lvlTxt = new Text({ text: String(upg.level), style: STYLE_UPG_LVL });
      lvlTxt.anchor.set(1, 1);
      lvlTxt.position.set(ICON, ICON);
      iconCont.addChild(lvlTxt);
    }

    iconCont.on('pointerover', (e) => {
      // Use logical coordinates for tooltip positioning (center of icon)
      showTooltip(ix + ICON / 2, iy + ICON / 2, upg.label, upg.description, upg.color);
    });
    iconCont.on('pointerout', () => hideTooltip());

    container.addChild(iconCont);
  }

  return panelH;
}

// ── Weapon slots ──────────────────────────────────────────────

function _updateWeaponSlots(s) {
  clearContainer(dom.weaponPanel);

  const SLOT  = 44, SGAP = 6, PAD = 8, LABEL_H = 14;
  const totalH = SLOT + LABEL_H + PAD * 2;
  const maxSlots = s.maxSlots || 1;
  const totalW  = maxSlots * SLOT + (maxSlots - 1) * SGAP + PAD * 2;
  const MARGIN  = 8;
  const panelX  = MARGIN;
  const panelY  = VH - totalH - MARGIN;

  const bg = createPanel({
    x: panelX, y: panelY,
    width: totalW, height: totalH,
    bgColor: UI_COLORS.BG_DARK, bgAlpha: 0.75,
    strokeColor: UI_COLORS.STROKE_DEFAULT, strokeAlpha: 0.7, strokeWidth: 1
  });
  dom.weaponPanel.addChild(bg);

  for (let i = 0; i < maxSlots; i++) {
    const sx     = panelX + PAD + i * (SLOT + SGAP);
    const sy     = panelY + PAD;
    const wId    = s.weaponSlots[i];
    const active = i === s.activeSlot;

    const slotBg = createPanel({
      x: sx, y: sy,
      width: SLOT, height: SLOT,
      bgColor: active ? UI_COLORS.CYAN : 0x000000,
      bgAlpha: active ? 0.12 : 0.3,
      strokeColor: active ? UI_COLORS.CYAN : UI_COLORS.STROKE_DEFAULT,
      strokeAlpha: 0.9,
      strokeWidth: active ? 1.5 : 1
    });
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
      fontFamily: 'BoldPixels, sans-serif',
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
  { alias: 'ctrl-q',     label: 'оружие' },
  { alias: 'ctrl-tab',   label: 'характ.' },
  { alias: 'mouse-left', label: 'выстрел' },
  { alias: 'mouse-right',label: 'откр/закр' },
];

function _buildHintsPanel() {
  clearContainer(dom.hintsPanel);

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

  const bg = createPanel({
    x: panelX, y: panelY,
    width: totalW, height: totalH,
    bgColor: UI_COLORS.BG_DARK, bgAlpha: 0.65,
    strokeColor: UI_COLORS.STROKE_DEFAULT, strokeAlpha: 0.55, strokeWidth: 1
  });
  dom.hintsPanel.addChild(bg);

  for (let i = 0; i < HINTS.length; i++) {
    const { alias, label } = HINTS[i];
    const ix = panelX + PAD_X + i * 1.5 * (ICON + GAP);
    const iy = panelY + PAD_Y;

    let iconFound = false;
    try {
      const tex = Texture.from(alias);
      if (tex && tex.valid) {
        const spr = new Sprite(tex);
        spr.width = spr.height = ICON;
        spr.position.set(ix, iy);
        dom.hintsPanel.addChild(spr);
        iconFound = true;
      }
    } catch { /* texture not ready */ }

    if (!iconFound) {
      // Draw text-based icon if texture missing (e.g. for Q)
      let keyText = 'F';
      if (alias.includes('q')) keyText = 'Q';
      else if (alias.includes('tab')) keyText = 'TAB';
      else if (alias.includes('shift')) keyText = 'SHFT';
      else if (alias.includes('left')) keyText = 'LMB';
      else if (alias.includes('right')) keyText = 'RMB';

      const g = createPanel({
        x: ix, y: iy,
        width: ICON, height: ICON,
        bgColor: UI_COLORS.STROKE_DEFAULT, bgAlpha: 0.8,
        strokeColor: UI_COLORS.CYAN, strokeAlpha: 0.9, strokeWidth: 1
      });
      dom.hintsPanel.addChild(g);

      const txt = new Text({
        text: keyText,
        style: new TextStyle({
          fill: '#00d4ff',
          fontSize: 10,
          fontFamily: 'BoldPixels, sans-serif',
          fontWeight: 'bold',
        })
      });
      txt.anchor.set(0.5, 0.5);
      txt.position.set(ix + ICON / 2, iy + ICON / 2);
      dom.hintsPanel.addChild(txt);
    }

    const lbl = new Text({ text: label, style: STYLE_HINT });
    lbl.anchor.set(0.5, 0);
    lbl.position.set(ix + ICON / 2, iy + ICON + 3);
    dom.hintsPanel.addChild(lbl);
  }
}

// ── Pickup hint (F key) ──────────────────────────────────────

function _buildPickupHint() {
  clearContainer(dom.pickupHint);

  const KEY_SIZE = 28, GAP = 6;
  const panelW = KEY_SIZE + 80;
  const panelH = KEY_SIZE + 10;

  const bg = createPanel({
    x: 0, y: 0,
    width: panelW, height: panelH,
    bgColor: UI_COLORS.BG_DARK, bgAlpha: 0.75,
    strokeColor: 0x2a5a8c, strokeAlpha: 0.8, strokeWidth: 1
  });
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
  clearContainer(dom.bossSummonHint);

  const KEY_SIZE = 28, GAP = 6;
  const panelW = KEY_SIZE + 100;
  const panelH = KEY_SIZE + 10;

  const bg = createPanel({
    x: 0, y: 0,
    width: panelW, height: panelH,
    bgColor: UI_COLORS.BG_DARK, bgAlpha: 0.75,
    strokeColor: 0xff6600, strokeAlpha: 0.8, strokeWidth: 1
  });
  dom.bossSummonHint.addChild(bg);

  // Space key icon (draw as rectangle with text)
  const keyBg = createPanel({
    x: 5, y: 5,
    width: KEY_SIZE, height: KEY_SIZE,
    bgColor: UI_COLORS.STROKE_DEFAULT, bgAlpha: 0.8,
    strokeColor: UI_COLORS.CYAN, strokeAlpha: 0.9, strokeWidth: 1
  });
  dom.bossSummonHint.addChild(keyBg);

  const keyLbl = new Text({ text: 'SPC', style: new TextStyle({
    fill: '#00d4ff',
    fontSize: 10,
    fontFamily: 'BoldPixels, sans-serif',
    fontWeight: 'bold',
  })});
  keyLbl.anchor.set(0.5, 0.5);
  keyLbl.position.set(5 + KEY_SIZE / 2, 5 + KEY_SIZE / 2);
  dom.bossSummonHint.addChild(keyLbl);

  // Label
  const lbl = new Text({ text: 'ПРИЗВАТЬ БОССА', style: new TextStyle({
    fill: '#ff6600',
    fontSize: 11,
    fontFamily: 'BoldPixels, sans-serif',
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
  clearContainer(dom.bossHpBar);

  const BAR_W = 400;
  const BAR_H = 16;
  const X = (VW - BAR_W) / 2;
  const Y = 20;

  // Background (dark red)
  const bg = createPanel({
    x: X, y: Y,
    width: BAR_W, height: BAR_H,
    bgColor: 0x331111, bgAlpha: 0.9,
    strokeColor: 0x662222, strokeAlpha: 0.8, strokeWidth: 1
  });
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
    fontFamily: 'BoldPixels, sans-serif',
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
    fontFamily: 'BoldPixels, sans-serif',
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
  dom.fpsCounter.visible = CONFIG.DEBUG.showFps === true;
  if (dom.fpsCounter.visible) {
    dom.fpsCounter.text = `FPS: ${Math.round(fps)}`;
  }
}

// ── Level complete screen overlay ─────────────────────────────

let _nextLevelCallback = null;

function _buildLevelComplete() {
  clearContainer(dom.levelComplete);

  // Semi-transparent background
  const bg = createPanel({
    x: 0, y: 0,
    width: VW, height: VH,
    bgColor: 0x040a04, bgAlpha: 0.88,
    strokeWidth: 0
  });
  dom.levelComplete.addChild(bg);

  // Title
  const title = new Text({ text: 'УРОВЕНЬ ПРОЙДЕН!', style: new TextStyle({
    fill: '#44ff88',
    fontSize: 32,
    fontFamily: 'BoldPixels, sans-serif',
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
    fontFamily: 'BoldPixels, sans-serif',
  })});
  subtitle.anchor.set(0.5, 0.5);
  subtitle.position.set(VW / 2, VH / 2 + 10);
  subtitle.label = 'level-complete-sub';
  dom.levelComplete.addChild(subtitle);

  // Next level button
  const btnW = 200, btnH = 40;
  const btnX = (VW - btnW) / 2;
  const btnY = VH / 2 + 60;

  const btnBg = createPanel({
    x: btnX, y: btnY,
    width: btnW, height: btnH,
    bgColor: UI_COLORS.CYAN, bgAlpha: 0.2,
    strokeColor: UI_COLORS.CYAN, strokeAlpha: 0.8, strokeWidth: 2
  });
  btnBg.label = 'level-complete-btn-bg';
  btnBg.eventMode = 'static';
  btnBg.cursor = 'pointer';
  dom.levelComplete.addChild(btnBg);

  const btnText = new Text({ text: 'СЛЕДУЮЩИЙ УРОВЕНЬ', style: new TextStyle({
    fill: '#00d4ff',
    fontSize: 14,
    fontFamily: 'BoldPixels, sans-serif',
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
