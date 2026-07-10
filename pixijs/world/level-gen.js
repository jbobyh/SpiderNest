// ============================================================
// LEVEL GENERATION — pure data, no rendering
// Ported from js/game-state.js :: initState()
// Globals used (loaded by index.html):
//   CONFIG (incl. ENEMY_COSTS, ROOM_ENEMY_BUDGET, ROOM_CONTENT_BUDGET_MULT,
//           ENEMY_SPAWN_TABLE), LEVEL_CONFIG, UPGRADE_TYPES
// ============================================================

import {
  CELL_PX, CARDINAL_DIRECTIONS,
  cellKey, cellFromKey, wallKey,
  shuffleInPlace, inBounds,
} from './constants.js';
import { EnemyFactory } from '../game/enemy-factory.js';

// ── Room content types ───────────────────────────────────────

const ROOM_TYPES = {
  START:         'start',
  SUMMON_SPHERE: 'summonSphere',
  ROOM_BONUS:    'roomBonus',
  WEAPON:        'weapon',
  HEART:         'heart',
  CHEST:         'chest',
  SPATIAL_CHEST: 'spatial',
  ENEMY:         'enemies',
  EMPTY:         'empty',
};

// ── Room size distribution ───────────────────────────────────

function buildRoomQuotaList(roomQuotas, targetRoomCount) {
  const q = roomQuotas || { size4: 1, size3: 2, size2: 3 };
  const sizes = [];
  
  // Total rooms to generate (excluding Room 0 which is always size 1)
  const remainingRooms = targetRoomCount - 1;

  for (let i = 0; i < (q.size4 || 0); i++) sizes.push(4);
  for (let i = 0; i < (q.size3 || 0); i++) sizes.push(3);
  for (let i = 0; i < (q.size2 || 0); i++) sizes.push(2);

  // If we have more quotas than rooms, truncate
  if (sizes.length > remainingRooms) {
    sizes.splice(remainingRooms);
  } else {
    // Fill the rest with size-1 rooms
    const singleCount = remainingRooms - sizes.length;
    for (let i = 0; i < singleCount; i++) sizes.push(1);
  }

  shuffleInPlace(sizes);
  return sizes;
}

// ── Room shape generation ────────────────────────────────────

function generateRoomShape(centerX, centerY, size) {
  const cells = [];
  const seen  = new Set();

  function add(x, y) {
    const k = cellKey(x, y);
    if (!seen.has(k)) { seen.add(k); cells.push({ x, y, k }); }
  }

  add(centerX, centerY);

  if (size === 2) {
    if (Math.random() < 0.5) add(centerX + 1, centerY);
    else add(centerX, centerY + 1);
    return cells;
  }

  if (size === 3) {
    if (Math.random() < 0.5) {
      // straight line
      if (Math.random() < 0.5) { add(centerX - 1, centerY); add(centerX + 1, centerY); }
      else                     { add(centerX, centerY - 1); add(centerX, centerY + 1); }
    } else {
      // L-shape
      switch (Math.floor(Math.random() * 4)) {
        case 0: add(centerX + 1, centerY); add(centerX, centerY + 1); break;
        case 1: add(centerX + 1, centerY); add(centerX, centerY - 1); break;
        case 2: add(centerX - 1, centerY); add(centerX, centerY + 1); break;
        case 3: add(centerX - 1, centerY); add(centerX, centerY - 1); break;
      }
    }
    return cells;
  }

  if (size === 4) {
    const shape = Math.floor(Math.random() * 3); // 0 = square, 1 = L, 2 = T

    if (shape === 0) {
      // Square: 2x2 block anchored at top-left
      add(centerX + 1, centerY);
      add(centerX,     centerY + 1);
      add(centerX + 1, centerY + 1);
    } else if (shape === 1) {
      // L-shape: straight line of 3 + one cell attached to an end
      const horizontal = Math.random() < 0.5;
      if (horizontal) {
        add(centerX - 1, centerY);
        add(centerX + 1, centerY);
        if (Math.random() < 0.5) add(centerX - 1, centerY + 1);
        else                     add(centerX - 1, centerY - 1);
      } else {
        add(centerX, centerY - 1);
        add(centerX, centerY + 1);
        if (Math.random() < 0.5) add(centerX + 1, centerY - 1);
        else                     add(centerX - 1, centerY - 1);
      }
    } else {
      // T-shape: straight line of 3 + one cell attached to the middle cell
      const horizontal = Math.random() < 0.5;
      if (horizontal) {
        add(centerX - 1, centerY);
        add(centerX + 1, centerY);
        if (Math.random() < 0.5) add(centerX, centerY + 1);
        else                     add(centerX, centerY - 1);
      } else {
        add(centerX, centerY - 1);
        add(centerX, centerY + 1);
        if (Math.random() < 0.5) add(centerX + 1, centerY);
        else                     add(centerX - 1, centerY);
      }
    }

    return cells;
  }

  return cells; // size === 1
}

