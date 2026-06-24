import { createEnemyBody, destroyBody, setBodyVelocity } from '../world/physics.js';
import { cellOf, cellKey, CELL_PX, getRoomBonus } from '../world/constants.js';
import { Sounds } from '../core/sound.js';

export class Enemy {
  constructor(data) {
    this.x = data.x;
    this.y = data.y;
    this.vx = data.vx || 0;
    this.vy = data.vy || 0;
    this.hp = data.hp;
    this.maxHp = data.maxHp || data.hp;
    this.radius = data.radius || (typeof CONFIG !== 'undefined' ? CONFIG.SPIDER_RADIUS : 20);
    this.visualScale = data.visualScale || 3.2;
    this.type = data.type;
    this.isBoss = !!data.isBoss;

    this.hitFlash = data.hitFlash || 0;
    this.stunTimer = data.stunTimer || 0;
    this.stuckTimer = data.stuckTimer || 0;
    this.lastX = data.lastX ?? data.x;
    this.lastY = data.lastY ?? data.y;

    this.body = data.body || null;
    this.isDead = false;

    // Animation state
    this.animState = data.animState || null;
    this.animFrame = data.animFrame || 0;
    this.animTimer = data.animTimer || 0;
  }

  update(dt, state) {
    if (this.isDead) return;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.stunTimer > 0) this.stunTimer -= dt;

    if (!this.body) {
      this.body = createEnemyBody(this.x, this.y, this.radius, this);
    }

    this._updateStuckDetection(dt);
    this.updateBehavior(dt, state);
    this._syncWithBody();
  }

  updateBehavior(dt, state) {
    // To be overridden by subclasses
  }

  _updateStuckDetection(dt) {
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
    const roomBonus = getRoomBonus(state, ck);
    if (roomBonus === 'speedup') {
      const bonusDef = (typeof ROOM_BONUS_TYPES !== 'undefined') && ROOM_BONUS_TYPES.find(bt => bt.id === 'speedup');
      return bonusDef?.speedMult || 1.3;
    }
    if (roomBonus === 'speeddown') {
      const bonusDef = (typeof ROOM_BONUS_TYPES !== 'undefined') && ROOM_BONUS_TYPES.find(bt => bt.id === 'speeddown');
      return bonusDef?.speedMult || 0.7;
    }
    return 1.0;
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
    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      hp: this.hp,
      maxHp: this.maxHp,
      radius: this.radius,
      visualScale: this.visualScale,
      type: this.type,
      isBoss: this.isBoss,
      hitFlash: this.hitFlash,
      stunTimer: this.stunTimer,
      stuckTimer: this.stuckTimer,
      lastX: this.lastX,
      lastY: this.lastY,
      animState: this.animState,
      animFrame: this.animFrame,
      animTimer: this.animTimer,
    };
  }
}
