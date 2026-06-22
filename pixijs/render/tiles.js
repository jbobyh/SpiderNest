// ============================================================
// TILES — floor / outer-wall / corner / partition sprites
//
// buildTileLayer(container, worldData, level)
//   Clears and rebuilds all tile sprites into `container`.
//   Call on level start and after any wall open/close event.
//
// Direction convention (matches original engine-utils.js):
//   0 = right  [+1,  0]
//   1 = bottom [ 0, +1]
//   2 = left   [-1,  0]
//   3 = top    [ 0, -1]
// ============================================================

import { Container, Sprite, TilingSprite, Texture, Graphics, Assets, Text } from 'pixi.js';
import {
  CELL_PX, FLOOR_TILES_PER_CELL, FLOOR_TILE_PX, SUBCELL_PX, TILES_PER_CELL, CARDINAL_DIRECTIONS,
  cellKey, cellFromKey, wallKey,
} from '../world/constants.js';

const WALL_DEPTH  = CELL_PX * 0.125;
const CORNER_SIZE = CELL_PX * 0.125;
const PART_T      = CELL_PX * 0.05;   // partition wall thickness

// Direction vectors in the canonical order 0..3
const DIR_VECS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// ── Level texture aliases ────────────────────────────────────

function lvlSuffix(level) { return level === 2 ? 'green' : level === 3 ? 'y' : 'blue'; }
function wallAlias(level)  { return level === 2 ? 'wall-green' : level === 3 ? 'wall-y' : 'wall'; }
function cornerAlias(level){ return level === 2 ? 'corner-green' : level === 3 ? 'corner-y' : 'corner'; }

// ── Floor tile selection ─────────────────────────────────────

function getOpenDirs(x, y, openCells) {
  const dirs = [];
  for (let d = 0; d < 4; d++) {
    const [dx, dy] = DIR_VECS[d];
    if (openCells.has(cellKey(x + dx, y + dy))) dirs.push(d);
  }
  return dirs;
}

function floorAlias(openDirs, level) {
  const s = lvlSuffix(level);
  switch (openDirs.length) {
    case 0: return `floor-${s}`;
    case 4: return `floor-4exit-${s}`;
    case 1: return `floor-rightexit-${s}`;
    case 2: {
      const [d1, d2] = openDirs;
      return (d1 + 2) % 4 === d2 ? `floor-topdownexit-${s}` : `floor-rightbottomexit-${s}`;
    }
    default: return `floor-leftrightbottomexit-${s}`;
  }
}

function floorRotation(openDirs) {
  switch (openDirs.length) {
    case 0: case 4: return 0;
    case 1: return openDirs[0] * Math.PI / 2;
    case 2: {
      const [d1, d2] = openDirs;
      if ((d1 + 2) % 4 === d2) {
        // straight: topdownexit has exits at 1(bottom) + 3(top) = no rotation
        return (openDirs.includes(1) && openDirs.includes(3)) ? 0 : Math.PI / 2;
      }
      // corner: rightbottomexit has exits 0+1; find r so rotated dirs = [0,1]
      for (let r = 0; r < 4; r++) {
        const rot = openDirs.map(d => (d - r + 4) % 4).sort((a, b) => a - b);
        if (rot[0] === 0 && rot[1] === 1) return r * Math.PI / 2;
      }
      return 0;
    }
    default: {
      // T-junction: leftrightbottomexit has missing=top(3) at r=0
      const missing = [0, 1, 2, 3].find(d => !openDirs.includes(d));
      return ((missing + 1) % 4) * Math.PI / 2;
    }
  }
}

// ── Sprite factories ─────────────────────────────────────────

