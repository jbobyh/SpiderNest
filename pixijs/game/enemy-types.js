import { Enemy } from './enemy-base.js';
import { getEnemyMoveDir, hasLineOfSight } from './flow-field.js';
import { setBodyVelocity, createGhostBody } from '../world/physics.js';
import { updateStatuses } from './status-system.js';
import { enemyBulletRange, ENEMY_BULLET_COLOR } from './combat.js';
import { bulletManager } from './bullet-manager.js';
import { CELL_PX, cellKey } from '../world/constants.js';

// ── Chaser (Soldier, Tank) ─────────────────────────────────────
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
      const speedMult = this.getRoomSpeedVectorMult(state, dir.dx, dir.dy);
      const speed = this.type === 'tank' ? CONFIG.ENEMY_STATS.tank.speed : CONFIG.ENEMY_STATS.soldier.speed;
      setBodyVelocity(this.body, dir.dx * speed * speedMult, dir.dy * speed * speedMult);
    }
  }
}

// ── Bat (Zigzag Chaser) ───────────────────────────────────────
export class ZigzagChaserEnemy extends Enemy {
  constructor(data) {
    super(data);
    if (this.animState == null) this.animState = 'fly';
    if (this.animFrame == null) this.animFrame = 0;
    if (this.animTimer == null) this.animTimer = 0;
  }

  updateBehavior(dt, state) {
    const speedMult = this.getRoomSpeedMult(state);
    this._updateBatAnim(dt * speedMult);

    if (this.stunTimer > 0) {
      setBodyVelocity(this.body, 0, 0);
      return;
    }

    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      const baseSpeed = CONFIG.ENEMY_STATS.bat.speed;
      
      // Use direct movement with zigzag if LoS, otherwise follow flow field
      const hasLos = hasLineOfSight(state.openCells, state.removedWalls, this.x, this.y, state.player.x, state.player.y);
      
      let moveDir;
      if (hasLos) {
        // Normalized direct vector
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        // Perpendicular vector (rotate 90 deg: (x, y) -> (-y, x))
        const perpX = -dirY;
        const perpY = dirX;
        
        // Sine-based oscillation
        const freq = CONFIG.ENEMY_STATS.bat.zigzagFreq;
        const amp = CONFIG.ENEMY_STATS.bat.zigzagAmp;
        const offset = Math.sin(state.time * freq) * amp;
        
        // Final direction = direct + oscillating perpendicular
        moveDir = {
          dx: dirX + perpX * offset,
          dy: dirY + perpY * offset
        };
        
        // Re-normalize to ensure constant speed
        const moveLen = Math.hypot(moveDir.dx, moveDir.dy);
        if (moveLen > 0) {
          moveDir.dx /= moveLen;
          moveDir.dy /= moveLen;
        }
      } else {
        // Fallback to flow field pathfinding when out of LoS
        moveDir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
      }
      
      const moveSpeedMult = this.getRoomSpeedVectorMult(state, moveDir.dx, moveDir.dy);
      setBodyVelocity(this.body, moveDir.dx * baseSpeed * moveSpeedMult, moveDir.dy * baseSpeed * moveSpeedMult);
    }
  }

  _updateBatAnim(dt) {
    if (this.animState == null || typeof SPRITE_SHEETS.bat.anim === 'undefined') return;
    this.animTimer += dt;
    const cfg = SPRITE_SHEETS.bat.anim;
    if (this.animTimer >= 1 / cfg.fps) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % cfg.frames;
    }
  }
}

// ── Shooter ───────────────────────────────────────────────────
export class ShooterEnemy extends Enemy {
  constructor(data) {
    super(data);
    this.shootCd = data.shootCd || 0;
    if (this.animState == null) this.animState = 'idle';
    if (this.animFrame == null) this.animFrame = 0;
    if (this.animTimer == null) this.animTimer = 0;
  }

  updateBehavior(dt, state) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    const speedMult = this.getRoomSpeedMult(state);
    this._updateShooterAnim(dt * speedMult);

    const hasLos = hasLineOfSight(state.openCells, state.removedWalls, this.x, this.y, state.player.x, state.player.y);
    const isStunned = this.stunTimer > 0;

