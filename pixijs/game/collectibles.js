// ============================================================
// COLLECTIBLES — hearts, summon sphere, upgrades, chests,
//                weapons, enemy-room spawning / altar system
// ============================================================

import { cellOf, cellKey, CELL_PX } from '../world/constants.js';
import { Sounds } from '../core/sound.js';
import { applyUpgrade } from './upgrades.js';
import { pickupWeapon  } from './combat.js';
import { buildTileLayer } from '../render/tiles.js';
import { layers } from '../render/layers.js';
import { getCurrentLevel, saveCurrentGame } from '../game-loop.js';

const PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE;

// ── Play-mode collectibles update ─────────────────────────────

export function updateCollectibles(state, playerProgress, onParticles, onUpgradePopup) {
  const s = state;
  const px = s.player.x, py = s.player.y;

  // Hearts
  for (const heart of s.hearts) {
    if (heart.collected || heart.spawned === false) continue;
    if (Math.hypot(px - heart.x, py - heart.y) < PICKUP_R) {
      heart.collected = true;
      s.cellContents.delete(heart.cellKey);
      s.player.lives += CONFIG.LIVES_PER_HEART;
      s.heartsCollected++;
      Sounds.heartcollect();
      onParticles(heart.x, heart.y, CONFIG.PARTICLES.pickup.count, '#ff6b9d');
    }
  }

  // Summon sphere
  if (s.summonSphere && !s.summonSphere.collected && s.summonSphere.spawned) {
    if (Math.hypot(px - s.summonSphere.x, py - s.summonSphere.y) < PICKUP_R) {
      s.summonSphere.collected = true;
      s.summonSphereCollected  = true;
      s.cellContents.delete(s.summonSphere.cellKey);
      Sounds.keycollect();
      onParticles(s.summonSphere.x, s.summonSphere.y, CONFIG.PARTICLES.pickup.count, '#ff6600');
    }
  }

  s.bossSummonReady = s.summonSphereCollected && s.phase === 'play' && !s.bossDefeated;

  // Dropped weapons — pickup manually via F key (handled in play-mode.js)
  // for (const dw of (s.droppedWeapons || [])) {
  //   if (dw.picked) continue;
  //   if (Math.hypot(px - dw.x, py - dw.y) < PICKUP_R) {
  //     dw.picked = true;
  //     const idx = s.droppedWeapons.indexOf(dw);
  //     if (idx >= 0) s.droppedWeapons.splice(idx, 1);
  //     pickupWeapon(state, dw.weaponId, s.particles, px, py, 1, px, py);
  //     playerProgress.weaponSlots = [...s.weaponSlots];
  //     playerProgress.activeSlot  = s.activeSlot;
  //     playerProgress.maxSlots    = s.maxSlots;
  //   }
  // }
}

// ── Battle-mode collectibles update ───────────────────────────

export function updateBattleCollectibles(state, playerProgress, onParticles) {
  const b  = state.battle;
  const BS = CONFIG.BATTLE_SCALE;
  const PR = (CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE) * BS;
  const px = b.player.x, py = b.player.y;

  // Hearts
  for (const heart of b.hearts) {
    if (heart.collected) continue;
    if (Math.hypot(px - heart.x, py - heart.y) < PR) {
      heart.collected = true;
      state.player.lives += CONFIG.LIVES_PER_HEART;
      Sounds.heartcollect();
      onParticles(heart.x, heart.y, CONFIG.PARTICLES.pickup.count, '#ff6b9d');
      // Sync to world
      const worldHeart = state.hearts.find(h => h.cellKey === heart.originalCellKey);
      if (worldHeart) worldHeart.collected = true;
    }
  }

  // Summon sphere
  if (b.summonSphere && !b.summonSphere.collected) {
    if (Math.hypot(px - b.summonSphere.x, py - b.summonSphere.y) < PR) {
      b.summonSphere.collected        = true;
      state.summonSphere.collected    = true;
      state.summonSphereCollected     = true;
      state.cellContents.delete(b.summonSphere.originalCellKey);
      Sounds.keycollect();
      onParticles(b.summonSphere.x, b.summonSphere.y, CONFIG.PARTICLES.pickup.count, '#ff6600');
    }
  }

  // Upgrades
  for (const upg of (b.upgrades || [])) {
    if (upg.collected) continue;
    if (Math.hypot(px - upg.x, py - upg.y) < PR) {
      upg.collected = true;
      applyUpgrade(state, playerProgress, upg.upgradeType);
      Sounds.upgradecollect();
      const def   = (UPGRADE_TYPES || []).find(u => u.id === upg.upgradeType);
      const color = def ? def.color : '#ffcc00';
      onParticles(upg.x, upg.y, CONFIG.PARTICLES.pickup.count, color);
      // Sync
    }
  }

  // Spatial chests
  for (const bc of (b.spatialChests || [])) {
    if (bc.collected) continue;
    if (Math.hypot(px - bc.x, py - bc.y) < PR) {
      const worldChest = (state.spatialChests || []).find(c => c.cellKey === bc.originalCellKey);
      if (worldChest) {
        openSpatialChoice(state, worldChest);
        bc.collected = true;
      }
      break;
    }
  }

  // Dropped weapons in battle
  for (const dw of (b.droppedWeapons || [])) {
    if (dw.picked) continue;
    if (Math.hypot(px - dw.x, py - dw.y) < PR) {
      dw.picked = true;
      pickupWeapon(state, dw.weaponId, b.particles, px, py, BS, dw.originalX, dw.originalY);
      playerProgress.weaponSlots = [...state.weaponSlots];
      playerProgress.activeSlot  = state.activeSlot;
      playerProgress.maxSlots    = state.maxSlots;
    }
  }
}

