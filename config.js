// ============================================================
// GAME CONFIGURATION
// All constants and magic numbers live here.
// ============================================================

const CONFIG = {
  // Grid & View
  GRID_SIZE: 9,           // размер сетки (кол-во клеток по стороне)
  CELL_PX: 96 * 1.3,      // размер клетки в пикселях
  VIEW_W: 576 * 1.5,      // ширина области просмотра в пикселях
  VIEW_H: 576,            // высота области просмотра в пикселях

  // Player
  INITIAL_LIVES: 3,       // начальное кол-во жизней
  LIVES_PER_HEART: 1,     // жизней на одно сердце
  PLAYER_SPEED: 130,      // скорость игрока (пикс/сек)
  PLAYER_RADIUS: 6,       // радиус коллизии игрока
  PLAYER_SPRITE_RADIUS: 20,        // визуальный радиус спрайта (половина ширины отрисовки)
  PLAYER_INVULNERABLE_TIME: 1,    // секунд неуязвимости после урона

  // Player Dash
  PLAYER_DASH_SPEED: 350,       // скорость деша (пикс/сек)
  PLAYER_DASH_DISTANCE: 50,    // дальность деша (пикселей)
  PLAYER_DASH_COOLDOWN: 2.0,    // кулдаун деша (сек)

  // Shooting (default values, weapon-specific in WEAPON_DEFS)
  SHOOTING_ENABLED: true, // включить стрельбу
  BULLET_SPEED: 320,      // скорость пули по умолчанию (пикс/сек)
  BULLET_DAMAGE: 35,      // урон пули по умолчанию
  BULLET_RADIUS: 3,       // радиус пули
  BULLET_LIFE: 1.5,                 // время жизни пули (сек)

  // Muzzle flash particles
  MUZZLE_PARTICLES_COUNT: 8,          // кол-во частиц вспышки дула
  MUZZLE_PARTICLES_SPREAD: 0.8,       // угол разлёта (рад)
  MUZZLE_PARTICLES_SPEED_MIN: 60,     // мин. скорость частиц вспышки
  MUZZLE_PARTICLES_SPEED_MAX: 80,     // макс. скорость частиц вспышки
  MUZZLE_PARTICLES_LIFE: 0.2,         // время жизни частиц вспышки (сек)

  // Hit particles (when bullet hits enemy) - green blood
  HIT_PARTICLES_COUNT: 6,             // кол-во частиц при попадании в врага
  HIT_PARTICLES_SPEED_MIN: 40,        // мин. скорость частиц крови
  HIT_PARTICLES_SPEED_MAX: 200,       // макс. скорость частиц крови
  HIT_PARTICLES_SPREAD: 0.6,          // угол разлёта крови (рад)
  HIT_PARTICLES_LIFE: 2.0,            // время жизни частиц крови (сек)
  HIT_PARTICLES_COLOR: '#00ff44',     // цвет крови врага

  // Death particles (when enemy dies)
  DEATH_PARTICLES_COUNT: 16,          // кол-во частиц при смерти врага
  DEATH_PARTICLES_SPEED_MIN: 40,      // мин. скорость частиц смерти
  DEATH_PARTICLES_SPEED_MAX: 80,      // макс. скорость частиц смерти
  DEATH_PARTICLES_LIFE: 0.6,          // время жизни частиц смерти (сек)

  // Wall hit particles
  WALL_HIT_PARTICLES_COUNT: 5,        // кол-во частиц при попадании в стену
  WALL_HIT_PARTICLES_SPEED: 40,       // скорость частиц от стены
  WALL_HIT_PARTICLES_LIFE: 0.3,       // время жизни частиц от стены (сек)

  // Enemy bullet hit particles
  ENEMY_BULLET_HIT_PARTICLES_COUNT: 5,    // кол-во частиц при попадании пули врага в игрока
  ENEMY_BULLET_HIT_PARTICLES_LIFE: 0.25,  // время жизни этих частиц (сек)

  // Player hit particles (when player takes damage)
  PLAYER_HIT_PARTICLES_COUNT: 12,     // кол-во частиц при уроне по игроку
  PLAYER_HIT_PARTICLES_SPEED: 80,     // скорость этих частиц
  PLAYER_HIT_PARTICLES_LIFE: 0.5,     // время жизни этих частиц (сек)

  // Collectible pickup particles
  PICKUP_PARTICLES_COUNT: 12,         // кол-во частиц при подборе предмета
  PICKUP_PARTICLES_SPEED: 80,         // скорость этих частиц
  PICKUP_PARTICLES_LIFE: 0.6,         // время жизни этих частиц (сек)

  // Camera shake on shoot
  SHAKE_AMOUNT: 0,      // сила тряски камеры при выстреле
  SHAKE_DECAY: 0.9,       // затухание тряски (множитель за кадр)

  // Spiders
  SPIDER_HP: 100,         // здоровье паука
  SPIDER_SPEED: 70,       // скорость паука (пикс/сек)
  SPIDER_RADIUS: 7,       // радиус коллизии паука
  SPIDER_PHASE_SPEED: 2,          // скорость анимации парения
  SPIDER_WOBBLE_MIN: 0.3, // мин. амплитуда покачивания
  SPIDER_WOBBLE_MAX: 0.5, // макс. амплитуда покачивания
  SPIDER_SPAWN_MARGIN: 10,        // отступ от стен при спавне

  // Shooters
  SHOOTER_HP: 70,             // здоровье плеваки
  SHOOTER_SPEED: 55,          // скорость плеваки (пикс/сек)
  SHOOTER_RADIUS: 7,          // радиус коллизии плеваки
  SHOOTER_BULLET_SPEED: 100,  // скорость пули плеваки
  SHOOTER_SHOOT_RANGE_CELLS: 1.0, // дальность стрельбы плеваки (в клетках)
  SHOOTER_SHOOT_CD: 2.0,     // кулдаун выстрела плеваки (сек)
  SHOOTER_STOP_DIST_CELLS: 0.9,   // дистанция остановки плеваки (в клетках)
  // Spawn chances by level
  // Level 1: only soldier/shooter
  SHOOTER_CHANCE: 0.30,           // шанс что враг будет плевакой (остальное - солдат)
  // Level 2: bull/buldyga + soldier/shooter
  BULL_CHANCE: 0.30,              // шанс что враг будет быком
  BULDYGA_CHANCE: 0.30,           // шанс что враг будет булдыгой (после быка)
  // Level 3: cocoon/bloated/bull/buldyga + soldier/shooter
  COCOON_CHANCE: 0.30,           // шанс что враг будет коконом
  BLOATED_CHANCE: 0.30,           // шанс что враг будет распухшим (после кокона)
  BULL_CHANCE_LVL3: 0.20,         // шанс что враг будет быком на 3 уровне (после распухшего)
  BULDYGA_CHANCE_LVL3: 0.20,      // шанс что враг будет булдыгой на 3 уровне (после быка)

  // Bull
  BULL_HP: 150,           // здоровье быка
  BULL_SPEED: 70,         // скорость быка (пикс/сек)
  BULL_RADIUS: 7,         // радиус коллизии быка
  BULL_PREPARE_TIME: 0.5,         // время подготовки рывка (сек)
  BULL_DASH_DISTANCE_CELLS: 2.0,  // дистанция рывка быка (в клетках)
  BULL_REST_TIME: 3.0,            // время отдыха после рывка (сек)
  BULL_CHARGE_DIST_CELLS: 1.5,    // дистанция начала атаки быка (в клетках)
  BULL_ATTACK_DIST_CELLS: 1.6,    // дистанция удара быка (в клетках)

  // Buldyga
  BULDYGA_HP: 150,        // здоровье булдыги
  BULDYGA_SPEED: 70,              // начальная скорость
  BULDYGA_SPEED_INCREMENT: 10,    // ускорение каждую секунду
  BULDYGA_RADIUS: 7,     // радиус коллизии булдыги
  BULDYGA_ACCEL: 180,             // ускорение инерции (пикс/с²)
  BULDYGA_FRICTION: 3.5,          // коэффициент торможения (затухание скорости)

  // Cocoon (spawner)
  COCOON_HP: 100,         // здоровье кокона
  COCOON_RADIUS: 10,      // радиус коллизии кокона
  COCOON_SPAWN_INTERVAL: 5.0,     // секунд между спавнами солдат
  COCOON_CHANCE: 0.30,            // шанс спавна кокона на уровне 3

  // Bloated (explodes on death)
  BLOATED_HP: 100,        // здоровье распухшего
  BLOATED_SPEED: 70,      // скорость распухшего (пикс/сек)
  BLOATED_RADIUS: 8,      // радиус коллизии распухшего
  BLOATED_DEATH_SHOT_SPEED: 100,  // скорость пули при смерти (как у плеваки)
  BLOATED_CHANCE: 0.30,           // шанс спавна распухшего на уровне 3 (после кокона)

  // Level generation
  DISABLED_CELLS_COUNT: 15,       // кол-во заблокированных клеток по умолчанию
  BLOCK_CELLS_FOREVER: false,     // блокировать клетки навсегда (дебаг)
  MAX_GENERATION_ATTEMPTS: 1000,  // макс. попыток генерации уровня
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
  PARTICLE_POOL_MAX_SIZE: 200,    // максимум частиц в пуле

  // Sound
  DEFAULT_VOLUME: 0.4,    // громкость по умолчанию (0..1)
  AMBIENCE_VOLUME_MULT: 0.5,      // громкость амбиента относительно основной
  SHOT_VOLUME_MULT: 0.5,          // громкость выстрелов относительно основной
  FOOTSTEP_INTERVAL: 0.32,        // секунд между шагами

  // Debug
  DEBUG_INVULNERABLE: false,      // дебаг: неуязвимость игрока от врагов
  DEBUG_SPREAD_INDICATOR: false,  // дебаг: отображать индикатор угла разброса
};

