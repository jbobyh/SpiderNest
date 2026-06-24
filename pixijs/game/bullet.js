export class Bullet {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this._baseVx = 0;
    this._baseVy = 0;
    this.speed = 0;
    this.damage = 0;
    this.owner = 'player'; // 'player' or 'enemy'
    this.penetrate = 0;
    this._basePenetrate = 0;
    this.ricochet = false;
    this.color = 0xffffff;
    this.maxRange = 1000;
    this.distanceTraveled = 0;
    this.hitCount = 0;
    this.isCrit = false;
    this.enhancedPierceActive = false;
    this.hitEntities = new Set(); // To avoid hitting same entity multiple times (if piercing)
    this._lastRoomBonus = null;
    this._ricocheted = false;
    this.isDead = false;
    
    // Future modifiers support
    this.modifiers = [];
  }

  init(data) {
    this.x = data.x;
    this.y = data.y;
    this.vx = data.vx;
    this.vy = data.vy;
    this._baseVx = data.vx;
    this._baseVy = data.vy;
    this.speed = Math.hypot(data.vx, data.vy);
    this.damage = data.damage || 1;
    this.owner = data.owner || 'player';
    this.penetrate = data.penetrate ?? 0;
    this._basePenetrate = this.penetrate;
    this.ricochet = !!data.ricochet;
    this.color = data.color || 0xffffff;
    this.maxRange = data.maxRange || 1000;
    this.isCrit = !!data.isCrit;
    this.isDead = false;
    
    this.distanceTraveled = 0;
    this.hitCount = 0;
    this.enhancedPierceActive = false;
    this.hitEntities.clear();
    this._lastRoomBonus = null;
    this._ricocheted = false;
  }
}

const pool = [];

export function acquireBullet(data) {
  const b = pool.pop() ?? new Bullet();
  b.init(data);
  return b;
}

export function releaseBullet(b) {
  b.isDead = true;
  pool.push(b);
}
