import { createEnemyBody, destroyBody, setBodyVelocity } from '../world/physics.js';
import { cellOf, cellKey, CELL_PX, getRoomBonus, getRoomSpeedMultiplier } from '../world/constants.js';
import { Sounds } from '../core/sound.js';
import { updateStatuses, hasStatus } from './status-system.js';
import { spawnDamageNumber } from '../render/damage-numbers.js';

export class Enemy {
  constructor(data) {
    Object.assign(this, data);
    
    this.vx = data.vx || 0;
    this.vy = data.vy || 0;
    this.maxHp = data.maxHp || data.hp;
    this.radius = data.radius || (typeof CONFIG !== 'undefined' ? CONFIG.ENEMY_STATS.soldier.radius : 20);
    this.visualScale = data.visualScale || 3.2;
    this.body = data.body || null;
    this.isDead = false;
    this.stunTimer = data.stunTimer || 0;
    this.hitFlash = data.hitFlash || 0;

    this.hpBarVisible = false;
    this.displayedHp = data.displayedHp ?? data.hp;
    this.hpDamageTimer = 0;
    this.hpDamageStart = data.hpDamageStart ?? data.hp;
    this.statuses = {};
  }

  update(dt, state) {
    if (this.isDead) return;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.stunTimer > 0) this.stunTimer -= dt;

    if (!this.body) {
      this.body = createEnemyBody(this.x, this.y, this.radius, this);
    }

    if ((state.battle?.freezeTimer ?? 0) > 0) {
      setBodyVelocity(this.body, 0, 0);
      this._syncWithBody();
      return;
    }

    this.updateBehavior(dt, state);
    this._syncWithBody();

    if (!this.isDead) {
      updateStatuses(this, dt, state);
    }
  }

  updateBehavior(dt, state) {
    // To be overridden by subclasses
  }

  _syncWithBody() {
    if (this.body) {
      this.x = this.body.position.x;
      this.y = this.body.position.y;
    }
  }

  getRoomSpeedMult(state) {
    const cell = cellOf(this.x, this.y);
    const ck = cellKey(cell.x, cell.y);
    let mult = getRoomSpeedMultiplier(state, ck);
    if (hasStatus(this, 'freeze')) mult *= 0.5;
    return mult;
  }

  takeDamage(damage, isCrit = false, options = {}) {
    this.hpBarVisible = true;
    this.hpDamageStart = this.displayedHp;
    this.hpDamageTimer = 0;
    this.hp -= damage;
    this.hitFlash = (typeof CONFIG !== 'undefined') ? CONFIG.ENEMY_HIT_FLASH_DURATION : 0.1;
    if (!options.silent) Sounds.hit();
    if (options.state && options.showDamageNumber !== false) {
      spawnDamageNumber(options.state, this.x, this.y - (this.radius || CONFIG.ENEMY_STATS.soldier.radius), damage, isCrit, 1);
    }
    if (this.hp <= 0) {
      this.die();
    }
  }

  die(state, silent = false) {
    this.isDead = true;
    if (this.body) {
      destroyBody(this.body);
      this.body = null;
    }
    if (!silent) {
      Sounds.death();
    }
  }

  serialize() {
    const data = { ...this };
    delete data.body;
    return data;
  }
}
