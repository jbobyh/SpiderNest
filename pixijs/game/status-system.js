// ============================================================
// STATUS SYSTEM — applyStatus(), updateStatuses(), hasStatus()
// Generic status effect system for enemies.
// Statuses are stored on enemy.statuses as { [type]: statusInstance }
// Each statusInstance: { remaining, tickTimer, tickInterval, ...options }
// ============================================================

import { Sounds } from '../core/sound.js';

// ── Status definitions ────────────────────────────────────────
// Each def: { duration, tickInterval, onApply(enemy, state, opts), onTick(enemy, state, status), onExpire(enemy, state) }

export const STATUS_DEFS = {
  freeze: {
    duration: 2.0,
    tickInterval: 0,
  },
  burn: {
    duration: 2.0,
    tickInterval: 0.2,
    onTick(enemy, state, status) {
      enemy.takeDamage(status.damagePerTick, false, { state, silent: true });

      if (enemy.hp <= 0 && !enemy.isDead) {
        enemy.die();
      }
    },
  },
};

// ── Public API ────────────────────────────────────────────────

export function applyStatus(enemy, statusType, duration, options = {}) {
  const def = STATUS_DEFS[statusType];
  if (!def) return;

  const dur = duration ?? def.duration;

  if (!enemy.statuses) enemy.statuses = {};

  const existing = enemy.statuses[statusType];
  if (existing) {
    existing.remaining = dur;
  } else {
    enemy.statuses[statusType] = {
      remaining: dur,
      tickTimer: 0,
      tickInterval: def.tickInterval,
      damagePerTick: options.damagePerTick ?? 0,
      ...options,
    };
  }

  if (def.onApply) def.onApply(enemy, options.state, options);
}

export function updateStatuses(enemy, dt, state) {
  if (!enemy.statuses) return;

  for (const type of Object.keys(enemy.statuses)) {
    const status = enemy.statuses[type];
    const def = STATUS_DEFS[type];
    if (!def) {
      delete enemy.statuses[type];
      continue;
    }

    status.remaining -= dt;
    if (status.remaining <= 0) {
      if (def.onExpire) def.onExpire(enemy, state);
      delete enemy.statuses[type];
      continue;
    }

    if (def.onTick && status.tickInterval > 0) {
      status.tickTimer += dt;
      while (status.tickTimer >= status.tickInterval) {
        status.tickTimer -= status.tickInterval;
        def.onTick(enemy, state, status);
        if (enemy.isDead) return;
      }
    }
  }
}

export function hasStatus(enemy, statusType) {
  return !!(enemy.statuses && enemy.statuses[statusType]);
}

export function clearStatuses(enemy) {
  if (enemy.statuses) enemy.statuses = {};
}