function makeFloorSprite(x, y, openDirs, level, purifiedRooms, cellToRoom, cellContents, chestObjs, hearts, upgradeChests, summonSphere, roomBonuses, roomBonusAltars) {
  const k = cellKey(x, y);
  const roomIdx = cellToRoom ? cellToRoom.get(k) : undefined;
  const isPurified = roomIdx !== undefined && purifiedRooms && purifiedRooms.has(roomIdx);

  // Check if room has heart
  let hasHeart = false;
  if (roomIdx !== undefined && hearts && hearts.length > 0) {
    for (const heart of hearts) {
      const heartRoomIdx = cellToRoom.get(heart.cellKey);
      if (heartRoomIdx === roomIdx) {
        hasHeart = true;
        break;
      }
    }
  }

  // Check if room has room bonus altar
  let hasRoomBonusAltar = false;
  if (roomIdx !== undefined && roomBonusAltars && roomBonusAltars.length > 0) {
    for (const altar of roomBonusAltars) {
      if (altar.roomIdx === roomIdx && !altar.activated) {
        hasRoomBonusAltar = true;
        break;
      }
    }
  }

  // Check if room has cursed chest using chestObjs
  let hasCursedChest = false;
  if (!hasHeart && !hasRoomBonusAltar && roomIdx !== undefined && chestObjs && chestObjs.length > 0) {
    for (const chest of chestObjs) {
      const chestRoomIdx = cellToRoom.get(chest.cellKey);
      if (chestRoomIdx === roomIdx) {
        hasCursedChest = true;
        break;
      }
    }
  }

  // Check if room has upgrade chest
  let hasUpgradeChest = false;
  if (!hasHeart && !hasRoomBonusAltar && !hasCursedChest && roomIdx !== undefined && upgradeChests && upgradeChests.length > 0) {
    for (const chest of upgradeChests) {
      const chestRoomIdx = cellToRoom.get(chest.cellKey);
      if (chestRoomIdx === roomIdx) {
        hasUpgradeChest = true;
        break;
      }
    }
  }

  // Check if room has summon sphere
  let hasSummonSphere = false;
  if (!hasHeart && !hasRoomBonusAltar && !hasCursedChest && !hasUpgradeChest && roomIdx !== undefined && summonSphere) {
    const sphereRoomIdx = cellToRoom.get(summonSphere.cellKey);
    if (sphereRoomIdx === roomIdx) {
      hasSummonSphere = true;
    }
  }

  // Check if room has bonus
  let roomBonus = null;
  if (roomIdx !== undefined) {
    // Check roomBonuses array first
    if (roomBonuses && roomBonuses.length > 0) {
      for (const rb of roomBonuses) {
        if (rb.roomIdx === roomIdx) {
          roomBonus = rb.bonusType;
          break;
        }
      }
    }
    // Also check roomBonusAltars for activated altars with bonusType
    if (!roomBonus && roomBonusAltars && roomBonusAltars.length > 0) {
      for (const altar of roomBonusAltars) {
        if (altar.roomIdx === roomIdx && altar.activated && altar.bonusType) {
          roomBonus = altar.bonusType;
          break;
        }
      }
    }
  }

  // Select texture based on content type and purified status
  let texAlias;
  if (hasSummonSphere) {
    texAlias = isPurified ? 'floor-ground-sand' : 'floor-ground-dirt';
  } else if (hasHeart) {
    texAlias = isPurified ? 'floor-stone-pattern-small' : 'floor-stone-pattern-small-dark';
  } else if (hasCursedChest || hasUpgradeChest) {
    texAlias = isPurified ? 'floor-stone-pattern' : 'floor-stone-pattern-dark';
  } else {
    texAlias = isPurified ? 'floor-stone' : 'floor-stone-dark';
  }
  const tex = Assets.get(texAlias);

  const container = new Container();
  // Create FLOOR_TILES_PER_CELL x FLOOR_TILES_PER_CELL grid of sprites within the cell
  for (let sy = 0; sy < FLOOR_TILES_PER_CELL; sy++) {
    for (let sx = 0; sx < FLOOR_TILES_PER_CELL; sx++) {
      const spr = new Sprite(tex);
      spr.width = FLOOR_TILE_PX;
      spr.height = FLOOR_TILE_PX;
      spr.x = sx * FLOOR_TILE_PX;
      spr.y = sy * FLOOR_TILE_PX;
      container.addChild(spr);
    }
  }
  container.position.set(x * CELL_PX, y * CELL_PX);

  // Add room bonus icon if present
  if (roomBonus && typeof ROOM_BONUS_TYPES !== 'undefined') {
    const bonusType = ROOM_BONUS_TYPES.find(bt => bt.id === roomBonus);
    if (bonusType && bonusType.icon) {
      const icon = new Text({
        text: bonusType.icon,
        style: { fontSize: 16, fontFamily: 'sans-serif' },
      });
      icon.anchor.set(1, 0); // Top-right anchor
      icon.position.set(CELL_PX - 4, 4);
      container.addChild(icon);
    }
  }

  return container;
}