    if (this.shootCd > 0) this.shootCd -= dt;

    const shootRange = CONFIG.ENEMY_STATS.shooter.shootRangeCells * CELL_PX;
    const stopDist = CONFIG.ENEMY_STATS.shooter.stopDistCells * CELL_PX;

    // Shooting logic
    if (hasLos && dist <= shootRange && this.shootCd <= 0 && dist > 0) {
      this.shootCd = CONFIG.ENEMY_STATS.shooter.shootCd;
      this.animState = 'shoot';
      this.animFrame = 0;
      this.animTimer = 0;

      const ebx = (dx / dist) * CONFIG.ENEMY_STATS.shooter.bulletSpeed;
      const eby = (dy / dist) * CONFIG.ENEMY_STATS.shooter.bulletSpeed;
      bulletManager.spawn({
        x: this.x, y: this.y,
        vx: ebx, vy: eby,
        owner: 'enemy',
        color: ENEMY_BULLET_COLOR,
        maxRange: enemyBulletRange(ebx, eby),
      });
    }

    // Movement logic
    if (isStunned) {
      setBodyVelocity(this.body, 0, 0);
    } else if (!hasLos || dist > stopDist) {
      if (dist > 0) {
        const dir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
        setBodyVelocity(this.body, dir.dx * CONFIG.ENEMY_STATS.shooter.speed * speedMult, dir.dy * CONFIG.ENEMY_STATS.shooter.speed * speedMult);
        if (this.animState !== 'shoot') this.animState = 'run';
      }
    } else {
      setBodyVelocity(this.body, 0, 0);
      if (this.animState !== 'shoot') this.animState = 'idle';
    }
  }

  _updateShooterAnim(dt) {
    if (this.animState == null || typeof SPRITE_SHEETS.shooter.anims === 'undefined') return;
    this.animTimer += dt;
    const cfg = SPRITE_SHEETS.shooter.anims[this.animState];
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
}

// ── Wall Shooter (4 bullets in a wall) ────────────────────────
export class WallShooterEnemy extends ShooterEnemy {
  updateBehavior(dt, state) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    const hasLos = hasLineOfSight(state.openCells, state.removedWalls, this.x, this.y, state.player.x, state.player.y);
    const isStunned = this.stunTimer > 0;

    if (this.shootCd > 0) this.shootCd -= dt;

    const stats = CONFIG.ENEMY_STATS.wallshooter;
    const shootRange = stats.shootRangeCells * CELL_PX;
    const stopDist = stats.stopDistCells * CELL_PX;

    if (hasLos && dist <= shootRange && this.shootCd <= 0 && dist > 0) {
      this.shootCd = stats.shootCd;

      const dirX = dx / dist;
      const dirY = dy / dist;
      const perpX = -dirY;
      const perpY = dirX;
      const count = stats.wallBulletCount;
      const spacing = stats.wallBulletSpacing;
      const offset = (count - 1) / 2;

      for (let i = 0; i < count; i++) {
        const ox = perpX * spacing * (i - offset);
        const oy = perpY * spacing * (i - offset);
        bulletManager.spawn({
          x: this.x + ox, y: this.y + oy,
          vx: dirX * stats.bulletSpeed, vy: dirY * stats.bulletSpeed,
          owner: 'enemy',
          color: ENEMY_BULLET_COLOR,
          maxRange: enemyBulletRange(dirX * stats.bulletSpeed, dirY * stats.bulletSpeed),
        });
      }
    }

    if (isStunned) {
      setBodyVelocity(this.body, 0, 0);
    } else if (!hasLos || dist > stopDist) {
      if (dist > 0) {
        const dir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
        const speedMult = this.getRoomSpeedVectorMult(state, dir.dx, dir.dy);
        setBodyVelocity(this.body, dir.dx * stats.speed * speedMult, dir.dy * stats.speed * speedMult);
      }
    } else {
      setBodyVelocity(this.body, 0, 0);
    }
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
    