// ── Sync battle collectibles back to world state ──────────────

export function syncBattleCollectibles(state) {
  const b = state.battle;
  if (!b) return;
  for (const bh of b.hearts) {
    if (!bh.collected) continue;
    const wh = state.hearts.find(h => h.cellKey === bh.originalCellKey);
    if (wh) wh.collected = true;
  }
}

// ── Enemy room / altar logic ──────────────────────────────────

export function checkAltarActivation(state, fKeyPressed, onEnterBattle) {
  if (!fKeyPressed) return false;
  const px = state.player.x, py = state.player.y;
  for (const altar of (state.roomAltars || [])) {
    if (altar.activated) continue;
    if (!state.openCells.has(altar.cellKey)) continue;
    const content = state.cellContents.get(altar.cellKey);
    if (!content || !content.enemyCount || content.enemyCount <= 0 || content.enemiesReleased) continue;
    const dist = Math.hypot(px - altar.x, py - altar.y);
    if (dist < CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE) {
      altar.activated = true;
      if (onEnterBattle) onEnterBattle(altar.cellKey);
      return true;
    }
  }
  return false;
}

export function isNearAltar(state) {
  if (state.phase !== 'play') return false;
  const px = state.player.x, py = state.player.y;
  for (const altar of (state.roomAltars || [])) {
    if (altar.activated) continue;
    if (!state.openCells.has(altar.cellKey)) continue;
    const content = state.cellContents.get(altar.cellKey);
    if (!content || !content.enemyCount || content.enemyCount <= 0 || content.enemiesReleased) continue;
    if (Math.hypot(px - altar.x, py - altar.y) < CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE) return true;
  }
  return false;
}

// ── Spawning bonus items after room cleared ───────────────────

export function spawnRoomRewards(state, cellKey) {
  for (const heart of state.hearts) {
    if (heart.cellKey === cellKey) heart.spawned = true;
  }
  for (const chest of (state.upgradeChests || [])) {
    if (chest.cellKey === cellKey) chest.spawned = true;
  }
  for (const chest of (state.spatialChests || [])) {
    if (chest.cellKey === cellKey) chest.spawned = true;
  }
  if (state.summonSphere?.cellKey === cellKey) state.summonSphere.spawned = true;

  // Mark room as purified
  if (state.rooms && state.purified) {
    for (let i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].cells.some(c => c.k === cellKey)) {
        state.purified.add(i);
        break;
      }
    }
  }
}

// ── Spatial chest choice ───────────

export function openSpatialChoice(state, chest, onEnterBattle) {
  if (!chest && !state._specialChoiceState) {
    state._specialChoiceState = { type: 'spatial', chest: null, active: false };
  }
  if (!chest) return;
  if (chest.collected) return;
  // Pause game, show choice overlay — actual rendering is in HUD layer
  state._specialChoiceState = { type: 'spatial', chest, active: true, onEnterBattle };
}

export function openBossCursedChoice(state) {
  state._specialChoiceState = { type: 'cursed', chest: null, active: true };
}

export function applySpecialChoice(state, playerProgress, choiceId) {
  if (!state._specialChoiceState) return;
  const { type, chest, onEnterBattle } = state._specialChoiceState;
  if (chest) chest.collected = true;
  state._specialChoiceState = null;

  if (!choiceId) {
    return;
  }
  applyUpgrade(state, playerProgress, choiceId);

  // Enter battle mode after choice only if enemies not already released
  const content = chest ? state.cellContents.get(chest.cellKey) : null;
  if (onEnterBattle && !(content && content.enemiesReleased)) onEnterBattle(chest?.cellKey);
}

// ── Upgrade chest choice (regular upgrades) ───────────

export function checkUpgradeChestActivation(state, fKeyPressed, onEnterBattle) {
  if (!fKeyPressed) return false;
  const px = state.player.x, py = state.player.y;
  const PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE;

  for (const chest of (state.upgradeChests || [])) {
    if (chest.collected || chest.spawned === false) continue;
    const dist = Math.hypot(px - chest.x, py - chest.y);
    if (dist < PICKUP_R) {
      // Open choice window
      openUpgradeChoice(state, chest, onEnterBattle);
      return true;
    }
  }
  return false;
}

export function isNearUpgradeChest(state) {
  if (state.phase !== 'play') return false;
  const px = state.player.x, py = state.player.y;
  const PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE;

  for (const chest of (state.upgradeChests || [])) {
    if (chest.collected || chest.spawned === false) continue;
    const dist = Math.hypot(px - chest.x, py - chest.y);
    if (dist < PICKUP_R) return true;
  }
  return false;
}