function makeWallStrips(x, y, openCells, level) {
  const tex     = Texture.from(wallAlias(level));
  const sprites = [];

  for (let d = 0; d < 4; d++) {
    const [dx, dy] = DIR_VECS[d];
    if (openCells.has(cellKey(x + dx, y + dy))) continue;

    // Edge midpoint (world coords)
    const emx   = (x + 0.5 + dx * 0.5) * CELL_PX;
    const emy   = (y + 0.5 + dy * 0.5) * CELL_PX;
    const angle = Math.atan2(dy, dx) + Math.PI / 2;

    const spr = new Sprite(tex);
    spr.anchor.set(0.5, 1); // bottom-centre → bottom aligns to the cell edge
    spr.width    = CELL_PX;
    spr.height   = WALL_DEPTH;
    spr.position.set(emx, emy);
    spr.rotation = angle;
    sprites.push(spr);
  }
  return sprites;
}

const DIAG_CORNERS = [
  { ddx: -1, ddy: -1, angle: 0 },
  { ddx:  1, ddy: -1, angle: Math.PI / 2 },
  { ddx:  1, ddy:  1, angle: Math.PI },
  { ddx: -1, ddy:  1, angle: -Math.PI / 2 },
];

function makeCornerSprites(x, y, openCells, level) {
  const tex     = Texture.from(cornerAlias(level));
  const sprites = [];

  for (const { ddx, ddy, angle } of DIAG_CORNERS) {
    const sideA    = openCells.has(cellKey(x + ddx, y));
    const sideB    = openCells.has(cellKey(x, y + ddy));
    const diagOpen = openCells.has(cellKey(x + ddx, y + ddy));
    const isExternal = !sideA && !sideB;
    const isInternal = sideA && sideB && !diagOpen;
    if (!isExternal && !isInternal) continue;

    const cornerX = (x + (ddx > 0 ? 1 : 0)) * CELL_PX;
    const cornerY = (y + (ddy > 0 ? 1 : 0)) * CELL_PX;

    const spr = new Sprite(tex);
    spr.width  = CORNER_SIZE;
    spr.height = CORNER_SIZE;
    spr.position.set(cornerX, cornerY);
    if (isInternal) {
      spr.anchor.set(0);
      spr.rotation = angle + Math.PI;
    } else {
      spr.anchor.set(1);
      spr.rotation = angle;
    }
    sprites.push(spr);
  }
  return sprites;
}

// ── Closed / rock cell sprites ───────────────────────────────

function makeClosedCellSprites(blobCells, openCells, everRevealedCells, everOpenedCells,
                                permanentlyClosed, disabledCells) {
  const sprites = [];
  const blackCells = new Set([
    ...(permanentlyClosed && typeof permanentlyClosed[Symbol.iterator] === 'function' ? permanentlyClosed : []),
    ...(disabledCells && typeof disabledCells[Symbol.iterator] === 'function' ? disabledCells : [])
  ]);

  for (const k of blackCells) {
    const { x, y } = cellFromKey(k);
    // Only show if at least one adjacent cell has ever been opened (fog-of-war)
    let revealed = false;
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      if (everOpenedCells.has(cellKey(x + dx, y + dy))) { revealed = true; break; }
    }
    if (!revealed) continue;

    let tex;
    try { tex = Texture.from('rock'); } catch { continue; }
    const spr = new Sprite(tex);
    spr.x = x * CELL_PX;
    spr.y = y * CELL_PX;
    spr.width = spr.height = CELL_PX;
    sprites.push(spr);
  }

  // closedcell texture for revealed-but-not-open blobCells
  for (const k of everRevealedCells) {
    if (openCells.has(k) || blackCells.has(k)) continue;
    if (!blobCells.has(k)) continue;
    const { x, y } = cellFromKey(k);
    let tex;
    try { tex = Texture.from('closedcell'); } catch { continue; }
    const spr = new Sprite(tex);
    spr.x = x * CELL_PX;
    spr.y = y * CELL_PX;
    spr.width = spr.height = CELL_PX;
    spr.alpha = 0.35;
    sprites.push(spr);
  }

  return sprites;
}

// ── Partition walls (Graphics) ────────────────────────────────
// Drawn for every boundary between two blobCells that is NOT in removedWalls
// and where at least one of the two cells is visible (open or ever-revealed).

