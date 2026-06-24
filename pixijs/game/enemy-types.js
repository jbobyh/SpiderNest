import { Enemy } from './enemy-base.js';
import { getEnemyMoveDir, hasLineOfSight } from './flow-field.js';
import { setBodyVelocity } from '../world/physics.js';
import { enemyBulletRange } from './combat.js';
import { CELL_PX, cellKey } from '../world/constants.js';

// ── Chaser (Soldier, Bat, Chaser) ─────────────────────────────
export class ChaserEnemy extends Enemy {
  updateBehavior(dt, state) {
    if (this.stunTimer > 0) {
      setBodyVelocity(this.body, 0, 0);
      return;
    }

    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      const dir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
      const speedMult = this.getRoomSpeedMult(state);
      const baseSpeed = this.type === 'bat' ? CONFIG.BAT_SPEED : CONFIG.SPIDER_SPEED;
      setBodyVelocity(this.body, dir.dx * baseSpeed * speedMult, dir.dy * baseSpeed * speedMult);
    }

    if (this.type === 'bat') {
      this._updateBatAnim(dt);
    }
  }

  _updateBatAnim(dt) {
    if (this.animState === null || typeof BAT_ANIM === 'undefined') return;
    this.animTimer += dt;
    const cfg = BAT_ANIM;
    if (this.animTimer >= 1 / cfg.fps) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % cfg.frames;
    }
  }
}

// ── Shooter (Shooter, Plevaka) ─────────────────────────────────
export class ShooterEnemy extends Enemy {
  constructor(data) {
    super(data);
    this.shootCd = data.shootCd || 0;
    if (this.animState === null) this.animState = 'idle';
  }

  updateBehavior(dt, state) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    this._updateShooterAnim(dt);

    const hasLos = hasLineOfSight(state.openCells, state.removedWalls, this.x, this.y, state.player.x, state.player.y);
    const isStunned = this.stunTimer > 0;

    if (this.shootCd > 0) this.shootCd -= dt;

    const shootRange = CONFIG.SHOOTER_SHOOT_RANGE_CELLS * CELL_PX;
    const stopDist = CONFIG.SHOOTER_STOP_DIST_CELLS * CELL_PX;

    // Shooting logic
    if (hasLos && dist <= shootRange && this.shootCd <= 0 && dist > 0) {
      this.shootCd = CONFIG.SHOOTER_SHOOT_CD;
      this.animState = 'shoot';
      this.animFrame = 0;
      this.animTimer = 0;

      const ebx = (dx / dist) * CONFIG.SHOOTER_BULLET_SPEED;
      const eby = (dy / dist) * CONFIG.SHOOTER_BULLET_SPEED;
      state.enemyBullets.push({
        x: this.x, y: this.y,
        vx: ebx, vy: eby,
        _baseVx: ebx, _baseVy: eby,
        maxRange: enemyBulletRange(ebx, eby),
        distanceTraveled: 0,
      });
    }

    // Movement logic
    if (isStunned) {
      setBodyVelocity(this.body, 0, 0);
    } else if (!hasLos || dist > stopDist) {
      if (dist > 0) {
        const dir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
        const speedMult = this.getRoomSpeedMult(state);
        setBodyVelocity(this.body, dir.dx * CONFIG.SHOOTER_SPEED * speedMult, dir.dy * CONFIG.SHOOTER_SPEED * speedMult);
        if (this.animState !== 'shoot') this.animState = 'run';
      }
    } else {
      setBodyVelocity(this.body, 0, 0);
      if (this.animState !== 'shoot') this.animState = 'idle';
    }
  }

  _updateShooterAnim(dt) {
    if (this.animState === null || typeof PLEVAKA_ANIMS === 'undefined') return;
    this.animTimer += dt;
    const cfg = PLEVAKA_ANIMS[this.animState];
    if (!cfg) return;
    if (this.animTimer >= 1 / cfg.fps) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % cfg.frames;
      if (this.animState === 'shoot' && this.animFrame === 0) {
        this.animState = 'idle';
        this.animFrame = 0;
      }
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      shootCd: this.shootCd,
    };
  }
}

// ── Bull ──────────────────────────────────────────────────────
export class BullEnemy extends Enemy {
  constructor(data) {
    super(data);
    this.state = data.state || 'chase';
    this.stateTimer = data.stateTimer || 0;
    this.dashDirX = data.dashDirX || 0;
    this.dashDirY = data.dashDirY || 0;
    this.dashDistance = data.dashDistance || 0;
  }