function getInternalWalls(cells) {
  const walls   = [];
  const cellSet = new Set(cells.map(c => c.k));
  for (const { x, y } of cells) {
    if (cellSet.has(cellKey(x + 1, y))) walls.push(wallKey(x, y, x + 1, y));
    if (cellSet.has(cellKey(x, y + 1))) walls.push(wallKey(x, y, x, y + 1));
  }
  return walls;
}

// ── BFS room expansion ───────────────────────────────────────

function generateRoomsRandom(targetRoomCount, roomQuotas) {
  const rooms        = [];
  const allCells     = new Map(); // cellKey → roomIndex
  const removedWalls = new Set();
  const internalWalls = new Set();

  const sizes    = buildRoomQuotaList(roomQuotas, targetRoomCount);
  let nextIdx    = 0;

  function pickRoomSize() {
    if (nextIdx < sizes.length) return sizes[nextIdx];
    return 1;
  }

  // Start Room (always 1-cell, always at the left-most possible position relative to growth)
  const startX = 0, startY = 0;
  const startRoom = {
    cells:    [{ x: startX, y: startY, k: cellKey(startX, startY) }],
    size:     1,
    cellKeys: new Set([cellKey(startX, startY)]),
  };
  rooms.push(startRoom);
  allCells.set(cellKey(startX, startY), 0);

  const frontier = [{ x: startX, y: startY }];

  while (rooms.length < targetRoomCount && frontier.length > 0) {
    const idx       = Math.floor(Math.random() * frontier.length);
    const { x, y } = frontier[idx];
    const dirs      = shuffleInPlace([...CARDINAL_DIRECTIONS]);
    let placed      = false;

    for (const [dx, dy] of dirs) {
      const size      = pickRoomSize();
      const roomCells = generateRoomShape(x + dx, y + dy, size);

      let allFree = true;
      for (const cell of roomCells) {
        if (allCells.has(cell.k)) { allFree = false; break; }
      }

      if (!allFree || roomCells.length === 0) continue;

      // At least one cell must border an existing cell
      let hasAdj = false;
      outer: for (const cell of roomCells) {
        for (const [ndx, ndy] of CARDINAL_DIRECTIONS) {
          if (allCells.has(cellKey(cell.x + ndx, cell.y + ndy))) { hasAdj = true; break outer; }
        }
      }

      if (!hasAdj && roomCells.length > 1) continue;

      const roomIndex = rooms.length;
      const cellKeys  = new Set();
      for (const cell of roomCells) { cellKeys.add(cell.k); allCells.set(cell.k, roomIndex); }

      const roomInternal = getInternalWalls(roomCells);
      for (const w of roomInternal) { removedWalls.add(w); internalWalls.add(w); }

      rooms.push({ cells: roomCells, size: roomCells.length, cellKeys });
      for (const cell of roomCells) frontier.push({ x: cell.x, y: cell.y });
      nextIdx++;
      placed = true;
      break;
    }

    if (!placed) frontier.splice(idx, 1);
  }

  return { rooms, allCells: new Set(allCells.keys()), removedWalls, internalWalls };
}