function buildPartitions(blobCells, openCells, removedWalls, everRevealedCells, purified, cellToRoom, internalWalls) {
  const g  = new Graphics();
  const HT = PART_T / 2;
  const allVisible = openCells ? new Set([...openCells, ...everRevealedCells]) : everRevealedCells;

  for (const k of blobCells) {
    const { x, y } = cellFromKey(k);

    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      const nk = cellKey(nx, ny);
      if (!blobCells.has(nk)) continue;
      if (!allVisible.has(k) && !allVisible.has(nk)) continue;

      const wk = wallKey(x, y, nx, ny);
      const isRemoved = removedWalls.has(wk);
      if (isRemoved && internalWalls && internalWalls.has(wk)) continue;

      // Check if at least one adjacent room is purified
      const roomA = cellToRoom?.get(k);
      const roomB = cellToRoom?.get(nk);
      const purifiedA = roomA !== undefined && purified?.has(roomA);
      const purifiedB = roomB !== undefined && purified?.has(roomB);
      const isPurifiedAdjacent = purifiedA || purifiedB;

      // Lighter color for purified-adjacent walls
      const fillColor = isPurifiedAdjacent ? 0x2a1a3e : 0x14081e;
      const strokeColor = isPurifiedAdjacent ? 0x9a70b0 : 0x785090;
      const fillAlpha = isRemoved ? CONFIG.WALL_REMOVED_FILL_ALPHA : CONFIG.WALL_FILL_ALPHA;
      const strokeAlpha = isRemoved ? CONFIG.WALL_REMOVED_STROKE_ALPHA : CONFIG.WALL_STROKE_ALPHA;

      if (dx === 1) {
        // vertical strip at x-boundary — bevelled ends (45°)
        const bx = (x + 1) * CELL_PX;
        const by = y * CELL_PX;
        const H  = CELL_PX;
        g.poly([
          bx - HT, by + HT,       // top-left
          bx,      by,            // top tip
          bx + HT, by + HT,       // top-right
          bx + HT, by + H - HT,   // bottom-right
          bx,      by + H,        // bottom tip
          bx - HT, by + H - HT,   // bottom-left
        ])
          .fill({ color: fillColor, alpha: fillAlpha })
          .stroke({ color: strokeColor, alpha: strokeAlpha, width: 0.5 });
      } else {
        // horizontal strip at y-boundary — bevelled ends (45°)
        const bx = x * CELL_PX;
        const by = (y + 1) * CELL_PX;
        const W  = CELL_PX;
        g.poly([
          bx + HT,     by - HT,   // top-left
          bx + W - HT, by - HT,   // top-right
          bx + W,      by,        // right tip
          bx + W - HT, by + HT,   // bottom-right
          bx + HT,     by + HT,   // bottom-left
          bx,          by,        // left tip
        ])
          .fill({ color: fillColor, alpha: fillAlpha })
          .stroke({ color: strokeColor, alpha: strokeAlpha, width: 0.5 });
      }
    }
  }
  return g;
}

// ── External walls (Graphics) ───────────────────────────────────
// Drawn for blobCell boundaries where adjacent cell is NOT in blobCells
// These are always dark (0x14081e) and cannot be opened.

