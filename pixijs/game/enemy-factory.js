import { ChaserEnemy, ShooterEnemy, BullEnemy, BuldygaEnemy, BloatedEnemy, CocoonEnemy, PhaseBoss } from './enemy-types.js';

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
      case 'plevaka':
        return new ShooterEnemy(data);
      case 'bull':
        return new BullEnemy(data);
      case 'buldyga':
        return new BuldygaEnemy(data);
      case 'bloated':
        return new BloatedEnemy(data);
      case 'cocoon':
        return new CocoonEnemy(data);
      case 'soldier':
      case 'chaser':
      case 'bat':
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
      const base = def.hpBase === 'buldyga' ? CONFIG.BULDYGA_HP : CONFIG.SPIDER_HP;
      return base * (def.hpMult || 1);
    }
    switch (type) {
      case 'buldyga': return CONFIG.BULDYGA_HP;
      case 'bloated': return CONFIG.BLOATED_HP || 15;
      case 'cocoon': return CONFIG.COCOON_HP || 20;
      default: return CONFIG.SPIDER_HP;
    }
  }

  static getDefaultRadius(type, level = 1) {
    if (typeof CONFIG === 'undefined') return 20;
    if (type === 'boss_phase' && typeof BOSS_DEFS !== 'undefined') {
      const def = BOSS_DEFS[level] || BOSS_DEFS[1];
      return (def.radius || CONFIG.SPIDER_RADIUS) * (def.radiusMult || 1);
    }
    switch (type) {
      case 'bull': return CONFIG.BULL_RADIUS;
      case 'buldyga': return CONFIG.BULDYGA_RADIUS;
      case 'bloated': return CONFIG.BLOATED_RADIUS || 30;
      case 'cocoon': return CONFIG.COCOON_RADIUS || 35;
      default: return CONFIG.SPIDER_RADIUS;
    }
  }

  static getDefaultVisualScale(type, level = 1) {
    if (typeof CONFIG === 'undefined') return 3.2;
    if (type === 'boss_phase' && typeof BOSS_DEFS !== 'undefined') {
      const def = BOSS_DEFS[level] || BOSS_DEFS[1];
      return def.visualScale || 4.0;
    }
    switch (type) {
      case 'bull': return CONFIG.BULL_VISUAL_SCALE || 4.5;
      case 'buldyga': return CONFIG.BULDYGA_VISUAL_SCALE || 5.0;
      case 'bloated': return CONFIG.BLOATED_VISUAL_SCALE || 4.0;
      case 'cocoon': return CONFIG.COCOON_VISUAL_SCALE || 4.0;
      default: return CONFIG.SPIDER_VISUAL_SCALE || 3.2;
    }
  }
}