    const chargeDist = (CONFIG.ENEMY_STATS.bull.chargeDistCells ?? 1.5) * CELL_PX;
    const dashDistMax = (CONFIG.ENEMY_STATS.bull.dashDistCells ?? 3) * CELL_PX;
    const hitDist = this.radius + CONFIG.PLAYER_RADIUS;
    const isStunned = this.stunTimer > 0;

    switch (this.state) {
      case 'chase':
        if (isStunned) {
          setBodyVelocity(this.body, 0, 0);
        } else if (dist > chargeDist && dist > 0) {
          const dir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
          const speedMult = this.getRoomSpeedVectorMult(state, dir.dx, dir.dy);
          setBodyVelocity(this.body, dir.dx * CONFIG.ENEMY_STATS.bull.speed * speedMult, dir.dy * CONFIG.ENEMY_STATS.bull.speed * speedMult);
        } else if (dist <= chargeDist) {
          this.state = 'prepare';
          this.stateTimer = CONFIG.ENEMY_STATS.bull.prepareTime;
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
        const dashSpeed = CONFIG.ENEMY_STATS.bull.speed * 4;
        const speedMult = this.getRoomSpeedVectorMult(state, this.dashDirX, this.dashDirY);

        if (this._hitWall) {
          this._hitWall = false;
          this.state = 'rest';
          this.stateTimer = CONFIG.ENEMY_STATS.bull.restTime;
          setBodyVelocity(this.body, 0, 0);
          break;
        }

        setBodyVelocity(this.body, this.dashDirX * dashSpeed * speedMult, this.dashDirY * dashSpeed * speedMult);
        this.stateTimer += dashSpeed * speedMult * dt;

        if (this.stateTimer >= this.dashDistance) {
          this.state = 'rest';
          this.stateTimer = CONFIG.ENEMY_STATS.bull.restTime;
          setBodyVelocity(this.body, 0, 0);
        }

        if (dist < hitDist) {
          // Contact damage handled by onCollision, but we stop dash
          this.state = 'rest';
          this.stateTimer = CONFIG.ENEMY_STATS.bull.restTime;
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
}

// ── Buldyga ───────────────────────────────────────────────────
export class BuldygaEnemy extends Enemy {
  constructor(data) {
    super(data);
    this.currentSpeed = data.currentSpeed ?? CONFIG.ENEMY_STATS.buldyga.speed;
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
      this.currentSpeed += CONFIG.ENEMY_STATS.buldyga.speedIncrement * secs;
      this.speedAccumulator -= secs;
    }

    const speedMult = this.getRoomSpeedVectorMult(state, dx, dy);
    const effectiveSpeed = this.currentSpeed * speedMult;

    if (dist > 0) {
      const tvx = (dx / dist) * effectiveSpeed;
      const tvy = (dy / dist) * effectiveSpeed;
      const acc = (CONFIG.ENEMY_STATS.buldyga.accel * 0.1) * dt;
      const dvx = tvx - this.vx;
      const dvy = tvy - this.vy;
      const dLen = Math.hypot(dvx, dvy);

      if (dLen > 0) {
        const step = Math.min(dLen, acc);
        this.vx += (dvx / dLen) * step;
        this.vy += (dvy / dLen) * step;
      }
    } else {
      const friction = 1 - CONFIG.ENEMY_STATS.buldyga.friction * dt;
      this.vx *= Math.max(0, friction);
      this.vy *= Math.max(0, friction);
    }

    // Wall/enemy hit — reset inertia (flag set by collision events)
    if (this._hitWall) {
      this.vx = 0;
      this.vy = 0;
      this._hitWall = false;
    }

    setBodyVelocity(this.body, this.vx, this.vy);
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
      const speedMult = this.getRoomSpeedVectorMult(state, dir.dx, dir.dy);
      setBodyVelocity(this.body, dir.dx * CONFIG.ENEMY_STATS.bloated.speed * speedMult, dir.dy * CONFIG.ENEMY_STATS.bloated.speed * speedMult);
    } else {
      setBodyVelocity(this.body, 0, 0);
    }
  }
}

// ── Ghost (passes through walls, direct chase) ────────────────
export class GhostEnemy extends Enemy {
  constructor(data) {
    super(data);
    if (this.animState == null) this.animState = 'move';
    if (this.animFrame == null) this.animFrame = 0;
    if (this.animTimer == null) this.animTimer = 0;
  }

