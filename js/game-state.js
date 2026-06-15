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
      death:          function() { Sounds.play('death.wav'); },
      hitonplayer:    function() { Sounds.play('hitonplayer.wav'); },
      shield:         function() { Sounds.play('shield.wav'); },
      levelcomplete:  function() { Sounds.play('levelcomplete.wav'); },
      wallhit:        function() {
        Sounds.play('wallhit' + (Math.floor(Math.random() * 3) + 1) + '.wav');
      },
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

      // Level music system
      _levelMusic: null,
      _bossMusic: null,
      _currentMusicLevel: null,
      _musicFade: null, // { from: Audio, to: Audio, fromVol: number, toVol: number, duration: number, elapsed: number }

      playLevelMusic(level) {
        const cfg = CONFIG.MUSIC[level];
        if (!cfg) return;
        Sounds._musicFade = null;
        if (Sounds._bossMusic) {
          Sounds._bossMusic.pause();
          Sounds._bossMusic.currentTime = 0;
          Sounds._bossMusic = null;
        }
        if (Sounds._levelMusic) {
          Sounds._levelMusic.pause();
          Sounds._levelMusic.currentTime = 0;
        }
        Sounds._currentMusicLevel = level;
        Sounds._levelMusic = new Audio('sounds/' + cfg.file);
        Sounds._levelMusic.loop = true;
        Sounds._levelMusic.volume = cfg.volume * Sounds._volume;
        Sounds._levelMusic.play().catch(() => {});
      },

      stopLevelMusic(fadeDuration = 0) {
        if (!Sounds._levelMusic) return;
        if (fadeDuration > 0 && Sounds._levelMusic.volume > 0) {
          Sounds._musicFade = {
            from: Sounds._levelMusic,
            to: null,
            fromVol: Sounds._levelMusic.volume,
            toVol: 0,
            duration: fadeDuration,
            elapsed: 0,
            stopOnComplete: true,
          };
        } else {
          Sounds._levelMusic.pause();
          Sounds._levelMusic.currentTime = 0;
          Sounds._levelMusic = null;
          Sounds._currentMusicLevel = null;
        }
      },

      stopGameMusic() {
        // Stop level music
        if (Sounds._levelMusic) {
          Sounds._levelMusic.pause();
          Sounds._levelMusic.currentTime = 0;
          Sounds._levelMusic = null;
        }
        Sounds._currentMusicLevel = null;
        // Stop boss music
        if (Sounds._bossMusic) {
          Sounds._bossMusic.pause();
          Sounds._bossMusic.currentTime = 0;
          Sounds._bossMusic = null;
        }
        // Clear music fade
        Sounds._musicFade = null;
      },

      playBossMusic() {
        const cfg = CONFIG.MUSIC.BOSS;
        if (!cfg) return;
        if (Sounds._bossMusic) {
          Sounds._bossMusic.pause();
          Sounds._bossMusic.currentTime = 0;
        }
        const targetVol = cfg.volume * Sounds._volume;
        Sounds._bossMusic = new Audio('sounds/' + cfg.file);
        Sounds._bossMusic.loop = true;
        Sounds._bossMusic.volume = 0;
        Sounds._bossMusic.play().catch(() => {});
        const fadeDuration = CONFIG.FADE_DURATION_LEVEL_TO_BOSS;
        Sounds._musicFade = {
          from: Sounds._levelMusic,
          to: Sounds._bossMusic,
          fromVol: Sounds._levelMusic ? Sounds._levelMusic.volume : 0,
          toVol: targetVol,
          duration: fadeDuration,
          elapsed: 0,
          stopOnComplete: false,
          pauseFromOnComplete: true,
        };
      },

      stopBossMusic() {
        if (!Sounds._bossMusic) return;
        const level = Sounds._currentMusicLevel || currentLevel;
        const cfg = CONFIG.MUSIC[level] || CONFIG.MUSIC[1];
        Sounds._currentMusicLevel = level;
        if (Sounds._levelMusic) {
          Sounds._levelMusic.volume = 0;
          if (Sounds._levelMusic.paused) Sounds._levelMusic.play().catch(() => {});
        } else if (cfg) {
          Sounds._levelMusic = new Audio('sounds/' + cfg.file);
          Sounds._levelMusic.loop = true;
          Sounds._levelMusic.volume = 0;
          Sounds._levelMusic.play().catch(() => {});
        }
        const fadeDuration = CONFIG.FADE_DURATION_BOSS_TO_LEVEL;
        Sounds._musicFade = {
          from: Sounds._bossMusic,
          to: Sounds._levelMusic,
          fromVol: Sounds._bossMusic.volume,
          toVol: cfg ? cfg.volume * Sounds._volume : 0.3,
          duration: fadeDuration,
          elapsed: 0,
          stopOnComplete: true,
        };
      },

      updateMusicFade(dt) {
        if (!Sounds._musicFade) return;
        const fade = Sounds._musicFade;
        fade.elapsed += dt;
        const progress = Math.min(fade.elapsed / fade.duration, 1);
        if (fade.from) {
          fade.from.volume = fade.fromVol * (1 - progress);
        }
        if (fade.to) {
          fade.to.volume = fade.toVol * progress;
        }
        if (progress >= 1) {
          if (fade.pauseFromOnComplete && fade.from) {
            fade.from.pause();
          }
          if (fade.stopOnComplete && fade.from) {
            fade.from.pause();
            fade.from.currentTime = 0;
            if (fade.from === Sounds._bossMusic) {
              Sounds._bossMusic = null;
            }
          }
          if (fade.to === null) {
            Sounds._levelMusic = null;
            Sounds._currentMusicLevel = null;
          }
          Sounds._musicFade = null;
        }
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
    floorImg.src = 'img/floor-blue.png';

    const wallImg = new Image();
    wallImg.src = 'img/wall.png';

    const cornerImg = new Image();
    cornerImg.src = 'img/corner.png';

    // Green textures for level 2
    const floorGreenImg = new Image();
    floorGreenImg.src = 'img/floor-green.png';

    const wallGreenImg = new Image();
    wallGreenImg.src = 'img/wall-green.png';

    const cornerGreenImg = new Image();
    cornerGreenImg.src = 'img/corner-green.png';

    // Green floor variants with different exit configurations
    const floorRightExitGreenImg = new Image();
    floorRightExitGreenImg.src = 'img/floor-rightexit-green.png';

    const floorRightBottomExitGreenImg = new Image();
    floorRightBottomExitGreenImg.src = 'img/floor-rightbottomexit-green.png';

    const floorLeftRightBottomExitGreenImg = new Image();
    floorLeftRightBottomExitGreenImg.src = 'img/floor-leftrightbottomexit-green.png';

    const floorTopDownExitGreenImg = new Image();
    floorTopDownExitGreenImg.src = 'img/floor-topdownexit-green.png';

    const floor4ExitGreenImg = new Image();
    floor4ExitGreenImg.src = 'img/floor-4exit-green.png';

    // Y textures for level 3
    const floorYImg = new Image();
    floorYImg.src = 'img/floor-y.png';

    const wallYImg = new Image();
    wallYImg.src = 'img/wall-y.png';

    const cornerYImg = new Image();
    cornerYImg.src = 'img/corner-y.png';

    // Y floor variants with different exit configurations
    const floorRightExitYImg = new Image();
    floorRightExitYImg.src = 'img/floor-rightexit-y.png';

    const floorRightBottomExitYImg = new Image();
    floorRightBottomExitYImg.src = 'img/floor-rightbottomexit-y.png';

    const floorLeftRightBottomExitYImg = new Image();
    floorLeftRightBottomExitYImg.src = 'img/floor-leftrightbottomexit-y.png';

    const floorTopDownExitYImg = new Image();
    floorTopDownExitYImg.src = 'img/floor-topdownexit-y.png';

    const floor4ExitYImg = new Image();
    floor4ExitYImg.src = 'img/floor-4exit-y.png';

    const closedCellImg = new Image();
    closedCellImg.src = 'img/closedcell.png';

    const rockImg = new Image();
    rockImg.src = 'img/rock.png';

    const backgroundImg = new Image();
    backgroundImg.src = 'img/background.png';

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

    // Exit cell backgrounds
    const closedExit1Img = new Image();
    closedExit1Img.src = 'img/closedexit1.png';

    const closedExit2Img = new Image();
    closedExit2Img.src = 'img/closedexit2.png';

    const closedExit3Img = new Image();
    closedExit3Img.src = 'img/closedexit3.png';

    const openExitImg = new Image();
    openExitImg.src = 'img/openexit.png';

    const heroImg = new Image();
    heroImg.src = 'img/hero.png';

    const cocoonImg = new Image();
    cocoonImg.src = 'img/cocoon.png';

    const altarImg = new Image();
    altarImg.src = 'img/altar.png';

    const hudHeartImg = new Image();
    hudHeartImg.src = 'img/heart.png';

    const hudHeartContainerImg = new Image();
    hudHeartContainerImg.src = 'img/heart-container.png';

    const hudKeyImg = new Image();
    hudKeyImg.src = 'img/key.png';

    const hudShieldImg = new Image();
    hudShieldImg.src = 'img/shield.png';

    const cursedChestImg = new Image();
    cursedChestImg.src = 'img/open-treasure-chest.png';

    const hudCtrlF     = new Image(); hudCtrlF.src     = 'img/keyboard_f.png';
    const hudCtrlShift = new Image(); hudCtrlShift.src = 'img/keyboard_shift.png';
    const hudCtrlTab   = new Image(); hudCtrlTab.src   = 'img/keyboard_tab.png';
    const hudCtrlML    = new Image(); hudCtrlML.src    = 'img/mouse_left.png';
    const hudCtrlMR    = new Image(); hudCtrlMR.src    = 'img/mouse_right.png';

    // Enemy sprites (500x500px each)
    const enemyImages = {
      bloated:  new Image(),
      buldyga:  new Image(),
      bull:     new Image(),
      plevaka:  new Image(),
      plevaka_anim: new Image(),
      soldier:  new Image(),
    };
    enemyImages.bloated.src  = 'img/bloated.png';
    enemyImages.buldyga.src  = 'img/buldyga.png';
    enemyImages.bull.src     = 'img/bull.png';
    enemyImages.plevaka.src  = 'img/plevaka.png';
    enemyImages.plevaka_anim.src = 'img/plevaka_anim.png';
    enemyImages.soldier.src  = 'img/soldier.png';
    enemyImages.bloated_dead = new Image();
    enemyImages.buldyga_dead = new Image();
    enemyImages.bull_dead    = new Image();
    enemyImages.plevaka_dead = new Image();
    enemyImages.soldier_dead = new Image();
    enemyImages.bloated_dead.src = 'img/bloated_dead.png';
    enemyImages.buldyga_dead.src = 'img/buldyga_dead.png';
    enemyImages.bull_dead.src    = 'img/bull_dead.png';
    enemyImages.plevaka_dead.src = 'img/plevaka_dead.png';
    enemyImages.soldier_dead.src = 'img/soldier_dead.png';

    // Weapon sprites
    const weaponImages = {
      pistol:   new Image(),
      shotgun:  new Image(),
      smg:      new Image(),
      rifle:    new Image(),
      revolver: new Image(),
      carbine:  new Image(),
    };
    weaponImages.pistol.src   = 'img/pistol.png';
    weaponImages.shotgun.src  = 'img/shotgun.png';
    weaponImages.smg.src      = 'img/smg.png';
    weaponImages.rifle.src    = 'img/rifle.png';
    weaponImages.revolver.src = 'img/revolver.png';
    weaponImages.carbine.src  = 'img/carbine.png';

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

    function drawPlayerSprite(cx2, cy2, scale, alpha, snapshot) {
      if (!heroImg.complete || heroImg.naturalWidth === 0) return;
      const frame = snapshot ? snapshot.frame : playerAnim.frame;
      const key = snapshot ? snapshot.key : playerAnim.key;
      const flip = snapshot ? snapshot.flip : playerAnim.flip;
      const anim = HERO_ANIMS[key];
      const sx = frame * HERO_SW;
      const sy = anim.row * HERO_SH;
      const drawSize = HERO_SW * scale;
      ctx.save();
      ctx.globalAlpha = alpha !== undefined ? alpha : 1;
      ctx.translate(cx2, cy2);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(
        heroImg,
        sx, sy, HERO_SW, HERO_SH,
        -drawSize / 2, -drawSize / 2, drawSize, drawSize
      );
      ctx.restore();
    }

    function drawPlayerWeapon(cx2, cy2, aimAngle, scale, alpha) {
      if (!state) return;
      const weaponId = state.weaponSlots[state.activeSlot];
      if (!weaponId) return;
      const img = weaponImages[weaponId];
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const wDef = WEAPON_DEFS[weaponId];
      const spriteAngle = wDef ? (wDef.spriteAngle || 0) : 0;
      const drawSize = HERO_SW * scale * 0.5;
      const recoilOffset = weaponRecoil * drawSize * 0.4;
      const offsetDist = drawSize * 0.5 - recoilOffset;
      ctx.save();
      ctx.globalAlpha = alpha !== undefined ? alpha : 1;
      ctx.translate(cx2, cy2);
      ctx.rotate(aimAngle);
      if (aimAngle > Math.PI / 2 || aimAngle < -Math.PI / 2) ctx.scale(1, -1);
      ctx.translate(offsetDist, 0);
      ctx.rotate(spriteAngle);
      ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();
    }

    let state = null;
    let currentLevel = 1;
    let screenShake = { amount: 0, angle: 0 };
    let weaponRecoil = 0;
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
        lastLife: false,
        battleSpeed: false,
        freeze: false,
        randomBonus: false,
        farSight: false,
        longRange: false,
        sniper: false,
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
    let pendingOpenHeart = false; // false | 'hud' (heart from HUD to cell) | 'cell' (heart cell-to-cell)

    // Органическая генерация карты: BFS-расширение из центра
    function generateBlobCells(cx, cy, cellCount) {
      const cells = new Set();
      const frontier = [];
      const startKey = cellKey(cx, cy);
      cells.add(startKey);
      frontier.push({ x: cx, y: cy });

      while (cells.size < cellCount && frontier.length > 0) {
        const idx = Math.floor(Math.random() * frontier.length);
        const { x, y } = frontier[idx];
        const dirs = shuffleInPlace([...CARDINAL_DIRECTIONS]);
        let added = false;
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          const nk = cellKey(nx, ny);
          if (!cells.has(nk)) {
            cells.add(nk);
            frontier.push({ x: nx, y: ny });
            added = true;
            break;
          }
        }
        if (!added) frontier.splice(idx, 1);
      }

      return cells;
    }

    // ============================================================
    // ROOM GENERATION SYSTEM
    // ============================================================
    const ROOM_SIZE_WEIGHTS = [
      { size: 1, weight: 0.40 },
      { size: 2, weight: 0.30 },
      { size: 3, weight: 0.20 },
      { size: 4, weight: 0.10 },
    ];

    function pickRoomSize() {
      const r = Math.random();
      let cumulative = 0;
      for (const { size, weight } of ROOM_SIZE_WEIGHTS) {
        cumulative += weight;
        if (r < cumulative) return size;
      }
      return 1;
    }

    // Generate room shapes
    function generateRoomShape(centerX, centerY, size) {
      const cells = [];
      const keySet = new Set();

      function addCell(x, y) {
        const k = cellKey(x, y);
        if (!keySet.has(k)) {
          keySet.add(k);
          cells.push({ x, y, k });
        }
      }

      // Always include center
      addCell(centerX, centerY);

      if (size === 1) {
        return cells;
      }

      if (size === 2) {
        // 2x1 line - random orientation
        const horizontal = Math.random() < 0.5;
        if (horizontal) {
          addCell(centerX + 1, centerY);
        } else {
          addCell(centerX, centerY + 1);
        }
        return cells;
      }

      if (size === 3) {
        // 50% line, 50% L-shape
        const isLine = Math.random() < 0.5;
        if (isLine) {
          // 3x1 line - random orientation
          const horizontal = Math.random() < 0.5;
          if (horizontal) {
            addCell(centerX - 1, centerY);
            addCell(centerX + 1, centerY);
          } else {
            addCell(centerX, centerY - 1);
            addCell(centerX, centerY + 1);
          }
        } else {
          // L-shape - 4 variants
          const variant = Math.floor(Math.random() * 4);
          switch (variant) {
            case 0: addCell(centerX + 1, centerY); addCell(centerX, centerY + 1); break;
            case 1: addCell(centerX + 1, centerY); addCell(centerX, centerY - 1); break;
            case 2: addCell(centerX - 1, centerY); addCell(centerX, centerY + 1); break;
            case 3: addCell(centerX - 1, centerY); addCell(centerX, centerY - 1); break;
          }
        }
        return cells;
      }

      if (size === 4) {
        // Always 2x2 square - start from top-left of the 2x2
        // Place center at top-left of the quad
        addCell(centerX + 1, centerY);
        addCell(centerX, centerY + 1);
        addCell(centerX + 1, centerY + 1);
        return cells;
      }

      return cells;
    }

    function getInternalWalls(cells) {
      const walls = [];
      const cellSet = new Set(cells.map(c => c.k));

      for (const { x, y } of cells) {
        // Check right neighbor
        const rightKey = cellKey(x + 1, y);
        if (cellSet.has(rightKey)) {
          walls.push(wallKey(x, y, x + 1, y));
        }
        // Check bottom neighbor
        const bottomKey = cellKey(x, y + 1);
        if (cellSet.has(bottomKey)) {
          walls.push(wallKey(x, y, x, y + 1));
        }
      }

      return walls;
    }

    // Generate rooms using BFS expansion with room-sized steps
    function generateRooms(startX, startY, targetCellCount) {
      const rooms = [];
      const allCells = new Map(); // cellKey -> roomIndex
      const removedWalls = new Set();
      const internalWalls = new Set();

      // Start with 1-cell room at center
      const startRoom = {
        cells: [{ x: startX, y: startY, k: cellKey(startX, startY) }],
        size: 1,
        cellKeys: new Set([cellKey(startX, startY)]),
      };
      rooms.push(startRoom);
      allCells.set(cellKey(startX, startY), 0);

      // BFS frontier - cells that are on the edge and can expand
      const frontier = [{ x: startX, y: startY }];

      while (allCells.size < targetCellCount && frontier.length > 0) {
        // Pick random frontier cell
        const idx = Math.floor(Math.random() * frontier.length);
        const { x, y } = frontier[idx];

        // Try to place a room adjacent to this cell
        const dirs = shuffleInPlace([...CARDINAL_DIRECTIONS]);
        let placed = false;

        for (const [dx, dy] of dirs) {
          // Pick room size
          const size = pickRoomSize();
          const centerX = x + dx;
          const centerY = y + dy;

          // Generate room shape
          const roomCells = generateRoomShape(centerX, centerY, size);

          // Check if all cells are free
          let allFree = true;
          for (const cell of roomCells) {
            if (allCells.has(cell.k)) {
              allFree = false;
              break;
            }
          }

          if (allFree && roomCells.length > 0) {
            // Check connectivity - at least one cell must be adjacent to existing frontier
            let hasAdjacent = false;
            for (const cell of roomCells) {
              for (const [ndx, ndy] of CARDINAL_DIRECTIONS) {
                const neighborKey = cellKey(cell.x + ndx, cell.y + ndy);
                if (allCells.has(neighborKey)) {
                  hasAdjacent = true;
                  break;
                }
              }
              if (hasAdjacent) break;
            }

            if (hasAdjacent || roomCells.length === 1) {
              // Place the room
              const roomIndex = rooms.length;
              const cellKeys = new Set();
              for (const cell of roomCells) {
                cellKeys.add(cell.k);
                allCells.set(cell.k, roomIndex);
              }

              // Add internal walls to removed set
              const roomInternalWalls = getInternalWalls(roomCells);
              for (const w of roomInternalWalls) {
                removedWalls.add(w);
                internalWalls.add(w);
              }

              rooms.push({
                cells: roomCells,
                size: roomCells.length,
                cellKeys: cellKeys,
              });

              // Add new cells to frontier
              for (const cell of roomCells) {
                frontier.push({ x: cell.x, y: cell.y });
              }

              placed = true;
              break;
            }
          }
        }

        if (!placed) {
          frontier.splice(idx, 1);
        }
      }

      return { rooms, allCells: new Set(allCells.keys()), removedWalls, internalWalls };
    }

    const ENEMY_POOL_TYPE_MAP = {
      soldier: 'soldier',
      shooter: 'plevaka',
      bull: 'bull',
      buldyga: 'buldyga',
      cocoon: 'cocoon',
      bloated: 'bloated',
    };

    function cellDistanceFromStart(x, y, startX, startY) {
      return Math.max(Math.abs(x - startX), Math.abs(y - startY));
    }

    function getDifficultyTier(dist, maxDist) {
      if (maxDist <= 0) return 'easy';
      const third = maxDist / 3;
      if (dist <= third) return 'easy';
      if (dist <= third * 2) return 'medium';
      return 'hard';
    }

    function pickRoomPreset(level, poolName) {
      const pools = ROOM_POOLS[level] || ROOM_POOLS[1];
      const pool = pools[poolName] || pools.easy;
      return { ...pool[Math.floor(Math.random() * pool.length)] };
    }

    function countEnemiesInPreset(preset) {
      let total = 0;
      for (const count of Object.values(preset)) {
        total += count || 0;
      }
      return total;
    }

    function getEnemyStats(enemyType) {
      // HP multipliers for regular enemies by level (bosses unaffected)
      let hpMult = 1;
      if (currentLevel === 2) hpMult = 2;
      else if (currentLevel >= 3) hpMult = 4;

      switch (enemyType) {
        case 'cocoon':
          return { hp: CONFIG.COCOON_HP * hpMult, radius: CONFIG.COCOON_RADIUS, visualScale: CONFIG.COCOON_VISUAL_SCALE };
        case 'bloated':
          return { hp: CONFIG.BLOATED_HP * hpMult, radius: CONFIG.BLOATED_RADIUS, visualScale: CONFIG.BLOATED_VISUAL_SCALE };
        case 'bull':
          return { hp: CONFIG.BULL_HP * hpMult, radius: CONFIG.BULL_RADIUS, visualScale: CONFIG.BULL_VISUAL_SCALE };
        case 'buldyga':
          return { hp: CONFIG.BULDYGA_HP * hpMult, radius: CONFIG.BULDYGA_RADIUS, visualScale: CONFIG.BULDYGA_VISUAL_SCALE };
        case 'plevaka':
          return { hp: CONFIG.SHOOTER_HP * hpMult, radius: CONFIG.SPIDER_RADIUS, visualScale: CONFIG.SHOOTER_VISUAL_SCALE };
        default:
          return { hp: CONFIG.SPIDER_HP * hpMult, radius: CONFIG.SPIDER_RADIUS, visualScale: CONFIG.SPIDER_VISUAL_SCALE };
      }
    }

    function createTrappedEnemy(enemyType, gx, gy, homeX, homeY) {
      const { hp, radius, visualScale } = getEnemyStats(enemyType);
      const isPlevaka = enemyType === 'plevaka' || enemyType === 'shooter';
      return {
        x: gx, y: gy,
        homeX, homeY,
        trapped: true,
        phase: Math.random() * Math.PI * 2,
        wobble: CONFIG.SPIDER_WOBBLE_MIN + Math.random() * (CONFIG.SPIDER_WOBBLE_MAX - CONFIG.SPIDER_WOBBLE_MIN),
        vx: 0, vy: 0,
        radius,
        hp,
        maxHp: hp,
        visualScale,
        type: enemyType,
        shootCd: 0,
        state: 'chase',
        stateTimer: 0,
        dashTargetX: 0,
        dashTargetY: 0,
        dashDirX: 0,
        // Animation state for plevaka
        animState: isPlevaka ? 'idle' : null,
        animFrame: isPlevaka ? 0 : null,
        animTimer: isPlevaka ? 0 : null,
        dashDirY: 0,
        dashDistance: 0,
        currentSpeed: enemyType === 'buldyga' ? CONFIG.BULDYGA_SPEED : undefined,
        speedAccumulator: 0,
        spawnTimer: enemyType === 'cocoon' ? CONFIG.COCOON_SPAWN_INTERVAL : undefined,
      };
    }

    function spawnEnemiesFromPreset(preset, cellX, cellY, trappedSpiders) {
      const margin = CONFIG.SPIDER_RADIUS + CONFIG.SPIDER_SPAWN_MARGIN;
      for (const [configKey, count] of Object.entries(preset)) {
        if (!count) continue;
        const enemyType = ENEMY_POOL_TYPE_MAP[configKey];
        if (!enemyType) continue;
        for (let i = 0; i < count; i++) {
          const gx = cellX * CP + margin + Math.random() * (CP - margin * 2);
          const gy = cellY * CP + margin + Math.random() * (CP - margin * 2);
          trappedSpiders.push(createTrappedEnemy(enemyType, gx, gy, cellX, cellY));
        }
      }
    }

    function setCellEnemies(cellContents, key, contentFields, preset) {
      cellContents.set(key, {
        ...contentFields,
        enemyPreset: preset,
        enemyCount: countEnemiesInPreset(preset),
        enemiesReleased: false,
        enemies: [],
      });
    }

    function initState(level = 1) {
      // Start level music
      Sounds.playLevelMusic(level);

      const levelConfig = getLevelConfig(level);
      const gridSize = levelConfig.gridSize;
      const heartsConfig = levelConfig.heartsCount;
      const cellCount = levelConfig.cellCount || gridSize * gridSize;

      const cx = Math.floor(gridSize / 2);
      const cy = Math.floor(gridSize / 2);

      // Генерируем комнаты разных размеров
      const { rooms, allCells: blobCells, removedWalls: roomRemovedWalls, internalWalls: roomInternalWalls } = generateRooms(cx, cy, cellCount);
      const disabledCells = new Set();

      // Генерируем содержимое комнат (каждая комната имеет один тип контента)
      const cellContents = new Map(); // key -> {type: 'empty'|'heart'|'enemies', enemyCount?: number}
      const cellToRoom = new Map(); // cellKey -> roomIndex (для быстрого поиска)

      // Строим маппинг клетка -> комната
      for (let i = 0; i < rooms.length; i++) {
        for (const cell of rooms[i].cells) {
          cellToRoom.set(cell.k, i);
        }
      }

      // Собираем все комнаты кроме стартовой
      const availableRooms = [];
      for (let i = 1; i < rooms.length; i++) { // room[0] - стартовая
        availableRooms.push(i);
      }

      // Перемешиваем комнаты
      shuffleInPlace(availableRooms);

      // Вычисляем maxDist для тиров сложности
      let maxCellDist = 0;
      for (const roomIdx of availableRooms) {
        for (const cell of rooms[roomIdx].cells) {
          const d = cellDistanceFromStart(cell.x, cell.y, cx, cy);
          if (d > maxCellDist) maxCellDist = d;
        }
      }

      function tierForRoom(roomIdx) {
        // Используем первую клетку комнаты для определения тира
        const cell = rooms[roomIdx].cells[0];
        const dist = cellDistanceFromStart(cell.x, cell.y, cx, cy);
        return getDifficultyTier(dist, maxCellDist);
      }

      function getRoomCenter(roomIdx) {
        const room = rooms[roomIdx];
        let sumX = 0, sumY = 0;
        for (const cell of room.cells) {
          sumX += cell.x;
          sumY += cell.y;
        }
        return { x: (sumX / room.cells.length + 0.5) * CP, y: (sumY / room.cells.length + 0.5) * CP };
      }

      function getCenterCellKey(roomIdx) {
        const room = rooms[roomIdx];
        let sumX = 0, sumY = 0;
        for (const cell of room.cells) {
          sumX += cell.x;
          sumY += cell.y;
        }
        const centerX = Math.floor(sumX / room.cells.length + 0.5);
        const centerY = Math.floor(sumY / room.cells.length + 0.5);
        return cellKey(centerX, centerY);
      }

      function setRoomContent(roomIdx, type, extraFields, preset) {
        const room = rooms[roomIdx];
        for (const cell of room.cells) {
          setCellEnemies(cellContents, cell.k, { ...extraFields, type }, preset);
        }
      }

      // Расставляем сферу призыва — случайная комната
      let summonSphere = null;
      if (availableRooms.length > 0) {
        const sphereIdx = Math.floor(Math.random() * availableRooms.length);
        const roomIdx = availableRooms.splice(sphereIdx, 1)[0];
        setRoomContent(roomIdx, 'summonSphere', {}, pickRoomPreset(level, 'key'));
        const center = getRoomCenter(roomIdx);
        const centerKey = getCenterCellKey(roomIdx);
        summonSphere = { x: center.x, y: center.y, cellKey: centerKey, collected: false, spawned: true };
      }

      // Расставляем сердечки
      const hearts = [];
      const heartsCount = Math.min(heartsConfig, availableRooms.length);
      for (let i = 0; i < heartsCount; i++) {
        const roomIdx = availableRooms.shift();
        setRoomContent(roomIdx, 'heart', {}, pickRoomPreset(level, tierForRoom(roomIdx)));
        const center = getRoomCenter(roomIdx);
        const centerKey = getCenterCellKey(roomIdx);
        hearts.push({ x: center.x, y: center.y, cellKey: centerKey, collected: false, spawned: true });
      }

      // Генерируем оружие на полу
      const droppedWeapons = [];
      const allWeapons = ['shotgun', 'smg', 'rifle', 'revolver', 'carbine'];
      const weaponPool = allWeapons.filter(w => !playerProgress.spawnedWeapons.includes(w));
      shuffleInPlace(weaponPool);
      const targetWeaponCount = LEVEL_WEAPON_COUNTS[level] || 1;
      const weaponCount = Math.min(targetWeaponCount, availableRooms.length, weaponPool.length);

      // На 1 уровне оружие спавнится в комнатах рядом со стартом (диагональные)
      let weaponRoomIndices = [];
      if (level === 1) {
        const diagonalOffsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        for (const [dx, dy] of diagonalOffsets) {
          const nx = cx + dx, ny = cy + dy;
          const k = cellKey(nx, ny);
          const roomIdx = cellToRoom.get(k);
          if (roomIdx !== undefined && !rooms[roomIdx].contentSet) {
            weaponRoomIndices.push(roomIdx);
          }
        }
        shuffleInPlace(weaponRoomIndices);
        weaponRoomIndices = weaponRoomIndices.slice(0, weaponCount);
      }

      for (let i = 0; i < weaponCount; i++) {
        let roomIdx;
        if (level === 1 && i < weaponRoomIndices.length) {
          roomIdx = weaponRoomIndices[i];
          // Удаляем эту комнату из availableRooms
          const idx = availableRooms.indexOf(roomIdx);
          if (idx >= 0) availableRooms.splice(idx, 1);
        } else {
          if (availableRooms.length === 0) break;
          roomIdx = availableRooms.shift();
        }
        if (roomIdx === undefined) continue;
        const weaponId = weaponPool[i];
        const center = getRoomCenter(roomIdx);
        const centerKey = getCenterCellKey(roomIdx);
        droppedWeapons.push({ x: center.x, y: center.y, weaponId: weaponId, cellKey: centerKey });
        playerProgress.spawnedWeapons.push(weaponId);
        // Помечаем все клетки комнаты как содержащие оружие (для предотвращения конфликтов)
        for (const cell of rooms[roomIdx].cells) {
          cellContents.set(cell.k, { type: 'weapon', weaponId });
        }
      }

      // Расставляем апгрейды
      const upgradeObjs = [];
      const targetCount = LEVEL_UPGRADE_COUNTS[level] || 4;

      const availableUpgrades = [];
      for (const upg of UPGRADE_TYPES) {
        const spawnedCount = playerProgress.spawnedUpgrades[upg.id] || 0;
        const remaining = upg.max - spawnedCount;
        for (let i = 0; i < remaining; i++) {
          availableUpgrades.push(upg.id);
        }
      }

      shuffleInPlace(availableUpgrades);
      const uniqueUpgrades = [];
      const usedInThisLevel = new Set();
      for (const upgId of availableUpgrades) {
        if (usedInThisLevel.has(upgId)) continue;
        usedInThisLevel.add(upgId);
        uniqueUpgrades.push(upgId);
        if (uniqueUpgrades.length >= targetCount) break;
      }

      for (const upgId of uniqueUpgrades) {
        playerProgress.spawnedUpgrades[upgId] = (playerProgress.spawnedUpgrades[upgId] || 0) + 1;
      }

      const upgsCount = Math.min(uniqueUpgrades.length, availableRooms.length);
      for (let i = 0; i < upgsCount; i++) {
        const roomIdx = availableRooms.shift();
        const upgId = uniqueUpgrades[i];
        setRoomContent(roomIdx, 'upgrade', { upgradeType: upgId }, pickRoomPreset(level, 'simpleupgrade'));
        const center = getRoomCenter(roomIdx);
        const centerKey = getCenterCellKey(roomIdx);
        upgradeObjs.push({ x: center.x, y: center.y, cellKey: centerKey, upgradeType: upgId, collected: false, spawned: true });
      }

      // Расставляем проклятые сундуки
      const chestObjs = [];
      const chestCount = Math.min(LEVEL_CHEST_COUNTS[level] || 1, availableRooms.length);
      for (let i = 0; i < chestCount; i++) {
        const roomIdx = availableRooms.shift();
        if (roomIdx === undefined) break;
        setRoomContent(roomIdx, 'chest', {}, pickRoomPreset(level, 'cursedupgrade'));
        const center = getRoomCenter(roomIdx);
        const centerKey = getCenterCellKey(roomIdx);
        chestObjs.push({ x: center.x, y: center.y, cellKey: centerKey, collected: false, spawned: true });
      }

      // Расставляем врагов (комнаты целиком)
      const enemyRoomCount = Math.floor(availableRooms.length * CONFIG.ENEMY_SPAWN_CHANCE);
      shuffleInPlace(availableRooms);
      for (let i = 0; i < enemyRoomCount; i++) {
        const roomIdx = availableRooms.shift();
        setRoomContent(roomIdx, 'enemies', {}, pickRoomPreset(level, tierForRoom(roomIdx)));
      }

      // Для комнат с врагами — бонусы появляются только после победы
      // Проверяем все ячейки комнаты на наличие врагов
      for (const h of hearts) {
        const roomIdx = cellToRoom.get(h.cellKey);
        if (roomIdx !== undefined) {
          const room = rooms[roomIdx];
          for (const cell of room.cells) {
            const content = cellContents.get(cell.k);
            if (content && content.enemyCount > 0) { h.spawned = false; break; }
          }
        }
      }
      for (const u of upgradeObjs) {
        const roomIdx = cellToRoom.get(u.cellKey);
        if (roomIdx !== undefined) {
          const room = rooms[roomIdx];
          for (const cell of room.cells) {
            const content = cellContents.get(cell.k);
            if (content && content.enemyCount > 0) { u.spawned = false; break; }
          }
        }
      }
      for (const c of chestObjs) {
        const roomIdx = cellToRoom.get(c.cellKey);
        if (roomIdx !== undefined) {
          const room = rooms[roomIdx];
          for (const cell of room.cells) {
            const content = cellContents.get(cell.k);
            if (content && content.enemyCount > 0) { c.spawned = false; break; }
          }
        }
      }
      // Summoning sphere also hidden until enemies defeated
      if (summonSphere) {
        const roomIdx = cellToRoom.get(summonSphere.cellKey);
        if (roomIdx !== undefined) {
          const room = rooms[roomIdx];
          for (const cell of room.cells) {
            const content = cellContents.get(cell.k);
            if (content && content.enemyCount > 0) { summonSphere.spawned = false; break; }
          }
        }
      }

      // Оставшиеся комнаты - пустые
      for (const roomIdx of availableRooms) {
        for (const cell of rooms[roomIdx].cells) {
          cellContents.set(cell.k, { type: 'empty' });
        }
      }

      // Создаём врагов в закрытых комнатах по пресетам (один раз на комнату, в центре)
      const trappedSpiders = [];
      const processedRooms = new Set(); // Track which rooms already have enemies spawned
      for (const [k, content] of cellContents) {
        if (content.enemyPreset && content.enemyCount > 0) {
          // Find which room this cell belongs to
          const roomIdx = cellToRoom.get(k);
          if (roomIdx === undefined || processedRooms.has(roomIdx)) continue;
          processedRooms.add(roomIdx);
          // Spawn enemies at room center cell (integer coordinates)
          const { x: spawnX, y: spawnY } = cellFromKey(getCenterCellKey(roomIdx));
          spawnEnemiesFromPreset(content.enemyPreset, spawnX, spawnY, trappedSpiders);
        }
      }

      // Вычисляем начальные смежные клетки (со стартовой позиции)
      const initOpen = new Set([`${cx},${cy}`]);
      const initEverOpened = new Set([`${cx},${cy}`]);
      const initEverRevealed = new Set([`${cx},${cy}`]);
      // Reveal all cells of starting room (and adjacent)
      for (const cell of rooms[0].cells) {
        initEverRevealed.add(cell.k);
      }
      revealAdjacentCells(initEverRevealed, cx, cy, disabledCells);

      // Генерируем цвет фона для каждой комнаты (оттенок #0e0f1a)
      const roomColors = new Map(); // cellKey -> cssColor
      for (let i = 0; i < rooms.length; i++) {
        const hue = Math.floor(Math.random() * 360);
        const sat = 18 + Math.floor(Math.random() * 22); // 18..39%
        const lit = 7 + Math.floor(Math.random() * 5);   // 7..11%
        const color = `hsl(${hue},${sat}%,${lit}%)`;
        for (const cell of rooms[i].cells) {
          roomColors.set(cell.k, color);
        }
      }

      return {
        gridSize: gridSize,
        rooms: rooms, // комнаты с их размерами (для reference)
        blobCells: blobCells, // все клетки карты (Set для совместимости)
        openCells: initOpen,
        removedWalls: roomRemovedWalls,
        internalWalls: roomInternalWalls,
        roomColors: roomColors, // цвет фона для каждой клетки (по комнате)
        playerRemovedWalls: 0, // счётчик стен, убранных игроком (для HUD)
        everRevealedCells: initEverRevealed, // клетки, которые когда-либо были видны (смежные или открытые)
        everOpenedCells: initEverOpened, // клетки, которые когда-либо были реально открыты
        permanentlyClosed: new Set(), // чёрные клетки
        startCell: { x: cx, y: cy },
        exitCell: null, // выход создается после убийства босса
        disabledCells: disabledCells,
        cellContents: cellContents,
        hearts: hearts,
        heartsCollected: 0,
        summonSphere: summonSphere,
        summonSphereCollected: false,
        upgradeObjs: upgradeObjs,
        chestObjs: chestObjs,
        revealedExit: false,

        upgrades: { ...playerProgress.upgrades },

        player: {
          x: (cx + 0.5) * CP,
          y: (cy + 0.5) * CP,
          lives: playerProgress.totalLives,
          invulnerable: 0,
          dashCooldown: 0,
          isDashing: false,
          dashDirX: 0,
          dashDirY: 0,
          dashProgress: 0,
          dashTrails: [],
          dashTrailTimer: 0,
        },

        spiders: trappedSpiders,
        activeSpiders: [], // враги которые были выпущены
        deathCorpses: [],
        bullets: [],
        enemyBullets: [],
        shootCooldown: 0,
        maxShootCooldown: 0,
        burstCooldown: 0,
        burstRemaining: 0,
        burstWeaponId: null,
        particles: [],

        time: 0,

        keys: {},
        mouse: { x: (cx + 0.5) * CP, y: (cy + 0.5) * CP },
        phase: 'play', // 'play', 'battle', 'win', 'dead', 'stopped', 'level_complete'

        // Battle mode state
        battle: null, // { openCells, cellContents, hearts, upgradeObjs, spiders, activeSpiders, ... }

        // Boss battle flags
        bossSummonReady: false,
        bossDefeated: false,

        droppedWeapons: droppedWeapons,
        weaponSlots: [...playerProgress.weaponSlots],
        activeSlot: playerProgress.activeSlot,
        maxSlots: playerProgress.maxSlots,

        // Room altars for enemy rooms (battle trigger)
        roomAltars: (() => {
          const altars = [];
          const processedRooms = new Set();
          for (const [k, content] of cellContents) {
            if (content.enemyPreset && content.enemyCount > 0 && !content.enemiesReleased) {
              const roomIdx = cellToRoom.get(k);
              if (roomIdx === undefined || processedRooms.has(roomIdx)) continue;
              processedRooms.add(roomIdx);
              const centerKey = getCenterCellKey(roomIdx);
              const { x: cx, y: cy } = cellFromKey(centerKey);
              altars.push({
                roomIdx,
                x: (cx + 0.5) * CP,
                y: (cy + 0.5) * CP,
                cellKey: centerKey,
                activated: false,
              });
            }
          }
          return altars;
        })(),
      };
    }

