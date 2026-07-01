// ============================================================
// GAME CONFIGURATION
// All constants and magic numbers live here.
// ============================================================

const CONFIG = {
  // Wall rendering
  WALL_FILL_ALPHA:        0.92,  // непрозрачность залитых стен
  WALL_STROKE_ALPHA:      0.5,   // непрозрачность обводки стен
  WALL_REMOVED_FILL_ALPHA:   0.29,  // залитые стены-проходы (удалённые)
  WALL_REMOVED_STROKE_ALPHA: 0.05,  // обводка стен-проходов
  WALL_3D_CAP_ALPHA:      0.92,  // верхняя грань 3д стен
  WALL_DISSOLVE_DURATION:   0.2,   // длительность dissolve-анимации открытия стены (сек)
  WALL_DISSOLVE_NOISE_SCALE: 24.0,  // масштаб шума (крупность зерна)
  WALL_DISSOLVE_DIST_SCALE:  5.2,  // масштаб расстояния от центра (1.0 = до края, >1 = быстрее к краям)
  WALL_DISSOLVE_DIST_WEIGHT: 0.5,  // сила влияния расстояния от центра на скорость
  WALL_DISSOLVE_FADE_START:  0.7,  // порог начала общего fade-out (0..1.5)
  WALL_DISSOLVE_FADE_END:    2.4,  // порог конца fade-out
  WALL_3D_HEIGHT:         96 * 1.3 / 5,   // высота 3д стены (мировые пиксели) = CELL_PX / 3
  WALL_3D_CAM_Z:          96 * 1.3 * 2,   // виртуальная высота камеры для перспективы
  WALL_3D_USE_TEXTURES:  true,           // использовать текстуры на боковых гранях 3д стен

  // Lighting
  LIGHT_RADIUS: 200,       // радиус освещения от игрока (пиксели)
  LIGHT_RAY_COUNT: 360,   // кол-во лучей для raycasting
  LIGHT_COLOR: '#ffcc00', // цвет света (теплый желтый)
  LIGHT_ALPHA_CENTER: 0.3, // яркость в центре (0..1)
  LIGHT_ALPHA_MID: 0.1,    // яркость на середине радиуса
  LIGHT_MOVE_THRESHOLD: 2, // порог движения игрока для обновления света (пиксели)
  LIGHT_DARKNESS_ALPHA: 0.45, // непрозрачность тьмы вне освещения (0..1)

  // Grid & View
  GRID_SIZE: 9,           // размер сетки (кол-во клеток по стороне)
  CELL_PX: 96 * 1.3,      // размер клетки в пикселях
  VIEW_W: 1024,      // ширина области просмотра в пикселях
  VIEW_H: 576,            // высота области просмотра в пикселях

  // Player
  INITIAL_LIVES: 3,       // начальное кол-во жизней
  LIVES_PER_HEART: 1,     // жизней на одно сердце
  PLAYER_SPEED: 2.2,      // скорость игрока (пикс/сек)
  PLAYER_RADIUS: 5,       // радиус коллизии игрока
  PLAYER_SPRITE_RADIUS: 14,        // визуальный радиус спрайта (половина ширины отрисовки)
  PLAYER_INVULNERABLE_TIME: 1,    // секунд неуязвимости после урона

  // Player Dash
  PLAYER_DASH_SPEED: 8,       // скорость деша (пикс/сек)
  PLAYER_DASH_DISTANCE: 1.1,    // дальность деша (пикселей)
  PLAYER_DASH_COOLDOWN: 2.0,    // кулдаун деша (сек)

  // Shooting (default values, weapon-specific in WEAPON_DEFS)
  SHOOTING_ENABLED: true, // включить стрельбу
  BULLET_SPEED: 100,      // скорость пули по умолчанию (пикс/сек)
  BULLET_DAMAGE: 1,      // урон пули по умолчанию
  BULLET_RADIUS: 3,       // радиус пули
  BULLET_LIFE: 1.5,                 // время жизни пули (сек)

  // Muzzle flash particles
  MUZZLE_PARTICLES_COUNT: 4,          // кол-во частиц вспышки дула
  MUZZLE_PARTICLES_SPREAD: 0.3,       // угол разлёта (рад)
  MUZZLE_PARTICLES_SPEED_MIN: 200,     // мин. скорость частиц вспышки
  MUZZLE_PARTICLES_SPEED_MAX: 400,     // макс. скорость частиц вспышки
  MUZZLE_PARTICLES_LIFE: 0.2,         // время жизни частиц вспышки (сек)

  // Hit particles (when bullet hits enemy) - green blood
  HIT_PARTICLES_COUNT: 3,             // кол-во частиц при попадании в врага
  HIT_PARTICLES_SPEED_MIN: 40,        // мин. скорость частиц крови
  HIT_PARTICLES_SPEED_MAX: 200,       // макс. скорость частиц крови
  HIT_PARTICLES_SPREAD: 0.6,          // угол разлёта крови (рад)
  HIT_PARTICLES_LIFE: 0.5,            // время жизни частиц крови (сек)
  HIT_PARTICLES_COLOR: '#a21515',     // цвет крови врага
  ENEMY_HIT_FLASH_DURATION: 0.18,     // длительность белой вспышки при уроне (сек)
  ENEMY_STUN_DURATION: 0.3,           // длительность стана при получении урона (сек)

  // Death particles (when enemy dies)
  DEATH_PARTICLES_COUNT: 5,          // кол-во частиц при смерти врага
  DEATH_PARTICLES_SPEED_MIN: 40,      // мин. скорость частиц смерти
  DEATH_PARTICLES_SPEED_MAX: 200,      // макс. скорость частиц смерти
  DEATH_PARTICLES_LIFE: 0.6,          // время жизни частиц смерти (сек)

  // Wall hit particles
  WALL_HIT_PARTICLES_COUNT: 2,        // кол-во частиц при попадании в стену
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

  // Camera smooth follow (play mode)
  CAMERA_CURSOR_WEIGHT: 0.3,  // 0 = только игрок, 1 = только курсор
  CAMERA_DAMPING: 2.0,         // λ экспоненциального сглаживания (выше = быстрее)
  CAMERA_MAX_OFFSET: 160,      // макс. сдвиг камеры от игрока в сторону курсора (px)

  // Spiders
  SPIDER_HP: 3*2,         // здоровье паука
  SPIDER_SPEED: 1,       // скорость паука (пикс/сек)
  SPIDER_RADIUS: 7,       // радиус коллизии паука
  SPIDER_VISUAL_SCALE: 2.9,       // множитель визуального размера спрайта
  SPIDER_PHASE_SPEED: 2,          // скорость анимации парения
  SPIDER_WOBBLE_MIN: 0.2, // мин. амплитуда покачивания
  SPIDER_WOBBLE_MAX: 0.3, // макс. амплитуда покачивания
  SPIDER_SPAWN_MARGIN: 10,        // отступ от стен при спавне

  // Bat (level 1 only)
  BAT_HP: 3*2,            // здоровье летучей мыши
  BAT_SPEED: 1,          // скорость летучей мыши
  BAT_RADIUS: 7,          // радиус коллизии летучей мыши
  BAT_VISUAL_SCALE: 3.9,          // множитель визуального размера
  BAT_ANIM_FPS: 15,        // скорость анимации полёта
  BAT_ZIGZAG_FREQ: 4,    // частота зигзага (рад/сек)
  BAT_ZIGZAG_AMP: 0.8,    // амплитуда зигзага (нормализованный перпендикуляр)

  // Shooters
  SHOOTER_HP: 2*2,             // здоровье плеваки
  SHOOTER_SPEED: 1,          // скорость плеваки (пикс/сек)
  SHOOTER_RADIUS: 6,          // радиус коллизии плеваки
  SHOOTER_VISUAL_SCALE: 2.5,          // множитель визуального размера спрайта
  SHOOTER_BULLET_SPEED: 100,  // скорость пули плеваки
  SHOOTER_SHOOT_RANGE_CELLS: 2, // дальность стрельбы плеваки (в клетках)
  SHOOTER_SHOOT_CD: 1.5,     // кулдаун выстрела плеваки (сек)
  SHOOTER_STOP_DIST_CELLS: 2,   // дистанция остановки плеваки (в клетках)
  // Spawn chances by level
  // Level 1: only soldier/shooter
  SHOOTER_CHANCE: 0.20,           // шанс что враг будет плевакой (остальное - солдат)
  // Level 2: bull/buldyga + soldier/shooter
  BULL_CHANCE: 0.20,              // шанс что враг будет быком
  BULDYGA_CHANCE: 0.30,           // шанс что враг будет булдыгой (после быка)
  // Level 3: cocoon/bloated/bull/buldyga + soldier/shooter
  COCOON_CHANCE: 0.30,           // шанс что враг будет коконом
  BLOATED_CHANCE: 0.30,           // шанс что враг будет распухшим (после кокона)
  BULL_CHANCE_LVL3: 0.20,         // шанс что враг будет быком на 3 уровне (после распухшего)
  BULDYGA_CHANCE_LVL3: 0.20,      // шанс что враг будет булдыгой на 3 уровне (после быка)

  // Bull
  BULL_HP: 4*2,           // здоровье быка
  BULL_SPEED: 1,         // скорость быка (пикс/сек)
  BULL_RADIUS: 6,         // радиус коллизии быка
  BULL_VISUAL_SCALE: 3.2,         // множитель визуального размера спрайта
  BULL_PREPARE_TIME: 1,         // время подготовки рывка (сек)
  BULL_DASH_DISTANCE_CELLS: 0.02,  // дистанция рывка быка (в клетках)
  BULL_REST_TIME: 1.5,            // время отдыха после рывка (сек)
  BULL_CHARGE_DIST_CELLS: 0.75,    // дистанция начала атаки быка (в клетках)
  BULL_ATTACK_DIST_CELLS: 1.0,    // дистанция удара быка (в клетках)

  // Buldyga
  BULDYGA_HP: 8*2,        // здоровье булдыги
  BULDYGA_SPEED: 1,              // начальная скорость
  BULDYGA_SPEED_INCREMENT: 0.1,    // ускорение каждую секунду
  BULDYGA_RADIUS: 6,     // радиус коллизии булдыги
  BULDYGA_VISUAL_SCALE: 4.0,     // множитель визуального размера спрайта
  BULDYGA_ACCEL: 20,             // ускорение инерции (пикс/с²)
  BULDYGA_FRICTION: 3.5,          // коэффициент торможения (затухание скорости)

  // Cocoon (spawner)
  COCOON_HP: 16*2,         // здоровье кокона
  COCOON_RADIUS: 10,      // радиус коллизии кокона
  COCOON_VISUAL_SCALE: 3.2,      // множитель визуального размера спрайта
  COCOON_SPAWN_INTERVAL: 3.0,     // секунд между спавнами солдат
  COCOON_CHANCE: 0.30,            // шанс спавна кокона на уровне 3

  // Bloated (explodes on death)
  BLOATED_HP: 4*2,        // здоровье распухшего
  BLOATED_SPEED: 1,      // скорость распухшего (пикс/сек)
  BLOATED_RADIUS: 7,      // радиус коллизии распухшего
  BLOATED_VISUAL_SCALE: 3.2,      // множитель визуального размера спрайта
  BLOATED_DEATH_SHOT_SPEED: 120,  // скорость пули при смерти (как у плеваки)
  BLOATED_CHANCE: 0.30,           // шанс спавна распухшего на уровне 3 (после кокона)

  // Enemy costs for budget-based spawning
  ENEMY_COSTS: {
    bat: 15,          // летающий, зигзаг
    soldier: 20,      // преследует игрока
    shooter: 30,      // стреляет
    bull: 40,         // рывки
    buldyga: 50,      // инерция, ускорение
    cocoon: 60,       // спавнит солдат
    bloated: 35,      // взрывается при смерти
  },

  // Level generation
  DISABLED_CELLS_COUNT: 15,       // кол-во заблокированных клеток по умолчанию
  BLOCK_CELLS_FOREVER: false,     // блокировать клетки навсегда (дебаг)
  MAX_GENERATION_ATTEMPTS: 1000,  // макс. попыток генерации уровня
  ENEMY_SPAWN_CHANCE: 0.5,        // шанс спавна врагов в клетке

  // Pickup distances
  PICKUP_DISTANCE: 10,            // расстояние до предметов (добавляется к радиусу)
  WEAPON_PICKUP_DISTANCE: 24,     // расстояние до оружия

  // Upgrade popup
  UPGRADE_POPUP_DURATION: 2.0,    // секунд

  // Battle mode
  BATTLE_SCALE: 1,                // unified coords — no separate battle space
  BATTLE_TRANSITION_DURATION: 1.0, // секунд на zoom

  // Camera zoom
  PLAY_MODE_ZOOM: 1,              // зум камеры в play режиме
  BATTLE_ZOOM_MULTIPLIER: 1,      // множитель к вычисленному зуму в battle режиме

  // Zoom/Transitions
  ZOOM_DURATION: 1.0,             // секунд

  // Particle pool
  PARTICLE_POOL_MAX_SIZE: 200,    // максимум частиц в пуле

  // Sound
  DEFAULT_VOLUME: 0.3,    // громкость по умолчанию (0..1)
  AMBIENCE_VOLUME_MULT: 0.6,      // громкость амбиента относительно основной
  SHOT_VOLUME_MULT: 0.4,          // громкость выстрелов относительно основной
  FOOTSTEP_INTERVAL: 0.25,        // секунд между шагами

  // Music
  MUSIC: {
    1: { file: 'Three Red Hearts Candy.ogg', volume: 0.0 },
    2: { file: 'Clement Panchout - Sweet 70s.wav', volume: 0.0 },
    3: { file: 'Three Red Hearts - Box Jump.ogg', volume: 0.0 },
    BOSS: { file: 'GEN Death metal.wav', volume: 0.0 },
  },
  FADE_DURATION_LEVEL_TO_BOSS: 0.5,  // seconds
  FADE_DURATION_BOSS_TO_LEVEL: 0.5,  // seconds
  FADE_DURATION_LEVEL_END: 2.0,      // seconds

  // Debug
  DEBUG_INVULNERABLE: false,      // дебаг: неуязвимость игрока от врагов
  DEBUG_SPREAD_INDICATOR: false,  // дебаг: отображать индикатор угла разброса
  DEBUG_COLLISIONS: false,        // дебаг: отображать коллайдеры
  SHOW_FPS: true,                 // дебаг: отображать счетчик FPS

  // Boss phase AI
  BOSS_STRAFE_SPEED: 1,          // скорость стрейфа босса в фазе плеваки (пикс/сек)
  BOSS_STRAFE_SWITCH_TIME: 1.2,   // секунд до смены направления стрейфа
};

