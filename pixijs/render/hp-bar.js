// ============================================================
// HP BAR (shared)
//
// Reusable HP-bar animation + drawing helpers shared by the
// per-enemy world bars (enemy-renderer.js) and the boss HUD bar
// (hud.js). Both use the same "ghost eat" animation: a white
// segment shows the recently-lost HP and shrinks toward the
// current HP over animDuration seconds.
// ============================================================

/**
 * Advance the HP-bar "ghost eat" animation for an entity.
 * Reads/writes entity.hpDamageTimer and entity.displayedHp.
 *
 * @param {object} entity        — must have hp, hpDamageStart, hpDamageTimer, displayedHp
 * @param {number} dt            — delta time (sec)
 * @param {number} animDuration  — animation length (sec)
 */
export function tickHpAnim(entity, dt, animDuration) {
  if (entity.hpDamageTimer < animDuration) {
    entity.hpDamageTimer += dt;
    const t = Math.min(1, entity.hpDamageTimer / animDuration);
    entity.displayedHp = entity.hpDamageStart + (entity.hp - entity.hpDamageStart) * t;
    if (t >= 1) entity.displayedHp = entity.hp;
  } else {
    entity.displayedHp = entity.hp;
  }
}

/**
 * Draw an HP bar into a Graphics: background, white ghost segment,
 * then the red current-HP fill.
 *
 * @param {import('pixi.js').Graphics} gfx
 * @param {object} o
 * @param {number} o.x, o.y      — top-left of the bar (in gfx local coords)
 * @param {number} o.w, o.h      — bar size
 * @param {number} o.hpPct       — current hp fraction [0..1]
 * @param {number} o.dispPct     — displayed (animated) hp fraction [0..1]
 * @param {number} o.bgColor
 * @param {number} o.hpColor
 * @param {number} o.ghostColor
 */
export function drawHpBar(gfx, { x, y, w, h, hpPct, dispPct, bgColor, hpColor, ghostColor }) {
  gfx.clear();

  // Background
  gfx.rect(x, y, w, h).fill({ color: bgColor });

  // White ghost (displayedHp → hp)
  if (dispPct > hpPct) {
    gfx.rect(x + hpPct * w, y, (dispPct - hpPct) * w, h).fill({ color: ghostColor });
  }

  // Red fill (current hp)
  gfx.rect(x, y, hpPct * w, h).fill({ color: hpColor });
}
