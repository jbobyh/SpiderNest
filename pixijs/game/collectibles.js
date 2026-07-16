// ============================================================
// COLLECTIBLES — upgrades, chests, room bonus altars
// ============================================================

import { cellOf, cellKey, CELL_PX, inOpenRect } from '../world/constants.js';
import { Sounds } from '../core/sound.js';
import { applyUpgrade } from './upgrades.js';
import { buildTileLayer } from '../render/tiles.js';
import { layers } from '../render/layers.js';
import { getCurrentLevel, saveCurrentGame } from '../game-loop.js';

const PICKUP_R = CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE;

// ── Play-mode collectibles update ─────────────────────────────

export function updateCollectibles(state, playerProgress, onParticles, onUpgradePopup) {
  // No automatic pickups in new system — chests are activated via F key
}

// ── Spatial chest choice ───────────

export function isNearAltar(state) {
  return false;
}

export function openSpatialChoice(state, chest, onEnterBattle) {
  if (!chest && !state._specialChoiceState) {
    state._specialChoiceState = { type: 'spatial', chest: null, active: false };
  }
  if (!chest) return;
  if (chest.collected) return;
  state._specialChoiceState = { type: 'spatial', chest, active: true, onEnterBattle };
}

export function applySpecialChoice(state, playerProgress, choiceId) {
  if (!state._specialChoiceState) return;
  const { type, chest, onEnterBattle } = state._specialChoiceState;
  if (chest) chest.collected = true;
  state._specialChoiceState = null;

  if (!choiceId) return;
  applyUpgrade(state, playerProgress, choiceId);

  const content = chest ? state.cellContents.get(chest.cellKey) : null;
  if (onEnterBattle && (state.pendingNextCycle || !(content && content.enemiesReleased))) onEnterBattle(chest?.cellKey);
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

  // Enter battle mode only if enemies not already released (or pending next cycle)
  const content = chest ? state.cellContents.get(chest.cellKey) : null;
  if (cb && (state.pendingNextCycle || !(content && content.enemiesReleased))) cb(chest?.cellKey);
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
    if (!inOpenRect(altar.x, altar.y, state.openRect)) continue;
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
    if (!inOpenRect(altar.x, altar.y, state.openRect)) continue;
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
    openCells:          state.openCells,
    rooms:              state.rooms,
    purified:           state.purified,
    chestObjs:          state.chestObjs,
    upgradeChests:      state.upgradeChests,
    roomBonuses:        state.roomBonuses,
    roomBonusAltars:     state.roomBonusAltars,
    openRect:           state.openRect,
  }, currentLevel);

  // Enter battle mode after choice only if enemies not already released (or pending next cycle)
  const altarContent = altar ? state.cellContents.get(altar.cellKey) : null;
  if (cb && (state.pendingNextCycle || !(altarContent && altarContent.enemiesReleased))) cb(altar?.cellKey);
}
