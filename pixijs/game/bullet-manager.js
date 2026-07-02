import { acquireBullet, releaseBullet } from './bullet.js';
import { cellOf, cellKey, CELL_PX, getRoomBonus, getRoomSpeedMultiplier, crossesWall, inRoom } from '../world/constants.js';
import { Sounds } from '../core/sound.js';
import { spawnParticles } from '../render/particles.js';
import { spawnDamageNumber } from '../render/damage-numbers.js';

class BulletManager {
  constructor() {
    this.bullets = [];
  }

  spawn(data) {
    const b = acquireBullet(data);
    this.bullets.push(b);
    return b;
  }

  update(state, dt, onEnemyKilled, onPlayerHit, isBattle = false) {
    const BS = isBattle ? (CONFIG.BATTLE_SCALE || 1) : 1;
    const worldBullets = this.bullets;
    
    // In battle-mode, we might have different coordinate system or openCells
    const activeState = isBattle ? state.battle : state;
    const openCells = activeState.openCells;
    const removedWalls = activeState.removedWalls;

    for (let i = worldBullets.length - 1; i >= 0; i--) {
      const b = worldBullets[i];
      const prevX = b.x;
      const prevY = b.y;

      // 1. Move
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const dx = b.x - prevX;
      const dy = b.y - prevY;
      b.distanceTraveled += Math.hypot(dx, dy);

      // 2. Room Bonuses (Speed/Penetrate)
      this._applyRoomBonuses(b, state, isBattle);

      // 3. Range check
      if (b.distanceTraveled >= b.maxRange) {
        this._handleWallHit(b, state, isBattle, worldBullets, i);
        continue;
      }

      // 4. Wall collisions (OOB and Static Walls)
      let bouncedThisFrame = false;
      if (isBattle) {
        const oob = b.x < 0 || b.x > activeState.width || b.y < 0 || b.y > activeState.height;
        if (oob) {
          if (b.ricochet && !b._ricocheted) {
            this._handleBattleRicochet(b, activeState, worldBullets, i);
            bouncedThisFrame = true;
          } else {
            this._handleWallHit(b, state, isBattle, worldBullets, i);
            continue;
          }
        }
      }

      if (!bouncedThisFrame) {
        const hitsPartition = isBattle 
          ? this._battleCrossesWall(activeState, CELL_PX * BS, prevX, prevY, b.x, b.y)
          : crossesWall(removedWalls, prevX, prevY, b.x, b.y);

        const prevCell = cellOf(prevX / (isBattle ? BS : 1), prevY / (isBattle ? BS : 1));
        const prevCellKey = isBattle
          ? cellKey(prevCell.x + activeState.cellOffsetX, prevCell.y + activeState.cellOffsetY)
          : cellKey(prevCell.x, prevCell.y);
        const prevRoomBonus = getRoomBonus(state, prevCellKey);
        const wasInRoom = isBattle 
          ? openCells.has(prevCellKey)
          : inRoom(prevX, prevY, openCells);

        const currentCell = cellOf(b.x / (isBattle ? BS : 1), b.y / (isBattle ? BS : 1));
        const cellIsBlocked = isBattle 
          ? !openCells.has(cellKey(currentCell.x + activeState.cellOffsetX, currentCell.y + activeState.cellOffsetY))
          : !inRoom(b.x, b.y, openCells);

        const hitsWall = cellIsBlocked || hitsPartition;

        if (hitsWall) {
          const canRicochet = !b._ricocheted && wasInRoom && (b._baseRicochet || prevRoomBonus === 'ricochet');
          if (canRicochet) {
            this._handleRicochet(b, activeState, prevX, prevY, dt, isBattle, worldBullets, i);
          } else {
            this._handleWallHit(b, state, isBattle, worldBullets, i);
            continue;
          }
        } else {
          b._ricocheted = false;
        }
      }

      // 5. Entity collisions
      if (b.owner === 'player') {
        if (this._checkEnemyCollisions(b, state, activeState, onEnemyKilled, isBattle)) {
          worldBullets.splice(i, 1);
          releaseBullet(b);
          continue;
        }
      } else {
        if (this._checkPlayerCollision(b, state, activeState, onPlayerHit, isBattle)) {
          worldBullets.splice(i, 1);
          releaseBullet(b);
          continue;
        }
      }
    }
  }

