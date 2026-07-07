// ============================================================
// GAME CONFIGURATION
// All constants and magic numbers live here.
// ============================================================

const CONFIG = {
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
  BULLET_RADIUS: 3,       // радиус пули
  BULLET_LIFE: 1.5,                 // время жизни пули (сек)

  // Particles
  PARTICLES: {
    muzzle:  { count: 8, spread: 0.5, speedMin: 150, speedMax: 350, life: 0.15 },
    hit:     { count: 8, speedMin: 40, speedMax: 80, spread: 0.6, life: 0.25, color: '#e44101', critCount: 14 },
    death:   { count: 14, speedMin: 40, speedMax: 80, life: 0.3 },
    wallHit: { count: 3, speed: 80, life: 0.1 },
    pickup:  { count: 12, speed: 80, life: 0.6 },
  },

  // Combat effects
  ENEMY_HIT_FLASH_DURATION: 0.18,     // длительность белой вспышки при уроне (сек)
  ENEMY_HIT_PUNCH: 0.15,              // макс. увеличение scale при попадании (15%)
  ENEMY_STUN_DURATION: 0.05,           // длительность стана при получении урона (сек)

  // Bullet render
  BULLET_RENDER: {
    radius:     2.5,    // радиус ядра пули (px)
    playerColor: 0xffff00,
    critColor:       0x00a2ff,
    incendiaryColor: 0xff6600,
    freezeColor:     0x44ddff,
    enemyColor:      0xff0000,
  },

  // Bullet trail
  BULLET_TRAIL: {
    interval: 0.01,   // секунд между эмитом частиц трейла
    life:     0.06,   // время жизни частицы трейла (сек)
    playerColor:    '#ffdd44',
    critColor:      '#00a2ff',
    incendiaryColor:'#ff6600',
    freezeColor:    '#44ddff',
    enemyColor:     '#ff0000',
  },

  // Damage numbers
  DAMAGE_NUMBERS: {
    maxActive:    64,     // макс. одновременно активных цифр
    fontSize:     13,     // базовый размер шрифта
    life:         0.7,    // время жизни (сек)
    riseSpeed:    30,     // скорость вертикального подъёма (px/сек)
    damp:         0.95,   // затухание скорости (множитель за кадр)
    driftSpeed:   80,     // макс. горизонтальный импульс при спавне (px/сек)
    popDuration:  0.12,   // длительность pop-in анимации (сек)
    popOvershoot: 4.8,    // сила overshoot для easeOutBack
    fadeStart:    0.4,    // доля жизни, с которой начинается fade (0..1)
  },

  // Enemy HP bar (non-boss)
  ENEMY_HP_BAR: {
    width: 30,           // макс. ширина полоски (px)
    height: 2,           // толщина полоски (px)
    offset: 3,           // отступ от верха спрайта врага (px)
    animDuration: 1.0,   // длительность анимации отжора белой части (сек)
    bgColor: 0x333333,   // цвет фона
    hpColor: 0xff0000,   // цвет текущего ХП
    ghostColor: 0xffffff,// цвет анимации отжора
  },

  // Camera
  CAMERA: {
    shakeDecay: 0.9,       // затухание тряски (множитель за кадр)
    cursorWeight: 0.3,  // 0 = только игрок, 1 = только курсор
    damping: 2.0,         // λ экспоненциального сглаживания (выше = быстрее)
    maxOffset: 160,      // макс. сдвиг камеры от игрока в сторону курсора (px)
    playZoom: 1.5,              // зум камеры в play режиме
    battleZoomMult: 1,      // множитель к вычисленному зуму в battle режиме
    shakeMin: 0.01,          // минимальный порог тряски (пистолет 0 не трясёт)
    shakeScale: 5,          // множитель shakeAmount → пиксели (0.5 * 12 = 6px)
  },

  // Shoot VFX (muzzle flash sprite animation)
  SHOOT_VFX: {
    frameSize: 64,           // размер кадра в спрайтшите (px)
    frameCount: 9,           // кол-во кадров анимации (верхний ряд)
    fps: 35,                 // скорость анимации
    sizeMult: 1.5,           // множитель к drawSize игрока (PLAYER_SPRITE_RADIUS * 2)
    offsetMult: 0.9,         // множитель к drawSize для смещения от центра игрока
    rotationOffset: Math.PI / 4,  // поправка угла спрайта (рад)
  },

  // Wall hit VFX (bullet hits wall)
  WALL_HIT_VFX: {
    frameSize: 64,           // размер кадра в спрайтшите (px)
    frameCount: 10,          // кол-во кадров анимации (верхний ряд)
    fps: 60,                 // скорость анимации
    sizeMult: 0.20,          // множитель к CELL_PX для размера спрайта
    normalOffset: 0.2,       // смещение спрайта вдоль нормали от стены (доля от drawSize)
  },

  // Enemy hit VFX (bullet hits enemy)
  ENEMY_HIT_VFX: {
    frameSize: 64,           // размер кадра в спрайтшите (px)
    frameCount: 8,           // кол-во кадров анимации (верхний ряд)
    fps: 45,                 // скорость анимации
    sizeMult: 0.4,          // множитель к CELL_PX для размера спрайта
  },

  // Burn status VFX (fire animation overlay on burning enemies)
  BURN_VFX: {
    frameSize: 64,           // размер кадра в спрайтшите (px)
    frameCount: 16,          // кол-во кадров анимации (верхний ряд)
    fps: 48,                 // скорость анимации (кадров/сек)
  },

  // Freeze status VFX (ice animation overlay on frozen enemies)
  FREEZE_VFX: {
    frameSize: 64,           // размер кадра в спрайтшите (px)
    frameCount: 12,          // кол-во кадров анимации (3-й ряд)
    row: 2,                  // ряд спрайтшита (0-indexed)
    fps: 48,                 // скорость анимации (кадров/сек)
  },

  // Accuracy indicator (spread visualization near cursor)
  ACCURACY_INDICATOR: {
    lineLength: 12,          // длина полоски (px, screen-space)
    lineWidth: 2,            // толщина полоски (px)
    alpha: 0.7,              // прозрачность
    minSpread: 0.001,        // минимальный разброс (рад) для показа индикатора
    bendLength: 3,           // длина загиба L-формы (px, screen-space)
  },

  // Enemy stats
  ENEMY_STATS: {
    soldier:  { hp: 120, speed: 1, radius: 7, visualScale: 2.9, wobbleMin: 0.2, wobbleMax: 0.3, spawnMargin: 10 },
    bat:      { hp: 120, speed: 1, radius: 7, visualScale: 3.9, animFps: 15, zigzagFreq: 4, zigzagAmp: 0.8 },
    shooter:  { hp: 80, speed: 1, radius: 6, visualScale: 2.5, bulletSpeed: 100, shootRangeCells: 2, shootCd: 1.5, stopDistCells: 2 },
    bull:     { hp: 160, speed: 1, radius: 6, visualScale: 3.2, prepareTime: 1, restTime: 1.5, chargeDistCells: 0.75, dashDistCells: 0.02 },
    buldyga:  { hp: 200, speed: 1, radius: 6, visualScale: 4.0, accel: 40, friction: 3.5, speedIncrement: 0.1 },
    cocoon:   { hp: 400, radius: 10, visualScale: 3.2, spawnInterval: 3.0 },
    bloated:  { hp: 120, speed: 1, radius: 7, visualScale: 3.2, deathShotSpeed: 120 },
    tank:     { hp: 400, speed: 0.7, radius: 14, visualScale: 2 },
    wallshooter: { hp: 40, speed: 1, radius: 8, visualScale: 2.5, bulletSpeed: 50, shootRangeCells: 1.5, shootCd: 3.0, stopDistCells: 1.4, wallBulletCount: 5, wallBulletSpacing: 8 },
    ghost:     { hp: 40, speed: 1.2, radius: 6, visualScale: 3.0 },
  },

  // HP multiplier by level
  ENEMY_HP_MULT: { 1: 1, 2: 2, 3: 4 },

  // Enemy costs for budget-based spawning
  ENEMY_COSTS: {
    bat: 30,          // hp 60, летающий, зигзаг
    soldier: 30,      // hp 60, преследует игрока
    shooter: 25,      // hp 40, стреляет (+5 за дальнобойность)
    bull: 40,         // hp 80, рывки
    buldyga: 50,      // hp 100, инерция, ускорение
    cocoon: 110,      // hp 200, спавнит солдат (+10 за спавн)
    bloated: 40,      // hp 60, взрывается при смерти
    tank: 80,        // hp 200, танк: большой, медленный, много HP
    wallshooter: 40,  // hp 20, 4 пули стеной (+5 за стену пуль)
    ghost: 20,        // hp 150, проходит сквозь стены, прямая навигация
    boss_1: 250,      // босс уровня 1
    boss_2: 400,      // босс уровня 2
    boss_3: 600,      // босс уровня 3
  },

  // ── Бюджетная генерация врагов в комнатах ──────────────────
  // budget(cells) = base * growthRate^(cells-1), затем * levelMult * contentMult
  // growthRate > 1 → выпуклая (нелинейная) кривая: большие комнаты опаснее.
  ROOM_ENEMY_BUDGET: {
    base: 100,                 // бюджет 1-клеточной комнаты (до множителей)
    growthRate: 1.4,           // >1 = выпуклая (нелинейная) кривая; 1.0 = линейно
    levelMult: { 1: 1.0, 2: 1.2, 3: 1.5 },
    maxEnemiesPerCell: 8,      // потолок врагов на ячейку (анти-переполнение)
    maxEnemiesTotal:   32,     // абсолютный потолок врагов в комнате
  },

  // Множитель бюджета по содержимому комнаты. weapon/empty/start — без врагов (множитель 0).
  ROOM_CONTENT_BUDGET_MULT: {
    enemies:      1.0,
    heart:        1.5,
    summonSphere: 1.4,   // ключевая комната (мини-босс)
    chest:        1.15,
    spatial:      1.15,
    roomBonus:    1.15,
  },

  // Доступные типы врагов по уровням + веса выбора (больше = чаще встречается).
  // Ключи должны совпадать с ENEMY_COSTS.
  ENEMY_SPAWN_TABLE: {
    1: { bat: 5, shooter: 2, bloated: 1, tank: 1, wallshooter: 1, ghost: 2 },
    2: { soldier: 5, shooter: 2, bull: 2, buldyga: 1, bloated: 1, tank: 1, wallshooter: 2, ghost: 2 },
    3: { soldier: 4, shooter: 2, bull: 2, buldyga: 1, bloated: 1, cocoon: 1, tank: 1, wallshooter: 2, ghost: 2 },
  },

  // Level generation
  MAX_GENERATION_ATTEMPTS: 1000,  // макс. попыток генерации уровня

  // Pickup distances
  PICKUP_DISTANCE: 10,            // расстояние до предметов (добавляется к радиусу)
  WEAPON_PICKUP_DISTANCE: 24,     // расстояние до оружия

  // Upgrade popup
  UPGRADE_POPUP_DURATION: 2.0,    // секунд

  // Battle mode
  BATTLE_SCALE: 1,                // unified coords — no separate battle space

  // Particle pool
  PARTICLE_POOL_MAX_SIZE: 200,    // максимум частиц в пуле

  // Sound
  SOUND: {
    defaultVolume: 0.3,    // громкость по умолчанию (0..1)
    ambienceVolumeMult: 0.6,      // громкость амбиента относительно основной
    shotVolumeMult: 0.4,          // громкость выстрелов относительно основной
    footstepInterval: 0.25,        // секунд между шагами
  },

  // Music
  MUSIC: {
    1: { file: 'Three Red Hearts Candy.ogg', volume: 0.0 },
    2: { file: 'Clement Panchout - Sweet 70s.wav', volume: 0.0 },
    3: { file: 'Three Red Hearts - Box Jump.ogg', volume: 0.0 },
    BOSS: { file: 'GEN Death metal.wav', volume: 0.0 },
  },
  FADE_DURATION_LEVEL_TO_BOSS: 0.5,  // seconds
  FADE_DURATION_BOSS_TO_LEVEL: 0.5,  // seconds

  // Debug
  DEBUG: {
    invulnerable: false,      // неуязвимость игрока от врагов
    collisions: false,        // отображать коллайдеры
    showFps: true,            // отображать счетчик FPS
    showWeapon: false,         // отображать оружие поверх персонажа
  },

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

// ============================================================
// WEAPON DEFINITIONS
// ============================================================
const WEAPON_DEFS = {
  pistol: {//dps 50
    id: 'pistol',
    label: 'ПИСТОЛЕТ',
    description: 'Обычный пистолет',
    color: '#00d4ff',       // цвет пули/иконки
    pellets: 1,             // кол-во пуль за выстрел
    spread: 0.05,            // разброс (рад)
    damage: 20,             // урон одной пули
    cooldown: 0.4,         // задержка между выстрелами (сек)
    bulletSpeed: 400,       // скорость пули (пикс/сек)
    range: 13,              // дальность в клетках
    penetrate: 0,           // кол-во врагов, которых пробивает пуля
    shakeAmount: 0,       // сила тряски камеры
    spriteAngle: 0.1,       // поправка угла спрайта (рад)
    magazineSize: 12,       // размер обоймы
    reloadTime: 2,          // время перезарядки (сек)
    bloomPerShot: 0.04,
    bloomRecoveryTime: 0.3,
    maxSpread: 0.8,
  },
  shotgun: {//dps 80
    id: 'shotgun',
    label: 'ДРОБОВИК',
    description: 'Стреляет дробью.',
    color: '#ffaa00',
    pellets: 3,
    spread: 0.20,
    damage: 20,
    cooldown: 0.5,
    bulletSpeed: 440,
    range: 10,
    penetrate: 0,
    shakeAmount: 0.5,
    spriteAngle: 0.55,
    magazineSize: 6,
    reloadTime: 3,
    bloomPerShot: 0.35,
    bloomRecoveryTime: 0.5,
    maxSpread: 1,
  },
  smg: {//dps 50
    id: 'smg',
    label: 'ПП',
    description: 'Высокая скорострельность.',
    color: '#ff44ff',
    pellets: 1,
    spread: 0.05,
    damage: 8,
    cooldown: 0.12,
    bulletSpeed: 500,
    range: 18,
    penetrate: 0,
    shakeAmount: 0,
    spriteAngle: 0.8,
    magazineSize: 30,
    reloadTime: 3,
    bloomPerShot: 0.06,
    bloomRecoveryTime: 0.4,
    maxSpread: 1,
  },
  rifle: {//dps 42
    id: 'rifle',
    label: 'ВИНТОВКА',
    description: 'Высокая точность и урон. Пробивает 2 врагов.',
    color: '#44ff44',
    pellets: 1,
    spread: 0.05,
    damage: 60,
    cooldown: 1.0,
    bulletSpeed: 700,
    range: 40,
    penetrate: 2,
    shakeAmount: 0.8,
    spriteAngle: 0.7,
    magazineSize: 5,
    reloadTime: 4,
    bloomPerShot: 0.25,
    bloomRecoveryTime: 0.4,
    maxSpread: 1,
  },
  revolver: {//dps 66
    id: 'revolver',
    label: 'РЕВОЛЬВЕР',
    description: 'Высокая точность. Пробивает 1 врага.',
    color: '#8b4513',
    pellets: 1,
    spread: 0.03,
    damage: 40,
    cooldown: 0.6,
    bulletSpeed: 500,
    range: 20,
    penetrate: 1,
    shakeAmount: 0.2,
    spriteAngle: 0,
    magazineSize: 6,
    reloadTime: 3,
    bloomPerShot: 0.15,
    bloomRecoveryTime: 0.4,
    maxSpread: 1,
  },
  carbine: {//dps 60
    id: 'carbine',
    label: 'КАРАБИН',
    description: 'Очередь из 3 пуль.',
    color: '#556b2f',
    pellets: 1,
    spread: 0.05,
    damage: 20,
    cooldown: 0.8,
    burstSize: 3,           // кол-во пуль в очереди (мультивыстрел: +1 за апгрейд pellets)
    burstDuration: 0.2,     // полное время очереди (сек); задержка между пулями = burstDuration / (размер очереди - 1)
    bulletSpeed: 450,
    range: 25,
    penetrate: 0,
    shakeAmount: 0.3,
    spriteAngle: 0.7,
    magazineSize: 15,
    reloadTime: 4,
    bloomPerShot: 0.08,
    bloomRecoveryTime: 0.3,
    maxSpread: 1,
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
    hpMult: 30,             // множитель к SOLDIER_HP
    radiusMult: 2.25,       // множитель к SOLDIER_RADIUS
    speedMult: 1.1,         // множитель к SOLDIER_SPEED
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
      { id: 'buldyga', duration: 6, accelMult: 40, frictionMult: 3.5 },
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
  // { id: 'pellets',       label: '+1 пуля к выстрелу',     description: 'Каждый выстрел выпускает на 1 пулю больше',                   color: '#ffaa00', max: 2, icon: '🔫', effects: { pellets: 1 } },
  { id: 'extraBulletChance', label: '+5% доп пуля',  description: '5% шанс выпустить дополнительную пулю при выстреле',          color: '#ffaa44', max: 3, icon: '✨', effects: { extraBulletChance: 0.05 } },
  { id: 'damage',        label: '+20% урона от пули',        description: 'Каждая пуля наносит на 20% урона больше',                        color: '#ff4444', max: 5, icon: '💥', effects: { damageMult: 0.20 } },
  { id: 'penetrate',     label: '+1 пробитие врага',       description: 'Пуля пролетает сквозь одного дополнительного врага',          color: '#ff44ff', max: 2, icon: '🎯', effects: { penetrate: 1 } },
  { id: 'bulletSpeed',   label: '+30% скорость пули',      description: 'Пули летят быстрее на +30%',                     color: '#ffff44', max: 2, icon: '⚡', effects: { bulletSpeedMult: 0.30 } },
  { id: 'critChance',    label: '+5% шанс крита',          description: '+5% шанс нанести двойной урон',                       color: '#ff0000', max: 3, icon: '⚔️', effects: { critChance: 0.05 } },
  { id: 'killAccel',     label: 'Убийственный разгон',     description: 'Каждое убийство ускоряет перезарядку на 0.1%',                  color: '#ff8800', max: 1, icon: '🏃', effects: { killAccel: true } },
  { id: 'enhancedPierce',label: 'Усиленное пробитие',      description: 'Пуля, пробившая врага, имеет шанс 50% нанести удвоенный урон',               color: '#aa44ff', max: 1, icon: '🗡️', effects: { enhancedPierce: true } },
  { id: 'shield',        label: 'Щит',                     description: 'Поглощает один удар без потери жизни. Тратится.',                        color: '#00aaff', max: 2, icon: '🛡️', effects: { shield: 1 } },
  { id: 'retreat',       label: 'Отступление',             description: 'После получения урона получи неуязвимость на 1.5 секунды',                  color: '#00ffaa', max: 2, icon: '🏃‍♂️', effects: { retreat: 1 } },
  //{ id: 'reflection',    label: 'Отражение',               description: 'При получении урона выпускает 3 пули в ближайших врагов',        color: '#ff00ff', max: 1, icon: '🔄', effects: { reflection: true } },
  { id: 'cooldown',      label: 'Перезарядка -10%',        description: 'Уменьшает время между выстрелами на 10%',                    color: '#00ccff', max: 5, icon: '⏱️', effects: { cooldownMult: -0.10 } },
  { id: 'speed',         label: 'Скорость бега +10%',      description: 'Увеличивает скорость передвижения на 10%',                    color: '#44ff88', max: 3, icon: '💨', effects: { speedMult: 0.10 } },
  { id: 'hitStun',       label: 'Стан при попадании',      description: 'Враги застывают на 0.05с при попадании.',                     color: '#88ddff', max: 5, icon: '⏳', effects: { hitStun: 0.05 } },
  { id: 'incendiary',    label: '+5% поджигающая пуля',     description: '5% шанс что пуля подожжёт врага. Горение наносит урон каждые 0.2с в течение 2с.', color: '#ff6600', max: 3, icon: '🔥', effects: { incendiaryChance: 0.05 } },
  { id: 'freezeBullet',  label: '+5% охлаждающая пуля',     description: '5% шанс заморозить врага. Замедление в 2 раза на 2с.', color: '#44ddff', max: 3, icon: '❄️', effects: { freezeChance: 0.05 } },
];

const ROOM_BONUS_TYPES = [
  { id: 'penetrate',     label: 'Пробитие',       description: 'Пули пробивают врагов насквозь',          color: '#ff44ff', max: 100, icon: '🎯' },
  { id: 'wind_east',  label: 'Поток на восток',  description: 'Движение на восток +50%, на запад −50%', color: '#44ddff', max: 100, icon: '→', windDir: { x:  1, y:  0 }, windStrength: 0.5 },
  { id: 'wind_west',  label: 'Поток на запад',  description: 'Движение на запад +50%, на восток −50%', color: '#44ddff', max: 100, icon: '←', windDir: { x: -1, y:  0 }, windStrength: 0.5 },
  { id: 'wind_north', label: 'Поток на север', description: 'Движение на север +50%, на юг −50%',   color: '#44ddff', max: 100, icon: '↑', windDir: { x:  0, y: -1 }, windStrength: 0.5 },
  { id: 'wind_south', label: 'Поток на юг',   description: 'Движение на юг +50%, на север −50%',   color: '#44ddff', max: 100, icon: '↓', windDir: { x:  0, y:  1 }, windStrength: 0.5 },
  { id: 'speeddown',    label: 'Замедление',          description: 'Персонаж, враги и пули замедляются на 50%',                       color: '#ff0000', max: 100, icon: '⚔️', speedMult: 0.5 },
  { id: 'ricochet',    label: 'Рикошет',          description: 'Пули рикошетят от стен внутри комнаты',                       color: '#ff8922', max: 100, icon: '↩️' },
  { id: 'longRange',   label: 'Дальнобой',         description: 'Дальность пуль +1000%',                                        color: '#0066ff', max: 100, icon: '🏹' },
  { id: 'freeAmmo',    label: 'Бесконечный боезапас', description: 'Выстрелы не тратят пули из магазина',                        color: '#ffdd00', max: 100, icon: '♾️' },
  { id: 'burnChance',   label: 'Поджигающая комната',  description: 'Пули выстреленные в комнате имеют +10% шанс поджечь врага при попадании.', color: '#ff6600', max: 100, icon: '🔥' },
  { id: 'freezeChance', label: 'Охлаждающая комната',  description: 'Пули выстреленные в комнате имеют +10% шанс охладить врага при попадании.', color: '#44ddff', max: 100, icon: '❄️' },
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
    description: 'В начале боя враги не могут двигаться 1 секунду',
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
  // {
  //   id: 'farSight',
  //   label: 'Далеко гляжу',
  //   description: 'Видно содержимое смежных комнат по диагонали',
  //   color: '#00e5ff',
  //   max: 1,
  //   icon: '👁️',
  //   effects: { farSight: true }
  // },
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
// SPRITE SHEETS
// ============================================================
const SPRITE_SHEETS = {
  hero: {
    sw: 64, sh: 64,
    anims: {
      idle_forward: { col: 0, frames: 1, fps: 1 },
      idle_left:    { col: 2, frames: 1, fps: 1 },
      idle_back:    { col: 1, frames: 1, fps: 1 },
      run_forward:  { col: 0, frames: 1, fps: 1 },
      run_left:     { col: 2, frames: 1, fps: 1 },
      run_back:     { col: 1, frames: 1, fps: 1 },
    },
  },
  heroHands: {
    sw: 64, sh: 64,
    rows: 3, cols: 5,
  },
  cocoon: {
    sw: 500, sh: 500,
    anim: { frames: 7, fps: 8 },
  },
  bat: {
    sw: 64, sh: 64,
    anim: { frames: 7, fps: 15, hitFrame: 7 },
  },
  shooter: {
    sw: 500, sh: 500,
    anims: {
      run: { row: 0, frames: 3, fps: 3 },
      idle: { row: 1, frames: 2, fps: 2 },
      shoot: { row: 2, frames: 3, fps: 3 },
    },
  },
  ghost: {
    sw: 32, sh: 32, cols: 8,
    anims: {
      idle:  { frames: [0,1,2,3,4,5,6,7], fps: 15 },
      move:  { frames: [9,10,11,12,13,14,15,16,17], fps: 15 },
      death: { frames: [21,22,23,24,25,26,27,28], fps: 10 },
      hit:   { frames: [36], fps: 15 },
    },
  },
};
