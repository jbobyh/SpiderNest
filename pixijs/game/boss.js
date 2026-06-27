// ============================================================
// BOSS — phase boss AI (boss_phase type)
// Called from the battle update loop for entities where g.isBoss.
// BOSS_DEFS / CONFIG are globals from config.js.
// ============================================================

import { cellKey, CELL_PX } from '../world/constants.js';
import { destroyBody } from '../world/physics.js';
import { Sounds } from '../core/sound.js';
import { showUpgradePopup } from './upgrades.js';
import { EnemyFactory } from './enemy-factory.js';

import { openBossCursedChoice } from './collectibles.js';

// ── Boss kill handler ─────────────────────────────────────────

export function handleBossKilled(g, state, playerProgress) {
  state.bossDefeated = true;
  if (g.body) destroyBody(g.body);
  const bossCellX = Math.floor(g.x / CELL_PX);
  const bossCellY = Math.floor(g.y / CELL_PX);
  state.exitCell = { x: bossCellX, y: bossCellY };
  Sounds.stopBossMusic?.();
  showUpgradePopup('БОСС ПОБЕЖДЕН!', '#ff4400');
  openBossCursedChoice(state);
}

// ── Create boss entity ────────────────────────────────────────

export function createBossEntity(level, cx, cy) {
  return EnemyFactory.create('boss_phase', cx, cy, { level });
}

// ── Freeze upgrade ────────────────────────────────────────────

export function applyFreezeUpgrade(b, state) {
  if (!state.upgrades.freeze) return;
  if (b?.freezeTimer > 0) return;
  if (b) b.freezeTimer = CONFIG.FREEZE_DURATION ?? 3;
  Sounds.play?.('shield');
}