export function openUpgradeChoice(state, chest, onEnterBattle) {
  if (!chest) return;
  if (chest.collected) return;
  // Store pending choice state with callback to enter battle after selection
  state._upgradeChoiceState = {
    chest,
    active: true,
    onEnterBattle,
    selected: false,
  };
}

export function applyUpgradeChoice(state, playerProgress, choiceId) {
  if (!state._upgradeChoiceState) return;
  const { chest, onEnterBattle } = state._upgradeChoiceState;

  // Mark chest as collected regardless of choice
  if (chest) {
    chest.collected = true;
  }

  // Clear state
  const cb = state._upgradeChoiceState.onEnterBattle;
  state._upgradeChoiceState = null;

  // Apply upgrade if selected
  if (choiceId) {
    applyUpgrade(state, playerProgress, choiceId);
  }

  // Enter battle mode only if enemies not already released
  const content = chest ? state.cellContents.get(chest.cellKey) : null;
  if (cb && !(content && content.enemiesReleased)) cb(chest?.cellKey);
}

// ── Spatial chest F-key activation ───────────

export function checkSpatialChestActivation(state, fKeyPressed, onEnterBattle) {
  if (!fKeyPressed) return false;
  const px = state.player.x, py = state.player.y;
  const PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE;

  for (const chest of (state.spatialChests || [])) {
    if (chest.collected || chest.spawned === false) continue;
    const dist = Math.hypot(px - chest.x, py - chest.y);
    if (dist < PICKUP_R) {
      openSpatialChoice(state, chest, onEnterBattle);
      return true;
    }
  }
  return false;
}

export function isNearSpatialChest(state) {
  if (state.phase !== 'play') return false;
  const px = state.player.x, py = state.player.y;
  const PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE;

  for (const chest of (state.spatialChests || [])) {
    if (chest.collected || chest.spawned === false) continue;
    const dist = Math.hypot(px - chest.x, py - chest.y);
    if (dist < PICKUP_R) return true;
  }
  return false;
}

// ── Room bonus altar F-key activation ───────────

export function checkRoomBonusAltarActivation(state, fKeyPressed, onEnterBattle) {
  if (!fKeyPressed) return false;
  const px = state.player.x, py = state.player.y;
  const PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE;

  for (const altar of (state.roomBonusAltars || [])) {
    if (altar.activated) continue;
    if (!state.openCells.has(altar.cellKey)) continue;
    const dist = Math.hypot(px - altar.x, py - altar.y);
    if (dist < PICKUP_R) {
      openRoomBonusChoice(state, altar, onEnterBattle);
      return true;
    }
  }
  return false;
}

export function isNearRoomBonusAltar(state) {
  if (state.phase !== 'play') return false;
  const px = state.player.x, py = state.player.y;
  const PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE;

  for (const altar of (state.roomBonusAltars || [])) {
    if (altar.activated) continue;
    if (!state.openCells.has(altar.cellKey)) continue;
    const dist = Math.hypot(px - altar.x, py - altar.y);
    if (dist < PICKUP_R) return true;
  }
  return false;
}

export function openRoomBonusChoice(state, altar, onEnterBattle) {
  if (!altar) return;
  if (altar.activated) return;
  state._roomBonusChoiceState = {
    altar,
    active: true,
    onEnterBattle,
    selected: false,
  };
}

export function applyRoomBonusChoice(state, playerProgress, choiceId) {
  if (!state._roomBonusChoiceState) return;
  const { altar, onEnterBattle } = state._roomBonusChoiceState;

  if (altar) {
    altar.activated = true;
    altar.bonusType = choiceId;
    // Add to roomBonuses array
    if (choiceId) {
      state.roomBonuses.push({ roomIdx: altar.roomIdx, bonusType: choiceId });
    }
  }

  const cb = state._roomBonusChoiceState.onEnterBattle;
  state._roomBonusChoiceState = null;

  // Rebuild tile layer to show bonus icon immediately
  const currentLevel = getCurrentLevel();
  buildTileLayer(layers.tiles, {
    blobCells:          state.blobCells,
    openCells:          state.openCells,
    everRevealedCells:  state.everRevealedCells,
    everOpenedCells:   state.everOpenedCells,
    removedWalls:       state.removedWalls,
    internalWalls:      state.internalWalls,
    fixedWalls:         state.fixedWalls,
    permanentlyClosed: state.permanentlyClosed,
    disabledCells:      state.disabledCells,
    rooms:              state.rooms,
    purified:           state.purified,
    chestObjs:          state.chestObjs,
    hearts:             state.hearts,
    upgradeChests:      state.upgradeChests,
    summonSphere:       state.summonSphere,
    roomBonuses:        state.roomBonuses,
    roomBonusAltars:     state.roomBonusAltars,
  }, currentLevel);

  // Enter battle mode after choice only if enemies not already released
  const altarContent = altar ? state.cellContents.get(altar.cellKey) : null;
  if (cb && !(altarContent && altarContent.enemiesReleased)) cb(altar?.cellKey);
}
