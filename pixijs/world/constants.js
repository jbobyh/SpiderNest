// ============================================================
// WORLD CONSTANTS & COORDINATE UTILITIES
// ============================================================

export const CELL_PX           = 126; // physical cell size in pixels (drives physics & collision)

export const FLOOR_TILES_PER_CELL = 5;                           // how many floor tiles fill one cell (render only)
export const FLOOR_TILE_PX        = CELL_PX / FLOOR_TILES_PER_CELL;

export const TILES_PER_CELL    = FLOOR_TILES_PER_CELL;           // alias
export const SUBCELLS_PER_CELL = FLOOR_TILES_PER_CELL;           // alias
export const SUBCELL_PX        = FLOOR_TILE_PX;                  // alias

export const CARDINAL_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIAGONAL_DIRECTIONS = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
export const WALL_DIRECTIONS     = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export const SHIFT_STEP = 3; // sub-cells shifted per life spent on wall expansion

// ── Cell coordinate helpers ──────────────────────────────────

export function cellKey(x, y)    { return `${x},${y}`; }
export function cellFromKey(k)   { if (!k) return { x: 0, y: 0 }; const [x, y] = k.split(','); return { x: +x, y: +y }; }
export function cellOf(wx, wy)   { return { x: Math.floor(wx / CELL_PX), y: Math.floor(wy / CELL_PX) }; }
export function inBounds(x, y)   { return x >= -100 && x < 200 && y >= -100 && y < 200; }

// Sub-cell position within a cell (0..8 in each axis)
export function subCellOf(wx, wy) {
  const cellX  = Math.floor(wx / CELL_PX);
  const cellY  = Math.floor(wy / CELL_PX);
  const localX = wx - cellX * CELL_PX;
  const localY = wy - cellY * CELL_PX;
  return { cellX, cellY, subX: Math.floor(localX / SUBCELL_PX), subY: Math.floor(localY / SUBCELL_PX) };
}

// ── Wall key helpers ─────────────────────────────────────────
// Normalised so the cell with smaller (x, then y) is always first.

export function wallKey(ax, ay, bx, by) {
  if (ax > bx || (ax === bx && ay > by)) return `${bx},${by}|${ax},${ay}`;
  return `${ax},${ay}|${bx},${by}`;
}

export function wallKeyFromStr(wk) {
  const [left, right] = wk.split('|');
  const [ax, ay] = left.split(',').map(Number);
  const [bx, by] = right.split(',').map(Number);
  return { ax, ay, bx, by };
}

// ── Spatial queries ──────────────────────────────────────────

// BFS: open cells reachable from seedKey by crossing removedWalls inside blobCells
export function recomputeOpenCells(blobCells, removedWalls, seedKey) {
  const open  = new Set([seedKey]);
  const queue = [seedKey];
  while (queue.length) {
    const k    = queue.shift();
    const { x, y } = cellFromKey(k);
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nx = x + dx, ny = y + dy;
      const nk = cellKey(nx, ny);
      if (!blobCells.has(nk) || open.has(nk)) continue;
      if (removedWalls.has(wallKey(x, y, nx, ny))) { open.add(nk); queue.push(nk); }
    }
  }
  return open;
}

// BFS: flood-fill within openCells from startKey
export function getConnectedCells(openCells, startKey) {
  const connected = new Set([startKey]);
  const queue     = [startKey];
  while (queue.length) {
    const k    = queue.shift();
    const { x, y } = cellFromKey(k);
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nk = cellKey(x + dx, y + dy);
      if (openCells.has(nk) && !connected.has(nk)) { connected.add(nk); queue.push(nk); }
    }
  }
  return connected;
}

