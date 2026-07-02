import { ChaserEnemy, ZigzagChaserEnemy, ShooterEnemy, BullEnemy, BuldygaEnemy, BloatedEnemy, CocoonEnemy, PhaseBoss } from './enemy-types.js';

// Map type → ENEMY_STATS key (some types share stats)
const ENEMY_STATS_KEY = {
  soldier: 'spider',
  chaser:  'spider',
  bat:     'bat',
  shooter: 'shooter',
  plevaka: 'shooter',
  bull:    'bull',
  buldyga: 'buldyga',
  bloated: 'bloated',
  cocoon:  'cocoon',
  tank:    'tank',
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
      case 'tank':
      case 'soldier':
      case 'chaser':
        return new ChaserEnemy(data);
      case 'bat':
        return new ZigzagChaserEnemy(data);
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
      const base = def.hpBase === 'buldyga' ? CONFIG.ENEMY_STATS.buldyga.hp : CONFIG.ENEMY_STATS.spider.hp;
      return base * (def.hpMult || 1);
    }
    const statsKey = ENEMY_STATS_KEY[type];
    if (statsKey) return CONFIG.ENEMY_STATS[statsKey].hp;
    return CONFIG.ENEMY_STATS.spider.hp;
  }

  static getDefaultRadius(type, level = 1) {
    if (typeof CONFIG === 'undefined') return 20;
    if (type === 'boss_phase' && typeof BOSS_DEFS !== 'undefined') {
      const def = BOSS_DEFS[level] || BOSS_DEFS[1];
      return (def.radius || CONFIG.ENEMY_STATS.spider.radius) * (def.radiusMult || 1);
    }
    const statsKey = ENEMY_STATS_KEY[type];
    if (statsKey) return CONFIG.ENEMY_STATS[statsKey].radius;
    return CONFIG.ENEMY_STATS.spider.radius;
  }

  static getDefaultVisualScale(type, level = 1) {
    if (typeof CONFIG === 'undefined') return 3.2;
    if (type === 'boss_phase' && typeof BOSS_DEFS !== 'undefined') {
      const def = BOSS_DEFS[level] || BOSS_DEFS[1];
      return def.visualScale || 4.0;
    }
    const statsKey = ENEMY_STATS_KEY[type];
    if (statsKey) return CONFIG.ENEMY_STATS[statsKey].visualScale || 3.2;
    return CONFIG.ENEMY_STATS.spider.visualScale || 3.2;
  }
}