// ============================================================
// LEVEL CONFIGURATION
// ============================================================
const LEVEL_CONFIG = {
  // gridSize: размер сетки; roomCount: кол-во комнат;
  // roomQuotas: обязательное количество комнат каждого размера (остальные — 1-клеточные)
  1: { 
    genType: 'grid',
    roomCount: 25,
    roomQuotas: { size4: 1, size3: 2, size2: 3 },
    content: {
      weapons: 1,
      upgrades: 4,
      cursed: 1,
      bonuses: 3,
      hearts: 1,
      enemyRoomPercent: 0.4
    }
  },
  2: { 
    genType: 'random',
    roomCount: 25,
    roomQuotas: { size4: 1, size3: 2, size2: 3 },
    content: {
      weapons: 2,
      upgrades: 10,
      cursed: 1,
      bonuses: 3,
      hearts: 2,
      enemyRoomPercent: 0.5
    }
  },
  3: { 
    genType: 'random',
    roomCount: 25,
    roomQuotas: { size4: 1, size3: 2, size2: 3 },
    content: {
      weapons: 2,
      upgrades: 16,
      cursed: 1,
      bonuses: 3,
      hearts: 3,
      enemyRoomPercent: 0.6
    }
  },
};

// Legacy counts (can be removed once refactoring is complete, but keeping for now if needed elsewhere)
const LEVEL_WEAPON_COUNTS  = { 1: 1, 2: 2, 3: 2 };
const LEVEL_UPGRADE_COUNTS = { 1: 4, 2: 10, 3: 16 };
const LEVEL_CHEST_COUNTS   = { 1: 3, 2: 2, 3: 3 };
const LEVEL_ROOM_BONUS_COUNTS = { 1: 3, 2: 3, 3: 3 };

