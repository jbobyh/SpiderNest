    function savePlayerProgress(s) {
      playerProgress.totalLives = s.player.lives + s.openCells.size;
      playerProgress.totalHeartsCollected += s.heartsCollected;
      playerProgress.weaponSlots = [...(s.weaponSlots || ['pistol', null])];
      playerProgress.activeSlot = s.activeSlot || 0;
      playerProgress.maxSlots = s.maxSlots || 1;
      // upgrades already saved during applyUpgrade
    }

    // ============================================================
    // SAVE / LOAD (localStorage)
    // ============================================================
    const SAVE_KEY = 'spidernest_save';

    function serializeState(s) {
      return {
        gridSize: s.gridSize,
        keysRequired: s.keysRequired,
        openCells: [...s.openCells],
        everRevealedCells: [...s.everRevealedCells],
        everOpenedCells: [...s.everOpenedCells],
        permanentlyClosed: [...s.permanentlyClosed],
        disabledCells: [...s.disabledCells],
        startCell: s.startCell,
        exitCell: s.exitCell,
        revealedExit: s.revealedExit,
        heartsCollected: s.heartsCollected,
        keysCollected: s.keysCollected,
        player: { x: s.player.x, y: s.player.y, lives: s.player.lives, invulnerable: 0 },
        cellContents: [...s.cellContents].map(([k, v]) => [k, v]),
        hearts: s.hearts,
        keyObjs: s.keyObjs,
        upgradeObjs: s.upgradeObjs,
        chestObjs: s.chestObjs || [],
        upgrades: { ...s.upgrades },
        spiders: s.spiders.map(g => ({ ...g })),
        activeSpiders: s.activeSpiders.map(g => ({ ...g })),
        droppedWeapons: s.droppedWeapons ? [...s.droppedWeapons] : [],
        weaponSlots: s.weaponSlots ? [...s.weaponSlots] : ['pistol', null],
        activeSlot: s.activeSlot || 0,
        maxSlots: s.maxSlots || 1,
        time: s.time,
      };
    }

    function deserializeState(data) {
      const s = {
        gridSize: data.gridSize || 5,
        keysRequired: data.keysRequired || 2,
        openCells: new Set(data.openCells),
        everRevealedCells: new Set(data.everRevealedCells),
        everOpenedCells: new Set(data.everOpenedCells),
        permanentlyClosed: new Set(data.permanentlyClosed),
        disabledCells: new Set(data.disabledCells),
        startCell: data.startCell,
        exitCell: data.exitCell,
        revealedExit: data.revealedExit,
        heartsCollected: data.heartsCollected,
        keysCollected: data.keysCollected,
        player: { ...data.player },
        cellContents: new Map(data.cellContents),
        hearts: data.hearts,
        keyObjs: data.keyObjs,
        upgradeObjs: data.upgradeObjs,
        chestObjs: data.chestObjs || [],
        upgrades: { ...data.upgrades },
        spiders: data.spiders.map(g => ({ ...g })),
        activeSpiders: (data.activeSpiders || []).map(g => ({ ...g })),
        droppedWeapons: data.droppedWeapons ? [...data.droppedWeapons] : [],
        weaponSlots: data.weaponSlots ? [...data.weaponSlots] : ['pistol', null],
        activeSlot: data.activeSlot || 0,
        maxSlots: data.maxSlots || 1,
        bullets: [],
        enemyBullets: [],
        particles: [],
        shootCooldown: 0,
        burstCooldown: 0,
        burstRemaining: 0,
        burstWeaponId: null,
        keys: {},
        mouse: { x: data.player.x, y: data.player.y },
        time: data.time || 0,
        phase: 'play',
        battle: null,
      };
      return s;
    }

    function saveGame() {
      if (!state) return;
      try {
        const save = {
          version: 1,
          currentLevel,
          playerProgress: {
            ...playerProgress,
            upgrades: { ...playerProgress.upgrades },
            spawnedUpgrades: { ...playerProgress.spawnedUpgrades }
          },
          state: serializeState(state),
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch (e) {
        console.warn('Save failed:', e);
      }
    }

    function loadGame() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const save = JSON.parse(raw);
        if (!save || save.version !== 1) return false;
        currentLevel = save.currentLevel;
        playerProgress = save.playerProgress;
        // Для старых сохранений без spawnedUpgrades и spawnedWeapons
        if (!playerProgress.spawnedUpgrades) {
          playerProgress.spawnedUpgrades = {};
        }
        if (!playerProgress.spawnedWeapons) {
          playerProgress.spawnedWeapons = [];
        }
        // Для старых сохранений без проклятых апгрейдов
        if (playerProgress.upgrades.infinitePenetrate === undefined) playerProgress.upgrades.infinitePenetrate = false;
        if (playerProgress.upgrades.infiniteRange === undefined) playerProgress.upgrades.infiniteRange = false;
        if (playerProgress.upgrades.ricochet === undefined) playerProgress.upgrades.ricochet = false;
        if (playerProgress.upgrades.lastLife === undefined) playerProgress.upgrades.lastLife = false;
        if (playerProgress.upgrades.battleSpeed === undefined) playerProgress.upgrades.battleSpeed = false;
        if (playerProgress.upgrades.freeze === undefined) playerProgress.upgrades.freeze = false;
        if (playerProgress.upgrades.randomBonus === undefined) playerProgress.upgrades.randomBonus = false;
        if (playerProgress.upgrades.farSight === undefined) playerProgress.upgrades.farSight = false;
        if (playerProgress.upgrades.longRange === undefined) playerProgress.upgrades.longRange = false;
        if (playerProgress.upgrades.sniper === undefined) playerProgress.upgrades.sniper = false;
        state = deserializeState(save.state);
        return true;
      } catch (e) {
        console.warn('Load failed:', e);
        return false;
      }
    }

    function hasSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const save = JSON.parse(raw);
        return save && save.version === 1;
      } catch (e) { return false; }
    }

    function deleteSave() {
      localStorage.removeItem(SAVE_KEY);
    }

    function nextLevel() {
      if (currentLevel >= 3) {
        // All levels completed - show victory
        deleteSave();
        state.phase = 'win';
        return;
      }
      
      savePlayerProgress(state);
      currentLevel++;
      // После первого уровня разблокируем второй слот
      if (currentLevel === 2) {
        playerProgress.maxSlots = 2;
      }
      flyingHeart = null;
      cursedChoiceState = null;
      state = initState(currentLevel);
      saveGame();
    }

    function startGame() {
      hideOverlay();
      deleteSave();
      currentLevel = 1;
      playerProgress = {
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
        spawnedUpgrades: {},
        spawnedWeapons: [],
        weaponSlots: ['pistol', null],
        activeSlot: 0,
        maxSlots: 1,
      };
      flyingHeart = null;
      cursedChoiceState = null;
      state = initState(currentLevel);
      draw(state);
      Sounds.ambienceStart();
    }

    function continueGame() {
      hideOverlay();
      if (!loadGame()) {
        startGame();
        return;
      }
      draw(state);
      Sounds.ambienceStart();
    }

    // ============================================================
    // INPUT
    // ============================================================
    document.addEventListener('keydown', e => {
      if (!state) return;
      state.keys[e.key.toLowerCase()] = true;
      if (e.key === 'CapsLock') showStatsPanel = true;

      // Смена слотов / оружия
      if (e.key === 'Escape') {
        if (cursedChoiceState) { e.preventDefault(); return; }
        if (state.phase === 'play' || state.phase === 'battle') {
          if (paused) resumeGame();
          else { paused = true; }
          e.preventDefault();
          return;
        }
      }

      if (paused) return;

      if (state.phase === 'play' || state.phase === 'battle') {
        let weaponChanged = false;
        if (e.key === '1') {
          if (state.maxSlots >= 1 && state.weaponSlots[0] && state.activeSlot !== 0) {
            state.activeSlot = 0;
            playerProgress.activeSlot = 0;
            state.shootCooldown = 0;
            weaponChanged = true;
            Sounds.weaponcollect();
          }
        } else if (e.key === '2') {
          if (state.maxSlots >= 2 && state.weaponSlots[1] && state.activeSlot !== 1) {
            state.activeSlot = 1;
            playerProgress.activeSlot = 1;
            state.shootCooldown = 0;
            weaponChanged = true;
            Sounds.weaponcollect();
          }
        } else if (e.key === '3') {
          if (state.maxSlots >= 3 && state.weaponSlots[2] && state.activeSlot !== 2) {
            state.activeSlot = 2;
            playerProgress.activeSlot = 2;
            state.shootCooldown = 0;
            weaponChanged = true;
            Sounds.weaponcollect();
          }
        } else if (e.key === '4') {
          if (state.maxSlots >= 4 && state.weaponSlots[3] && state.activeSlot !== 3) {
            state.activeSlot = 3;
            playerProgress.activeSlot = 3;
            state.shootCooldown = 0;
            weaponChanged = true;
            Sounds.weaponcollect();
          }
        } else if (e.key === '5') {
          if (state.maxSlots >= 5 && state.weaponSlots[4] && state.activeSlot !== 4) {
            state.activeSlot = 4;
            playerProgress.activeSlot = 4;
            state.shootCooldown = 0;
            weaponChanged = true;
            Sounds.weaponcollect();
          }
        } else if (e.key === 'q' || e.key === 'Q' || e.key === 'й' || e.key === 'Й') {
          // Q — циклическое переключение между всеми слотами
          let nextSlot = (state.activeSlot + 1) % state.maxSlots;
          let attempts = 0;
          
          // Ищем следующий слот с оружием
          while (attempts < state.maxSlots) {
            if (state.weaponSlots[nextSlot]) {
              state.activeSlot = nextSlot;
              playerProgress.activeSlot = nextSlot;
              state.shootCooldown = 0;
              weaponChanged = true;
              Sounds.weaponcollect();
              break;
            }
            nextSlot = (nextSlot + 1) % state.maxSlots;
            attempts++;
          }
        } else if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
          // Сначала пытаемся подобрать оружие рядом
          let pickedUp = false;

          if (state.phase === 'play') {
            for (let i = state.droppedWeapons.length - 1; i >= 0; i--) {
              const dw = state.droppedWeapons[i];
              const wc = cellOf(dw.x, dw.y);
              if (!state.openCells.has(cellKey(wc.x, wc.y))) continue;
              const dist = Math.hypot(state.player.x - dw.x, state.player.y - dw.y);
              if (dist < CONFIG.PLAYER_RADIUS + CONFIG.WEAPON_PICKUP_DISTANCE) {
                state.droppedWeapons.splice(i, 1);
                pickupWeapon(state, dw.weaponId, state.particles, dw.x, dw.y, 1);
                pickedUp = true;
                weaponChanged = true;
                break;
              }
            }
          } else if (state.phase === 'battle' && state.battle && state.battle.weapons) {
            const b = state.battle;
            for (let i = b.weapons.length - 1; i >= 0; i--) {
              const bw = b.weapons[i];
              if (bw.picked) continue;
              const dist = Math.hypot(b.player.x - bw.x, b.player.y - bw.y);
              if (dist < CONFIG.PLAYER_RADIUS * BATTLE_SCALE + CONFIG.WEAPON_PICKUP_DISTANCE * BATTLE_SCALE) {
                bw.picked = true;
                const idx = state.droppedWeapons.findIndex(dw => Math.abs(dw.x - bw.originalX) < 1 && Math.abs(dw.y - bw.originalY) < 1);
                if (idx >= 0) state.droppedWeapons.splice(idx, 1);
                const bpCell = { x: Math.floor(b.player.x / BATTLE_CELL_PX), y: Math.floor(b.player.y / BATTLE_CELL_PX) };
                const dropPX = (bpCell.x + b.cellOffsetX + 0.5) * CP;
                const dropPY = (bpCell.y + b.cellOffsetY + 0.5) * CP;
                pickupWeapon(state, bw.weaponId, b.particles, bw.x, bw.y, BATTLE_SCALE, dropPX, dropPY);
                pickedUp = true;
                weaponChanged = true;
                break;
              }
            }
          }

          // Проверка выхода: если на клетке выхода с ключами — выходим
          if (!pickedUp && state.keysCollected >= state.keysRequired) {
            const ec = state.exitCell;
            const ex0 = ec.x * CP, ex1 = (ec.x + 1) * CP;
            const ey0 = ec.y * CP, ey1 = (ec.y + 1) * CP;
            if (state.player.x > ex0 && state.player.x < ex1 && state.player.y > ey0 && state.player.y < ey1) {
              state.phase = 'level_complete';
              return;
            }
          }
        }
      }
    });
    document.addEventListener('keyup', e => {
      if (!state) return;
      state.keys[e.key.toLowerCase()] = false;
      if (e.key === 'CapsLock') showStatsPanel = false;
    });

    C.addEventListener('mousemove', e => {
      const p = getCanvasPoint(e);
      mouseScreen.x = p.x;
      mouseScreen.y = p.y;
      if (pauseSliderDragging) {
        const ps = PAUSE;
        Sounds._volume = Math.max(0, Math.min(1, (p.x - ps.sliderX()) / ps.sliderW()));
        Sounds.ambienceSyncVolume();
      }
    });

    C.addEventListener('mousedown', e => {
      if (!state) return;

      if (paused && e.button === 0) {
        e.preventDefault();
        const pointer = getCanvasPoint(e);
        const mx = pointer.x, my = pointer.y;

        // Клик по проклятому выбору
        if (cursedChoiceState) {
          const { offers, chest } = cursedChoiceState;
          const panelW = Math.min(VIEW_W - 40, 680);
          const cardW = Math.floor((panelW - 48) / 3);
          const cardH = 190;
          const panelX = (VIEW_W - panelW) / 2;
          const panelY = (VIEW_H - (cardH + 90)) / 2;
          for (let i = 0; i < offers.length; i++) {
            const cx = panelX + 16 + i * (cardW + 8);
            const cy = panelY + 58;
            if (mx >= cx && mx <= cx + cardW && my >= cy && my <= cy + cardH) {
              chest.collected = true;
              state.cellContents.delete(chest.cellKey);
              applyUpgrade(state, offers[i].id);
              addParticles(chest.x, chest.y, CONFIG.PICKUP_PARTICLES_COUNT, CONFIG.PICKUP_PARTICLES_SPEED, CONFIG.PICKUP_PARTICLES_LIFE, offers[i].color);
              cursedChoiceState = null;
              resumeGame();
              return;
            }
          }
          return;
        }

        const p = PAUSE;
        const sx = p.sliderX(), sy = p.sliderY(), sw = p.sliderW(), sh = p.sliderH;
        if (mx >= sx - 8 && mx <= sx + sw + 8 && my >= sy - 10 && my <= sy + sh + 10) {
          pauseSliderDragging = true;
          Sounds._volume = Math.max(0, Math.min(1, (mx - sx) / sw));
        }
        const bx = p.btnX(), by = p.btnY(), bw = p.btnW, bh = p.btnH;
        if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
          resumeGame();
        }
        return;
      }

      // ПКМ только в play mode, ЛКМ в play и battle
      if (e.button === 2 && state.phase !== 'play') return;
      if (e.button === 0 && state.phase !== 'play' && state.phase !== 'battle') return;
      e.preventDefault();

      const pointer = getCanvasPoint(e);
      const mx = pointer.x + camera.x;
      const my = pointer.y + camera.y;

      if (e.button === 0) {
        // ЛКМ — стрельба (в play или battle)
        if (state.phase === 'battle') {
          shootBattle(state);
        } else {
          shoot(state);
        }
      } else if (e.button === 2) {
        // ПКМ — открыть или закрыть комнату
        const cx = Math.floor(mx / CP);
        const cy = Math.floor(my / CP);
        if (cx < 0 || cx >= state.gridSize || cy < 0 || cy >= state.gridSize) return;
        const k = cellKey(cx, cy);

        // Проверяем, не выключена ли клетка изначально
        if (state.disabledCells.has(k)) return;

        if (!state.openCells.has(k) && !state.permanentlyClosed.has(k)) {
          // ОТКРЫТЬ клетку — только смежная с клеткой игрока
          const playerC = cellOf(state.player.x, state.player.y);
          const isAdjToPlayer = Math.abs(cx - playerC.x) + Math.abs(cy - playerC.y) === 1;
          if (!isAdjToPlayer) return;

          // Блокируем если уже летит сердечко
          if (flyingHeart) return;

          // Проверяем хватает ли жизней
          if (state.player.lives < 1) return;

          // Центр открываемой клетки (цель сердечка)
          const targetCellCX = (cx + 0.5) * CP;
          const targetCellCY = (cy + 0.5) * CP;

          // Если 1 жизнь — автозакрываем клетку сначала, потом сердце летит из закрытой в открываемую
          if (state.player.lives === 1) {
            const playerCell = cellOf(state.player.x, state.player.y);
            const playerKey = cellKey(playerCell.x, playerCell.y);

            // Находим связанные с игроком клетки (BFS)
            const connected = getConnectedCells(state.openCells, playerKey);

            // Фильтруем кандидатов на закрытие
            const candidates = [];
            for (const openKey of state.openCells) {
              if (openKey === playerKey) continue;
              // Нельзя закрыть с несобранным ключом
              if (state.keyObjs.some(key => !key.collected && key.cellKey === openKey)) continue;
              // Нельзя закрыть с несобранным сердцем
              if (state.hearts.some(heart => !heart.collected && heart.cellKey === openKey)) continue;
              candidates.push(openKey);
            }

            let cellToClose = null;

            // Шаг 1: Ищем отсоединённые клетки (не в connected)
            const isolated = candidates.filter(ck => !connected.has(ck));
            if (isolated.length > 0) {
              cellToClose = isolated[0];
            } else {
              // Шаг 2: Находим самую дальнюю по пути (BFS distance)
              const distances = new Map();
              const bfsQueue = [[playerKey, 0]];
              distances.set(playerKey, 0);

              while (bfsQueue.length) {
                const [bk, d] = bfsQueue.shift();
                const { x: bx2, y: by2 } = cellFromKey(bk);
                for (const [dx, dy] of CARDINAL_DIRECTIONS) {
                  const nk = cellKey(bx2 + dx, by2 + dy);
                  if (state.openCells.has(nk) && !distances.has(nk)) {
                    distances.set(nk, d + 1);
                    bfsQueue.push([nk, d + 1]);
                  }
                }
              }

              let maxDist = -1;
              for (const ck of candidates) {
                if (connected.has(ck) && distances.has(ck)) {
                  const d = distances.get(ck);
                  if (d > maxDist) {
                    maxDist = d;
                    cellToClose = ck;
                  }
                }
              }
            }

            // Если не нашли клетку для закрытия — отменяем
            if (!cellToClose) return;

            // Закрываем клетку сразу
            state.openCells.delete(cellToClose);
            // Возвращаем жизнь за закрытие
            state.player.lives++;

            // Сердце летит из центра закрытой клетки в центр открываемой клетки
            const { x: ccx, y: ccy } = cellFromKey(cellToClose);
            const fromX = (ccx + 0.5) * CP;
            const fromY = (ccy + 0.5) * CP;
            const openKey = k;
            const openCX = cx, openCY = cy;

            launchFlyingHeart(fromX, fromY, targetCellCX, targetCellCY, () => {
              // Тратим жизнь
              state.player.lives--;

              // Открываем
              state.openCells.add(openKey);
              state.everRevealedCells.add(openKey);
              state.everOpenedCells.add(openKey);
              revealAdjacentCells(state.everRevealedCells, openCX, openCY, state.disabledCells, state.permanentlyClosed);
              // Далеко гляжу: раскрываем диагональные клетки
              if (state.upgrades.farSight) {
                revealDiagonalCells(state.everRevealedCells, openCX, openCY, state.disabledCells, state.permanentlyClosed);
              }

              // Запускаем zoom transition или сохраняем
              doOpenCellAfterHeart(openKey, openCX, openCY);
            });
            return;
          }

          // Обычный случай (жизней > 1): сердце летит от игрока к клетке
          const fromX = state.player.x;
          const fromY = state.player.y;
          const openKey = k;
          const openCX = cx, openCY = cy;

          // Тратим жизнь сразу (чтобы HUD обновился)
          state.player.lives--;

          launchFlyingHeart(fromX, fromY, targetCellCX, targetCellCY, () => {
            // Открываем когда долетело
            state.openCells.add(openKey);
            state.everRevealedCells.add(openKey);
            state.everOpenedCells.add(openKey);
            revealAdjacentCells(state.everRevealedCells, openCX, openCY, state.disabledCells, state.permanentlyClosed);
            // Далеко гляжу: раскрываем диагональные клетки
            if (state.upgrades.farSight) {
              revealDiagonalCells(state.everRevealedCells, openCX, openCY, state.disabledCells, state.permanentlyClosed);
            }

            doOpenCellAfterHeart(openKey, openCX, openCY);
          });

        } else if (state.openCells.has(k)) {
          // ЗАКРЫТЬ клетку
          const playerCell = cellOf(state.player.x, state.player.y);
          if (k === cellKey(playerCell.x, playerCell.y)) return; // Нельзя закрыть клетку с игроком

          // Блокируем если уже летит сердечко
          if (flyingHeart) return;

          // Нельзя закрыть клетку с несобранным ключом
          const hasUncollectedKey = state.keyObjs.some(key => !key.collected && key.cellKey === k);
          if (hasUncollectedKey) return;

          // Нельзя закрыть клетку с несобранным сердцем
          const hasUncollectedHeart = state.hearts.some(heart => !heart.collected && heart.cellKey === k);
          if (hasUncollectedHeart) return;

          // Нельзя закрыть клетку, которая разделит оставшиеся клетки на 2+ части
          const openWithoutThis = new Set(state.openCells);
          openWithoutThis.delete(k);
          const playerKey = cellKey(playerCell.x, playerCell.y);
          if (openWithoutThis.has(playerKey)) {
            const remainingConnected = getConnectedCells(openWithoutThis, playerKey);
            if (remainingConnected.size !== openWithoutThis.size) return;
          }

          // Возвращаем жизнь сразу
          state.player.lives++;

          // Закрываем сразу
          state.openCells.delete(k);
          if (CONFIG.BLOCK_CELLS_FOREVER) {
            state.permanentlyClosed.add(k);
          }

          // Сердце летит из центра закрытой клетки к игроку (с преследованием)
          const closedCX = (cx + 0.5) * CP;
          const closedCY = (cy + 0.5) * CP;
          launchFlyingHeart(closedCX, closedCY, state.player.x, state.player.y, () => {
            saveGame();
          }, () => ({ x: state.player.x, y: state.player.y }));
        }
      }
    });

    C.addEventListener('contextmenu', e => e.preventDefault());

    // Стрельба по удержанию ЛКМ (обрабатывается в игровом цикле для точной синхронизации с cooldown)
    let mouseHeld = false;
    let showStatsPanel = false;
    C.addEventListener('mousedown', e => { if (e.button === 0) mouseHeld = true; });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) {
        mouseHeld = false;
        pauseSliderDragging = false;
      }
    });

    // ============================================================
    // START
    // ============================================================
    showStartOverlay();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);

    // ============================================================
    // FULLSCREEN
    // ============================================================
    const fsBtn = document.getElementById('fullscreen-btn');
    const fsContainer = document.getElementById('canvas-container');

    function isFullscreen() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function updateFsIcon() {
      fsBtn.textContent = isFullscreen() ? '🗗' : '⛶';
      fsBtn.title = isFullscreen() ? 'Выйти из полного экрана' : 'Полный экран';
      if (isFullscreen()) {
        resizeCanvas(window.screen.width, window.screen.height);
      } else {
        canvasScale = 1;
        C.width = VIEW_W;
        C.height = VIEW_H;
        C.style.width = '';
        C.style.height = '';
      }
    }

    fsBtn.addEventListener('click', () => {
      if (!isFullscreen()) {
        (fsContainer.requestFullscreen || fsContainer.webkitRequestFullscreen).call(fsContainer);
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      }
    });

    document.addEventListener('fullscreenchange', updateFsIcon);
    document.addEventListener('webkitfullscreenchange', updateFsIcon);
