import { ChaserEnemy, ZigzagChaserEnemy, ShooterEnemy, WallShooterEnemy, BullEnemy, BuldygaEnemy, BloatedEnemy, CocoonEnemy, PhaseBoss, GhostEnemy } from './enemy-types.js';

export class EnemyFactory {
  static create(type, x, y, options = {}) {
    const data = {
      type,
      x,
      y,
      hp: options.hp || EnemyFactory.getDefaultHp(type, options.level),
      radius: options.radius || EnemyFactory.getDefaultRadius(type, options.level),
      visualScale: options.visualScale || EnemyFactory.getDefaultVisualScale(type, options.level),
      ...options
    };

    switch (type) {
      case 'boss_phase':
        return new PhaseBoss(data);
      case 'shooter':
        return new ShooterEnemy(data);
      case 'wallshooter':
        return new WallShooterEnemy(data);
      case 'bull':
        return new BullEnemy(data);
      case 'buldyga':
        return new BuldygaEnemy(data);
      case 'bloated':
        return new BloatedEnemy(data);
      case 'cocoon':
        return new CocoonEnemy(data);
      case 'tank':
      case 'soldier':
        return new ChaserEnemy(data);
      case 'bat':
        return new ZigzagChaserEnemy(data);
      case 'ghost':
        return new GhostEnemy(data);
      default:
        return new ChaserEnemy(data);
    }
  }

  static fromObject(obj) {
    if (!obj || !obj.type) return null;
    return EnemyFactory.create(obj.type, obj.x, obj.y, obj);
  }

  static getDefaultHp(type, level = 1) {
    if (typeof CONFIG === 'undefined') return 10;
    if (type === 'boss_phase' && typeof BOSS_DEFS !== 'undefined') {
      const def = BOSS_DEFS[level] || BOSS_DEFS[1];
      if (def.hp !== undefined) return def.hp;
      const base = def.hpBase === 'buldyga' ? CONFIG.ENEMY_STATS.buldyga.hp : CONFIG.ENEMY_STATS.soldier.hp;
      return base * (def.hpMult || 1);
    }
    const stats = CONFIG.ENEMY_STATS[type];
    if (stats) return stats.hp;
    return CONFIG.ENEMY_STATS.soldier.hp;
  }

  static getDefaultRadius(type, level = 1) {
    if (typeof CONFIG === 'undefined') return 20;
    if (type === 'boss_phase' && typeof BOSS_DEFS !== 'undefined') {
      const def = BOSS_DEFS[level] || BOSS_DEFS[1];
      return (def.radius || CONFIG.ENEMY_STATS.soldier.radius) * (def.radiusMult || 1);
    }
    const stats = CONFIG.ENEMY_STATS[type];
    if (stats) return stats.radius;
    return CONFIG.ENEMY_STATS.soldier.radius;
  }

  static getDefaultVisualScale(type, level = 1) {
    if (typeof CONFIG === 'undefined') return 3.2;
    if (type === 'boss_phase' && typeof BOSS_DEFS !== 'undefined') {
      const def = BOSS_DEFS[level] || BOSS_DEFS[1];
      return def.visualScale || 4.0;
    }
    const stats = CONFIG.ENEMY_STATS[type];
    if (stats) return stats.visualScale || 3.2;
    return CONFIG.ENEMY_STATS.soldier.visualScale || 3.2;
  }
}