  _applyRoomBonuses(b, state, isBattle) {
    const activeState = isBattle ? state.battle : state;
    const BS = isBattle ? (CONFIG.BATTLE_SCALE || 1) : 1;
    
    let bcx, bcy;
    if (isBattle) {
      bcx = Math.floor(b.x / (CELL_PX * BS)) + activeState.cellOffsetX;
      bcy = Math.floor(b.y / (CELL_PX * BS)) + activeState.cellOffsetY;
    } else {
      const cell = cellOf(b.x, b.y);
      bcx = cell.x;
      bcy = cell.y;
    }
    
    const bulletCellKey = cellKey(bcx, bcy);
    const roomBonus = getRoomBonus(state, bulletCellKey);
    
    if (roomBonus !== b._lastRoomBonus) {
      if (roomBonus === 'speedup' || roomBonus === 'speeddown') {
        const mult = getRoomSpeedMultiplier(state, bulletCellKey);
        b.vx = b._baseVx * mult;
        b.vy = b._baseVy * mult;
      } else if (b._lastRoomBonus === 'speedup' || b._lastRoomBonus === 'speeddown') {
        b.vx = b._baseVx;
        b.vy = b._baseVy;
      }
      
      if (roomBonus === 'ricochet') {
        b.ricochet = true;
      } else if (b._lastRoomBonus === 'ricochet') {
        b.ricochet = b._baseRicochet;
      }

      if (b.owner === 'player') {
        if (roomBonus === 'penetrate') {
          b.penetrate = Infinity;
        } else if (b._lastRoomBonus === 'penetrate') {
          b.penetrate = b._basePenetrate;
        }
      }
      
      b._lastRoomBonus = roomBonus;
    }
  }

  _handleWallHit(b, state, isBattle, worldBullets, i) {
    const activeState = isBattle ? state.battle : state;
    const particles = activeState.particles;
    const color = b.owner === 'player' ? '#88aaff' : '#ff6600';
    
    Sounds.wallhit?.();
    spawnParticles(particles, b.x, b.y,
      CONFIG.WALL_HIT_PARTICLES_COUNT, 0, Math.PI * 2,
      CONFIG.WALL_HIT_PARTICLES_SPEED * (isBattle ? CONFIG.BATTLE_SCALE : 1), 
      CONFIG.WALL_HIT_PARTICLES_SPEED * (isBattle ? CONFIG.BATTLE_SCALE : 1),
      CONFIG.WALL_HIT_PARTICLES_LIFE, color);
      
    worldBullets.splice(i, 1);
    releaseBullet(b);
  }

  _handleRicochet(b, activeState, prevX, prevY, dt, isBattle, worldBullets, i) {
    b._ricocheted = true;
    const BS = isBattle ? (CONFIG.BATTLE_SCALE || 1) : 1;
    const CPB = CELL_PX * BS;
    
    const px = b.x - b.vx * dt;
    const py = b.y - b.vy * dt;

    if (isBattle) {
      const cx1 = Math.floor(b.x / CPB) + activeState.cellOffsetX;
      const cy1 = Math.floor(py  / CPB) + activeState.cellOffsetY;
      const cx2 = Math.floor(px  / CPB) + activeState.cellOffsetX;
      const cy2 = Math.floor(b.y / CPB) + activeState.cellOffsetY;
      
      const xOk = activeState.openCells.has(cellKey(cx1, cy1));
      const yOk = activeState.openCells.has(cellKey(cx2, cy2));
      
      if (xOk)      { b.vy = -b.vy; b.y = py; }
      else if (yOk) { b.vx = -b.vx; b.x = px; }
      else          { b.vx = -b.vx; b.vy = -b.vy; b.x = px; b.y = py; }
      this._syncBaseVelocity(b);
    } else {
      const c0x = Math.floor(prevX / CELL_PX);
      const c0y = Math.floor(prevY / CELL_PX);
      const c1x = Math.floor(b.x / CELL_PX);
      const c1y = Math.floor(b.y / CELL_PX);

      if (c0x !== c1x && c0y !== c1y) {
        b.vx = -b.vx; b.vy = -b.vy; b.x = px; b.y = py;
      } else if (c0x !== c1x) {
        b.vx = -b.vx; b.x = px;
      } else {
        b.vy = -b.vy; b.y = py;
      }
      this._syncBaseVelocity(b);
    }

    b.hitEntities.clear();
    Sounds.wallhit?.();
    spawnParticles(activeState.particles, b.x, b.y, CONFIG.WALL_HIT_PARTICLES_COUNT, 0, Math.PI * 2,
      CONFIG.WALL_HIT_PARTICLES_SPEED * BS, CONFIG.WALL_HIT_PARTICLES_SPEED * BS,
      CONFIG.WALL_HIT_PARTICLES_LIFE, '#22ffdd');
  }

  _handleBattleRicochet(b, activeState, worldBullets, i) {
    b._ricocheted = true;
    if (b.x < 0 || b.x > activeState.width)   { b.vx = -b.vx; b.x = b.x < 0 ? 0.1 : activeState.width - 0.1; }
    if (b.y < 0 || b.y > activeState.height)  { b.vy = -b.vy; b.y = b.y < 0 ? 0.1 : activeState.height - 0.1; }
    this._syncBaseVelocity(b);
    b.hitEntities.clear();
    
    const BS = CONFIG.BATTLE_SCALE || 1;
    spawnParticles(activeState.particles, b.x, b.y, CONFIG.WALL_HIT_PARTICLES_COUNT, 0, Math.PI * 2,
      CONFIG.WALL_HIT_PARTICLES_SPEED * BS, CONFIG.WALL_HIT_PARTICLES_SPEED * BS,
      CONFIG.WALL_HIT_PARTICLES_LIFE, '#22ffdd');
  }