  update(dt, state) {
    if (this.isDead) return;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.stunTimer > 0) this.stunTimer -= dt;

    if (!this.body) {
      this.body = createGhostBody(this.x, this.y, this.radius, this);
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
    const speedMult = this.getRoomSpeedMult(state);
    this._updateGhostAnim(dt * speedMult);

    if (this.stunTimer > 0) {
      setBodyVelocity(this.body, 0, 0);
      this.animState = 'idle';
      return;
    }

    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      const speed = CONFIG.ENEMY_STATS.ghost.speed;
      const moveSpeedMult = this.getRoomSpeedVectorMult(state, dx, dy);
      setBodyVelocity(this.body, (dx / dist) * speed * moveSpeedMult, (dy / dist) * speed * moveSpeedMult);
      this.animState = 'move';
    }
  }

  _updateGhostAnim(dt) {
    if (this.animState == null || typeof SPRITE_SHEETS.ghost === 'undefined') return;
    this.animTimer += dt;
    const cfg = SPRITE_SHEETS.ghost.anims[this.animState];
    if (!cfg) return;
    if (this.animTimer >= 1 / cfg.fps) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % cfg.frames.length;
    }
  }
}

// ── Cocoon ────────────────────────────────────────────────────
export class CocoonEnemy extends Enemy {
  constructor(data) {
    super(data);
    this.spawnTimer = data.spawnTimer ?? CONFIG.ENEMY_STATS.cocoon.spawnInterval;
    this.animTime = data.animTime ?? 0;
  }

  updateBehavior(dt, state) {
    this.animTime += dt * this.getRoomSpeedMult(state);
    const cx = Math.floor(this.x / CELL_PX), cy = Math.floor(this.y / CELL_PX);
    if (!state.openCells.has(cellKey(cx, cy))) {
      this.die(state, true);
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = CONFIG.ENEMY_STATS.cocoon.spawnInterval;
      const a = Math.random() * Math.PI * 2;
      const d = this.radius + CONFIG.ENEMY_STATS.soldier.radius + 5;
      const spawnX = this.x + Math.cos(a) * d;
      const spawnY = this.y + Math.sin(a) * d;
      
      // We will need to use EnemyFactory here, but to avoid circular dependency
      // we'll handle actual pushing to activeSpiders in enemy-ai.js or use a callback
      if (this.onSpawnRequested) {
        this.onSpawnRequested('soldier', spawnX, spawnY);
      }
    }
  }
}

// ── Phase Boss ────────────────────────────────────────────────
export class PhaseBoss extends Enemy {
  constructor(data) {
    super(data);
    this.isBoss = true;
    this.phaseIndex = data.phaseIndex || 0;
    this.phaseTimer = data.phaseTimer || 0;
    this.dashCount = data.dashCount || 0;
    this.strafeDir = data.strafeDir || 1;
    this.strafeSwitchTimer = data.strafeSwitchTimer || (CONFIG.BOSS_STRAFE_SWITCH_TIME ?? 1.2);
    this.level = data.level || 1;
  }

  updateBehavior(dt, state) {
    const bossDef = (typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[this.level]) || this._fallbackDef();

    // Phase timer advance
    {
      const cp = bossDef.phases[this.phaseIndex];
      if (cp && cp.id !== 'bull_limited' && cp.duration !== undefined) {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this._advancePhase(bossDef);
      }
    }

    const phase = bossDef.phases[this.phaseIndex] || bossDef.phases[0];
    const bossSpd = CONFIG.ENEMY_STATS.soldier.speed * (bossDef.speedMult || 1.0);
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    switch (phase.id) {
      case 'pause':
        setBodyVelocity(this.body, 0, 0);
        break;

      case 'soldier':
        if (this.stunTimer <= 0 && dist > 0) {
          const dir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
          const vecMult = this.getRoomSpeedVectorMult(state, dir.dx, dir.dy);
          setBodyVelocity(this.body, dir.dx * bossSpd * vecMult, dir.dy * bossSpd * vecMult);
        } else {
          setBodyVelocity(this.body, 0, 0);
        }
        break;

      case 'buldyga':
        this._updateBuldygaPhase(dt, state, phase, dx, dy, dist);
        break;

      case 'bull_limited':
        this._updateBullLimitedPhase(dt, state, phase, dx, dy, dist);
        break;

      case 'shooter':
        this._updateShooterPhase(dt, state, phase, dx, dy, dist, bossSpd);
        break;
    }
  }

