import { ChaserEnemy, ShooterEnemy, BullEnemy, BuldygaEnemy, BloatedEnemy, CocoonEnemy, PhaseBoss } from './enemy-types.js';

const ENEMY_DEFS = {
  soldier: { hp: 'SPIDER_HP', radius: 'SPIDER_RADIUS', visualScale: 'SPIDER_VISUAL_SCALE' },
  chaser:  { hp: 'SPIDER_HP', radius: 'SPIDER_RADIUS', visualScale: 'SPIDER_VISUAL_SCALE' },
  bat:     { hp: 'BAT_HP',    radius: 'BAT_RADIUS',    visualScale: 'BAT_VISUAL_SCALE' },
  shooter: { hp: 'SHOOTER_HP', radius: 'SHOOTER_RADIUS', visualScale: 'SHOOTER_VISUAL_SCALE' },
  plevaka: { hp: 'SHOOTER_HP', radius: 'SHOOTER_RADIUS', visualScale: 'SHOOTER_VISUAL_SCALE' },
  bull:    { hp: 'SPIDER_HP', radius: 'BULL_RADIUS',    visualScale: 'BULL_VISUAL_SCALE' },
  buldyga: { hp: 'BULDYGA_HP', radius: 'BULDYGA_RADIUS', visualScale: 'BULDYGA_VISUAL_SCALE' },
  bloated: { hp: 'BLOATED_HP', radius: 'BLOATED_RADIUS', visualScale: 'BLOATED_VISUAL_SCALE' },
  cocoon:  { hp: 'COCOON_HP',  radius: 'COCOON_RADIUS',  visualScale: 'COCOON_VISUAL_SCALE' },
};

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
    const def = ENEMY_DEFS[type];
    if (def && def.hp) return CONFIG[def.hp] || CONFIG.SPIDER_HP;
    return CONFIG.SPIDER_HP;
  }

  static getDefaultRadius(type, level = 1) {
    if (typeof CONFIG === 'undefined') return 20;
    if (type === 'boss_phase' && typeof BOSS_DEFS !== 'undefined') {
      const def = BOSS_DEFS[level] || BOSS_DEFS[1];
      return (def.radius || CONFIG.SPIDER_RADIUS) * (def.radiusMult || 1);
    }
    const def = ENEMY_DEFS[type];
    if (def && def.radius) return CONFIG[def.radius] || CONFIG.SPIDER_RADIUS;
    return CONFIG.SPIDER_RADIUS;
  }

  static getDefaultVisualScale(type, level = 1) {
    if (typeof CONFIG === 'undefined') return 3.2;
    if (type === 'boss_phase' && typeof BOSS_DEFS !== 'undefined') {
      const def = BOSS_DEFS[level] || BOSS_DEFS[1];
      return def.visualScale || 4.0;
    }
    const def = ENEMY_DEFS[type];
    if (def && def.visualScale) return CONFIG[def.visualScale] || 3.2;
    return CONFIG.SPIDER_VISUAL_SCALE || 3.2;
  }
}
