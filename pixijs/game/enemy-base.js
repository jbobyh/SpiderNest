import { createEnemyBody, destroyBody, setBodyVelocity } from '../world/physics.js';
import { cellOf, cellKey, CELL_PX, getRoomBonus, getRoomSpeedMultiplier } from '../world/constants.js';
import { Sounds } from '../core/sound.js';

export class Enemy {
  constructor(data) {
    Object.assign(this, data);
    
    this.vx = data.vx || 0;
    this.vy = data.vy || 0;
    this.maxHp = data.maxHp || data.hp;
    this.radius = data.radius || (typeof CONFIG !== 'undefined' ? CONFIG.SPIDER_RADIUS : 20);
    this.visualScale = data.visualScale || 3.2;
    this.lastX = data.lastX ?? data.x;
    this.lastY = data.lastY ?? data.y;

    this.body = data.body || null;
    this.isDead = false;
    this.stuckTimer = data.stuckTimer || 0;
    this.stunTimer = data.stunTimer || 0;
    this.hitFlash = data.hitFlash || 0;
  }

  update(dt, state) {
    if (this.isDead) return;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.stunTimer > 0) this.stunTimer -= dt;

    if (!this.body) {
      this.body = createEnemyBody(this.x, this.y, this.radius, this);
    }

    this._updateStuckDetection(dt, state);
    this.updateBehavior(dt, state);
    this._syncWithBody();
  }

  updateBehavior(dt, state) {
    // To be overridden by subclasses
  }

  _updateStuckDetection(dt, state) {
    if (this.type === 'cocoon' || this.type === 'plevaka' || this.type === 'shooter' || this.type === 'bull' || this.isBoss) {
      return;
    }
    const moved = Math.hypot(this.x - this.lastX, this.y - this.lastY);
    if (moved < 1) {
      this.stuckTimer += dt;
      if (this.stuckTimer >= 5) {
        this.die(state, true); 
      }
    } else {
      this.stuckTimer = 0;
      this.lastX = this.x;
      this.lastY = this.y;
    }
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
    return getRoomSpeedMultiplier(state, ck);
  }

  takeDamage(damage, isCrit = false) {
    this.hp -= damage;
    this.hitFlash = (typeof CONFIG !== 'undefined') ? CONFIG.ENEMY_HIT_FLASH_DURATION : 0.1;
    if (!this.isBoss) {
      this.stunTimer = (typeof CONFIG !== 'undefined') ? CONFIG.ENEMY_STUN_DURATION : 0.2;
    }
    Sounds.hit();
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