function generateRoomsGrid(targetRoomCount, roomQuotas, torchMode = false) {
  const sizes = buildRoomQuotaList(roomQuotas, targetRoomCount);
  const totalCellsNeeded = 1 + sizes.reduce((sum, s) => sum + s, 0);
  
  // Calculate W x H rectangle (min dimension 5)
  let h = 5;
  let w = Math.ceil(totalCellsNeeded / h);
  if (w < 5) { w = 5; h = Math.ceil(totalCellsNeeded / w); }

  const totalCells = w * h;
  const rooms = [];
  const allCells = new Map(); // cellKey -> roomIndex
  const removedWalls = new Set();
  const internalWalls = new Set();

  // 1. Place Start Room (left edge, center row)
  const startX = 0;
  const startY = Math.floor(h / 2);
  const startRoom = {
    cells: [{ x: startX, y: startY, k: cellKey(startX, startY) }],
    size: 1,
    cellKeys: new Set([cellKey(startX, startY)]),
  };
  rooms.push(startRoom);
  allCells.set(cellKey(startX, startY), 0);

  // 2. Fill remaining grid
  const quota = [...sizes];
  
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const k = cellKey(x, y);
      if (allCells.has(k)) continue;

      let size = quota.length > 0 ? quota.shift() : 1;
      let roomCells = [];

      if (size === 1) {
        roomCells = [{ x, y, k }];
      } else {
        // Find connected free cells within the rectangle bounds
        roomCells = [{ x, y, k }];
        const queue = [{ x, y }];
        const seenInSearch = new Set([k]);

        while (roomCells.length < size && queue.length > 0) {
          const curr = queue.shift();
          const dirs = shuffleInPlace([...CARDINAL_DIRECTIONS]);
          for (const [dx, dy] of dirs) {
            const nx = curr.x + dx, ny = curr.y + dy;
            const nk = cellKey(nx, ny);
            if (nx >= 0 && nx < w && ny >= 0 && ny < h && !allCells.has(nk) && !seenInSearch.has(nk)) {
              seenInSearch.add(nk);
              roomCells.push({ x: nx, y: ny, k: nk });
              queue.push({ x: nx, y: ny });
              if (roomCells.length === size) break;
            }
          }
        }
        
        // If we couldn't find enough cells, the room will just be smaller
        // (the extra "size" is effectively lost, but subsequent 1-cell fills will handle it)
      }

      const roomIndex = rooms.length;
      const cellKeys = new Set();
      for (const cell of roomCells) { 
        cellKeys.add(cell.k); 
        allCells.set(cell.k, roomIndex); 
      }
      
      if (!torchMode) {
        const roomInternal = getInternalWalls(roomCells);
        for (const wKey of roomInternal) { 
          removedWalls.add(wKey); 
          internalWalls.add(wKey); 
        }
      }

      rooms.push({ cells: roomCells, size: roomCells.length, cellKeys });
    }
  }

  // Torch mode: all inter-cell walls are removed (open space)
  if (torchMode) {
    for (const k of allCells.keys()) {
      const { x, y } = cellFromKey(k);
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nk = cellKey(x + dx, y + dy);
        if (allCells.has(nk)) {
          removedWalls.add(wallKey(x, y, x + dx, y + dy));
        }
      }
    }
  }

  return { rooms, allCells: new Set(allCells.keys()), removedWalls, internalWalls };
}

// ── Difficulty helpers ───────────────────────────────────────
//
// Сложность комнаты теперь считается по бюджету врагов:
//   budget(cells) = base * growthRate^(cells-1), затем * levelMult * contentMult
// Это выпуклая (нелинейная) кривая — большие комнаты ощутимо опаснее.
// Дистанция от старта больше не влияет (раньше был easy/medium/hard тир).

// Сопоставление типа содержимого комнаты → ключ множителя бюджета.
// weapon/empty/start здесь нет намеренно (там нет врагов → множитель 0).
const CONTENT_BUDGET_KEY = {
  [ROOM_TYPES.SUMMON_SPHERE]: 'summonSphere',
  [ROOM_TYPES.ROOM_BONUS]:    'roomBonus',
  [ROOM_TYPES.HEART]:         'heart',
  [ROOM_TYPES.CHEST]:         'chest',
  [ROOM_TYPES.SPATIAL_CHEST]: 'spatial',
  [ROOM_TYPES.ENEMY]:         'enemies',
};