function buildExternalWalls(blobCells, openCells, everRevealedCells) {
  const g  = new Graphics();
  const HT = PART_T / 2;
  const allVisible = openCells ? new Set([...openCells, ...everRevealedCells]) : everRevealedCells;

  for (const k of allVisible) {
    if (!blobCells.has(k)) continue;
    const { x, y } = cellFromKey(k);

    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      const nk = cellKey(nx, ny);
      if (blobCells.has(nk)) continue; // Skip if adjacent cell exists in blob

      // Draw external wall at this boundary
      if (dx === 1) {
        // Right boundary - vertical strip
        const bx = (x + 1) * CELL_PX;
        const by = y * CELL_PX;
        const H  = CELL_PX;
        g.poly([
          bx - HT, by + HT,
          bx,      by,
          bx + HT, by + HT,
          bx + HT, by + H - HT,
          bx,      by + H,
          bx - HT, by + H - HT,
        ])
          .fill({ color: 0x14081e, alpha: CONFIG.WALL_FILL_ALPHA })
          .stroke({ color: 0x785090, alpha: CONFIG.WALL_STROKE_ALPHA, width: 0.5 });
      } else if (dx === -1) {
        // Left boundary - vertical strip
        const bx = x * CELL_PX;
        const by = y * CELL_PX;
        const H  = CELL_PX;
        g.poly([
          bx + HT, by + HT,
          bx,      by,
          bx - HT, by + HT,
          bx - HT, by + H - HT,
          bx,      by + H,
          bx + HT, by + H - HT,
        ])
          .fill({ color: 0x14081e, alpha: CONFIG.WALL_FILL_ALPHA })
          .stroke({ color: 0x785090, alpha: CONFIG.WALL_STROKE_ALPHA, width: 0.5 });
      } else if (dy === 1) {
        // Bottom boundary - horizontal strip
        const bx = x * CELL_PX;
        const by = (y + 1) * CELL_PX;
        const W  = CELL_PX;
        g.poly([
          bx + HT,     by - HT,
          bx + W - HT, by - HT,
          bx + W,      by,
          bx + W - HT, by + HT,
          bx + HT,     by + HT,
          bx,          by,
        ])
          .fill({ color: 0x14081e, alpha: CONFIG.WALL_FILL_ALPHA })
          .stroke({ color: 0x785090, alpha: CONFIG.WALL_STROKE_ALPHA, width: 0.5 });
      } else {
        // Top boundary - horizontal strip
        const bx = x * CELL_PX;
        const by = y * CELL_PX;
        const W  = CELL_PX;
        g.poly([
          bx + HT,     by + HT,
          bx + W - HT, by + HT,
          bx + W,      by,
          bx + W - HT, by - HT,
          bx + HT,     by - HT,
          bx,          by,
        ])
          .fill({ color: 0x14081e, alpha: CONFIG.WALL_FILL_ALPHA })
          .stroke({ color: 0x785090, alpha: CONFIG.WALL_STROKE_ALPHA, width: 0.5 });
      }
    }
  }
  return g;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Build (or fully rebuild) all tile sprites into `targetContainer`.
 * Destroys previous children.
 *
 * @param {Container} targetContainer — should be layers.tiles
 * @param {{
 *   blobCells: Set<string>,
 *   openCells: Set<string>,
 *   everRevealedCells: Set<string>,
 *   everOpenedCells: Set<string>,
 *   removedWalls: Set<string>,
 *   permanentlyClosed: Set<string>,
 *   disabledCells: Set<string>,
 *   rooms: Array<{cells: Array<{k: string}>}>,
 *   purified: Set<number>,
 *   chestObjs: Array<{cellKey: string}>,
 *   hearts: Array<{cellKey: string}>,
 *   upgradeChests: Array<{cellKey: string}>,
 * }} worldData
 * @param {number} level — 1 | 2 | 3
 */
export function buildTileLayer(targetContainer, worldData, level) {
  targetContainer.removeChildren().forEach(c => c.destroy({ children: true }));

  const {
    blobCells, openCells, everRevealedCells, everOpenedCells,
    removedWalls, permanentlyClosed, disabledCells, rooms, purified, chestObjs, hearts, upgradeChests, summonSphere, roomBonuses, roomBonusAltars,
  } = worldData;

  // Build cellToRoom map
  const cellToRoom = new Map();
  if (rooms) {
    for (let i = 0; i < rooms.length; i++) {
      for (const cell of rooms[i].cells) {
        cellToRoom.set(cell.k, i);
      }
    }
  }

  // ── 1. Closed / rock cell overlays ──
  const closedContainer = new Container({ label: 'closed' });
  for (const spr of makeClosedCellSprites(
    blobCells, openCells, everRevealedCells, everOpenedCells, permanentlyClosed, disabledCells,
  )) closedContainer.addChild(spr);

  // ── 2. Floor tiles (open cells + revealed cells that are blobCells) ──
  const floorContainer = new Container({ label: 'floors' });
  const allFloorCells = new Set([...openCells]);
  for (const k of everRevealedCells) {
    if (blobCells.has(k)) allFloorCells.add(k);
  }
  for (const k of allFloorCells) {
    const { x, y } = cellFromKey(k);
    floorContainer.addChild(makeFloorSprite(x, y, getOpenDirs(x, y, allFloorCells), level, purified, cellToRoom, null, chestObjs, hearts, upgradeChests, summonSphere, roomBonuses, roomBonusAltars));
  }

  // ── 3. Outer wall strips ──
  // const wallContainer = new Container({ label: 'outer-walls' });
  // for (const k of openCells) {
  //   const { x, y } = cellFromKey(k);
  //   for (const spr of makeWallStrips(x, y, openCells, level)) wallContainer.addChild(spr);
  // }
  const wallContainer = new Container({ label: 'outer-walls' });

  // ── 4. Corner pieces ──
  // const cornerContainer = new Container({ label: 'corners' });
  // for (const k of openCells) {
  //   const { x, y } = cellFromKey(k);
  //   for (const spr of makeCornerSprites(x, y, openCells, level)) cornerContainer.addChild(spr);
  // }
  const cornerContainer = new Container({ label: 'corners' });

  // ── 5. Partition walls between blob cells ──
  const { internalWalls } = worldData;
  const partitions = buildPartitions(blobCells, openCells, removedWalls, everRevealedCells, purified, cellToRoom, internalWalls);
  partitions.label = 'partitions';

  // ── 6. External walls (blobCell boundaries) ──
  const externalWalls = buildExternalWalls(blobCells, openCells, everRevealedCells);
  externalWalls.label = 'external-walls';

  targetContainer.addChild(closedContainer, floorContainer, wallContainer, cornerContainer, partitions, externalWalls);
}

