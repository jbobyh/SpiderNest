    // ============================================================
    // SOUNDS
    // ============================================================
    const Sounds = {
      _cache: {},
      _load(name) {
        if (!this._cache[name]) {
          this._cache[name] = new Audio('sounds/' + name);
        }
        return this._cache[name];
      },
      play(name) {
        const base = this._load(name);
        const snd = base.cloneNode();
        snd.volume = Sounds._volume;
        snd.play().catch(() => {});
        Sounds.ambienceSyncVolume();
      },
      keycollect:     function() { Sounds.play('keycollect.wav'); },
      heartcollect:   function() { Sounds.play('heartcollect.wav'); },
      hearttravel:    function() { Sounds.play('hearttravel.wav'); },
      hit:            function() { Sounds.play('hit' + (Math.floor(Math.random() * 5) + 1) + '.wav'); },
      upgradecollect: function() { Sounds.play('upgradecollect.wav'); },
      weaponcollect:  function() { Sounds.play('weaponcollect.wav'); },
      shot:           function(weaponId) {
        const map = { pistol: 'shotpistol.wav', shotgun: 'shotshotgun.wav', smg: 'shotsmg.wav', carbine: 'shotcarbine.wav', rifle: 'shotrifle.wav', revolver: 'shotrevolver.wav' };
        const base = Sounds._load(map[weaponId] || 'shot1.wav');
        const snd = base.cloneNode();
        snd.volume = Sounds._volume * CONFIG.SHOT_VOLUME_MULT;
        snd.play().catch(() => {});
      },
      wallhit:        function() { Sounds.play('wallhit' + (Math.floor(Math.random() * 3) + 1) + '.wav'); },
      zoom:           function() { Sounds.play('zoom.wav'); },
      _footstepTimer: 0,
      _ambience: null,
      ambienceStart() {
        if (!Sounds._ambience) {
          Sounds._ambience = new Audio('sounds/Ambience.wav');
          Sounds._ambience.loop = true;
        }
        Sounds._ambience.volume = Sounds._volume * CONFIG.AMBIENCE_VOLUME_MULT;
        if (Sounds._ambience.paused) Sounds._ambience.play().catch(() => {});
      },
      ambienceStop() {
        if (Sounds._ambience && !Sounds._ambience.paused) {
          Sounds._ambience.pause();
          Sounds._ambience.currentTime = 0;
        }
      },
      ambienceSyncVolume() {
        if (Sounds._ambience) Sounds._ambience.volume = Sounds._volume * CONFIG.AMBIENCE_VOLUME_MULT;
      },
      footstep: function(dt) {
        Sounds._footstepTimer -= dt;
        if (Sounds._footstepTimer <= 0) {
          Sounds.play('footstep_concrete_00' + Math.floor(Math.random() * 5) + '.ogg');
          Sounds._footstepTimer = CONFIG.FOOTSTEP_INTERVAL;
        }
      },
    };

    function getLevelConfig(level) {
      return LEVEL_CONFIG[level] || LEVEL_CONFIG[3];
    }

    // ============================================================
    // STATE
    // ============================================================
    const C = document.getElementById('canvas');
    const ctx = C.getContext('2d');
    const G = CONFIG.GRID_SIZE;
    const CP = CONFIG.CELL_PX;
    const SHOOTER_SHOOT_RANGE = CONFIG.SHOOTER_SHOOT_RANGE_CELLS * CP;
    const SHOOTER_STOP_DIST   = CONFIG.SHOOTER_STOP_DIST_CELLS   * CP;
    const BULL_DASH_DISTANCE  = CONFIG.BULL_DASH_DISTANCE_CELLS  * CP;
    const BULL_CHARGE_DIST    = CONFIG.BULL_CHARGE_DIST_CELLS    * CP;
    const BULL_ATTACK_DIST    = CONFIG.BULL_ATTACK_DIST_CELLS    * CP;
    const VIEW_W = CONFIG.VIEW_W;
    const VIEW_H = CONFIG.VIEW_H;
    let canvasScale = 1; // CSS px -> canvas px multiplier (changes in fullscreen)
    C.width = VIEW_W;
    C.height = VIEW_H;

    function resizeCanvas(cssW, cssH) {
      const dpr = window.devicePixelRatio || 1;
      const scaleX = cssW / VIEW_W;
      const scaleY = cssH / VIEW_H;
      canvasScale = Math.min(scaleX, scaleY) * dpr;
      C.width = Math.round(VIEW_W * canvasScale);
      C.height = Math.round(VIEW_H * canvasScale);
      C.style.width = Math.round(VIEW_W * Math.min(scaleX, scaleY)) + 'px';
      C.style.height = Math.round(VIEW_H * Math.min(scaleX, scaleY)) + 'px';
    }

    function beginFrame() {
      ctx.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    }
    const W = G * CP;           // полный размер мира
    const H = G * CP;

    const floorImg = new Image();
    floorImg.src = 'img/floor.png';

    const wallImg = new Image();
    wallImg.src = 'img/wall.png';

    const cornerImg = new Image();
    cornerImg.src = 'img/corner.png';

    const closedCellImg = new Image();
    closedCellImg.src = 'img/closedcell.png';

    // Blue floor variants with different exit configurations
    const floorRightExitImg = new Image();
    floorRightExitImg.src = 'img/floor-rightexit-blue.png';

    const floorRightBottomExitImg = new Image();
    floorRightBottomExitImg.src = 'img/floor-rightbottomexit-blue.png';

    const floorLeftRightBottomExitImg = new Image();
    floorLeftRightBottomExitImg.src = 'img/floor-leftrightbottomexit-blue.png';

    const floorTopDownExitImg = new Image();
    floorTopDownExitImg.src = 'img/floor-topdownexit-blue.png';

    const floor4ExitImg = new Image();
    floor4ExitImg.src = 'img/floor-4exit-blue.png';

    const heroImg = new Image();
    heroImg.src = 'img/hero.png';

    // ============================================================
    // PLAYER ANIMATION
    // ============================================================
    // HERO_SW, HERO_SH, HERO_ANIMS defined in config.js

    const playerAnim = {
      key: 'idle_forward',
      frame: 0,
      timer: 0,
      flip: false, // mirror horizontally for right-facing
    };

    function getPlayerAnimKey(mvx, mvy, mouseDx, mouseDy) {
      const moving = (mvx !== 0 || mvy !== 0);
      const angle = Math.atan2(mouseDy, mouseDx); // angle from player to mouse
      // Determine direction quadrant:
      // down  (facing camera): angle in [-45°, 135°) roughly => sin > 0 or |angle| < PI/4
      // We split into 4 sectors using angle:
      //   right: -PI/4 .. PI/4
      //   down:   PI/4 .. 3PI/4
      //   left:  3PI/4 .. PI  or -PI .. -3PI/4
      //   up:   -3PI/4 .. -PI/4
      let dir;
      const a = angle;
      if (a > -Math.PI / 4 && a <= Math.PI / 4) {
        dir = 'right';
      } else if (a > Math.PI / 4 && a <= 3 * Math.PI / 4) {
        dir = 'down';
      } else if (a > -3 * Math.PI / 4 && a <= -Math.PI / 4) {
        dir = 'up';
      } else {
        dir = 'left';
      }

      let key, flip = false;
      if (moving) {
        if (dir === 'right') { key = 'run_left';    flip = true; }
        else if (dir === 'left')  { key = 'run_left';    flip = false; }
        else if (dir === 'up')    { key = 'run_back';    flip = false; }
        else                      { key = 'run_forward'; flip = false; }
      } else {
        if (dir === 'right') { key = 'idle_left';    flip = true; }
        else if (dir === 'left')  { key = 'idle_left';    flip = false; }
        else if (dir === 'up')    { key = 'idle_back';    flip = false; }
        else                      { key = 'idle_forward'; flip = false; }
      }
      return { key, flip };
    }

    function updatePlayerAnim(mvx, mvy, mouseDx, mouseDy, dt) {
      const { key, flip } = getPlayerAnimKey(mvx, mvy, mouseDx, mouseDy);
      if (key !== playerAnim.key) {
        playerAnim.key = key;
        playerAnim.frame = 0;
        playerAnim.timer = 0;
      }
      playerAnim.flip = flip;
      const anim = HERO_ANIMS[key];
      playerAnim.timer += dt;
      const frameDur = 1 / anim.fps;
      while (playerAnim.timer >= frameDur) {
        playerAnim.timer -= frameDur;
        playerAnim.frame = (playerAnim.frame + 1) % anim.frames;
      }
    }

    function drawPlayerSprite(cx2, cy2, scale, alpha) {
      if (!heroImg.complete || heroImg.naturalWidth === 0) return;
      const anim = HERO_ANIMS[playerAnim.key];
      const sx = playerAnim.frame * HERO_SW;
      const sy = anim.row * HERO_SH;
      const drawSize = HERO_SW * scale;
      ctx.save();
      ctx.globalAlpha = alpha !== undefined ? alpha : 1;
      ctx.translate(cx2, cy2);
      if (playerAnim.flip) ctx.scale(-1, 1);
      ctx.drawImage(
        heroImg,
        sx, sy, HERO_SW, HERO_SH,
        -drawSize / 2, -drawSize / 2, drawSize, drawSize
      );
      ctx.restore();
    }

    let state = null;
    let currentLevel = 1;
    let screenShake = { amount: 0, angle: 0 };
    let playerProgress = {
      totalLives: 3,
      totalHeartsCollected: 0,
      upgrades: {
        pellets: 0,
        damage: 0,
        penetrate: 0,
        cooldownMult: 1.0,
        speedMult: 1.0,
        spreadMult: 1.0,
        bulletSpeedMult: 1.0,
        critChance: 0,
        killAccel: false,
        killAccelPercent: 0,
        enhancedPierce: false,
        shield: 0,
        retreat: 0,
        reflection: false,
        infinitePenetrate: false,
        infiniteRange: false,
        ricochet: false,
      },
      spawnedUpgrades: {}, // сколько раз каждый апгрейд заспавнился за всю игру
      spawnedWeapons: [], // какие оружия уже заспавнились за всю игру
      weaponSlots: ['pistol', null],
      activeSlot: 0,
      maxSlots: 1,
    };
    let animId = null;
    let lastTime = 0;
    let camera = { x: 0, y: 0 };  // позиция камеры в мире
    let mouseScreen = { x: 0, y: 0 }; // экранные координаты курсора (пикселей канваса)
    let paused = false;
    let pauseSliderDragging = false;
    let cursedChoiceState = null; // { offers: [{id,label,description,color}], chest }
    Sounds._volume = CONFIG.DEFAULT_VOLUME;

    // Состояние зум-перехода перед battle
    let zoomTransition = null; // { fromCamX, fromCamY, fromScale, toCamX, toCamY, toScale, t, pendingCellKey }
    let zoomOutTransition = null; // { fromScale, toScale, t }

    // Летящее сердечко при открытии/закрытии клетки
    // { x, y, startX, startY, targetX, targetY, t, duration, onArrive }
    let flyingHeart = null;

    // Проверка связности: все не-выключенные клетки достижимы из старта
    function checkConnectivity(startX, startY, disabledSet, gridSize) {
      const visited = new Set();
      const queue = [`${startX},${startY}`];
      visited.add(`${startX},${startY}`);

      while (queue.length) {
        const k = queue.shift();
        const { x, y } = cellFromKey(k);
        for (const [dx, dy] of CARDINAL_DIRECTIONS) {
          const nx = x + dx, ny = y + dy;
          const nk = cellKey(nx, ny);
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !disabledSet.has(nk) && !visited.has(nk)) {
            visited.add(nk);
            queue.push(nk);
          }
        }
      }

      // Все не-выключенные клетки должны быть посещены
      const totalCells = gridSize * gridSize;
      return visited.size === totalCells - disabledSet.size;
    }

    function generateDisabledCells(startX, startY, exitX, exitY, gridSize, disabledCount) {
      const maxAttempts = CONFIG.MAX_GENERATION_ATTEMPTS;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const disabled = new Set();
        const candidates = [];

        // Собираем все клетки кроме старта и выхода
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            if ((x !== startX || y !== startY) && (x !== exitX || y !== exitY)) {
              candidates.push({ x, y });
            }
          }
        }

        // Перемешиваем и берём нужное количество
        shuffleInPlace(candidates);

        for (let i = 0; i < Math.min(disabledCount, candidates.length); i++) {
          disabled.add(cellKey(candidates[i].x, candidates[i].y));
        }

        // Проверяем связность
        if (checkConnectivity(startX, startY, disabled, gridSize)) {
          return disabled;
        }
      }

      // Если не удалось, возвращаем пустой сет (не должно произойти при разумных значениях)
      return new Set();
    }

    function initState(level = 1) {
      const levelConfig = getLevelConfig(level);
      const gridSize = levelConfig.gridSize;
      const keysRequired = levelConfig.keysRequired;
      const disabledCount = levelConfig.disabledCells;
      const heartsConfig = levelConfig.heartsCount;
      
      const levelMultiplier = 1 + (level - 1) * 0.5;
      const cx = Math.floor(gridSize / 2);
      const cy = Math.floor(gridSize / 2);

      const maxDist = Math.max(cx, cy, gridSize - 1 - cx, gridSize - 1 - cy);
      
      let ex, ey, ed;
      do {
        ex = Math.floor(Math.random() * gridSize);
        ey = Math.floor(Math.random() * gridSize);
        ed = Math.max(Math.abs(ex - cx), Math.abs(ey - cy));
      } while (!(ed >= 2 && ed <= 4));

      const disabledCells = generateDisabledCells(cx, cy, ex, ey, gridSize, disabledCount);

      // Генерируем содержимое клеток
      const cellContents = new Map(); // key -> {type: 'empty'|'heart'|'enemies', enemyCount?: number}
      const availableCells = [];

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const k = cellKey(x, y);
          if (!disabledCells.has(k) && !(x === cx && y === cy) && !(x === ex && y === ey)) {
            availableCells.push({ x, y, k });
          }
        }
      }

      // Перемешиваем
      shuffleInPlace(availableCells);

      // Расставляем ключи — только в клетках с дистанцией 2-4 от центра
      const keyObjs = [];
      const keyCandidates = availableCells.filter(c => {
        const d = Math.max(Math.abs(c.x - cx), Math.abs(c.y - cy));
        return d >= 2 && d <= 4;
      });
      const keysCount = Math.min(keysRequired, keyCandidates.length);
      for (let i = 0; i < keysCount; i++) {
        const cell = keyCandidates[i];
        availableCells.splice(availableCells.indexOf(cell), 1);
        const dist = Math.max(Math.abs(cell.x - cx), Math.abs(cell.y - cy));
        const enemyCount = (4 + Math.floor(Math.random() * 5)) * dist * levelMultiplier;
        cellContents.set(cell.k, { type: 'key', enemyCount, enemiesReleased: false });
        keyObjs.push({ x: (cell.x + 0.5) * CP, y: (cell.y + 0.5) * CP, cellKey: cell.k, collected: false });
      }

      // Расставляем сердечки
      const heartsCount = Math.min(heartsConfig, availableCells.length);
      for (let i = 0; i < heartsCount; i++) {
        const cell = availableCells.shift();
        const dist = Math.max(Math.abs(cell.x - cx), Math.abs(cell.y - cy));
        const enemyCount = (3 + Math.floor(Math.random() * 5)) * dist * levelMultiplier;
        cellContents.set(cell.k, { type: 'heart', enemyCount, enemiesReleased: false });
      }

      // Генерируем оружие на полу: 1 на ур.1, 2 на ур.2, 2 на ур.3
      // Оружие не повторяется между уровнями!
      const droppedWeapons = [];
      const allWeapons = ['shotgun', 'smg', 'rifle', 'revolver', 'carbine'];
      // Фильтруем уже заспавненные оружия
      const weaponPool = allWeapons.filter(w => !playerProgress.spawnedWeapons.includes(w));
      shuffleInPlace(weaponPool);
      const targetWeaponCount = LEVEL_WEAPON_COUNTS[level] || 1;
      const weaponCount = Math.min(targetWeaponCount, availableCells.length, weaponPool.length);

      // На 1 уровне оружие спавнится на диагональных клетках от старта
      let weaponCells = [];
      if (level === 1) {
        const diagonalOffsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        for (const [dx, dy] of diagonalOffsets) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            const k = cellKey(nx, ny);
            if (!disabledCells.has(k) && !cellContents.has(k)) {
              weaponCells.push({ x: nx, y: ny, k });
            }
          }
        }
        // Перемешиваем и берём нужное количество
        shuffleInPlace(weaponCells);
        weaponCells = weaponCells.slice(0, weaponCount);
      }

      for (let i = 0; i < weaponCount; i++) {
        let cell;
        if (level === 1 && i < weaponCells.length) {
          cell = weaponCells[i];
          // Удаляем эту клетку из availableCells чтобы не было конфликтов
          const idx = availableCells.findIndex(c => c.k === cell.k);
          if (idx >= 0) availableCells.splice(idx, 1);
        } else {
          cell = availableCells.shift();
        }
        if (!cell) continue;
        const weaponId = weaponPool[i];
        droppedWeapons.push({
          x: (cell.x + 0.5) * CP,
          y: (cell.y + 0.5) * CP,
          weaponId: weaponId,
          cellKey: cell.k,
        });
        // Запоминаем что это оружие заспавнилось
        playerProgress.spawnedWeapons.push(weaponId);
      }

      // Расставляем апгрейды (после оружия, т.к. оружие в приоритете)
      const upgradeObjs = [];
      const targetCount = LEVEL_UPGRADE_COUNTS[level] || 4;

      // Собираем доступные апгрейды (не превысили глобальный max)
      const availableUpgrades = [];
      for (const upg of UPGRADE_TYPES) {
        const spawnedCount = playerProgress.spawnedUpgrades[upg.id] || 0;
        const remaining = upg.max - spawnedCount;
        for (let i = 0; i < remaining; i++) {
          availableUpgrades.push(upg.id);
        }
      }

      // Перемешиваем и берем уникальные для этого уровня
      shuffleInPlace(availableUpgrades);
      const uniqueUpgrades = [];
      const usedInThisLevel = new Set();
      for (const upgId of availableUpgrades) {
        if (usedInThisLevel.has(upgId)) continue;
        usedInThisLevel.add(upgId);
        uniqueUpgrades.push(upgId);
        if (uniqueUpgrades.length >= targetCount) break;
      }

      // Обновляем глобальный счетчик заспавненных
      for (const upgId of uniqueUpgrades) {
        playerProgress.spawnedUpgrades[upgId] = (playerProgress.spawnedUpgrades[upgId] || 0) + 1;
      }

      // Размещаем апгрейды
      const upgsCount = Math.min(uniqueUpgrades.length, availableCells.length);
      for (let i = 0; i < upgsCount; i++) {
        const cell = availableCells.shift();
        const upgId = uniqueUpgrades[i];
        const dist = Math.max(Math.abs(cell.x - cx), Math.abs(cell.y - cy));
        const enemyCount = (2 + Math.floor(Math.random() * 5)) * dist * levelMultiplier;
        cellContents.set(cell.k, { type: 'upgrade', upgradeType: upgId, enemyCount: enemyCount, enemiesReleased: false });
        upgradeObjs.push({ x: (cell.x + 0.5) * CP, y: (cell.y + 0.5) * CP, cellKey: cell.k, upgradeType: upgId, collected: false });
      }

      // Расставляем проклятые сундуки
      const chestObjs = [];
      const chestCount = Math.min(LEVEL_CHEST_COUNTS[level] || 1, availableCells.length);
      for (let i = 0; i < chestCount; i++) {
        const cell = availableCells.shift();
        if (!cell) break;
        const dist = Math.max(Math.abs(cell.x - cx), Math.abs(cell.y - cy));
        const enemyCount = (2 + Math.floor(Math.random() * 4)) * Math.max(1, dist) * levelMultiplier;
        cellContents.set(cell.k, { type: 'chest', enemyCount, enemiesReleased: false });
        chestObjs.push({ x: (cell.x + 0.5) * CP, y: (cell.y + 0.5) * CP, cellKey: cell.k, collected: false });
      }

      // Расставляем врагов в оставшиеся клетки
      while (availableCells.length > 0) {
        const cell = availableCells.shift();
        if (Math.random() < CONFIG.ENEMY_SPAWN_CHANCE) {
          const dist = Math.max(Math.abs(cell.x - cx), Math.abs(cell.y - cy));
          const enemyCount = (1 + Math.floor(Math.random() * 3)) * dist * levelMultiplier;
          cellContents.set(cell.k, { type: 'enemies', enemyCount, enemiesReleased: false, enemies: [] });
        } else {
          cellContents.set(cell.k, { type: 'empty' });
        }
      }

      // Создаём врагов в закрытых комнатах
      const trappedSpiders = [];
      for (const [k, content] of cellContents) {
        if (content.enemyCount > 0) {
          const { x, y } = cellFromKey(k);
          for (let i = 0; i < content.enemyCount; i++) {
            const margin = CONFIG.SPIDER_RADIUS + CONFIG.SPIDER_SPAWN_MARGIN;
            const gx = x * CP + margin + Math.random() * (CP - margin * 2);
            const gy = y * CP + margin + Math.random() * (CP - margin * 2);
            // Определяем тип врага
            let enemyType;
            let enemyHp;
            let enemyRadius = CONFIG.SPIDER_RADIUS;
            const roll = Math.random();
            if (level >= 3) {
              // На уровне 3: кокон/распухший/бык/булдыга/солдат/плевака
              if (roll < CONFIG.COCOON_CHANCE) {
                enemyType = 'cocoon';
                enemyHp = CONFIG.COCOON_HP;
                enemyRadius = CONFIG.COCOON_RADIUS;
              } else if (roll < CONFIG.COCOON_CHANCE + CONFIG.BLOATED_CHANCE) {
                enemyType = 'bloated';
                enemyHp = CONFIG.BLOATED_HP;
                enemyRadius = CONFIG.BLOATED_RADIUS;
              } else if (roll < CONFIG.COCOON_CHANCE + CONFIG.BLOATED_CHANCE + CONFIG.BULL_CHANCE_LVL3) {
                enemyType = 'bull';
                enemyHp = CONFIG.BULL_HP;
                enemyRadius = CONFIG.BULL_RADIUS;
              } else if (roll < CONFIG.COCOON_CHANCE + CONFIG.BLOATED_CHANCE + CONFIG.BULL_CHANCE_LVL3 + CONFIG.BULDYGA_CHANCE_LVL3) {
                enemyType = 'buldyga';
                enemyHp = CONFIG.BULDYGA_HP;
                enemyRadius = CONFIG.BULDYGA_RADIUS;
              } else {
                const isPlevaka = Math.random() < CONFIG.SHOOTER_CHANCE;
                enemyType = isPlevaka ? 'plevaka' : 'soldier';
                enemyHp = isPlevaka ? CONFIG.SHOOTER_HP : CONFIG.SPIDER_HP;
              }
            } else if (level >= 2) {
              // На уровнях 2 распределяем между быком, булдыгой и обычными
              if (roll < CONFIG.BULL_CHANCE) {
                enemyType = 'bull';
                enemyHp = CONFIG.BULL_HP;
                enemyRadius = CONFIG.BULL_RADIUS;
              } else if (roll < CONFIG.BULL_CHANCE + CONFIG.BULDYGA_CHANCE) {
                enemyType = 'buldyga';
                enemyHp = CONFIG.BULDYGA_HP;
                enemyRadius = CONFIG.BULDYGA_RADIUS;
              } else {
                const isPlevaka = Math.random() < CONFIG.SHOOTER_CHANCE;
                enemyType = isPlevaka ? 'plevaka' : 'soldier';
                enemyHp = isPlevaka ? CONFIG.SHOOTER_HP : CONFIG.SPIDER_HP;
              }
            } else {
              const isPlevaka = Math.random() < CONFIG.SHOOTER_CHANCE;
              enemyType = isPlevaka ? 'plevaka' : 'soldier';
              enemyHp = isPlevaka ? CONFIG.SHOOTER_HP : CONFIG.SPIDER_HP;
            }
            trappedSpiders.push({
              x: gx, y: gy,
              homeX: x, homeY: y,
              trapped: true,
              phase: Math.random() * Math.PI * 2,
              wobble: CONFIG.SPIDER_WOBBLE_MIN + Math.random() * (CONFIG.SPIDER_WOBBLE_MAX - CONFIG.SPIDER_WOBBLE_MIN),
              vx: 0, vy: 0,
              radius: enemyRadius,
              hp: enemyHp,
              type: enemyType,
              shootCd: 0,
              // Поля для быка
              state: 'chase', // chase, prepare, dash, rest
              stateTimer: 0,
              dashTargetX: 0,
              dashTargetY: 0,
              dashDirX: 0,
              dashDirY: 0,
              dashDistance: 0,
              // Поля для булдыги
              currentSpeed: enemyType === 'buldyga' ? CONFIG.BULDYGA_SPEED : undefined,
              speedAccumulator: 0,
              // Поля для кокона
              spawnTimer: enemyType === 'cocoon' ? CONFIG.COCOON_SPAWN_INTERVAL : undefined,
            });
          }
        }
      }

      // Собираем сердечки для отслеживания
      const hearts = [];
      for (const [k, content] of cellContents) {
        if (content.type === 'heart') {
          const { x, y } = cellFromKey(k);
          hearts.push({ x: (x + 0.5) * CP, y: (y + 0.5) * CP, cellKey: k, collected: false });
        }
      }

      // Вычисляем начальные смежные клетки (со стартовой позиции)
      const initOpen = new Set([`${cx},${cy}`]);
      const initEverOpened = new Set([`${cx},${cy}`]);
      const initEverRevealed = new Set([`${cx},${cy}`]);
      revealAdjacentCells(initEverRevealed, cx, cy, disabledCells);

      return {
        gridSize: gridSize,
        keysRequired: keysRequired,
        openCells: initOpen,
        everRevealedCells: initEverRevealed, // клетки, которые когда-либо были видны (смежные или открытые)
        everOpenedCells: initEverOpened, // клетки, которые когда-либо были реально открыты
        permanentlyClosed: new Set(), // чёрные клетки
        startCell: { x: cx, y: cy },
        exitCell: { x: ex, y: ey },
        disabledCells: disabledCells,
        cellContents: cellContents,
        hearts: hearts,
        heartsCollected: 0,
        keyObjs: keyObjs,
        keysCollected: 0,
        upgradeObjs: upgradeObjs,
        chestObjs: chestObjs,
        revealedExit: false,

        upgrades: { ...playerProgress.upgrades },

        player: {
          x: (cx + 0.5) * CP,
          y: (cy + 0.5) * CP,
          lives: playerProgress.totalLives,
          invulnerable: 0,
        },

        spiders: trappedSpiders,
        activeSpiders: [], // враги которые были выпущены
        bullets: [],
        enemyBullets: [],
        shootCooldown: 0,
        burstCooldown: 0,
        burstRemaining: 0,
        burstWeaponId: null,
        particles: [],

        time: 0,

        keys: {},
        mouse: { x: (cx + 0.5) * CP, y: (cy + 0.5) * CP },
        phase: 'play', // 'play', 'battle', 'win', 'dead', 'stopped'

        // Battle mode state
        battle: null, // { openCells, cellContents, hearts, keyObjs, upgradeObjs, spiders, activeSpiders, ... }

        droppedWeapons: droppedWeapons,
        weaponSlots: [...playerProgress.weaponSlots],
        activeSlot: playerProgress.activeSlot,
        maxSlots: playerProgress.maxSlots,
      };
    }