export function getCellBounds(cells) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of cells) {
    const { x, y } = cellFromKey(k);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

// ── Movement / collision helpers ─────────────────────────────

// True if movement from (x0,y0)→(x1,y1) crosses a closed inter-cell wall.
export function crossesWall(removedWalls, x0, y0, x1, y1) {
  const c0x = Math.floor(x0 / CELL_PX), c0y = Math.floor(y0 / CELL_PX);
  const c1x = Math.floor(x1 / CELL_PX), c1y = Math.floor(y1 / CELL_PX);
  if (c0x === c1x && c0y === c1y) return false;
  if (c0x !== c1x && c0y !== c1y) {
    const pathA = removedWalls.has(wallKey(c0x, c0y, c1x, c0y)) &&
                  removedWalls.has(wallKey(c1x, c0y, c1x, c1y));
    const pathB = removedWalls.has(wallKey(c0x, c0y, c0x, c1y)) &&
                  removedWalls.has(wallKey(c0x, c1y, c1x, c1y));
    return !(pathA || pathB);
  }
  return !removedWalls.has(wallKey(c0x, c0y, c1x, c1y));
}

// True if world-point (px,py) is inside an open cell.
export function inRoom(px, py, openCells) {
  const c = cellOf(px, py);
  return openCells.has(cellKey(c.x, c.y));
}

// Get room bonus type for a given cell
export function getRoomBonus(state, cellKey) {
  if (!state.cellToRoom || !state.roomBonuses) return null;
  const roomIdx = state.cellToRoom.get(cellKey);
  if (roomIdx === undefined) return null;
  const roomBonus = state.roomBonuses.find(rb => rb.roomIdx === roomIdx);
  return roomBonus ? roomBonus.bonusType : null;
}

const WIND_BONUS_IDS = new Set(['wind_east', 'wind_west', 'wind_north', 'wind_south']);

export function isWindBonus(id) {
  return WIND_BONUS_IDS.has(id);
}

// Get scalar speed multiplier from room bonuses for a given cell (no direction).
// Used for animation timing and HUD display. Wind bonuses return 1.0 here.
export function getRoomSpeedMultiplier(state, cellKey) {
  const bonus = getRoomBonus(state, cellKey);
  if (!bonus || bonus === 'speedup') return 1.0;
  if (isWindBonus(bonus)) return 1.0;
  if (bonus !== 'speeddown') return 1.0;

  const def = (typeof ROOM_BONUS_TYPES !== 'undefined') && ROOM_BONUS_TYPES.find(bt => bt.id === bonus);
  if (def && def.speedMult !== undefined) return def.speedMult;

  return 0.5;
}

// Get directional speed multiplier from room bonuses for a given cell.
// dirX/dirY is the movement direction vector (need not be normalized).
// Returns a scalar to multiply the velocity magnitude by.
// Wind: mult = 1.0 + windStrength * dot(normalize(dir), windDir)
//   - aligned with wind: 1.0 + windStrength (e.g. 1.5)
//   - opposite to wind:  1.0 - windStrength (e.g. 0.5)
//   - perpendicular:     1.0
//   - diagonal (45°):    1.0 + windStrength * 0.707 (e.g. ~1.35)
export function getRoomSpeedVectorMultiplier(state, cellKey, dirX, dirY) {
  const bonus = getRoomBonus(state, cellKey);
  if (!bonus) return 1.0;

  if (bonus === 'speeddown') {
    const def = (typeof ROOM_BONUS_TYPES !== 'undefined') && ROOM_BONUS_TYPES.find(bt => bt.id === bonus);
    return (def && def.speedMult !== undefined) ? def.speedMult : 0.5;
  }

  if (!isWindBonus(bonus)) return 1.0;

  // No movement direction → no wind effect
  const len = Math.hypot(dirX, dirY);
  if (len < 1e-9) return 1.0;

  const def = (typeof ROOM_BONUS_TYPES !== 'undefined') && ROOM_BONUS_TYPES.find(bt => bt.id === bonus);
  if (!def || !def.windDir) return 1.0;

  const ndx = dirX / len;
  const ndy = dirY / len;
  const dot = ndx * def.windDir.x + ndy * def.windDir.y;
  const strength = def.windStrength ?? 0.5;
  return 1.0 + strength * dot;
}

// Find wall at point (mx, my) within blobCells. Returns { ax, ay, bx, by, wk } or null.
export function getWallAtPoint(blobCells, mx, my) {
  const snapR = CELL_PX * 0.30;
  const snapR2 = snapR * snapR;
  const cx0 = Math.floor((mx - snapR) / CELL_PX) - 1;
  const cx1 = Math.floor((mx + snapR) / CELL_PX) + 1;
  const cy0 = Math.floor((my - snapR) / CELL_PX) - 1;
  const cy1 = Math.floor((my + snapR) / CELL_PX) + 1;

  let bestDist2 = Infinity;
  let best = null;

  for (let gx = cx0; gx <= cx1; gx++) {
    for (let gy = cy0; gy <= cy1; gy++) {
      const k = cellKey(gx, gy);
      if (!blobCells.has(k)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = gx + dx, ny = gy + dy;
        const nk = cellKey(nx, ny);
        if (!blobCells.has(nk)) continue;
        const midX = (gx + nx + 1) * CELL_PX / 2;
        const midY = (gy + ny + 1) * CELL_PX / 2;
        const d2 = (mx - midX) * (mx - midX) + (my - midY) * (my - midY);
        if (d2 < snapR2 && d2 < bestDist2) {
          bestDist2 = d2;
          best = { ax: gx, ay: gy, bx: nx, by: ny, wk: wallKey(gx, gy, nx, ny) };
        }
      }
    }
  }
  return best;
}

// ── Rectangle open-area helpers (wall-shift mechanic) ────────

// Compute world-pixel rectangle of open area from wall shifts.
// wallShifts: { N, S, E, W } — shift in sub-cells from original start-cell boundary.
// startCell: { x, y } — grid coords of the starting cell.
export function computeOpenRect(wallShifts, startCell) {
  return {
    minX: (startCell.x - wallShifts.W / SUBCELLS_PER_CELL) * CELL_PX,
    maxX: (startCell.x + 1 + wallShifts.E / SUBCELLS_PER_CELL) * CELL_PX,
    minY: (startCell.y - wallShifts.N / SUBCELLS_PER_CELL) * CELL_PX,
    maxY: (startCell.y + 1 + wallShifts.S / SUBCELLS_PER_CELL) * CELL_PX,
  };
}

// Compute set of cell keys whose center is inside openRect.
export function computeOpenCells(openRect) {
  const cells = new Set();
  const minCx = Math.floor(openRect.minX / CELL_PX);
  const maxCx = Math.floor(openRect.maxX / CELL_PX);
  const minCy = Math.floor(openRect.minY / CELL_PX);
  const maxCy = Math.floor(openRect.maxY / CELL_PX);
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const cxC = (cx + 0.5) * CELL_PX;
      const cyC = (cy + 0.5) * CELL_PX;
      if (cxC >= openRect.minX && cxC <= openRect.maxX &&
          cyC >= openRect.minY && cyC <= openRect.maxY) {
        cells.add(cellKey(cx, cy));
      }
    }
  }
  return cells;
}

