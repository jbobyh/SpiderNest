// ============================================================
// LEVEL GENERATION — pure data, no rendering
// Globals used (loaded by index.html):
//   CONFIG (incl. ENEMY_COSTS, ROOM_ENEMY_BUDGET, ROOM_CONTENT_BUDGET_MULT,
//           ENEMY_SPAWN_TABLE), LEVEL_CONFIG, UPGRADE_TYPES
// ============================================================

import {
  CELL_PX, CARDINAL_DIRECTIONS,
  cellKey, cellFromKey,
} from './constants.js';
import { EnemyFactory } from '../game/enemy-factory.js';

// ── Enemy budget helpers ──────────────────────────────────────

function generateEnemyComposition(level, cellCount) {
  const cfg = CONFIG.ROOM_ENEMY_BUDGET;
  const levelMult = (cfg.levelMult[level] ?? cfg.levelMult[3]) || 1;
  const budget = Math.round(cfg.base * levelMult);

  const costs  = CONFIG.ENEMY_COSTS;
  const table  = CONFIG.ENEMY_SPAWN_TABLE[level] || CONFIG.ENEMY_SPAWN_TABLE[3];
  const maxByCells = cellCount * (cfg.maxEnemiesPerCell || 8);
  const maxTotal   = cfg.maxEnemiesTotal || 32;
  const maxEnemies = Math.min(maxByCells, maxTotal);

  const candidates = Object.keys(table)
    .filter(k => costs[k] != null && costs[k] > 0 && table[k] > 0)
    .map(k => ({ key: k, cost: costs[k], weight: table[k] }))
    .filter(c => c.cost <= budget)
    .sort((a, b) => a.cost - b.cost);
  if (candidates.length === 0) return {};

  let remaining = budget;
  let total     = 0;
  const out     = {};

  while (total < maxEnemies) {
    const affordable = candidates.filter(c => c.cost <= remaining);
    if (affordable.length === 0) break;

    const totalWeight = affordable.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * totalWeight;
    let picked = affordable[affordable.length - 1];
    for (const c of affordable) {
      roll -= c.weight;
      if (roll <= 0) { picked = c; break; }
    }

    out[picked.key] = (out[picked.key] || 0) + 1;
    remaining -= picked.cost;
    total++;
  }

  return out;
}

function countEnemiesInPreset(preset) {
  let total = 0;
  for (const count of Object.values(preset)) total += count || 0;
  return total;
}

// ── Enemy creation ───────────────────────────────────────────

function getEnemyStats(enemyType, level) {
  const hpMult = CONFIG.ENEMY_HP_MULT[level] || 1;
  const stats = CONFIG.ENEMY_STATS[enemyType] || CONFIG.ENEMY_STATS.soldier;
  return {
    hp: stats.hp * hpMult,
    radius: stats.radius,
    visualScale: stats.visualScale,
  };
}

function createStasisEnemy(enemyType, gx, gy, level, roomIdx) {
  const { hp, radius, visualScale } = getEnemyStats(enemyType, level);
  const enemy = EnemyFactory.create(enemyType, gx, gy, {
    hp, maxHp: hp, radius, visualScale, level,
  });
  enemy.stasis = true;
  enemy.stasisRoomIdx = roomIdx;
  return enemy;
}

function spawnEnemiesFromPreset(preset, cells, stasisEnemies, level, roomIdx) {
  const margin = CONFIG.ENEMY_STATS.soldier.radius + CONFIG.ENEMY_STATS.soldier.spawnMargin;
  const MAX_ATTEMPTS = 20;
  for (const [configKey, count] of Object.entries(preset)) {
    if (!count) continue;
    const enemyType = configKey;
    const newRadius = CONFIG.ENEMY_STATS[enemyType]?.radius ?? CONFIG.ENEMY_STATS.soldier.radius;
    for (let i = 0; i < count; i++) {
      let gx = 0, gy = 0;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const cell = cells[Math.floor(Math.random() * cells.length)];
        gx = cell.x * CELL_PX + margin + Math.random() * (CELL_PX - margin * 2);
        gy = cell.y * CELL_PX + margin + Math.random() * (CELL_PX - margin * 2);
        let ok = true;
        for (const existing of stasisEnemies) {
          const minDist = newRadius + (existing.radius ?? CONFIG.ENEMY_STATS.soldier.radius);
          const dx = gx - existing.x;
          const dy = gy - existing.y;
          if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
        }
        if (ok) break;
      }
      stasisEnemies.push(createStasisEnemy(enemyType, gx, gy, level, roomIdx));
    }
  }
}

// ── Chest type randomization ──────────────────────────────────

const CHEST_TYPES = ['upgrade', 'roomBonus', 'cursed'];

function spawnRandomChest(state, cellKey, x, y, roomIdx) {
  const type = CHEST_TYPES[Math.floor(Math.random() * CHEST_TYPES.length)];
  if (type === 'upgrade') {
    state.upgradeChests.push({ x, y, cellKey, collected: false, spawned: true });
  } else if (type === 'roomBonus') {
    state.roomBonusAltars.push({ roomIdx, x, y, cellKey, activated: false, bonusType: null });
  } else {
    state.spatialChests.push({ x, y, cellKey, collected: false, spawned: true });
  }
}

// ── Spawn a battle cycle: enemies + chest in start room ───────