// ============================================================
// LEVEL CONFIGURATION
// ============================================================
const LEVEL_CONFIG = {
  // gridSize: размер сетки; keysRequired: кол-во ключей для выхода; disabledCells: заблокированных клеток; heartsCount: сердец на уровне
  1: { gridSize: 5,  keysRequired: 1, disabledCells: 6,  heartsCount: 1 },
  2: { gridSize: 7,  keysRequired: 2, disabledCells: 11, heartsCount: 2 },
  3: { gridSize: 9,  keysRequired: 3, disabledCells: 20, heartsCount: 3 },
};

// Количество оружия и апгрейдов на каждом уровне
const LEVEL_WEAPON_COUNTS  = { 1: 1, 2: 2, 3: 2 };
const LEVEL_UPGRADE_COUNTS = { 1: 4, 2: 10, 3: 16 };
// Количество проклятых сундуков на каждом уровне
const LEVEL_CHEST_COUNTS   = { 1: 1, 2: 2, 3: 3 };

// ============================================================
// ROOM ENEMY POOLS
// Пресеты врагов для каждого типа комнаты по уровням.
// Ключи: soldier, shooter, bull, buldyga, cocoon, bloated
// Типы комнат: easy, medium, hard, key, simpleupgrade, cursedupgrade, enemy
// ============================================================
const ROOM_POOLS = {
  1: {
    easy: [
      { soldier: 1, shooter: 0 },
      { soldier: 2, shooter: 0 },
      { soldier: 1, shooter: 1 },
    ],
    medium: [
      { soldier: 2, shooter: 1 },
      { soldier: 3, shooter: 0 },
      { soldier: 2, shooter: 2 },
    ],
    hard: [
      { soldier: 3, shooter: 1 },
      { soldier: 4, shooter: 1 },
      { soldier: 3, shooter: 2 },
    ],
    key: [
      { soldier: 2, shooter: 1 },
      { soldier: 3, shooter: 1 },
      { soldier: 2, shooter: 2 },
    ],
    simpleupgrade: [
      { soldier: 1, shooter: 0 },
      { soldier: 1, shooter: 1 },
      { soldier: 2, shooter: 0 },
    ],
    cursedupgrade: [
      { soldier: 2, shooter: 1 },
      { soldier: 3, shooter: 0 },
      { soldier: 2, shooter: 2 },
    ],
    enemy: [
      { soldier: 3, shooter: 0 },
      { soldier: 2, shooter: 2 },
      { soldier: 4, shooter: 0 },
    ],
  },
  2: {
    easy: [
      { soldier: 2, shooter: 1, bull: 0, buldyga: 0 },
      { soldier: 1, shooter: 1, bull: 1, buldyga: 0 },
      { soldier: 2, shooter: 0, bull: 1, buldyga: 0 },
    ],
    medium: [
      { soldier: 2, shooter: 1, bull: 1, buldyga: 0 },
      { soldier: 2, shooter: 2, bull: 0, buldyga: 1 },
      { soldier: 1, shooter: 1, bull: 1, buldyga: 1 },
    ],
    hard: [
      { soldier: 3, shooter: 1, bull: 1, buldyga: 1 },
      { soldier: 2, shooter: 2, bull: 2, buldyga: 0 },
      { soldier: 2, shooter: 1, bull: 1, buldyga: 2 },
    ],
    key: [
      { soldier: 2, shooter: 1, bull: 1, buldyga: 1 },
      { soldier: 3, shooter: 1, bull: 1, buldyga: 0 },
      { soldier: 2, shooter: 2, bull: 0, buldyga: 1 },
    ],
    simpleupgrade: [
      { soldier: 1, shooter: 1, bull: 0, buldyga: 0 },
      { soldier: 2, shooter: 0, bull: 1, buldyga: 0 },
      { soldier: 1, shooter: 1, bull: 1, buldyga: 0 },
    ],
    cursedupgrade: [
      { soldier: 2, shooter: 1, bull: 1, buldyga: 0 },
      { soldier: 2, shooter: 2, bull: 0, buldyga: 1 },
      { soldier: 3, shooter: 0, bull: 1, buldyga: 1 },
    ],
    enemy: [
      { soldier: 3, shooter: 1, bull: 1, buldyga: 1 },
      { soldier: 2, shooter: 2, bull: 2, buldyga: 0 },
      { soldier: 3, shooter: 0, bull: 0, buldyga: 2 },
    ],
  },
  3: {
    easy: [
      { soldier: 2, shooter: 1, bull: 1, buldyga: 0, cocoon: 0, bloated: 0 },
      { soldier: 1, shooter: 1, bull: 0, buldyga: 1, cocoon: 1, bloated: 0 },
      { soldier: 2, shooter: 0, bull: 1, buldyga: 0, cocoon: 0, bloated: 1 },
    ],
    medium: [
      { soldier: 2, shooter: 1, bull: 1, buldyga: 1, cocoon: 0, bloated: 1 },
      { soldier: 2, shooter: 2, bull: 0, buldyga: 1, cocoon: 1, bloated: 0 },
      { soldier: 1, shooter: 1, bull: 1, buldyga: 1, cocoon: 0, bloated: 2 },
    ],
    hard: [
      { soldier: 3, shooter: 1, bull: 1, buldyga: 1, cocoon: 1, bloated: 1 },
      { soldier: 2, shooter: 2, bull: 2, buldyga: 1, cocoon: 0, bloated: 2 },
      { soldier: 2, shooter: 1, bull: 1, buldyga: 2, cocoon: 1, bloated: 1 },
    ],
    key: [
      { soldier: 2, shooter: 1, bull: 1, buldyga: 1, cocoon: 1, bloated: 0 },
      { soldier: 3, shooter: 1, bull: 1, buldyga: 0, cocoon: 0, bloated: 2 },
      { soldier: 2, shooter: 2, bull: 0, buldyga: 1, cocoon: 1, bloated: 1 },
    ],
    simpleupgrade: [
      { soldier: 1, shooter: 1, bull: 1, buldyga: 0, cocoon: 0, bloated: 0 },
      { soldier: 2, shooter: 0, bull: 0, buldyga: 1, cocoon: 1, bloated: 0 },
      { soldier: 1, shooter: 1, bull: 0, buldyga: 0, cocoon: 0, bloated: 1 },
    ],
    cursedupgrade: [
      { soldier: 2, shooter: 1, bull: 1, buldyga: 1, cocoon: 0, bloated: 1 },
      { soldier: 2, shooter: 2, bull: 1, buldyga: 0, cocoon: 1, bloated: 1 },
      { soldier: 3, shooter: 0, bull: 1, buldyga: 1, cocoon: 1, bloated: 0 },
    ],
    enemy: [
      { soldier: 3, shooter: 1, bull: 1, buldyga: 1, cocoon: 1, bloated: 1 },
      { soldier: 2, shooter: 2, bull: 2, buldyga: 1, cocoon: 0, bloated: 2 },
      { soldier: 3, shooter: 0, bull: 1, buldyga: 2, cocoon: 1, bloated: 1 },
    ],
  },
};

