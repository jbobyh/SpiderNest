// ============================================================
// LEVEL GENERATION — pure data, no rendering
// Ported from js/game-state.js :: initState()
// Globals used (loaded by index.html):
//   CONFIG, LEVEL_CONFIG, ROOM_POOLS, UPGRADE_TYPES,
//   LEVEL_WEAPON_COUNTS, LEVEL_UPGRADE_COUNTS, LEVEL_CHEST_COUNTS
// ============================================================

import {
  CELL_PX, CARDINAL_DIRECTIONS,
  cellKey, cellFromKey, wallKey,
  shuffleInPlace, inBounds,
} from './constants.js';

// ── Room size distribution ───────────────────────────────────

const ROOM_SIZE_WEIGHTS = [
  { size: 1, weight: 0.40 },
  { size: 2, weight: 0.30 },
  { size: 3, weight: 0.20 },
  { size: 4, weight: 0.10 },
];

function pickRoomSize() {
  const r = Math.random();
  let acc = 0;
  for (const { size, weight } of ROOM_SIZE_WEIGHTS) {
    acc += weight;
    if (r < acc) return size;
  }
  return 1;
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
    add(centerX + 1, centerY);
    add(centerX,     centerY + 1);
    add(centerX + 1, centerY + 1);
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

function generateRooms(startX, startY, targetCellCount) {
  const rooms        = [];
  const allCells     = new Map(); // cellKey → roomIndex
  const removedWalls = new Set();
  const internalWalls = new Set();

  const startRoom = {
    cells:    [{ x: startX, y: startY, k: cellKey(startX, startY) }],
    size:     1,
    cellKeys: new Set([cellKey(startX, startY)]),
  };
  rooms.push(startRoom);
  allCells.set(cellKey(startX, startY), 0);

  const frontier = [{ x: startX, y: startY }];

  while (allCells.size < targetCellCount && frontier.length > 0) {
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
      placed = true;
      break;
    }

    if (!placed) frontier.splice(idx, 1);
  }

  return { rooms, allCells: new Set(allCells.keys()), removedWalls, internalWalls };
}

// ── Difficulty helpers ───────────────────────────────────────

function cellDistanceFromStart(x, y, startX, startY) {
  return Math.max(Math.abs(x - startX), Math.abs(y - startY));
}

function getDifficultyTier(dist, maxDist) {
  if (maxDist <= 0) return 'easy';
  const third = maxDist / 3;
  if (dist <= third)     return 'easy';
  if (dist <= third * 2) return 'medium';
  return 'hard';
}