// ============================================================
// ROOM ENEMY POOLS
// Пресеты врагов для каждого типа комнаты по уровням.
// Ключи: bat, soldier, shooter, bull, buldyga, cocoon, bloated
// Типы комнат: easy, medium, hard, key, simpleupgrade, cursedupgrade, enemy
// ============================================================
const ROOM_POOLS = {
  1: {
    easy: [
      { bat: 3, shooter: 2 },
      { bat: 2, shooter: 3 },
      { shooter: 4 },
      { bat: 4, bloated: 1 },
      { bat: 5, bloated: 1 },
    ],
    medium: [
      { bloated: 2 },
      { bat: 3, shooter: 2, bloated: 1 },
      { bat: 4, shooter: 2, bloated: 1 },
      { bat: 3, shooter: 2 },
      { bloated: 2, bat: 2, shooter: 1 },
    ],
    hard: [
      { bat: 3, bloated: 2 },
      { bat: 3, bloated: 2, shooter: 3 },
      { bat: 2, bloated: 3, shooter: 3 },
      { bat: 6, shooter: 2 },
      { bloated: 2, bat: 4, shooter: 2 },
    ],
    key: [
      { bloated: 4 },
      { bloated: 3, shooter: 2 },
      { bloated: 4, shooter: 2 },
      { bat: 7, shooter: 2 },
      { bloated: 3, bat: 4, shooter: 2 },
    ],
    simpleupgrade: [
      { bat: 3, bloated: 4 },
      { bat: 3, bloated: 3, shooter: 2 },
      { bat: 3, bloated: 4, shooter: 2 },
      { bat: 7, shooter: 2 },
      { bloated: 3, bat: 4, shooter: 2 },
    ],
    cursedupgrade: [
      { bat: 3, bloated: 4 },
      { bat: 3, bloated: 3, shooter: 2 },
      { bat: 3, bloated: 4, shooter: 2 },
      { bat: 5, shooter: 2 },
      { bloated: 3, bat: 4, shooter: 2 },
    ],
    enemy: [
      { bat: 3, shooter: 0 },
      { bat: 2, shooter: 2 },
      { bat: 4, shooter: 0 },
    ],
  },

  2: {
    easy: [
      { soldier: 3, shooter: 2, bull: 1 },
      { soldier: 2, shooter: 3, bull: 1 },
      { shooter: 4, bull: 1 },
      { soldier: 4, bull: 2 },
      { bloated: 2, bull: 1 },
      { soldier: 3, shooter: 2, buldyga: 1 },
    ],
    medium: [
      { soldier: 4, shooter: 3, bull: 1, buldyga: 1 },
      { soldier: 3, shooter: 4, bull: 1, buldyga: 1 },
      { shooter: 4, bull: 2, buldyga: 1 },
      { soldier: 5, bull: 2, buldyga: 1 },
      { bloated: 3, bull: 1, buldyga: 1 },
      { soldier: 4, shooter: 2, buldyga: 2 },
    ],
    hard: [
      { soldier: 6, shooter: 2, bull: 2, buldyga: 1 },
      { soldier: 5, shooter: 3, bull: 2, buldyga: 2 },
      { shooter: 4, bull: 3, buldyga: 2 },
      { soldier: 4, bull: 4, buldyga: 2 },
      { bloated: 4, bull: 2, buldyga: 1 },
      { buldyga: 4, shooter: 2, bull: 1 },
    ],
    key: [
      { soldier: 6, shooter: 3, bull: 2, buldyga: 2 },
      { soldier: 5, shooter: 4, bull: 2, buldyga: 2 },
      { shooter: 5, bull: 3, buldyga: 2 },
      { soldier: 7, bull: 3, buldyga: 2 },
      { bloated: 4, bull: 2, buldyga: 2 },
      { buldyga: 5, shooter: 3, bull: 2 },
    ],
    simpleupgrade: [
      { soldier: 6, shooter: 3, bull: 2, buldyga: 2 },
      { soldier: 5, shooter: 4, bull: 2, buldyga: 2 },
      { shooter: 5, bull: 3, buldyga: 2 },
      { soldier: 7, bull: 3, buldyga: 2 },
      { bloated: 4, bull: 2, buldyga: 2 },
      { buldyga: 5, shooter: 3, bull: 2 },
    ],
    cursedupgrade: [
      { soldier: 6, shooter: 3, bull: 2, buldyga: 2 },
      { soldier: 5, shooter: 4, bull: 2, buldyga: 2 },
      { shooter: 5, bull: 3, buldyga: 2 },
      { soldier: 7, bull: 3, buldyga: 2 },
      { bloated: 4, bull: 2, buldyga: 2 },
      { buldyga: 5, shooter: 3, bull: 2 },
    ],
    enemy: [
      { soldier: 3, shooter: 1, bull: 1, buldyga: 1 },
      { soldier: 2, shooter: 2, bull: 2, buldyga: 1 },
      { soldier: 3, shooter: 0, bull: 1, buldyga: 2 },
    ],
  },

  3: {
    easy: [
      { soldier: 5, shooter: 2, bull: 1, cocoon: 1, bloated: 1 },
      { soldier: 4, shooter: 3, bull: 1, cocoon: 1, bloated: 1 },
      { shooter: 4, bull: 2, cocoon: 1, bloated: 1 },
      { soldier: 6, bull: 1, cocoon: 1, bloated: 1 },
      { bloated: 3, bull: 1, cocoon: 1 },
    ],
    medium: [
      { soldier: 6, shooter: 3, bull: 2, cocoon: 1, bloated: 1 },
      { soldier: 5, shooter: 4, bull: 2, cocoon: 1, bloated: 1 },
      { shooter: 5, bull: 3, cocoon: 1, bloated: 1 },
      { soldier: 7, bull: 2, cocoon: 1, buldyga: 1 },
      { bloated: 4, bull: 2, cocoon: 1, buldyga: 1 },
    ],
    hard: [
      { soldier: 7, shooter: 4, bull: 3, cocoon: 2, bloated: 2, buldyga: 1 },
      { soldier: 6, shooter: 5, bull: 3, cocoon: 2, bloated: 2, buldyga: 1 },
      { shooter: 6, bull: 4, cocoon: 2, bloated: 2, buldyga: 2 },
      { soldier: 8, bull: 3, cocoon: 2, bloated: 2, buldyga: 2 },
      { bloated: 5, bull: 3, cocoon: 2, buldyga: 2 },
    ],
    key: [
      { soldier: 7, shooter: 4, bull: 3, cocoon: 4, bloated: 2, buldyga: 2 },
      { soldier: 6, shooter: 5, bull: 3, cocoon: 4, bloated: 2, buldyga: 2 },
      { shooter: 6, bull: 4, cocoon: 5, bloated: 2, buldyga: 2 },
      { soldier: 8, bull: 3, cocoon: 4, bloated: 2, buldyga: 2 },
      { bloated: 5, bull: 3, cocoon: 4, buldyga: 2 },
    ],
    simpleupgrade: [
      { soldier: 7, shooter: 4, bull: 3, cocoon: 4, bloated: 2, buldyga: 2 },
      { soldier: 6, shooter: 5, bull: 3, cocoon: 4, bloated: 2, buldyga: 2 },
      { shooter: 6, bull: 4, cocoon: 5, bloated: 2, buldyga: 2 },
      { soldier: 8, bull: 3, cocoon: 4, bloated: 2, buldyga: 2 },
      { bloated: 5, bull: 3, cocoon: 4, buldyga: 2 },
    ],
    cursedupgrade: [
      { soldier: 7, shooter: 4, bull: 3, cocoon: 4, bloated: 2, buldyga: 2 },
      { soldier: 6, shooter: 5, bull: 3, cocoon: 4, bloated: 2, buldyga: 2 },
      { shooter: 6, bull: 4, cocoon: 5, bloated: 2, buldyga: 2 },
      { soldier: 8, bull: 3, cocoon: 4, bloated: 2, buldyga: 2 },
      { bloated: 5, bull: 3, cocoon: 4, buldyga: 2 },
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
    damage: 1*2,             // урон одной пули
    cooldown: 0.4,         // задержка между выстрелами (сек)
    bulletSpeed: 300,       // скорость пули (пикс/сек)
    range: 13,              // дальность в клетках
    penetrate: 0,           // кол-во врагов, которых пробивает пуля
    shakeAmount: 0,       // сила тряски камеры
    spriteAngle: 0.1,       // поправка угла спрайта (рад)
  },
  shotgun: {
    id: 'shotgun',
    label: 'ДРОБОВИК',
    description: 'Стреляет дробью.',
    color: '#ffaa00',
    pellets: 3,
    spread: 0.35,
    damage: 1*2,
    cooldown: 0.75,
    bulletSpeed: 320,
    range: 10,
    penetrate: 0,
    shakeAmount: 0.5,
    spriteAngle: 0.55,
  },
  smg: {
    id: 'smg',
    label: 'ПП',
    description: 'Высокая скорострельность.',
    color: '#ff44ff',
    pellets: 1,
    spread: 0.20,
    damage: 0.5*2,
    cooldown: 0.12,
    bulletSpeed: 400,
    range: 18,
    penetrate: 0,
    shakeAmount: 0,
    spriteAngle: 0.8,
  },
  rifle: {
    id: 'rifle',
    label: 'ВИНТОВКА',
    description: 'Высокая точность и урон. Пробивает 2 врагов.',
    color: '#44ff44',
    pellets: 1,
    spread: 0.05,
    damage: 3*2,
    cooldown: 1.4,
    bulletSpeed: 700,
    range: 40,
    penetrate: 2,
    shakeAmount: 0.8,
    spriteAngle: 0.7,
  },
  revolver: {
    id: 'revolver',
    label: 'РЕВОЛЬВЕР',
    description: 'Высокая точность. Пробивает 1 врага.',
    color: '#8b4513',
    pellets: 1,
    spread: 0.08,
    damage: 1*2,
    cooldown: 0.7,
    bulletSpeed: 450,
    range: 27,
    penetrate: 1,
    shakeAmount: 0.2,
    spriteAngle: 0,
  },
  carbine: {
    id: 'carbine',
    label: 'КАРАБИН',
    description: 'Очередь из 3 пуль.',
    color: '#556b2f',
    pellets: 1,
    spread: 0.15,
    damage: 1*2,
    cooldown: 0.8,
    burstSize: 3,           // кол-во пуль в очереди (мультивыстрел: +1 за апгрейд pellets)
    burstDuration: 0.2,     // полное время очереди (сек); задержка между пулями = burstDuration / (размер очереди - 1)
    bulletSpeed: 400,
    range: 25,
    penetrate: 0,
    shakeAmount: 0.3,
    spriteAngle: 0.7,
  },
};

// ============================================================
// BOSS DEFINITIONS (по уровням)
// type: 'boss_phase' — фазовый босс с чередованием поведения
// phases: массив { id: 'soldier'|'shooter', duration: сек }
//   soldier — преследует игрока
//   shooter — стрейфает перпендикулярно и стреляет
// Уровни 2/3 — заглушки, идентичные уровню 1 (заменить позже)
// ============================================================
const BOSS_DEFS = {
  1: {
    type: 'boss_phase',
    hpMult: 30,             // множитель к SPIDER_HP
    radiusMult: 2.25,       // множитель к SPIDER_RADIUS
    speedMult: 1.1,         // множитель к SPIDER_SPEED
    name: 'БОСС',
    phases: [
      { id: 'soldier', duration: 5 },
      { id: 'shooter', duration: 5 },
    ],
  },
  2: {
    type: 'boss_phase',
    hpBase: 'buldyga',     // база HP — BULDYGA_HP
    hpMult: 40,            // BULDYGA_HP * 10 = 160
    radiusMult: 2.5,
    speedMult: 1.0,
    name: 'БОСС',
    phases: [
      { id: 'buldyga', duration: 6, accelMult: 2, frictionMult: 0.67 },  // инерция x2
      { id: 'shooter', duration: 5, shootCdMult: 0.4, bulletSpeedMult: 0.8 }, // скорострельность,  скорость пули
    ],
  },
  3: {
    type: 'boss_phase',
    hp: 3000,               // фиксированный HP
    radiusMult: 2.5,
    speedMult: 1.0,
    name: 'БОСС',
    phases: [
      { id: 'buldyga',      duration: 10, accelMult: 2, frictionMult: 0.6 },  // большая инерция
      { id: 'pause',        duration: 1 },
      { id: 'shooter',      duration: 6,  shootCdMult: 0.4, bulletSpeedMult: 1.8 }, // быстрые снаряды
      { id: 'pause',        duration: 1 },
      { id: 'bull_limited', maxDashes: 3, dashCells: 5, dashSpeedMult: 1.5 }, // 3 рывка, 5 клеток,
      { id: 'pause',        duration: 1 },
    ],
  },
};

// ============================================================
// UPGRADE TYPES
// ============================================================
const UPGRADE_TYPES = [
  { id: 'pellets',       label: '+1 пуля к выстрелу',     description: 'Каждый выстрел выпускает на 1 пулю больше',                   color: '#ffaa00', max: 2, icon: '🔫', effects: { pellets: 1 } },
  { id: 'damage',        label: '+2 урона от пули',        description: 'Каждая пуля наносит на 2 урона больше',                        color: '#ff4444', max: 2, icon: '💥', effects: { damage: 2 } },
  { id: 'penetrate',     label: '+1 пробитие врага',       description: 'Пуля пролетает сквозь одного дополнительного врага',          color: '#ff44ff', max: 2, icon: '🎯', effects: { penetrate: 1 } },
  { id: 'bulletSpeed',   label: '+30% скорость пули',      description: 'Пули летят быстрее на +30%',                     color: '#ffff44', max: 2, icon: '⚡', effects: { bulletSpeedMult: 0.30 } },
  { id: 'critChance',    label: '+5% шанс крита',          description: '+5% шанс нанести двойной урон',                       color: '#ff0000', max: 3, icon: '⚔️', effects: { critChance: 0.05 } },
  { id: 'killAccel',     label: 'Убийственный разгон',     description: 'Каждое убийство ускоряет перезарядку на 0.1%',                  color: '#ff8800', max: 1, icon: '🏃', effects: { killAccel: true } },
  { id: 'enhancedPierce',label: 'Усиленное пробитие',      description: 'Пуля, пробившая врага, имеет шанс 50% нанести удвоенный урон',               color: '#aa44ff', max: 1, icon: '🗡️', effects: { enhancedPierce: true } },
  { id: 'shield',        label: 'Щит',                     description: 'Поглощает один удар без потери жизни. Тратится.',                        color: '#00aaff', max: 2, icon: '🛡️', effects: { shield: 1 } },
  { id: 'retreat',       label: 'Отступление',             description: 'После получения урона получи неуязвимость на 1.5 секунды',                  color: '#00ffaa', max: 2, icon: '🏃‍♂️', effects: { retreat: 1 } },
  { id: 'reflection',    label: 'Отражение',               description: 'При получении урона выпускает 3 пули в ближайших врагов',        color: '#ff00ff', max: 1, icon: '🔄', effects: { reflection: true } },
  { id: 'cooldown',      label: 'Перезарядка -15%',        description: 'Уменьшает время между выстрелами на 15%',                    color: '#00ccff', max: 3, icon: '⏱️', effects: { cooldownMult: -0.15 } },
  { id: 'speed',         label: 'Скорость бега +10%',      description: 'Увеличивает скорость передвижения на 10%',                    color: '#44ff88', max: 3, icon: '💨', effects: { speedMult: 0.10 } },
];

const ROOM_BONUS_TYPES = [
  { id: 'penetrate',     label: 'Пробитие',       description: 'Пули пробивают врагов насквозь',          color: '#ff44ff', max: 2, icon: '🎯' },
  { id: 'speedup',   label: 'Ускорение',      description: 'Персонаж, враги и пули ускоряются на 50%',                     color: '#ffff44', max: 2, icon: '⚡', speedMult: 1.5 },
  { id: 'speeddown',    label: 'Замедление',          description: 'Персонаж, враги и пули замедляются на 50%',                       color: '#ff0000', max: 3, icon: '⚔️', speedMult: 0.5 },
];

// ============================================================
// CURSED UPGRADE TYPES (проклятые апгрейды — отдельный список)
// ============================================================
const CURSED_UPGRADE_TYPES = [
  {
    id: 'infinitePenetrate',
    label: 'Бесконечное пробитие',
    description: 'Пули пробивают всех врагов насквозь, но -20% скорости перезарядки',
    color: '#7fff44',
    max: 1,
    icon: '🔮',
    effects: { infinitePenetrate: true, cooldownMult: 0.20 }
  },
  {
    id: 'infiniteRange',
    label: 'Бесконечная дальность',
    description: 'Пули летят бесконечно, но -30% скорости передвижения',
    color: '#2238ff',
    max: 1,
    icon: '🌀',
    effects: { infiniteRange: true, speedMult: -0.30 }
  },
  {
    id: 'ricochet',
    label: 'Рикошет',
    description: 'Пули отскакивают от стен, +50% к дальности',
    color: '#ff8922',
    max: 1,
    icon: '↩️',
    effects: { ricochet: true }
  },
  {
    id: 'weaponSlot',
    label: '+1 слот для оружия',
    description: 'Дополнительный слот оружия.',
    color: '#ffaa00',
    max: 3,
    icon: '🗃️',
    onApply: (state, playerProgress) => {
      state.maxSlots++;
      state.weaponSlots.push(null);
      playerProgress.maxSlots = state.maxSlots;
      playerProgress.weaponSlots = [...state.weaponSlots];
    }
  },
  {
    id: 'lastLife',
    label: 'Последняя жизнь',
    description: 'При смертельном уроне все враги в бою умрут, урон не получишь. Одноразовый.',
    color: '#ff0000',
    max: 1,
    icon: '💀',
    effects: { lastLife: true }
  },
  {
    id: 'battleSpeed',
    label: 'Боевое ускорение',
    description: '+25% скорости при 2 комнатах в бою, -10% за каждую комнату сверх двух',
    color: '#00ff88',
    max: 1,
    icon: '⚡',
    effects: { battleSpeed: true }
  },
  {
    id: 'freeze',
    label: 'Заморозка',
    description: 'В начале боя враги не могут двигаться 1.5 секунд',
    color: '#ffa200',
    max: 1,
    icon: '❄️',
    effects: { freeze: true }
  },
  {
    id: 'randomBonus',
    label: 'Что попало',
    description: 'Получить 3 случайных обычных бонуса',
    color: '#e5ff00',
    max: 1,
    icon: '🎲'
  },
  {
    id: 'farSight',
    label: 'Далеко гляжу',
    description: 'Видно содержимое смежных комнат по диагонали',
    color: '#00e5ff',
    max: 1,
    icon: '👁️',
    effects: { farSight: true }
  },
  {
    id: 'longRange',
    label: 'Дальнобойщик',
    description: 'За каждую открытую комнату в бою +20% к дальности полета пули',
    color: '#0066ff',
    max: 1,
    icon: '🏹',
    effects: { longRange: true }
  },
  {
    id: 'sniper',
    label: 'Снайпер',
    description: 'Максимальная точность при 2 комнатах в бою, +10% разброса за каждую дополнительную комнату',
    color: '#00ff00',
    max: 1,
    icon: '🎯',
    effects: { sniper: true }
  },
];

// ============================================================
// SPATIAL UPGRADE TYPES (пространственные бонусы)
// Бинарные бонусы (либо есть, либо нет). 
// Взаимоисключающие по оси source (комнаты vs сердца).
// ============================================================
const SPATIAL_UPGRADE_TYPES = [
  // RELOAD SPEED AXIS (+10%)
  {
    id: 'spatialReloadRooms',
    type: 'additive',
    axis: 'reload',
    source: 'rooms',
    blocks: 'spatialReloadHearts',
    label: 'Пространственный ритм',
    description: 'Скорость перезарядки +10% за каждую открытую комнату.',
    color: '#00d4ff',
    max: 1,
    icon: '🔄',
    effects: { reloadPerRoom: 0.10 }
  },
  {
    id: 'spatialReloadHearts',
    type: 'additive',
    axis: 'reload',
    source: 'hearts',
    blocks: 'spatialReloadRooms',
    label: 'Сердечный ритм',
    description: 'Скорость перезарядки +10% за каждое сердце.',
    color: '#ff4444',
    max: 1,
    icon: '❤️',
    effects: { reloadPerHeart: 0.10 }
  },
  
  // RANGE AXIS (+20%)
  {
    id: 'spatialRangeRooms',
    type: 'additive',
    axis: 'range',
    source: 'rooms',
    blocks: 'spatialRangeHearts',
    label: 'Дальние горизонты',
    description: 'Дальность стрельбы +20% за каждую открытую комнату.',
    color: '#ffff44',
    max: 1,
    icon: '🔭',
    effects: { rangePerRoom: 0.20 }
  },
  {
    id: 'spatialRangeHearts',
    type: 'additive',
    axis: 'range',
    source: 'hearts',
    blocks: 'spatialRangeRooms',
    label: 'Жизненная дистанция',
    description: 'Дальность стрельбы +20% за каждое сердце.',
    color: '#ff8800',
    max: 1,
    icon: '🏹',
    effects: { rangePerHeart: 0.20 }
  },
  
  // ACCURACY AXIS (+20%)
  {
    id: 'spatialAccuracyRooms',
    type: 'additive',
    axis: 'accuracy',
    source: 'rooms',
    blocks: 'spatialAccuracyHearts',
    label: 'Геометрическая точность',
    description: 'Точность +20% за каждую открытую комнату.',
    color: '#44ff44',
    max: 1,
    icon: '📐',
    effects: { accuracyPerRoom: 0.20 }
  },
  {
    id: 'spatialAccuracyHearts',
    type: 'additive',
    axis: 'accuracy',
    source: 'hearts',
    blocks: 'spatialAccuracyRooms',
    label: 'Интуитивная точность',
    description: 'Точность +20% за каждое сердце.',
    color: '#ff00ff',
    max: 1,
    icon: '👁️',
    effects: { accuracyPerHeart: 0.20 }
  },

  // BULLET SPEED AXIS (+20%)
  {
    id: 'spatialBulletSpeedRooms',
    type: 'additive',
    axis: 'bulletSpeed',
    source: 'rooms',
    blocks: 'spatialBulletSpeedHearts',
    label: 'Пространственное ускорение',
    description: 'Скорость пули +20% за каждую открытую комнату.',
    color: '#00ffff',
    max: 1,
    icon: '⚡',
    effects: { bulletSpeedPerRoom: 0.20 }
  },
  {
    id: 'spatialBulletSpeedHearts',
    type: 'additive',
    axis: 'bulletSpeed',
    source: 'hearts',
    blocks: 'spatialBulletSpeedRooms',
    label: 'Сердечное ускорение',
    description: 'Скорость пули +20% за каждое сердце.',
    color: '#ff6666',
    max: 1,
    icon: '🚀',
    effects: { bulletSpeedPerHeart: 0.20 }
  },

  // SPEED AXIS (+10%)
  {
    id: 'spatialSpeedRooms',
    type: 'additive',
    axis: 'speed',
    source: 'rooms',
    blocks: 'spatialSpeedHearts',
    label: 'Пространственный маневр',
    description: 'Скорость бега +10% за каждую открытую комнату.',
    color: '#66ff66',
    max: 1,
    icon: '🏃',
    effects: { speedPerRoom: 0.10 }
  },
  {
    id: 'spatialSpeedHearts',
    type: 'additive',
    axis: 'speed',
    source: 'hearts',
    blocks: 'spatialSpeedRooms',
    label: 'Сердечный маневр',
    description: 'Скорость бега +10% за каждое сердце.',
    color: '#ff66ff',
    max: 1,
    icon: '💨',
    effects: { speedPerHeart: 0.10 }
  },

  // CRIT CHANCE AXIS (+5%)
  {
    id: 'spatialCritChanceRooms',
    type: 'additive',
    axis: 'critChance',
    source: 'rooms',
    blocks: 'spatialCritChanceHearts',
    label: 'Пространственный фокус',
    description: 'Шанс крита +5% за каждую открытую комнату.',
    color: '#ffcc00',
    max: 1,
    icon: '🎯',
    effects: { critChancePerRoom: 0.05 }
  },
  {
    id: 'spatialCritChanceHearts',
    type: 'additive',
    axis: 'critChance',
    source: 'hearts',
    blocks: 'spatialCritChanceRooms',
    label: 'Сердечный фокус',
    description: 'Шанс крита +5% за каждое сердце.',
    color: '#ff3300',
    max: 1,
    icon: '💥',
    effects: { critChancePerHeart: 0.05 }
  },

  // CRIT DAMAGE AXIS (+50%)
  {
    id: 'spatialCritDamageRooms',
    type: 'additive',
    axis: 'critDamage',
    source: 'rooms',
    blocks: 'spatialCritDamageHearts',
    label: 'Пространственная мощь',
    description: 'Крит урон +50% за каждую открытую комнату.',
    color: '#ccff00',
    max: 1,
    icon: '🔱',
    effects: { critDamagePerRoom: 0.50 }
  },
  {
    id: 'spatialCritDamageHearts',
    type: 'additive',
    axis: 'critDamage',
    source: 'hearts',
    blocks: 'spatialCritDamageRooms',
    label: 'Сердечная мощь',
    description: 'Крит урон +50% за каждое сердце.',
    color: '#990000',
    max: 1,
    icon: '🩸',
    effects: { critDamagePerHeart: 0.50 }
  },

  // PENETRATION AXIS (+1)
  {
    id: 'spatialPenetrateRooms',
    type: 'additive',
    axis: 'penetrate',
    source: 'rooms',
    blocks: 'spatialPenetrateHearts',
    label: 'Пространственный прокол',
    description: 'Пуля пробивает 1 врага за каждую открытую комнату.',
    color: '#cc00ff',
    max: 1,
    icon: '🗡️',
    effects: { penetratePerRoom: 1 }
  },
  {
    id: 'spatialPenetrateHearts',
    type: 'additive',
    axis: 'penetrate',
    source: 'hearts',
    blocks: 'spatialPenetrateRooms',
    label: 'Сердечный прокол',
    description: 'Пуля пробивает 1 врага за каждое сердце.',
    color: '#ff0066',
    max: 1,
    icon: '💉',
    effects: { penetratePerHeart: 1 }
  }
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

// ============================================================
// BAT ENEMY SPRITE SHEET
// Sprite sheet: 512x64, each sprite 64x64 (8 frames horizontal)
// Frames 0-6: movement loop; frame 7: damage
// ============================================================
const BAT_SW = 64, BAT_SH = 64; // размер одного спрайта (пикс)
const BAT_ANIM = {
  frames: 7, // movement frames
  fps: CONFIG?.BAT_ANIM_FPS ?? 8,
  hitFrame: 7,
};

// ============================================================
// PLEVAKA ENEMY SPRITE SHEET
// Sprite sheet: 1500x1500, each sprite 500x500 (3 rows x 3 cols)
// Row 0: run (3 frames) - when moving
// Row 1: idle (3 frames) - when stationary
// Row 2: shoot (3 frames) - when shooting
// ============================================================
const PLEVAKA_SW = 500, PLEVAKA_SH = 500; // размер одного спрайта (пикс)
const PLEVAKA_ANIMS = {
  run: { row: 0, frames: 3, fps: 3 },
  idle: { row: 1, frames: 2, fps: 2 },
  shoot: { row: 2, frames: 3, fps: 3 },
};