  _checkEnemyCollisions(b, state, activeState, onEnemyKilled, isBattle) {
    const BS = isBattle ? (CONFIG.BATTLE_SCALE || 1) : 1;
    const spiders = activeState.activeSpiders;
    
    for (let j = spiders.length - 1; j >= 0; j--) {
      const g = spiders[j];
      if (b.hitEntities.has(g)) continue;
      
      const dist = Math.hypot(b.x - g.x, b.y - g.y);
      if (dist >= ((g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.BULLET_RADIUS) * BS) continue;

      // Hit!
      let damage = b.damage;
      if (b.hitCount > 0 && state.upgrades.enhancedPierce && b.enhancedPierceActive) {
        damage *= 2;
      }

      if (g.takeDamage) {
        g.takeDamage(damage, b.isCrit);
      } else {
        g.hp -= damage;
        g.hitFlash = CONFIG.ENEMY_HIT_FLASH_DURATION;
        if (!g.isBoss) g.stunTimer = CONFIG.ENEMY_STUN_DURATION;
        Sounds.hit?.();
      }

      if (!isBattle) {
        spawnDamageNumber(state, g.x, g.y - (g.radius || CONFIG.SPIDER_RADIUS), damage, b.isCrit, 1);
      }

      // Hit particles
      const bAngle = Math.atan2(b.vy, b.vx);
      for (let k = 0; k < CONFIG.HIT_PARTICLES_COUNT; k++) {
        const sp = bAngle + (Math.random() - 0.5) * CONFIG.HIT_PARTICLES_SPREAD;
        const spd = (CONFIG.HIT_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.HIT_PARTICLES_SPEED_MAX - CONFIG.HIT_PARTICLES_SPEED_MIN)) * BS;
        activeState.particles.push({ 
          x: g.x, y: g.y, vx: Math.cos(sp) * spd, vy: Math.sin(sp) * spd,
          life: CONFIG.HIT_PARTICLES_LIFE, maxLife: CONFIG.HIT_PARTICLES_LIFE, color: CONFIG.HIT_PARTICLES_COLOR 
        });
      }

      if (g.hp <= 0 && onEnemyKilled) {
        if (isBattle) onEnemyKilled(g, state, activeState, j);
        else onEnemyKilled(g, state);
      }

      b.hitCount++;
      b.hitEntities.add(g);
      
      if (b.hitCount === 1 && state.upgrades.enhancedPierce && !b.enhancedPierceActive) {
        b.enhancedPierceActive = Math.random() < 0.5;
      }

      if (b.hitCount > b.penetrate) {
        return true; // Bullet destroyed
      }
    }
    return false;
  }

  _checkPlayerCollision(b, state, activeState, onPlayerHit, isBattle) {
    const BS = isBattle ? (CONFIG.BATTLE_SCALE || 1) : 1;
    const player = activeState.player || state.player;
    
    const pd = Math.hypot(b.x - player.x, b.y - player.y);
    if (pd < (CONFIG.PLAYER_RADIUS + CONFIG.BULLET_RADIUS) * BS) {
      if (!player.isDashing) {
        if (onPlayerHit) onPlayerHit(state, isBattle);
        return true; // Bullet destroyed
      }
    }
    return false;
  }

  _syncBaseVelocity(b) {
    const rb = b._lastRoomBonus;
    if (rb === 'speedup' || rb === 'speeddown') {
      const bonusDef = ROOM_BONUS_TYPES.find(bt => bt.id === rb);
      const mult = bonusDef?.speedMult || (rb === 'speedup' ? 1.3 : 0.7);
      b._baseVx = b.vx / mult;
      b._baseVy = b.vy / mult;
    } else {
      b._baseVx = b.vx;
      b._baseVy = b.vy;
    }
  }

  _battleCrossesWall(b, CPB, x0, y0, x1, y1) {
    const c0x = Math.floor(x0 / CPB) + b.cellOffsetX;
    const c0y = Math.floor(y0 / CPB) + b.cellOffsetY;
    const c1x = Math.floor(x1 / CPB) + b.cellOffsetX;
    const c1y = Math.floor(y1 / CPB) + b.cellOffsetY;
    if (c0x === c1x && c0y === c1y) return false;
    const key0 = cellKey(c0x, c0y);
    const key1 = cellKey(c1x, c1y);
    return b.removedWalls && !b.removedWalls.has(key0 + '|' + key1) && !b.removedWalls.has(key1 + '|' + key0);
  }

  clear() {
    for (const b of this.bullets) {
      releaseBullet(b);
    }
    this.bullets = [];
  }
}

export const bulletManager = new BulletManager();