function pickRoomPreset(level, poolName) {
  const pools = ROOM_POOLS[level] || ROOM_POOLS[1];
  const pool  = pools[poolName]   || pools.easy;
  return { ...pool[Math.floor(Math.random() * pool.length)] };
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

// ── Enemy creation ───────────────────────────────────────────

const ENEMY_POOL_TYPE_MAP = {
  soldier: 'soldier',
  shooter: 'plevaka',
  bull:    'bull',
  buldyga: 'buldyga',
  cocoon:  'cocoon',
  bloated: 'bloated',
};

function getEnemyStats(enemyType, level) {
  const hpMult = level >= 3 ? 4 : level === 2 ? 2 : 1;
  switch (enemyType) {
    case 'cocoon':  return { hp: CONFIG.COCOON_HP  * hpMult, radius: CONFIG.COCOON_RADIUS,  visualScale: CONFIG.COCOON_VISUAL_SCALE };
    case 'bloated': return { hp: CONFIG.BLOATED_HP * hpMult, radius: CONFIG.BLOATED_RADIUS, visualScale: CONFIG.BLOATED_VISUAL_SCALE };
    case 'bull':    return { hp: CONFIG.BULL_HP    * hpMult, radius: CONFIG.BULL_RADIUS,    visualScale: CONFIG.BULL_VISUAL_SCALE };
    case 'buldyga': return { hp: CONFIG.BULDYGA_HP * hpMult, radius: CONFIG.BULDYGA_RADIUS, visualScale: CONFIG.BULDYGA_VISUAL_SCALE };
    case 'plevaka': return { hp: CONFIG.SHOOTER_HP * hpMult, radius: CONFIG.SPIDER_RADIUS,  visualScale: CONFIG.SHOOTER_VISUAL_SCALE };
    default:        return { hp: CONFIG.SPIDER_HP  * hpMult, radius: CONFIG.SPIDER_RADIUS,  visualScale: CONFIG.SPIDER_VISUAL_SCALE };
  }
}

function createTrappedEnemy(enemyType, gx, gy, homeX, homeY, level) {
  const { hp, radius, visualScale } = getEnemyStats(enemyType, level);
  const isPlevaka = enemyType === 'plevaka' || enemyType === 'shooter';
  return {
    x: gx, y: gy,
    homeX, homeY,
    trapped: true,
    phase:   Math.random() * Math.PI * 2,
    wobble:  CONFIG.SPIDER_WOBBLE_MIN + Math.random() * (CONFIG.SPIDER_WOBBLE_MAX - CONFIG.SPIDER_WOBBLE_MIN),
    vx: 0, vy: 0,
    radius, hp, maxHp: hp, visualScale,
    type:         enemyType,
    shootCd:      0,
    state:        'chase',
    stateTimer:   0,
    dashTargetX:  0, dashTargetY:  0,
    dashDirX:     0, dashDirY:     0,
    dashDistance: 0,
    animState:  isPlevaka ? 'idle' : null,
    animFrame:  isPlevaka ? 0      : null,
    animTimer:  isPlevaka ? 0      : null,
    currentSpeed:      enemyType === 'buldyga' ? CONFIG.BULDYGA_SPEED         : undefined,
    speedAccumulator:  0,
    spawnTimer:        enemyType === 'cocoon'  ? CONFIG.COCOON_SPAWN_INTERVAL : undefined,
  };
}

function spawnEnemiesFromPreset(preset, cellX, cellY, trappedSpiders, level) {
  const margin = CONFIG.SPIDER_RADIUS + CONFIG.SPIDER_SPAWN_MARGIN;
  for (const [configKey, count] of Object.entries(preset)) {
    if (!count) continue;
    const enemyType = ENEMY_POOL_TYPE_MAP[configKey];
    if (!enemyType) continue;
    for (let i = 0; i < count; i++) {
      const gx = cellX * CELL_PX + margin + Math.random() * (CELL_PX - margin * 2);
      const gy = cellY * CELL_PX + margin + Math.random() * (CELL_PX - margin * 2);
      trappedSpiders.push(createTrappedEnemy(enemyType, gx, gy, cellX, cellY, level));
    }
  }
}

// ── Main export ───────────────────────────────────────────────
//
// generateLevel returns pure world data; no player state, no rendering.
// playerProgress is mutated in-place (spawnedWeapons, spawnedUpgrades).

export function generateLevel(level, playerProgress) {
  const levelConfig = LEVEL_CONFIG[level] || LEVEL_CONFIG[3];
  const gridSize    = levelConfig.gridSize;
  const heartsCount = levelConfig.heartsCount;
  const cellCount   = levelConfig.cellCount || gridSize * gridSize;

  const cx = Math.floor(gridSize / 2);
  const cy = Math.floor(gridSize / 2);

  // ── Room generation ──
  const { rooms, allCells: blobCells, removedWalls: roomRemovedWalls, internalWalls: roomInternalWalls }
    = generateRooms(cx, cy, cellCount);

  const disabledCells = new Set();
  const cellContents  = new Map();
  const cellToRoom    = new Map();

  for (let i = 0; i < rooms.length; i++) {
    for (const cell of rooms[i].cells) cellToRoom.set(cell.k, i);
  }

  const availableRooms = [];
  for (let i = 1; i < rooms.length; i++) availableRooms.push(i);
  shuffleInPlace(availableRooms);

  // Max distance for difficulty tiers
  let maxCellDist = 0;
  for (const ri of availableRooms) {
    for (const cell of rooms[ri].cells) {
      const d = cellDistanceFromStart(cell.x, cell.y, cx, cy);
      if (d > maxCellDist) maxCellDist = d;
    }
  }

  function tierForRoom(ri) {
    const cell = rooms[ri].cells[0];
    return getDifficultyTier(cellDistanceFromStart(cell.x, cell.y, cx, cy), maxCellDist);
  }

  function getRoomCenter(ri) {
    const room = rooms[ri];
    let sumX = 0, sumY = 0;
    for (const cell of room.cells) { sumX += cell.x; sumY += cell.y; }
    return {
      x: (sumX / room.cells.length + 0.5) * CELL_PX,
      y: (sumY / room.cells.length + 0.5) * CELL_PX,
    };
  }

  function getCenterCellKey(ri) {
    const room = rooms[ri];
    let sumX = 0, sumY = 0;
    for (const cell of room.cells) { sumX += cell.x; sumY += cell.y; }
    const centerX = Math.floor(sumX / room.cells.length + 0.5);
    const centerY = Math.floor(sumY / room.cells.length + 0.5);
    return cellKey(centerX, centerY);
  }

  function setRoomContent(ri, type, extraFields, preset) {
    for (const cell of rooms[ri].cells) {
      setCellEnemies(cellContents, cell.k, { ...extraFields, type }, preset);
    }
  }

  // ── Summon sphere ──
  let summonSphere = null;
  if (availableRooms.length > 0) {
    const si     = Math.floor(Math.random() * availableRooms.length);
    const ri     = availableRooms.splice(si, 1)[0];
    setRoomContent(ri, 'summonSphere', {}, pickRoomPreset(level, 'key'));
    const center = getRoomCenter(ri);
    summonSphere = { x: center.x, y: center.y, cellKey: getCenterCellKey(ri), collected: false, spawned: true };
  }

  // ── Hearts ──
  const hearts = [];
  const hCount = Math.min(heartsCount, availableRooms.length);
  for (let i = 0; i < hCount; i++) {
    const ri     = availableRooms.shift();
    setRoomContent(ri, 'heart', {}, pickRoomPreset(level, tierForRoom(ri)));
    const center = getRoomCenter(ri);
    hearts.push({ x: center.x, y: center.y, cellKey: getCenterCellKey(ri), collected: false, spawned: true });
  }

  // ── Weapons ──
  const droppedWeapons = [];
  const allWeapons     = ['shotgun', 'smg', 'rifle', 'revolver', 'carbine'];
  const weaponPool     = allWeapons.filter(w => !playerProgress.spawnedWeapons.includes(w));
  shuffleInPlace(weaponPool);
  const targetWeaponCount = LEVEL_WEAPON_COUNTS[level] || 1;
  const weaponCount       = Math.min(targetWeaponCount, availableRooms.length, weaponPool.length);

  let weaponRoomIndices = [];
  if (level === 1) {
    const diagonalOffsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [dx, dy] of diagonalOffsets) {
      const k  = cellKey(cx + dx, cy + dy);
      const ri = cellToRoom.get(k);
      if (ri !== undefined && !rooms[ri].contentSet) weaponRoomIndices.push(ri);
    }
    shuffleInPlace(weaponRoomIndices);
    weaponRoomIndices = weaponRoomIndices.slice(0, weaponCount);
  }

  for (let i = 0; i < weaponCount; i++) {
    let ri;
    if (level === 1 && i < weaponRoomIndices.length) {
      ri = weaponRoomIndices[i];
      const idx = availableRooms.indexOf(ri);
      if (idx >= 0) availableRooms.splice(idx, 1);
    } else {
      if (availableRooms.length === 0) break;
      ri = availableRooms.shift();
    }
    if (ri === undefined) continue;
    const weaponId = weaponPool[i];
    const center   = getRoomCenter(ri);
    droppedWeapons.push({ x: center.x, y: center.y, weaponId, cellKey: getCenterCellKey(ri) });
    playerProgress.spawnedWeapons.push(weaponId);
    for (const cell of rooms[ri].cells) cellContents.set(cell.k, { type: 'weapon', weaponId });
  }

  // ── Upgrades ──
  const upgradeObjs     = [];
  const targetUpgCount  = LEVEL_UPGRADE_COUNTS[level] || 4;
  const availUpgrades   = [];
  for (const upg of UPGRADE_TYPES) {
    const spawnedCount = playerProgress.spawnedUpgrades[upg.id] || 0;
    for (let i = 0; i < upg.max - spawnedCount; i++) availUpgrades.push(upg.id);
  }
  shuffleInPlace(availUpgrades);

  const uniqueUpgrades   = [];
  const usedInThisLevel  = new Set();
  for (const upgId of availUpgrades) {
    if (usedInThisLevel.has(upgId)) continue;
    usedInThisLevel.add(upgId);
    uniqueUpgrades.push(upgId);
    if (uniqueUpgrades.length >= targetUpgCount) break;
  }
  for (const upgId of uniqueUpgrades) {
    playerProgress.spawnedUpgrades[upgId] = (playerProgress.spawnedUpgrades[upgId] || 0) + 1;
  }

  const upgsCount = Math.min(uniqueUpgrades.length, availableRooms.length);
  for (let i = 0; i < upgsCount; i++) {
    const ri    = availableRooms.shift();
    const upgId = uniqueUpgrades[i];
    setRoomContent(ri, 'upgrade', { upgradeType: upgId }, pickRoomPreset(level, 'simpleupgrade'));
    const center = getRoomCenter(ri);
    upgradeObjs.push({
      x: center.x, y: center.y,
      cellKey:     getCenterCellKey(ri),
      upgradeType: upgId,
      collected:   false,
      spawned:     true,
    });
  }

  // ── Cursed chests ──
  const chestObjs  = [];
  const chestCount = Math.min(LEVEL_CHEST_COUNTS[level] || 1, availableRooms.length);
  for (let i = 0; i < chestCount; i++) {
    const ri = availableRooms.shift();
    if (ri === undefined) break;
    setRoomContent(ri, 'chest', {}, pickRoomPreset(level, 'cursedupgrade'));
    const center = getRoomCenter(ri);
    chestObjs.push({ x: center.x, y: center.y, cellKey: getCenterCellKey(ri), collected: false, spawned: true });
  }

  // ── Enemy rooms ──
  const enemyRoomCount = Math.floor(availableRooms.length * CONFIG.ENEMY_SPAWN_CHANCE);
  shuffleInPlace(availableRooms);
  for (let i = 0; i < enemyRoomCount; i++) {
    const ri = availableRooms.shift();
    setRoomContent(ri, 'enemies', {}, pickRoomPreset(level, tierForRoom(ri)));
  }

  // ── Remaining rooms → empty ──
  for (const ri of availableRooms) {
    for (const cell of rooms[ri].cells) cellContents.set(cell.k, { type: 'empty' });
  }

  // ── Hide spawned items in enemy rooms ──
  for (const h of hearts) {
    const ri = cellToRoom.get(h.cellKey);
    if (ri !== undefined) {
      const room = rooms[ri];
      for (const cell of room.cells) {
        const c = cellContents.get(cell.k);
        if (c && c.enemyCount > 0) { h.spawned = false; break; }
      }
    }
  }
  for (const u of upgradeObjs) {
    const ri = cellToRoom.get(u.cellKey);
    if (ri !== undefined) {
      const room = rooms[ri];
      for (const cell of room.cells) {
        const c = cellContents.get(cell.k);
        if (c && c.enemyCount > 0) { u.spawned = false; break; }
      }
    }
  }
  for (const c of chestObjs) {
    const ri = cellToRoom.get(c.cellKey);
    if (ri !== undefined) {
      const room = rooms[ri];
      for (const cell of room.cells) {
        const cont = cellContents.get(cell.k);
        if (cont && cont.enemyCount > 0) { c.spawned = false; break; }
      }
    }
  }
  if (summonSphere) {
    const ri = cellToRoom.get(summonSphere.cellKey);
    if (ri !== undefined) {
      const room = rooms[ri];
      for (const cell of room.cells) {
        const c = cellContents.get(cell.k);
        if (c && c.enemyCount > 0) { summonSphere.spawned = false; break; }
      }
    }
  }

  // ── Spawn trapped enemies ──
  const trappedSpiders   = [];
  const processedRooms   = new Set();
  for (const [k, content] of cellContents) {
    if (!content.enemyPreset || content.enemyCount <= 0) continue;
    const ri = cellToRoom.get(k);
    if (ri === undefined || processedRooms.has(ri)) continue;
    processedRooms.add(ri);
    const { x: spawnX, y: spawnY } = cellFromKey(getCenterCellKey(ri));
    spawnEnemiesFromPreset(content.enemyPreset, spawnX, spawnY, trappedSpiders, level);
  }

  // ── Initial visibility ──
  const initOpen         = new Set([cellKey(cx, cy)]);
  const initEverOpened   = new Set([cellKey(cx, cy)]);
  const initEverRevealed = new Set([cellKey(cx, cy)]);
  for (const cell of rooms[0].cells) initEverRevealed.add(cell.k);
  for (const [dx, dy] of CARDINAL_DIRECTIONS) {
    const nk = cellKey(cx + dx, cy + dy);
    if (!disabledCells.has(nk)) initEverRevealed.add(nk);
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

  // ── Room altars (battle triggers) ──
  const roomAltars        = [];
  const altarProcessed    = new Set();
  for (const [k, content] of cellContents) {
    if (!content.enemyPreset || content.enemyCount <= 0 || content.enemiesReleased) continue;
    const ri = cellToRoom.get(k);
    if (ri === undefined || altarProcessed.has(ri)) continue;
    altarProcessed.add(ri);
    const centerKey     = getCenterCellKey(ri);
    const { x: acx, y: acy } = cellFromKey(centerKey);
    roomAltars.push({
      roomIdx:   ri,
      x:         (acx + 0.5) * CELL_PX,
      y:         (acy + 0.5) * CELL_PX,
      cellKey:   centerKey,
      activated: false,
    });
  }

  return {
    level,
    gridSize,
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
    hearts,
    heartsCollected:    0,
    summonSphere,
    summonSphereCollected: false,
    upgradeObjs,
    chestObjs,
    revealedExit:       false,
    droppedWeapons,
    trappedSpiders,
    roomAltars,
  };
}
