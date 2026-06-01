// ============================================================
// GAME CONFIGURATION
// All constants and magic numbers live here.
// ============================================================

const CONFIG = {
  // Grid & View
  GRID_SIZE: 9,
  CELL_PX: 96 * 1.3,
  VIEW_W: 576 * 1.5,
  VIEW_H: 576,

  // Player
  INITIAL_LIVES: 3,
  HEARTS_COUNT: 5,
  LIVES_PER_HEART: 1,
  PLAYER_SPEED: 130,
  PLAYER_RADIUS: 6,
  PLAYER_SPRITE_RADIUS: 20,        // визуальный радиус спрайта (половина ширины отрисовки)
  PLAYER_INVULNERABLE_TIME: 1,    // секунд неуязвимости после урона

  // Shooting (default values, weapon-specific in WEAPON_DEFS)
  SHOOTING_ENABLED: true,
  BULLET_SPEED: 320,
  BULLET_DAMAGE: 35,
  BULLET_RADIUS: 3,
  BULLET_LIFE: 1.5,                 // время жизни пули (сек)

  // Muzzle flash particles
  MUZZLE_PARTICLES_COUNT: 8,
  MUZZLE_PARTICLES_SPREAD: 0.8,
  MUZZLE_PARTICLES_SPEED_MIN: 60,
  MUZZLE_PARTICLES_SPEED_MAX: 80,
  MUZZLE_PARTICLES_LIFE: 0.2,

  // Hit particles (when bullet hits enemy) - green blood
  HIT_PARTICLES_COUNT: 6,
  HIT_PARTICLES_SPEED_MIN: 40,
  HIT_PARTICLES_SPEED_MAX: 200,
  HIT_PARTICLES_SPREAD: 0.6,
  HIT_PARTICLES_LIFE: 2.0,
  HIT_PARTICLES_COLOR: '#00ff44',

  // Death particles (when enemy dies)
  DEATH_PARTICLES_COUNT: 16,
  DEATH_PARTICLES_SPEED_MIN: 40,
  DEATH_PARTICLES_SPEED_MAX: 80,
  DEATH_PARTICLES_LIFE: 0.6,

  // Wall hit particles
  WALL_HIT_PARTICLES_COUNT: 5,
  WALL_HIT_PARTICLES_SPEED: 40,
  WALL_HIT_PARTICLES_LIFE: 0.3,

  // Enemy bullet hit particles
  ENEMY_BULLET_HIT_PARTICLES_COUNT: 5,
  ENEMY_BULLET_HIT_PARTICLES_LIFE: 0.25,

  // Player hit particles (when player takes damage)
  PLAYER_HIT_PARTICLES_COUNT: 12,
  PLAYER_HIT_PARTICLES_SPEED: 80,
  PLAYER_HIT_PARTICLES_LIFE: 0.5,

  // Collectible pickup particles
  PICKUP_PARTICLES_COUNT: 12,
  PICKUP_PARTICLES_SPEED: 80,
  PICKUP_PARTICLES_LIFE: 0.6,

  // Camera shake on shoot
  SHAKE_AMOUNT: 2.0,
  SHAKE_DECAY: 0.9,

  // Spiders
  SPIDER_HP: 100,
  SPIDER_SPEED: 70,
  SPIDER_RADIUS: 7,
  SPIDER_PHASE_SPEED: 2,          // скорость анимации парения
  SPIDER_WOBBLE_MIN: 0.3,
  SPIDER_WOBBLE_MAX: 0.5,
  SPIDER_SPAWN_MARGIN: 10,        // отступ от стен при спавне

  // Shooters
  SHOOTER_HP: 70,
  SHOOTER_SPEED: 55,
  SHOOTER_RADIUS: 7,
  SHOOTER_BULLET_SPEED: 100,
  SHOOTER_SHOOT_RANGE: 0,         // заполняется после CP
  SHOOTER_SHOOT_CD: 2.0,
  SHOOTER_STOP_DIST: 0,           // заполняется после CP
  SHOOTER_CHANCE: 0.30,           // шанс что враг будет плевакой (только для типов кроме быка/булдыги)
  BULL_CHANCE: 0.30,              // шанс что враг будет быком (только на уровнях 2-3)
  BULDYGA_CHANCE: 0.30,           // шанс что враг будет булдыгой (только на уровнях 2-3)

  // Bull
  BULL_HP: 150,
  BULL_SPEED: 70,
  BULL_RADIUS: 7,
  BULL_PREPARE_TIME: 0.5,         // время подготовки рывка (сек)
  BULL_DASH_DISTANCE: 0,          // заполняется после CP (2 клетки)
  BULL_REST_TIME: 3.0,            // время отдыха после рывка (сек)
  BULL_CHARGE_DIST: 0,            // заполняется после CP (1.5 клетки)
  BULL_ATTACK_DIST: 0,            // заполняется после CP (1.6 клетки)

  // Buldyga
  BULDYGA_HP: 150,
  BULDYGA_SPEED: 70,              // начальная скорость
  BULDYGA_SPEED_INCREMENT: 10,    // ускорение каждую секунду
  BULDYGA_RADIUS: 7,

  // Level generation
  DISABLED_CELLS_COUNT: 15,
  BLOCK_CELLS_FOREVER: false,
  MAX_GENERATION_ATTEMPTS: 1000,
  ENEMY_SPAWN_CHANCE: 0.7,        // шанс спавна врагов в клетке

  // Pickup distances
  PICKUP_DISTANCE: 10,            // расстояние до предметов (добавляется к радиусу)
  WEAPON_PICKUP_DISTANCE: 24,     // расстояние до оружия

  // Upgrade popup
  UPGRADE_POPUP_DURATION: 2.0,    // секунд

  // Battle mode
  BATTLE_SCALE: 10,               // во сколько раз больше клетки в бою
  BATTLE_TRANSITION_DURATION: 1.0, // секунд на zoom

  // Zoom/Transitions
  ZOOM_DURATION: 1.0,             // секунд

  // Particle pool
  PARTICLE_POOL_MAX_SIZE: 200,

  // Sound
  DEFAULT_VOLUME: 0.4,
  AMBIENCE_VOLUME_MULT: 0.5,      // громкость амбиента относительно основной
  SHOT_VOLUME_MULT: 0.5,          // громкость выстрелов относительно основной
  FOOTSTEP_INTERVAL: 0.32,        // секунд между шагами

  // Debug
  DEBUG_INVULNERABLE: false,      // дебаг: неуязвимость от врагов
};