function roomEnemyBudget(level, roomType, cellCount) {
  const multKey = CONTENT_BUDGET_KEY[roomType];
  if (!multKey) return 0; // start / weapon / empty — без врагов

  const cfg = CONFIG.ROOM_ENEMY_BUDGET;
  const levelMult = (cfg.levelMult[level] ?? cfg.levelMult[3]) || 1;
  const contentMult = CONFIG.ROOM_CONTENT_BUDGET_MULT[multKey] ?? 1;

  const raw = cfg.base * Math.pow(cfg.growthRate, Math.max(0, cellCount - 1));
  return Math.round(raw * levelMult * contentMult);
}

// Жадный взвешенный выбор состава врагов под заданный бюджет.
// Возвращает объект { enemyKey: count, ... } (ключи — как в ENEMY_COSTS).
function generateRoomEnemyComposition(level, roomType, cellCount) {
  const budget = roomEnemyBudget(level, roomType, cellCount);
  if (budget <= 0) return {};

  const costs  = CONFIG.ENEMY_COSTS;
  const table  = CONFIG.ENEMY_SPAWN_TABLE[level] || CONFIG.ENEMY_SPAWN_TABLE[3];
  const maxByCells = cellCount * (CONFIG.ROOM_ENEMY_BUDGET.maxEnemiesPerCell || 8);
  const maxTotal   =  CONFIG.ROOM_ENEMY_BUDGET.maxEnemiesTotal || 32;
  const maxEnemies = Math.min(maxByCells, maxTotal);

  // Доступные типы (цена ≤ бюджета), отсортированные по цене (дорогие — в конце).
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
    // Берём только тех, кого ещё можно себе позволить.
    const affordable = candidates.filter(c => c.cost <= remaining);
    if (affordable.length === 0) break;

    // Взвешенный случайный выбор: дешёвые «базовые» враги выпадают чаще, элита — реже.
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

function setCellEnemies(cellContents, key, contentFields, preset) {
  cellContents.set(key, {
    ...contentFields,
    enemyPreset:     preset,
    enemyCount:      countEnemiesInPreset(preset),
    enemiesReleased: false,
    enemies:         [],
  });
}

function getRoomCenter(room) {
  let sumX = 0, sumY = 0;
  for (const cell of room.cells) { sumX += cell.x; sumY += cell.y; }
  return {
    x: (sumX / room.cells.length + 0.5) * CELL_PX,
    y: (sumY / room.cells.length + 0.5) * CELL_PX,
  };
}

function getCenterCellKey(room) {
  let sumX = 0, sumY = 0;
  for (const cell of room.cells) { sumX += cell.x; sumY += cell.y; }
  const centerX = Math.floor(sumX / room.cells.length + 0.5);
  const centerY = Math.floor(sumY / room.cells.length + 0.5);
  return cellKey(centerX, centerY);
}

function assignRoomContents(level, rooms, availableRooms, playerProgress, cx, cy, cellToRoom) {
  const levelConfig = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
  const content = levelConfig.content;
  const assignments = new Map();

  assignments.set(0, ROOM_TYPES.START);

  // 1. Room Bonuses (Strict size requirement: 3-4 cells)
  // We do this FIRST to ensure they get the large rooms before anything else
  let bonusesToPlace = content.bonuses || 0;
  const largeRoomIndices = availableRooms.filter(ri => rooms[ri].size >= 3);
  shuffleInPlace(largeRoomIndices);
  
  while (bonusesToPlace > 0 && largeRoomIndices.length > 0) {
    const ri = largeRoomIndices.shift();
    assignments.set(ri, ROOM_TYPES.ROOM_BONUS);
    availableRooms.splice(availableRooms.indexOf(ri), 1);
    bonusesToPlace--;
  }
  // Fallback: if we still need bonuses but ran out of large rooms, 
  // we must place them in any room to satisfy the "full size" rule.
  while (bonusesToPlace > 0 && availableRooms.length > 0) {
    const ri = availableRooms.shift();
    assignments.set(ri, ROOM_TYPES.ROOM_BONUS);
    bonusesToPlace--;
  }

  // 2. Summon Sphere (Critical)
  if (availableRooms.length > 0) {
    const ri = availableRooms.shift();
    assignments.set(ri, ROOM_TYPES.SUMMON_SPHERE);
  }

  // 3. Weapons (Level 1 special rule)
  let weaponCount = content.weapons || 0;
  if (level === 1) {
    const diagonalOffsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    const weaponCandidates = [];
    for (const [dx, dy] of diagonalOffsets) {
      const k = cellKey(cx + dx, cy + dy);
      const ri = cellToRoom.get(k);
      if (ri !== undefined && !assignments.has(ri)) {
        weaponCandidates.push(ri);
      }
    }
    shuffleInPlace(weaponCandidates);
    const count = Math.min(weaponCount, weaponCandidates.length);
    for (let i = 0; i < count; i++) {
      const ri = weaponCandidates[i];
      assignments.set(ri, ROOM_TYPES.WEAPON);
      const idx = availableRooms.indexOf(ri);
      if (idx !== -1) availableRooms.splice(idx, 1);
    }
    weaponCount -= count;
  }

  // General weapon placement
  for (let i = 0; i < weaponCount && availableRooms.length > 0; i++) {
    assignments.set(availableRooms.shift(), ROOM_TYPES.WEAPON);
  }

  // 4. Specialized Rooms (distributed to remaining available rooms)
  const placeType = (type, count) => {
    let placed = 0;
    while (placed < count && availableRooms.length > 0) {
      assignments.set(availableRooms.shift(), type);
      placed++;
    }
  };

  placeType(ROOM_TYPES.HEART, content.hearts);
  placeType(ROOM_TYPES.CHEST, content.upgrades);
  placeType(ROOM_TYPES.SPATIAL_CHEST, content.cursed);

  // 4. Combat Fill
  const combatRoomCount = Math.floor(availableRooms.length * content.enemyRoomPercent);
  for (let i = 0; i < combatRoomCount && availableRooms.length > 0; i++) {
    assignments.set(availableRooms.shift(), ROOM_TYPES.ENEMY);
  }

  // 5. Default Empty
  while (availableRooms.length > 0) {
    assignments.set(availableRooms.shift(), ROOM_TYPES.EMPTY);
  }

  return assignments;
}

function applyRoomContent(ri, type, level, rooms, levelState, playerProgress, weaponPool) {
  const room = rooms[ri];
  const center = getRoomCenter(room);
  const centerKey = getCenterCellKey(room);

  // Единая композиция врагов по бюджету (ячейки × уровень × тип содержимого).
  // Для start/weapon/empty вернёт {} — врагов не будет.
  const preset = generateRoomEnemyComposition(level, type, room.cells.length);

  // Default cell contents setup
  const setCells = (contentFields) => {
    for (const cell of room.cells) {
      if (Object.keys(preset).length > 0) {
        setCellEnemies(levelState.cellContents, cell.k, { ...contentFields, type }, preset);
      } else {
        levelState.cellContents.set(cell.k, { ...contentFields, type });
      }
    }
  };

  switch (type) {
    case ROOM_TYPES.START:
      setCells({ type: 'empty' });
      break;

    case ROOM_TYPES.SUMMON_SPHERE: {
      setCells({});
      levelState.summonSphere = { x: center.x, y: center.y, cellKey: centerKey, collected: false, spawned: false };
      break;
    }

    case ROOM_TYPES.ROOM_BONUS: {
      setCells({});
      levelState.roomBonusAltars.push({
        roomIdx: ri, x: center.x, y: center.y, cellKey: centerKey, activated: false, bonusType: null,
      });
      break;
    }

    case ROOM_TYPES.WEAPON: {
      const weaponId = weaponPool.shift();
      if (weaponId) {
        setCells({ weaponId });
        levelState.droppedWeapons.push({ x: center.x, y: center.y, weaponId, cellKey: centerKey });
        playerProgress.spawnedWeapons.push(weaponId);
      } else {
        setCells({ type: 'empty' });
      }
      break;
    }

    case ROOM_TYPES.HEART: {
      setCells({});
      levelState.hearts.push({ x: center.x, y: center.y, cellKey: centerKey, collected: false, spawned: false });
      break;
    }

    case ROOM_TYPES.CHEST: {
      setCells({});
      levelState.upgradeChests.push({ x: center.x, y: center.y, cellKey: centerKey, collected: false, spawned: true });
      break;
    }

    case ROOM_TYPES.SPATIAL_CHEST: {
      setCells({});
      levelState.spatialChests.push({ x: center.x, y: center.y, cellKey: centerKey, collected: false, spawned: true });
      break;
    }

    case ROOM_TYPES.ENEMY: {
      setCells({});
      break;
    }

    case ROOM_TYPES.EMPTY:
    default:
      setCells({ type: 'empty' });
      break;
  }
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

// ── Main export ───────────────────────────────────────────────
//
// generateLevel returns pure world data; no player state, no rendering.
// playerProgress is mutated in-place (spawnedWeapons, spawnedUpgrades).

export function generateLevel(level, playerProgress) {
  const levelConfig = LEVEL_CONFIG[level] || LEVEL_CONFIG[3];
  const roomCount   = levelConfig.roomCount || 25;

  // ── Room generation ──
  let levelData = null;
  const maxAttempts = CONFIG.MAX_GENERATION_ATTEMPTS || 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (levelConfig.genType === 'grid') {
      levelData = generateRoomsGrid(roomCount, levelConfig.roomQuotas, levelConfig.torchMode);
    } else {
      levelData = generateRoomsRandom(roomCount, levelConfig.roomQuotas);
    }
    if (levelData.rooms.length >= roomCount) break;
  }
  
  if (!levelData || levelData.rooms.length < roomCount) {
    throw new Error(`Failed to generate level ${level} after ${maxAttempts} attempts`);
  }
  
  const { rooms, allCells: blobCells, removedWalls: roomRemovedWalls, internalWalls: roomInternalWalls } = levelData;

  // Start position is always the first cell of Room 0
  const cx = rooms[0].cells[0].x;
  const cy = rooms[0].cells[0].y;

  const disabledCells = new Set();
  const cellContents  = new Map();
  const cellToRoom    = new Map();

  for (let i = 0; i < rooms.length; i++) {
    for (const cell of rooms[i].cells) cellToRoom.set(cell.k, i);
  }

  const availableRooms = [];
  for (let i = 1; i < rooms.length; i++) availableRooms.push(i);
  shuffleInPlace(availableRooms);

  // ── Room content assignment ──
  const allWeapons = ['shotgun', 'smg', 'rifle', 'revolver', 'carbine'];
  const weaponPool = allWeapons.filter(w => !playerProgress.spawnedWeapons.includes(w));
  shuffleInPlace(weaponPool);

  const levelState = {
    cellContents,
    hearts: [],
    summonSphere: null,
    upgradeChests: [],
    spatialChests: [],
    droppedWeapons: [],
    roomBonusAltars: [],
    roomBonuses: [],
  };

  const assignments = assignRoomContents(level, rooms, [...availableRooms], playerProgress, cx, cy, cellToRoom);

  for (const [ri, type] of assignments.entries()) {
    applyRoomContent(ri, type, level, rooms, levelState, playerProgress, weaponPool);
  }

  // ── Purified: torch mode = all rooms purified (no wall mechanics); else start only ──
  const purified = levelConfig.torchMode ? new Set(rooms.map((_, i) => i)) : new Set([0]);

  // ── Torch mode: all collectibles spawned immediately (no purification) ──
  if (levelConfig.torchMode) {
    for (const heart of levelState.hearts) heart.spawned = true;
    if (levelState.summonSphere) levelState.summonSphere.spawned = true;
  }

  // ── Spawn stasis enemies ──
  const trappedSpiders   = [];
  const processedRooms   = new Set();
  for (const [k, content] of cellContents) {
    if (!content.enemyPreset || content.enemyCount <= 0) continue;
    const ri = cellToRoom.get(k);
    if (ri === undefined || processedRooms.has(ri)) continue;
    processedRooms.add(ri);
    spawnEnemiesFromPreset(content.enemyPreset, rooms[ri].cells, trappedSpiders, level, ri);
  }

  // ── Initial visibility ──
  const startKey = cellKey(cx, cy);
  // Torch mode: all cells open and revealed (no fog-of-war, darkness is dynamic)
  const initOpen         = levelConfig.torchMode ? new Set(blobCells) : new Set([startKey]);
  const initEverOpened   = levelConfig.torchMode ? new Set(blobCells) : new Set([startKey]);
  const initEverRevealed = levelConfig.torchMode ? new Set(blobCells) : new Set([startKey]);
  if (!levelConfig.torchMode) {
    for (const cell of rooms[0].cells) initEverRevealed.add(cell.k);
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nk = cellKey(cx + dx, cy + dy);
      if (blobCells.has(nk)) initEverRevealed.add(nk);
    }
  }

  // ── Room background colours ──
  const roomColors = new Map();
  for (let i = 0; i < rooms.length; i++) {
    const hue   = Math.floor(Math.random() * 360);
    const sat   = 18 + Math.floor(Math.random() * 22);
    const lit   = 7  + Math.floor(Math.random() * 5);
    const color = `hsl(${hue},${sat}%,${lit}%)`;
    for (const cell of rooms[i].cells) roomColors.set(cell.k, color);
  }

  // ── Room altars (battle triggers) — skipped in torch mode ──
  const roomAltars        = [];
  if (!levelConfig.torchMode) {
    const altarProcessed    = new Set();
    for (const [k, content] of cellContents) {
      if (!content.enemyPreset || content.enemyCount <= 0 || content.enemiesReleased) continue;
      if (content.type === ROOM_TYPES.CHEST || content.type === ROOM_TYPES.SPATIAL_CHEST || content.type === ROOM_TYPES.ROOM_BONUS) continue;
      const ri = cellToRoom.get(k);
      if (ri === undefined || altarProcessed.has(ri)) continue;
      altarProcessed.add(ri);
      const centerKey     = getCenterCellKey(rooms[ri]);
      const { x: acx, y: acy } = cellFromKey(centerKey);
      roomAltars.push({
        roomIdx:   ri,
        x:         (acx + 0.5) * CELL_PX,
        y:         (acy + 0.5) * CELL_PX,
        cellKey:   centerKey,
        activated: false,
      });
    }
  }

  // Determine effective gridSize for legacy support (max dimension)
  let minX = cx, maxX = cx, minY = cy, maxY = cy;
  for (const k of blobCells) {
    const { x, y } = cellFromKey(k);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const effectiveGridSize = Math.max(maxX - minX + 1, maxY - minY + 1);

  return {
    level,
    gridSize:           effectiveGridSize,
    rooms,
    blobCells,
    openCells:          initOpen,
    removedWalls:       roomRemovedWalls,
    internalWalls:      roomInternalWalls,
    roomColors,
    playerRemovedWalls: 0,
    everRevealedCells:  initEverRevealed,
    everOpenedCells:    initEverOpened,
    permanentlyClosed:  new Set(),
    disabledCells,
    cellContents,
    startCell:          { x: cx, y: cy },
    exitCell:           null,
    hearts:             levelState.hearts,
    heartsCollected:    0,
    summonSphere:       levelState.summonSphere,
    summonSphereCollected: false,
    upgradeChests:      levelState.upgradeChests,
    spatialChests:      levelState.spatialChests,
    revealedExit:       false,
    droppedWeapons:     levelState.droppedWeapons,
    trappedSpiders,
    roomAltars,
    roomBonusAltars:    levelState.roomBonusAltars,
    roomBonuses:        levelState.roomBonuses,
    purified,
    torchMode:          !!levelConfig.torchMode,
  };
}
