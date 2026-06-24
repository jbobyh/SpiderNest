import { ChaserEnemy, ShooterEnemy, BullEnemy, BuldygaEnemy, BloatedEnemy, CocoonEnemy } from './enemy-types.js';

export class EnemyFactory {
  static create(type, x, y, options = {}) {
    const data = {
      type,
      x,
      y,
      hp: options.hp || EnemyFactory.getDefaultHp(type),
      radius: options.radius || EnemyFactory.getDefaultRadius(type),
      visualScale: options.visualScale || EnemyFactory.getDefaultVisualScale(type),
      ...options
    };

    switch (type) {
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

  static getDefaultHp(type) {
    if (typeof CONFIG === 'undefined') return 10;
    switch (type) {
      case 'buldyga': return CONFIG.BULDYGA_HP;
      case 'bloated': return CONFIG.BLOATED_HP || 15;
      case 'cocoon': return CONFIG.COCOON_HP || 20;
      default: return CONFIG.SPIDER_HP;
    }
  }

  static getDefaultRadius(type) {
    if (typeof CONFIG === 'undefined') return 20;
    switch (type) {
      case 'bull': return CONFIG.BULL_RADIUS;
      case 'buldyga': return CONFIG.BULDYGA_RADIUS;
      case 'bloated': return CONFIG.BLOATED_RADIUS || 30;
      case 'cocoon': return CONFIG.COCOON_RADIUS || 35;
      default: return CONFIG.SPIDER_RADIUS;
    }
  }

  static getDefaultVisualScale(type) {
    if (typeof CONFIG === 'undefined') return 3.2;
    switch (type) {
      case 'bull': return CONFIG.BULL_VISUAL_SCALE || 4.5;
      case 'buldyga': return CONFIG.BULDYGA_VISUAL_SCALE || 5.0;
      case 'bloated': return CONFIG.BLOATED_VISUAL_SCALE || 4.0;
      case 'cocoon': return CONFIG.COCOON_VISUAL_SCALE || 4.0;
      default: return CONFIG.SPIDER_VISUAL_SCALE || 3.2;
    }
  }
}