// ============================================================
// LEVEL CONFIGURATION
// ============================================================
const LEVEL_CONFIG = {
  1: { gridSize: 5,  keysRequired: 1, disabledCells: 6,  heartsCount: 1 },
  2: { gridSize: 7,  keysRequired: 2, disabledCells: 11, heartsCount: 2 },
  3: { gridSize: 9,  keysRequired: 3, disabledCells: 20, heartsCount: 3 },
};

// Количество оружия и апгрейдов на каждом уровне
const LEVEL_WEAPON_COUNTS  = { 1: 1, 2: 2, 3: 2 };
const LEVEL_UPGRADE_COUNTS = { 1: 4, 2: 10, 3: 16 };

// ============================================================
// WEAPON DEFINITIONS
// ============================================================
const WEAPON_DEFS = {
  pistol: {
    id: 'pistol',
    label: 'ПИСТОЛЕТ',
    color: '#00d4ff',
    pellets: 1,
    spread: 0.1,
    damage: 35,
    cooldown: 0.35,
    bulletSpeed: 400,
    penetrate: 0,
  },
  shotgun: {
    id: 'shotgun',
    label: 'ДРОБОВИК',
    color: '#ffaa00',
    pellets: 3,
    spread: 0.35,
    damage: 35,
    cooldown: 0.55,
    bulletSpeed: 320,
    penetrate: 0,
  },
  smg: {
    id: 'smg',
    label: 'ПП',
    color: '#ff44ff',
    pellets: 1,
    spread: 0.20,
    damage: 15,
    cooldown: 0.1,
    bulletSpeed: 400,
    penetrate: 0,
  },
  rifle: {
    id: 'rifle',
    label: 'ВИНТОВКА',
    color: '#44ff44',
    pellets: 1,
    spread: 0,
    damage: 51,
    cooldown: 1,
    bulletSpeed: 700,
    penetrate: 2,
  },
  revolver: {
    id: 'revolver',
    label: 'РЕВОЛЬВЕР',
    color: '#8b4513',
    pellets: 1,
    spread: 0.08,
    damage: 40,
    cooldown: 0.5,
    bulletSpeed: 450,
    penetrate: 1,
  },
  carbine: {
    id: 'carbine',
    label: 'КАРАБИН',
    color: '#556b2f',
    pellets: 1,
    spread: 0.15,
    damage: 35,
    cooldown: 1.0,
    burstSize: 3,
    burstCooldown: 0.1,
    bulletSpeed: 380,
    penetrate: 0,
  },
};