  updateBehavior(dt, state) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);
    
    const chargeDist = (CONFIG.BULL_CHARGE_DIST_CELLS ?? 1.5) * CELL_PX;
    const dashDistMax = (CONFIG.BULL_DASH_DISTANCE_CELLS ?? 3) * CELL_PX;
    const hitDist = this.radius + CONFIG.PLAYER_RADIUS;
    const isStunned = this.stunTimer > 0;

    switch (this.state) {
      case 'chase':
        if (isStunned) {
          setBodyVelocity(this.body, 0, 0);
        } else if (dist > chargeDist && dist > 0) {
          const dir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
          const speedMult = this.getRoomSpeedMult(state);
          setBodyVelocity(this.body, dir.dx * CONFIG.BULL_SPEED * speedMult, dir.dy * CONFIG.BULL_SPEED * speedMult);
        } else if (dist <= chargeDist) {
          this.state = 'prepare';
          this.stateTimer = CONFIG.BULL_PREPARE_TIME;
          setBodyVelocity(this.body, 0, 0);
        }
        break;

      case 'prepare':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'dash';
          const d2 = Math.hypot(state.player.x - this.x, state.player.y - this.y);
          if (d2 > 0) {
            this.dashDirX = (state.player.x - this.x) / d2;
            this.dashDirY = (state.player.y - this.y) / d2;
          } else {
            this.dashDirX = dx / (dist || 1);
            this.dashDirY = dy / (dist || 1);
          }
          this.dashDistance = dashDistMax;
          this.stateTimer = 0;
        }
        break;

      case 'dash': {
        const dashSpeed = CONFIG.BULL_SPEED * 4;
        const speedMult = this.getRoomSpeedMult(state);
        setBodyVelocity(this.body, this.dashDirX * dashSpeed * speedMult, this.dashDirY * dashSpeed * speedMult);
        this.stateTimer += dashSpeed * speedMult * dt;
        
        const hitWall = this.body && Math.hypot(this.body.velocity.x, this.body.velocity.y) < dashSpeed * speedMult * 0.3;
        if (hitWall || this.stateTimer >= this.dashDistance) {
          this.state = 'rest';
          this.stateTimer = CONFIG.BULL_REST_TIME;
          setBodyVelocity(this.body, 0, 0);
        }
        
        if (dist < hitDist) {
          // Contact damage handled by onCollision, but we stop dash
          this.state = 'rest';
          this.stateTimer = CONFIG.BULL_REST_TIME;
          setBodyVelocity(this.body, 0, 0);
        }
        break;
      }

      case 'rest':
        this.stateTimer -= dt;
        setBodyVelocity(this.body, 0, 0);
        if (this.stateTimer <= 0) this.state = 'chase';
        break;
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      state: this.state,
      stateTimer: this.stateTimer,
      dashDirX: this.dashDirX,
      dashDirY: this.dashDirY,
      dashDistance: this.dashDistance,
    };
  }
}

// ── Buldyga ───────────────────────────────────────────────────
export class BuldygaEnemy extends Enemy {
  constructor(data) {
    super(data);
    this.currentSpeed = data.currentSpeed ?? CONFIG.BULDYGA_SPEED;
    this.speedAccumulator = data.speedAccumulator ?? 0;
  }

  updateBehavior(dt, state) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.stunTimer > 0) {
      this.vx = 0; this.vy = 0;
      setBodyVelocity(this.body, 0, 0);
      return;
    }

    this.speedAccumulator += dt;
    if (this.speedAccumulator >= 1.0) {
      const secs = Math.floor(this.speedAccumulator);
      this.currentSpeed += CONFIG.BULDYGA_SPEED_INCREMENT * secs;
      this.speedAccumulator -= secs;
    }

    const speedMult = this.getRoomSpeedMult(state);
    const effectiveSpeed = this.currentSpeed * speedMult;

    if (dist > 0) {
      const tvx = (dx / dist) * effectiveSpeed;
      const tvy = (dy / dist) * effectiveSpeed;
      const acc = (CONFIG.BULDYGA_ACCEL * 0.1) * dt;
      const dvx = tvx - this.vx;
      const dvy = tvy - this.vy;
      const dLen = Math.hypot(dvx, dvy);

      if (dLen > 0) {
        const step = Math.min(dLen, acc);
        this.vx += (dvx / dLen) * step;
        this.vy += (dvy / dLen) * step;
      }
    } else {
      const friction = 1 - CONFIG.BULDYGA_FRICTION * dt;
      this.vx *= Math.max(0, friction);
      this.vy *= Math.max(0, friction);
    }

    // Wall hit check (internal velocity sync)
    if (this.body) {
      const bv = this.body.velocity;
      const bSpd = Math.hypot(bv.x, bv.y);
      const vSpd = Math.hypot(this.vx, this.vy);
      if (vSpd > 0.5 && bSpd < vSpd * 0.2) {
        this.vx = bv.x;
        this.vy = bv.y;
      }
    }
    
    setBodyVelocity(this.body, this.vx, this.vy);
  }

  serialize() {
    return {
      ...super.serialize(),
      currentSpeed: this.currentSpeed,
      speedAccumulator: this.speedAccumulator,
    };
  }
}

// ── Bloated ───────────────────────────────────────────────────
export class BloatedEnemy extends Enemy {
  updateBehavior(dt, state) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.stunTimer <= 0 && dist > 0) {
      const dir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
      const speedMult = this.getRoomSpeedMult(state);
      setBodyVelocity(this.body, dir.dx * CONFIG.BLOATED_SPEED * speedMult, dir.dy * CONFIG.BLOATED_SPEED * speedMult);
    } else {
      setBodyVelocity(this.body, 0, 0);
    }
  }
}

// ── Cocoon ────────────────────────────────────────────────────
export class CocoonEnemy extends Enemy {
  constructor(data) {
    super(data);
    this.spawnTimer = data.spawnTimer ?? CONFIG.COCOON_SPAWN_INTERVAL;
  }

  updateBehavior(dt, state) {
    const cx = Math.floor(this.x / CELL_PX), cy = Math.floor(this.y / CELL_PX);
    if (!state.openCells.has(cellKey(cx, cy))) {
      this.die(state, true);
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = CONFIG.COCOON_SPAWN_INTERVAL;
      const a = Math.random() * Math.PI * 2;
      const d = this.radius + CONFIG.SPIDER_RADIUS + 5;
      const spawnX = this.x + Math.cos(a) * d;
      const spawnY = this.y + Math.sin(a) * d;
      
      // We will need to use EnemyFactory here, but to avoid circular dependency
      // we'll handle actual pushing to activeSpiders in enemy-ai.js or use a callback
      if (this.onSpawnRequested) {
        this.onSpawnRequested('soldier', spawnX, spawnY);
      }
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      spawnTimer: this.spawnTimer,
    };
  }
}