// True if world-point (px,py) is inside the open rectangle.
export function inOpenRect(px, py, openRect) {
  return px >= openRect.minX && px <= openRect.maxX &&
         py >= openRect.minY && py <= openRect.maxY;
}

// True if segment (x0,y0)→(x1,y1) crosses the rectangle boundary.
export function crossesRectBoundary(openRect, x0, y0, x1, y1) {
  const in0 = inOpenRect(x0, y0, openRect);
  const in1 = inOpenRect(x1, y1, openRect);
  return in0 !== in1;
}

// Find nearest rectangle wall to point (mx, my).
// Returns { dir: 'N'|'S'|'E'|'W', midX, midY, dist } or null.
export function getNearestWall(openRect, mx, my) {
  const snapR = CELL_PX * 0.30;
  const snapR2 = snapR * snapR;

  const walls = [
    { dir: 'N', x0: openRect.minX, y0: openRect.minY, x1: openRect.maxX, y1: openRect.minY },
    { dir: 'S', x0: openRect.minX, y0: openRect.maxY, x1: openRect.maxX, y1: openRect.maxY },
    { dir: 'W', x0: openRect.minX, y0: openRect.minY, x1: openRect.minX, y1: openRect.maxY },
    { dir: 'E', x0: openRect.maxX, y0: openRect.minY, x1: openRect.maxX, y1: openRect.maxY },
  ];

  let bestDist2 = Infinity;
  let best = null;

  for (const w of walls) {
    // Closest point on segment to (mx, my)
    const dx = w.x1 - w.x0;
    const dy = w.y1 - w.y0;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((mx - w.x0) * dx + (my - w.y0) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = w.x0 + t * dx;
    const cy = w.y0 + t * dy;
    const d2 = (mx - cx) * (mx - cx) + (my - cy) * (my - cy);
    if (d2 < snapR2 && d2 < bestDist2) {
      bestDist2 = d2;
      best = { dir: w.dir, midX: cx, midY: cy, dist: Math.sqrt(d2) };
    }
  }
  return best;
}

// ── Misc utilities ───────────────────────────────────────────

export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