// Alias — call whenever openCells or removedWalls change.
export const rebuildTileLayer = buildTileLayer;

// ── Wall segment extraction for 3D rendering ─────────────────
// Returns array of { verts, edgeNormals } for wall-3d.js.
// verts: 6 floor-plane points of the hexagonal wall shape.
// edgeNormals: per-edge outward normal + color data (6 entries).

const CAP_ALPHA = CONFIG.WALL_3D_CAP_ALPHA;

function _hexVerts_V(bx, by) {
  const HT = PART_T / 2;
  const L  = CELL_PX;
  return [
    { x: bx - HT, y: by + HT      },  // 0: top-left
    { x: bx,      y: by            },  // 1: top tip
    { x: bx + HT, y: by + HT      },  // 2: top-right
    { x: bx + HT, y: by + L - HT  },  // 3: bottom-right
    { x: bx,      y: by + L        },  // 4: bottom tip
    { x: bx - HT, y: by + L - HT  },  // 5: bottom-left
  ];
}

function _hexVerts_H(bx, by) {
  const HT = PART_T / 2;
  const W  = CELL_PX;
  return [
    { x: bx + HT,     y: by - HT  },  // 0: top-left
    { x: bx + W - HT, y: by - HT  },  // 1: top-right
    { x: bx + W,      y: by        },  // 2: right tip
    { x: bx + W - HT, y: by + HT  },  // 3: bottom-right
    { x: bx + HT,     y: by + HT  },  // 4: bottom-left
    { x: bx,          y: by        },  // 5: left tip
  ];
}

function _edgeNormals(verts, color, alpha, strokeColor, strokeAlpha, purifiedNegSide = false, purifiedPosSide = false, mainDirX = 1, mainDirY = 0) {
  const capColor = color + 0x080408;
  const n = verts.length;
  return verts.map((v, i) => {
    const v2 = verts[(i + 1) % n];
    const ex = v2.x - v.x;
    const ey = v2.y - v.y;
    const len = Math.hypot(ex, ey);
    const nx = ey / len;
    const ny = -ex / len;
    // dot of face normal with main wall direction tells which room this face looks toward
    const dot = nx * mainDirX + ny * mainDirY;
    const isPurifiedSide = dot >= 0 ? purifiedPosSide : purifiedNegSide;
    return {
      nx, ny,
      color, alpha, strokeColor, strokeAlpha,
      capColor, capAlpha: CAP_ALPHA,
      isPurifiedSide,
    };
  });
}

/**
 * Extract wall polygons for pseudo-3D rendering.
 * Call with the same worldData passed to buildTileLayer.
 * @returns {Array<{verts, edgeNormals}>}
 */
