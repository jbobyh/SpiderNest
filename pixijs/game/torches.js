// ============================================================
// TORCHES — place/pickup torches, darkness damage, stasis activation
// Torch mode (level 1): lives = torches. Player emits light while
// holding >=1 torch. Torches placed on ground emit light too.
// ============================================================

import { Sounds } from '../core/sound.js';
import { dealPlayerDamage } from './upgrades.js';
import { spawnParticles } from '../render/particles.js';
import { saveCurrentGame } from '../game-loop.js';

const { LIGHT_RADIUS, PICKUP_RADIUS, DARKNESS_DAMAGE_COOLDOWN } = CONFIG.TORCH_MODE;

let _torchRightHeld = false;

// ── Torch placement / pickup ─────────────────────────────────

export function handleTorchAction(state, mx, my, rightHeld, camera, onPlayerDead) {
  if (!state.torchMode) return;

  // Debounce: trigger only on rising edge
  if (!rightHeld) {
    _torchRightHeld = false;
    return;
  }
  if (_torchRightHeld) return;
  _torchRightHeld = true;

  // Check if clicking on an existing torch → pick it up
  for (const torch of state.torches) {
    const dist = Math.hypot(mx - torch.x, my - torch.y);
    if (dist < PICKUP_RADIUS) {
      const idx = state.torches.indexOf(torch);
      state.torches.splice(idx, 1);
      state.player.lives++;
      Sounds.heartcollect?.();
      spawnParticles(state.particles, torch.x, torch.y, 8, 0, Math.PI * 2, 20, 40, 0.4, '#ffaa44');
      saveCurrentGame();
      return;
    }
  }

  // Place new torch if player has lives to spend
  if (state.player.lives <= 0) return;

  state.player.lives--;
  state.torches.push({ x: mx, y: my, radius: LIGHT_RADIUS });
  Sounds.hearttravel?.();
  spawnParticles(state.particles, mx, my, 6, 0, Math.PI * 2, 15, 35, 0.3, '#ffaa44');
  saveCurrentGame();
}

// ── Light check ──────────────────────────────────────────────

export function isInLight(state, x, y) {
  // Player emits light while holding >=1 torch
  if (state.player.lives > 0) {
    const dist = Math.hypot(x - state.player.x, y - state.player.y);
    if (dist < LIGHT_RADIUS) return true;
  }

  // Ground torches
  for (const torch of state.torches) {
    const dist = Math.hypot(x - torch.x, y - torch.y);
    if (dist < torch.radius) return true;
  }

  return false;
}

// ── Darkness damage ──────────────────────────────────────────

export function updateDarkness(state, dt, playerProgress, onPlayerDead) {
  if (!state.torchMode) return;
  if (state.phase !== 'play') return;

  const playerInLight = isInLight(state, state.player.x, state.player.y);

  if (!playerInLight) {
    if (state.darknessDamageCooldown > 0) {
      state.darknessDamageCooldown -= dt;
    } else {
      // Deal damage
      state.darknessDamageCooldown = DARKNESS_DAMAGE_COOLDOWN;
      spawnParticles(state.particles, state.player.x, state.player.y, 10, 0, Math.PI * 2, 20, 50, 0.5, '#660066');
      dealPlayerDamage(state, playerProgress, null, onPlayerDead);
    }
  } else {
    // Reset cooldown when in light
    state.darknessDamageCooldown = 0;
  }
}

// ── Stasis enemy activation by light ─────────────────────────

export function checkEnemyStasisActivation(state) {
  if (!state.torchMode) return;
  if (state.phase !== 'play') return;

  for (const enemy of state.activeSpiders) {
    if (!enemy.stasis) continue;
    if (isInLight(state, enemy.x, enemy.y)) {
      enemy.stasis = false;
      // Mark room content as released
      if (enemy.stasisRoomIdx !== undefined) {
        const room = state.rooms?.[enemy.stasisRoomIdx];
        if (room) {
          for (const cell of room.cells) {
            const content = state.cellContents?.get(cell.k);
            if (content) content.enemiesReleased = true;
          }
        }
      }
    }
  }
}