// ============================================================
// WEAPON DEFINITIONS
// ============================================================
const WEAPON_DEFS = {
  pistol: {
    id: 'pistol',
    label: 'ПИСТОЛЕТ',
    description: 'Обычный пистолет',
    color: '#00d4ff',       // цвет пули/иконки
    pellets: 1,             // кол-во пуль за выстрел
    spread: 0.1,            // разброс (рад)
    damage: 35,             // урон одной пули
    cooldown: 0.35,         // задержка между выстрелами (сек)
    bulletSpeed: 400,       // скорость пули (пикс/сек)
    range: 15,              // дальность в клетках
    penetrate: 0,           // кол-во врагов, которых пробивает пуля
    shakeAmount: 0,       // сила тряски камеры
  },
  shotgun: {
    id: 'shotgun',
    label: 'ДРОБОВИК',
    description: 'Стреляет дробью.',
    color: '#ffaa00',
    pellets: 3,
    spread: 0.35,
    damage: 35,
    cooldown: 0.55,
    bulletSpeed: 320,
    range: 10,
    penetrate: 0,
    shakeAmount: 0.5,
  },
  smg: {
    id: 'smg',
    label: 'ПП',
    description: 'Высокая скорострельность.',
    color: '#ff44ff',
    pellets: 1,
    spread: 0.20,
    damage: 15,
    cooldown: 0.1,
    bulletSpeed: 400,
    range: 15,
    penetrate: 0,
    shakeAmount: 0,
  },
  rifle: {
    id: 'rifle',
    label: 'ВИНТОВКА',
    description: 'Высокая точность и урон. Пробивает 2 врагов.',
    color: '#44ff44',
    pellets: 1,
    spread: 0,
    damage: 51,
    cooldown: 1,
    bulletSpeed: 700,
    range: 40,
    penetrate: 2,
    shakeAmount: 0.8,
  },
  revolver: {
    id: 'revolver',
    label: 'РЕВОЛЬВЕР',
    description: 'Высокая точность. Пробивает 1 врага.',
    color: '#8b4513',
    pellets: 1,
    spread: 0.08,
    damage: 40,
    cooldown: 0.5,
    bulletSpeed: 450,
    range: 30,
    penetrate: 1,
    shakeAmount: 0.2,
  },
  carbine: {
    id: 'carbine',
    label: 'КАРАБИН',
    description: 'Очередь из 3 пуль.',
    color: '#556b2f',
    pellets: 1,
    spread: 0.15,
    damage: 35,
    cooldown: 1.0,
    burstSize: 3,           // кол-во пуль в очереди
    burstCooldown: 0.1,     // задержка между пулями в очереди (сек)
    bulletSpeed: 380,
    range: 35,
    penetrate: 0,
    shakeAmount: 0.3,
  },
};