export function extractWallSegments(worldData) {
  const {
    blobCells, openCells, removedWalls, everRevealedCells, purified, internalWalls, rooms,
  } = worldData;

  const cellToRoom = new Map();
  if (rooms) {
    for (let i = 0; i < rooms.length; i++) {
      for (const cell of rooms[i].cells) cellToRoom.set(cell.k, i);
    }
  }

  const segments = [];
  const allVisible = openCells
    ? new Set([...openCells, ...everRevealedCells])
    : everRevealedCells;

  // ── Partition walls (between two blobCells) ──────────────────
  for (const k of blobCells) {
    const { x, y } = cellFromKey(k);

    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      const nk = cellKey(nx, ny);
      if (!blobCells.has(nk)) continue;
      if (!allVisible.has(k) && !allVisible.has(nk)) continue;

      const wk = wallKey(x, y, nx, ny);
      const isRemoved = removedWalls.has(wk);
      if (isRemoved && internalWalls && internalWalls.has(wk)) continue;

      const roomA = cellToRoom?.get(k);
      const roomB = cellToRoom?.get(nk);
      const purifiedA = roomA !== undefined && purified?.has(roomA);
      const purifiedB = roomB !== undefined && purified?.has(roomB);
      const isPurifiedAdjacent = purifiedA || purifiedB;

      const fillColor   = isPurifiedAdjacent ? 0x2a1a3e : 0x14081e;
      const strokeColor = isPurifiedAdjacent ? 0x9a70b0 : 0x785090;
      const fillAlpha   = isRemoved ? CONFIG.WALL_REMOVED_FILL_ALPHA : CONFIG.WALL_FILL_ALPHA;
      const strokeAlpha = isRemoved ? CONFIG.WALL_REMOVED_STROKE_ALPHA : CONFIG.WALL_STROKE_ALPHA;

      if (dx === 1) {
        // vertical partition: A=left (neg X), B=right (pos X)
        const verts = _hexVerts_V((x + 1) * CELL_PX, y * CELL_PX);
        segments.push({ verts, edgeNormals: _edgeNormals(verts, fillColor, fillAlpha, strokeColor, strokeAlpha, purifiedA, purifiedB, 1, 0), isRemoved });
      } else {
        // horizontal partition: A=top (neg Y), B=bottom (pos Y)
        const verts = _hexVerts_H(x * CELL_PX, (y + 1) * CELL_PX);
        segments.push({ verts, edgeNormals: _edgeNormals(verts, fillColor, fillAlpha, strokeColor, strokeAlpha, purifiedA, purifiedB, 0, 1), isRemoved });
      }
    }
  }

  // ── External walls (blobCell boundary with non-blob neighbor) ─
  for (const k of allVisible) {
    if (!blobCells.has(k)) continue;
    const { x, y } = cellFromKey(k);

    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      const nk = cellKey(nx, ny);
      if (blobCells.has(nk)) continue;

      const fillColor   = 0x14081e;
      const strokeColor = 0x785090;
      const fillAlpha   = CONFIG.WALL_FILL_ALPHA;
      const strokeAlpha = CONFIG.WALL_STROKE_ALPHA;

      // For external walls: inner face (toward blob cell) may be purified; outer face is always dark
      const roomA = cellToRoom?.get(k);
      const purifiedInner = roomA !== undefined && purified?.has(roomA);

      let verts, mainDirX, mainDirY;
      if (dx === 1) {
        verts = _hexVerts_V((x + 1) * CELL_PX, y * CELL_PX);
        // inner side is -X (neg), outer is +X (pos=outside=dark)
        mainDirX = 1; mainDirY = 0;
        segments.push({ verts, edgeNormals: _edgeNormals(verts, fillColor, fillAlpha, strokeColor, strokeAlpha, purifiedInner, false, mainDirX, mainDirY), isRemoved: false });
      } else if (dx === -1) {
        verts = _hexVerts_V(x * CELL_PX, y * CELL_PX);
        // inner side is +X (pos), outer is -X (neg=outside=dark)
        mainDirX = 1; mainDirY = 0;
        segments.push({ verts, edgeNormals: _edgeNormals(verts, fillColor, fillAlpha, strokeColor, strokeAlpha, false, purifiedInner, mainDirX, mainDirY), isRemoved: false });
      } else if (dy === 1) {
        verts = _hexVerts_H(x * CELL_PX, (y + 1) * CELL_PX);
        // inner side is -Y (neg), outer is +Y (pos=outside=dark)
        mainDirX = 0; mainDirY = 1;
        segments.push({ verts, edgeNormals: _edgeNormals(verts, fillColor, fillAlpha, strokeColor, strokeAlpha, purifiedInner, false, mainDirX, mainDirY), isRemoved: false });
      } else {
        verts = _hexVerts_H(x * CELL_PX, y * CELL_PX);
        // inner side is +Y (pos), outer is -Y (neg=outside=dark)
        mainDirX = 0; mainDirY = 1;
        segments.push({ verts, edgeNormals: _edgeNormals(verts, fillColor, fillAlpha, strokeColor, strokeAlpha, false, purifiedInner, mainDirX, mainDirY), isRemoved: false });
      }
    }
  }

  return segments;
}