  _advancePhase(bossDef) {
    this.phaseIndex = (this.phaseIndex + 1) % bossDef.phases.length;
    const next = bossDef.phases[this.phaseIndex];
    this.phaseTimer = next.duration ?? Infinity;
    this.dashCount = 0;
    this.state = 'chase';
    this.stateTimer = 0;
    this.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME ?? 1.2;
    // Reset inertia
    this.vx = 0; this.vy = 0;
    this.currentSpeed = undefined;
    this.speedAccumulator = 0;
  }

  _updateBuldygaPhase(dt, state, phase, dx, dy, dist) {
    const accelMult = phase.accelMult || 1.0;
    const frictionMult = phase.frictionMult || 1.0;
    if (this.currentSpeed === undefined) this.currentSpeed = CONFIG.ENEMY_STATS.buldyga.speed;
    if (this.speedAccumulator === undefined) this.speedAccumulator = 0;
    if (this.vx === undefined) { this.vx = 0; this.vy = 0; }

    this.speedAccumulator += dt;
    if (this.speedAccumulator >= 1.0) {
      const s = Math.floor(this.speedAccumulator);
      this.currentSpeed += CONFIG.ENEMY_STATS.buldyga.speedIncrement * s;
      this.speedAccumulator -= s;
    }

    const stunned = this.stunTimer > 0;
    if (!stunned && dist > 0) {
      const vecMult = this.getRoomSpeedVectorMult(state, dx, dy);
      const tvx = (dx / dist) * this.currentSpeed * vecMult;
      const tvy = (dy / dist) * this.currentSpeed * vecMult;
      const acc = CONFIG.ENEMY_STATS.buldyga.accel * accelMult * dt;
      this.vx += (tvx - this.vx) * Math.min(1, acc / (this.currentSpeed || 1));
      this.vy += (tvy - this.vy) * Math.min(1, acc / (this.currentSpeed || 1));
    }

    if (this._hitWall) {
      this.vx = 0;
      this.vy = 0;
      this._hitWall = false;
    }
    setBodyVelocity(this.body, this.vx, this.vy);
  }

  _updateShooterPhase(dt, state, phase, dx, dy, dist, bossSpd) {
    const shootCdMult = phase.shootCdMult || 0.5;
    const bulletSpeedMult = phase.bulletSpeedMult || 1.0;

    if (this.stunTimer <= 0) {
      this.strafeSwitchTimer -= dt;
      if (this.strafeSwitchTimer <= 0) {
        this.strafeDir *= -1;
        this.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME ?? 1.2;
      }
      if (dist > 0) {
        const body = this.body;
        const hitWall = body && Math.hypot(body.velocity.x, body.velocity.y) < bossSpd * 0.3;
        
        // Flip direction if hit wall, but add small debounce to prevent jitter
        if (hitWall && this.strafeSwitchTimer < (CONFIG.BOSS_STRAFE_SWITCH_TIME || 1.2) - 0.2) {
          this.strafeDir *= -1;
          this.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME ?? 1.2;
        }

        const strafeDirX = (-dy / dist) * this.strafeDir;
        const strafeDirY = (dx / dist) * this.strafeDir;
        const vecMult = this.getRoomSpeedVectorMult(state, strafeDirX, strafeDirY);
        const bvx = strafeDirX * bossSpd * vecMult;
        const bvy = strafeDirY * bossSpd * vecMult;
        setBodyVelocity(body, bvx, bvy);
      }
    } else {
      setBodyVelocity(this.body, 0, 0);
    }

    if (this.shootCd === undefined) this.shootCd = 0;
    if (this.shootCd > 0) this.shootCd -= dt;
    
    const shootRange = CONFIG.ENEMY_STATS.shooter.shootRangeCells * CELL_PX * 10;
    if (dist <= shootRange && this.shootCd <= 0 && dist > 0) {
      this.shootCd = CONFIG.ENEMY_STATS.shooter.shootCd * shootCdMult;
      const ebx = (dx / dist) * CONFIG.ENEMY_STATS.shooter.bulletSpeed * bulletSpeedMult;
      const eby = (dy / dist) * CONFIG.ENEMY_STATS.shooter.bulletSpeed * bulletSpeedMult;
      bulletManager.spawn({
        x: this.x, y: this.y,
        vx: ebx, vy: eby,
        owner: 'enemy',
        color: ENEMY_BULLET_COLOR,
        maxRange: enemyBulletRange(ebx, eby),
      });
    }
  }