// ============================================================
// UPGRADE TYPES
// ============================================================
const UPGRADE_TYPES = [
  { id: 'pellets',       label: '+1 пуля к выстрелу',     description: 'Каждый выстрел выпускает на 1 пулю больше',                   color: '#ffaa00', max: 2, icon: '🔫' },
  { id: 'damage',        label: '+1 урона от пули',        description: 'Каждая пуля наносит на 1 урон больше',                        color: '#ff4444', max: 2, icon: '💥' },
  { id: 'penetrate',     label: '+1 пробитие врага',       description: 'Пуля пролетает сквозь одного дополнительного врага',          color: '#ff44ff', max: 2, icon: '🎯' },
  { id: 'bulletSpeed',   label: '+30% скорость пули',      description: 'Пули летят быстрее',                     color: '#ffff44', max: 2, icon: '⚡' },
  { id: 'critChance',    label: '+5% шанс крита',          description: 'Шанс нанести двойной урон',                       color: '#ff0000', max: 3, icon: '⚔️' },
  { id: 'killAccel',     label: 'Убийственный разгон',     description: 'Каждое убийство ускоряет перезарядку на 0.2%',                  color: '#ff8800', max: 1, icon: '🏃' },
  { id: 'enhancedPierce',label: 'Усиленное пробитие',      description: 'Пуля, пробившая врага, наносит повышенный урон',               color: '#aa44ff', max: 1, icon: '💜' },
  { id: 'shield',        label: 'Щит',                     description: 'Поглощает один удар без потери жизни. Тратится.',                        color: '#00aaff', max: 2, icon: '🛡️' },
  { id: 'retreat',       label: 'Отступление',             description: 'После получения урона получи неуязвимость на 1.5 секунды',                  color: '#00ffaa', max: 2, icon: '🏃‍♂️' },
  { id: 'reflection',    label: 'Отражение',               description: 'При получении урона выпускает 3 пули в ближайших врагов',        color: '#ff00ff', max: 1, icon: '🔄' },
  { id: 'cooldown',      label: 'Перезарядка -15%',        description: 'Уменьшает время между выстрелами на 15%',                    color: '#00ccff', max: 3, icon: '⏱️' },
  { id: 'speed',         label: 'Скорость бега +10%',      description: 'Увеличивает скорость передвижения на 10%',                    color: '#44ff88', max: 3, icon: '💨' },
  // { id: 'spread', label: 'Разброс +10%', color: '#ff66aa', max: 2 },
];