// ============================================================
// UPGRADE TYPES
// ============================================================
const UPGRADE_TYPES = [
  { id: 'pellets',       label: '+1 пуля к выстрелу',     description: 'Каждый выстрел выпускает на 1 пулю больше',                   color: '#ffaa00', max: 2 },
  { id: 'damage',        label: '+100% урона от пули',     description: 'Удваивает урон каждой пули',                                  color: '#ff4444', max: 2 },
  { id: 'penetrate',     label: '+1 пробитие врага',       description: 'Пуля пролетает сквозь одного дополнительного врага',          color: '#ff44ff', max: 2 },
  { id: 'bulletSpeed',   label: '+30% скорость пули',      description: 'Пули летят быстрее и труднее уклониться',                     color: '#ffff44', max: 2 },
  { id: 'critChance',    label: '+5% шанс крита',          description: 'Критический удар наносит двойной урон',                       color: '#ff0000', max: 3 },
  { id: 'killAccel',     label: 'Оружейный разгон',        description: 'Каждое убийство ускоряет следующий выстрел',                  color: '#ff8800', max: 1 },
  { id: 'enhancedPierce',label: 'Усиленное пробитие',      description: 'Пуля, пробившая врага, наносит усиленный урон',               color: '#aa44ff', max: 1 },
  { id: 'shield',        label: 'Щит',                     description: 'Поглощает один удар без потери жизни',                        color: '#00aaff', max: 2 },
  { id: 'retreat',       label: 'Отступление',             description: 'Получив урон, мгновенно отпрыгиваешь назад',                  color: '#00ffaa', max: 2 },
  { id: 'reflection',    label: 'Отражение',               description: 'Вражеские пули отражаются назад при попадании в тебя',        color: '#ff00ff', max: 1 },
  { id: 'cooldown',      label: 'Перезарядка -15%',        description: 'Уменьшает время между выстрелами на 15%',                    color: '#00ccff', max: 3 },
  { id: 'speed',         label: 'Скорость бега +10%',      description: 'Увеличивает скорость передвижения на 10%',                    color: '#44ff88', max: 3 },
  // { id: 'spread', label: 'Разброс +10%', color: '#ff66aa', max: 2 },
];

// ============================================================
// PLAYER SPRITE SHEET
// Sprite sheet: 2500x3000, each sprite 500x500 (5 cols x 6 rows)
// Row 0: idle face-forward (5 frames)
// Row 1: idle face-left    (5 frames)
// Row 2: idle face-back    (5 frames)
// Row 3: run  face-forward (4 frames)
// Row 4: run  face-left    (4 frames)
// Row 5: run  face-back    (4 frames)
// ============================================================
const HERO_SW = 500, HERO_SH = 500; // source sprite size
const HERO_ANIMS = {
  idle_forward: { row: 0, frames: 5, fps: 8 },
  idle_left:    { row: 1, frames: 5, fps: 8 },
  idle_back:    { row: 2, frames: 5, fps: 8 },
  run_forward:  { row: 3, frames: 4, fps: 10 },
  run_left:     { row: 4, frames: 4, fps: 10 },
  run_back:     { row: 5, frames: 4, fps: 10 },
};