  _updateBullLimitedPhase(dt, state, phase, dx, dy, dist) {
    const dashDistMax = (phase.dashCells || (CONFIG.ENEMY_STATS.bull.dashDistCells ?? 3)) * CELL_PX;
    const chargeDist = (CONFIG.ENEMY_STATS.bull.chargeDistCells ?? 1.5) * CELL_PX * 8;
    const hitDist = this.radius + CONFIG.PLAYER_RADIUS;

    if (!this.state) this.state = 'chase';
    if (this.stateTimer === undefined) this.stateTimer = 0;

    switch (this.state) {
      case 'chase':
        if (this.stunTimer <= 0 && dist > chargeDist && dist > 0) {
          const dir = getEnemyMoveDir(this.x, this.y, state.player.x, state.player.y, state.flowField, state.openCells, state.removedWalls);
          const vecMult = this.getRoomSpeedVectorMult(state, dir.dx, dir.dy);
          setBodyVelocity(this.body, dir.dx * CONFIG.ENEMY_STATS.bull.speed * vecMult, dir.dy * CONFIG.ENEMY_STATS.bull.speed * vecMult);
        } else if (dist <= chargeDist) {
          this.state = 'prepare';
          this.stateTimer = CONFIG.ENEMY_STATS.bull.prepareTime;
          setBodyVelocity(this.body, 0, 0);
        }
        break;
      case 'prepare':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'dash';
          if (dist > 0) { this.dashDirX = dx / dist; this.dashDirY = dy / dist; }
          else { this.dashDirX = 1; this.dashDirY = 0; }
          this.dashDistance = dashDistMax;
          this.stateTimer = 0;
        }
        break;
      case 'dash': {
        const vecMult = this.getRoomSpeedVectorMult(state, this.dashDirX, this.dashDirY);
        const dashSpeed = CONFIG.ENEMY_STATS.bull.speed * 3 * vecMult;

        if (this._hitWall) {
          this._hitWall = false;
          this._onDashFinished(phase);
          break;
        }

        setBodyVelocity(this.body, this.dashDirX * dashSpeed, this.dashDirY * dashSpeed);
        this.stateTimer += dashSpeed * dt;
        if (this.stateTimer >= this.dashDistance) {
          this._onDashFinished(phase);
        }
        if (Math.hypot(state.player.x - this.x, state.player.y - this.y) < hitDist) {
          this._onDashFinished(phase);
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

  _onDashFinished(phase) {
    this.state = 'rest';
    this.stateTimer = CONFIG.ENEMY_STATS.bull.restTime;
    setBodyVelocity(this.body, 0, 0);
    this.dashCount++;
    if (this.dashCount >= (phase.maxDashes || 3)) {
      const bossDef = BOSS_DEFS[this.level] || this._fallbackDef();
      this._advancePhase(bossDef);
    }
  }

  _fallbackDef() {
    return {
      hp: 30, speedMult: 1.2, radius: CONFIG.ENEMY_STATS.soldier.radius * 2,
      visualScale: 4.0,
      phases: [{ id: 'soldier', duration: 6 }, { id: 'pause', duration: 1 }],
    };
  }
}