// ============================================================
// CURSED UPGRADE TYPES (проклятые апгрейды — отдельный список)
// ============================================================
const CURSED_UPGRADE_TYPES = [
  {
    id: 'infinitePenetrate',
    label: 'Бесконечное пробитие',
    description: 'Пули пробивают всех врагов насквозь, но -20% скорости перезарядки',
    color: '#cc44ff',
    max: 1,
    icon: '🔮',
  },
  {
    id: 'infiniteRange',
    label: 'Бесконечная дальность',
    description: 'Пули летят бесконечно, но -30% скорости передвижения',
    color: '#ff6622',
    max: 1,
    icon: '🌀',
  },
  {
    id: 'ricochet',
    label: 'Рикошет',
    description: 'Пули отскакивают от стен, +50% к дальности',
    color: '#22ffdd',
    max: 1,
    icon: '↩️',
  },
  {
    id: 'weaponSlot',
    label: '+1 слот для оружия',
    description: 'Дополнительный слот оружия.',
    color: '#ffaa00',
    max: 3,
    icon: '🗃️',
  },
  {
    id: 'lastLife',
    label: 'Последняя жизнь',
    description: 'При смертельном уроне все враги в бою умрут, урон не получишь. Одноразовый.',
    color: '#ff0000',
    max: 1,
    icon: '💀',
  },
  {
    id: 'battleSpeed',
    label: 'Боевое ускорение',
    description: '+25% скорости при 2 комнатах в бою, -15% за каждую комнату сверх двух',
    color: '#00ff88',
    max: 1,
    icon: '⚡',
  },
  {
    id: 'freeze',
    label: 'Заморозка',
    description: 'В начале боя враги не могут двигаться 1.5 секунд',
    color: '#00ccff',
    max: 1,
    icon: '❄️',
  },
  {
    id: 'randomBonus',
    label: 'Что попало',
    description: 'Получить 3 случайных обычных бонуса',
    color: '#ff00ff',
    max: 1,
    icon: '🎲',
  },
  {
    id: 'farSight',
    label: 'Далеко гляжу',
    description: 'Видно содержимое смежных комнат по диагонали',
    color: '#ffff00',
    max: 1,
    icon: '👁️',
  },
  {
    id: 'longRange',
    label: 'Дальнобойщик',
    description: 'За каждую открытую комнату в бою +20% к дальности полета пули',
    color: '#ff8800',
    max: 1,
    icon: '🏹',
  },
  {
    id: 'sniper',
    label: 'Снайпер',
    description: 'Максимальная точность при 2 комнатах в бою, +10% разброса за каждую дополнительную комнату',
    color: '#00ff00',
    max: 1,
    icon: '🎯',
  },
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
const HERO_SW = 500, HERO_SH = 500; // размер одного спрайта в исходном листе (пикс)
const HERO_ANIMS = {
  // row: строка в спрайт-листе; frames: кол-во кадров; fps: скорость анимации
  idle_forward: { row: 0, frames: 5, fps: 8 },  // стоя лицом вперёд
  idle_left:    { row: 1, frames: 5, fps: 8 },  // стоя лицом влево
  idle_back:    { row: 2, frames: 5, fps: 8 },  // стоя спиной
  run_forward:  { row: 3, frames: 4, fps: 10 }, // бег лицом вперёд
  run_left:     { row: 4, frames: 4, fps: 10 }, // бег лицом влево
  run_back:     { row: 5, frames: 4, fps: 10 }, // бег спиной
};

// ============================================================
// COCOON ENEMY SPRITE SHEET
// Sprite sheet: 3500x500, each sprite 500x500 (7 frames horizontal)
// 7 animation frames for idle/pulsing animation
// ============================================================
const COCOON_SW = 500, COCOON_SH = 500; // размер одного спрайта (пикс)
const COCOON_ANIM = {
  frames: 7,
  fps: 8,
};