export function spawnBattleCycle(state, level, isBoss) {
  const startKey = cellKey(state.startCell.x, state.startCell.y);
  const sx = (state.startCell.x + 0.5) * CELL_PX;
  const sy = (state.startCell.y + 0.5) * CELL_PX;
  const roomIdx = 0;

  // Clear previous cycle's enemies (dead ones remain as corpses, remove stasis ones)
  state.activeSpiders = state.activeSpiders.filter(g => !g.stasis);

  // Check if a chest in start room is still uncollected
  const hasUncollectedChest =
    state.upgradeChests.some(c => c.cellKey === startKey && !c.collected) ||
    state.spatialChests.some(c => c.cellKey === startKey && !c.collected) ||
    state.roomBonusAltars.some(a => a.cellKey === startKey && !a.activated);

  // Only clear and respawn chest if previous one was collected (or none existed)
  if (hasUncollectedChest) {
    // Remove any collected chests in start room, keep uncollected ones
    state.upgradeChests = state.upgradeChests.filter(c => c.cellKey !== startKey || !c.collected);
    state.spatialChests = state.spatialChests.filter(c => c.cellKey !== startKey || !c.collected);
    state.roomBonusAltars = state.roomBonusAltars.filter(a => a.cellKey !== startKey || !a.activated);
  } else {
    // Clear all chests in start room and spawn a new one
    state.upgradeChests = state.upgradeChests.filter(c => c.cellKey !== startKey);
    state.spatialChests = state.spatialChests.filter(c => c.cellKey !== startKey);
    state.roomBonusAltars = state.roomBonusAltars.filter(a => a.cellKey !== startKey);
  }

  if (isBoss) {
    const bossDef = (typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[level]) || BOSS_DEFS[1];
    const bossHp = bossDef.hp !== undefined
      ? bossDef.hp
      : (bossDef.hpBase === 'buldyga' ? CONFIG.ENEMY_STATS.buldyga.hp : CONFIG.ENEMY_STATS.soldier.hp) * (bossDef.hpMult || 1);

    const boss = EnemyFactory.create(bossDef.type || 'boss_phase', sx, sy, {
      level,
      hp: bossHp,
      maxHp: bossHp,
      radius: CONFIG.ENEMY_STATS.soldier.radius * (bossDef.radiusMult || 1),
      isBoss: true,
      phaseIndex: 0,
      phaseTimer: bossDef.phases?.[0]?.duration ?? 0,
    });
    boss.stasis = true;
    boss.stasisRoomIdx = roomIdx;
    state.activeSpiders.push(boss);

    // Set cell contents for start room
    state.cellContents.set(startKey, {
      enemyCount: 1,
      enemiesReleased: false,
      isBoss: true,
    });
  } else {
    const preset = generateEnemyComposition(level, 1);
    const enemyCount = countEnemiesInPreset(preset);

    const startCells = [{ x: state.startCell.x, y: state.startCell.y, k: startKey }];
    spawnEnemiesFromPreset(preset, startCells, state.activeSpiders, level, roomIdx);

    state.cellContents.set(startKey, {
      enemyPreset: preset,
      enemyCount,
      enemiesReleased: false,
      isBoss: false,
    });

    // Spawn random chest in start room only if no uncollected chest remains
    if (!hasUncollectedChest) {
      spawnRandomChest(state, startKey, sx, sy, roomIdx);
    }
  }
}

// ── Main export ───────────────────────────────────────────────
//
// generateLevel returns pure world data: a grid of 1x1 cells.
// Only the start cell is open. All walls are openable (no fixed walls).

export function generateLevel(level, playerProgress) {
  const levelConfig = LEVEL_CONFIG[level] || LEVEL_CONFIG[3];
  const gridSize    = levelConfig.gridSize || 21;

  const cx = Math.floor(gridSize / 2);
  const cy = Math.floor(gridSize / 2);

  // ── Build grid of 1x1 cells ──
  const rooms      = [];
  const blobCells  = new Set();
  const cellToRoom = new Map();
  const roomColors = new Map();

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const k = cellKey(x, y);
      blobCells.add(k);
      const roomIdx = rooms.length;
      rooms.push({ cells: [{ x, y, k }], size: 1, cellKeys: new Set([k]) });
      cellToRoom.set(k, roomIdx);

      const hue   = Math.floor(Math.random() * 360);
      const sat   = 18 + Math.floor(Math.random() * 22);
      const lit   = 7  + Math.floor(Math.random() * 5);
      roomColors.set(k, `hsl(${hue},${sat}%,${lit}%)`);
    }
  }

  // ── Start cell ──
  const startKey = cellKey(cx, cy);
  const initOpen         = new Set([startKey]);
  const initEverOpened   = new Set([startKey]);
  const initEverRevealed = new Set([startKey]);

  // ── No removed walls, no internal walls, no fixed walls ──
  const removedWalls      = new Set();
  const internalWalls     = new Set();
  const fixedWalls        = new Set();
  const permanentlyClosed = new Set();
  const disabledCells     = new Set();
  const cellContents      = new Map();

  return {
    level,
    gridSize,
    rooms,
    blobCells,
    openCells:          initOpen,
    removedWalls,
    internalWalls,
    fixedWalls,
    roomColors,
    playerRemovedWalls: 0,
    everRevealedCells:  initEverRevealed,
    everOpenedCells:    initEverOpened,
    permanentlyClosed,
    disabledCells,
    cellContents,
    startCell:          { x: cx, y: cy },
    exitCell:           null,
    upgradeChests:      [],
    spatialChests:      [],
    revealedExit:       false,
    trappedSpiders:     [],
    roomAltars:         [],
    roomBonusAltars:    [],
    roomBonuses:        [],
    purified:           new Set(),
  };
}
