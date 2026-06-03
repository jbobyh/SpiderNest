    // ============================================================
    // BATTLE MODE
    // ============================================================
    const BATTLE_SCALE = CONFIG.BATTLE_SCALE;
    const BATTLE_CELL_PX = CP * BATTLE_SCALE;
    const RANGE_SCALE = CP / 10;

    function enterBattleMode(s, openedCellKey) {
      // Используем актуальные открытые клетки (после автозакрытия и всех изменений)
      const allOpenCells = new Set([...s.openCells]);
      allOpenCells.add(openedCellKey);

      // Находим клетку игрока и делаем BFS чтобы найти только связанные с ней клетки
      const playerCell = cellOf(s.player.x, s.player.y);
      const playerKey = cellKey(playerCell.x, playerCell.y);
      const battleCells = getConnectedCells(allOpenCells, playerKey);

      // Вычисляем границы battle-локации
      const { minX, minY, maxX, maxY } = getCellBounds(battleCells);

      // Создаём маппинг координат: позиция на карте -> позиция в battle
      const cellOffsetX = minX;
      const cellOffsetY = minY;
      const battleWidth = (maxX - minX + 1) * BATTLE_CELL_PX;
      const battleHeight = (maxY - minY + 1) * BATTLE_CELL_PX;

      // Конвертируем координаты игрока с точным смещением внутри клетки
      // playerCell уже определён выше при BFS
      const playerLocalX = s.player.x - playerCell.x * CP; // смещение внутри клетки [0..CP)
      const playerLocalY = s.player.y - playerCell.y * CP;
      const playerBattleX = (playerCell.x - cellOffsetX) * BATTLE_CELL_PX + playerLocalX * BATTLE_SCALE;
      const playerBattleY = (playerCell.y - cellOffsetY) * BATTLE_CELL_PX + playerLocalY * BATTLE_SCALE;

      // Создаём battle-копии коллектиблов
      const battleHearts = [];
      const battleKeys = [];
      const battleUpgrades = [];
      const battleSpiders = [];
      const battleActiveSpiders = [];

      // Сердечки
      for (const heart of s.hearts) {
        if (heart.collected) continue;
        const hc = cellOf(heart.x, heart.y);
        const hk = cellKey(hc.x, hc.y);
        if (battleCells.has(hk)) {
          battleHearts.push({
            x: (hc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (hc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            originalCellKey: hk,
            collected: false
          });
        }
      }

      // Ключи
      for (const keyObj of s.keyObjs) {
        if (keyObj.collected) continue;
        const kc = cellOf(keyObj.x, keyObj.y);
        const kk = cellKey(kc.x, kc.y);
        if (battleCells.has(kk)) {
          battleKeys.push({
            x: (kc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (kc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            originalCellKey: kk,
            collected: false
          });
        }
      }

      // Апгрейды
      for (const upg of s.upgradeObjs) {
        if (upg.collected) continue;
        const uc = cellOf(upg.x, upg.y);
        const uk = cellKey(uc.x, uc.y);
        if (battleCells.has(uk)) {
          battleUpgrades.push({
            x: (uc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (uc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            originalCellKey: uk,
            upgradeType: upg.upgradeType,
            collected: false
          });
        }
      }

      // Проклятые сундуки в battle
      const battleChests = [];
      for (const chest of (s.chestObjs || [])) {
        if (chest.collected) continue;
        const cc = cellOf(chest.x, chest.y);
        const ck = cellKey(cc.x, cc.y);
        if (battleCells.has(ck)) {
          battleChests.push({
            x: (cc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (cc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            originalCellKey: ck,
            collected: false,
          });
        }
      }

      // Оружие на полу в battle
      const battleWeapons = [];
      for (const dw of s.droppedWeapons) {
        const wc = cellOf(dw.x, dw.y);
        const wk = cellKey(wc.x, wc.y);
        if (battleCells.has(wk)) {
          battleWeapons.push({
            x: (wc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (wc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            weaponId: dw.weaponId,
            originalX: dw.x,
            originalY: dw.y,
            picked: false,
          });
        }
      }

      // Враги из открытой клетки -> активные враги
      const openedContent = s.cellContents.get(openedCellKey);
      if (openedContent && openedContent.enemyCount && !openedContent.enemiesReleased) {
        openedContent.enemiesReleased = true;
        const { x: ox, y: oy } = cellFromKey(openedCellKey);
        for (let i = s.spiders.length - 1; i >= 0; i--) {
          const g = s.spiders[i];
          if (g.homeX === ox && g.homeY === oy) {
            g.trapped = false;
            // Конвертируем позицию врага в battle-координаты
            const battleX = (g.homeX - cellOffsetX) * BATTLE_CELL_PX + (g.x - g.homeX * CP) * BATTLE_SCALE;
            const battleY = (g.homeY - cellOffsetY) * BATTLE_CELL_PX + (g.y - g.homeY * CP) * BATTLE_SCALE;
            battleActiveSpiders.push({
              x: battleX, y: battleY,
              vx: 0, vy: 0,
              hp: g.hp,
              type: g.type,
              phase: g.phase,
              wobble: g.wobble,
              shootCd: 0,
              radius: g.radius,
              state: g.state,
              stateTimer: g.stateTimer,
              dashTargetX: g.dashTargetX,
              dashTargetY: g.dashTargetY,
              dashDirX: g.dashDirX,
              dashDirY: g.dashDirY,
              dashDistance: g.dashDistance,
              currentSpeed: g.currentSpeed,
              speedAccumulator: g.speedAccumulator,
              stunTimer: 0,
            });
            s.spiders.splice(i, 1);
          }
        }
      }

      // Уже активные враги -> тоже переносим в battle
      for (const g of s.activeSpiders) {
        const gc = cellOf(g.x, g.y);
        if (battleCells.has(cellKey(gc.x, gc.y))) {
          const battleX = (gc.x - cellOffsetX) * BATTLE_CELL_PX + (g.x - gc.x * CP) * BATTLE_SCALE;
          const battleY = (gc.y - cellOffsetY) * BATTLE_CELL_PX + (g.y - gc.y * CP) * BATTLE_SCALE;
          battleActiveSpiders.push({
            x: battleX, y: battleY,
            vx: 0, vy: 0,
            hp: g.hp,
            type: g.type,
            phase: g.phase,
            wobble: g.wobble,
            shootCd: g.shootCd || 0,
            radius: g.radius,
            state: g.state,
            stateTimer: g.stateTimer,
            dashTargetX: g.dashTargetX,
            dashTargetY: g.dashTargetY,
            dashDirX: g.dashDirX,
            dashDirY: g.dashDirY,
            dashDistance: g.dashDistance,
            currentSpeed: g.currentSpeed,
            speedAccumulator: g.speedAccumulator,
            stunTimer: g.stunTimer || 0,
          });
        }
      }

      s.battle = {
        openCells: battleCells,
        cellOffsetX,
        cellOffsetY,
        width: battleWidth,
        height: battleHeight,
        hearts: battleHearts,
        keys: battleKeys,
        upgrades: battleUpgrades,
        chests: battleChests,
        weapons: battleWeapons,
        spiders: battleSpiders,
        activeSpiders: battleActiveSpiders,
        bullets: [],
        enemyBullets: [],
        particles: [],
        deathCorpses: [],
        freezeTimer: s.upgrades.freeze ? 1.5 : 0, // Таймер заморозки врагов
        damageNumbers: [],
        player: {
          x: playerBattleX,
          y: playerBattleY,
        },
        openedCellKey,
        cellContents: s.cellContents,
      };

      // Устанавливаем мышь на игрока для корректного направления стрельбы
      s.mouse.x = playerBattleX + 50;
      s.mouse.y = playerBattleY;

      s.phase = 'battle';

      // Вычисляем статичную камеру battle: умещаем все открытые клетки + стены на экране
      const bCols = maxX - minX + 1;
      const bRows = maxY - minY + 1;
      const wallPad = BATTLE_CELL_PX * 0.125; // wall depth, 1 side
      const scaleX2 = VIEW_W / (bCols * BATTLE_CELL_PX + wallPad * 2);
      const scaleY2 = VIEW_H / (bRows * BATTLE_CELL_PX + wallPad * 2);
      s.battle.staticScale = Math.min(scaleX2, scaleY2, 1);
      s.battle.staticCamX = (battleWidth * s.battle.staticScale - VIEW_W) / 2 - wallPad * s.battle.staticScale;
      s.battle.staticCamY = (battleHeight * s.battle.staticScale - VIEW_H) / 2 - wallPad * s.battle.staticScale;
      // Сохраняем центр зоны в play-координатах для zoom-out
      s.battle.playCenterX = (minX + bCols / 2) * CP;
      s.battle.playCenterY = (minY + bRows / 2) * CP;
      s.battle.playZoomScale = s.battle.staticScale * BATTLE_SCALE;
    }

    function syncBattleCollectibles(s) {
      if (!s.battle) return;
      const b = s.battle;

      for (const bh of b.hearts) {
        if (bh.collected) {
          const heart = s.hearts.find(h => h.cellKey === bh.originalCellKey);
          if (heart && !heart.collected) {
            heart.collected = true;
            s.cellContents.delete(bh.originalCellKey);
            s.heartsCollected++;
          }
        }
      }

      for (const bk of b.keys) {
        if (bk.collected) {
          const keyObj = s.keyObjs.find(k => k.cellKey === bk.originalCellKey);
          if (keyObj && !keyObj.collected) {
            keyObj.collected = true;
            s.cellContents.delete(bk.originalCellKey);
            s.keysCollected++;
          }
        }
      }

      for (const bu of b.upgrades) {
        if (bu.collected) {
          const upg = s.upgradeObjs.find(u => u.cellKey === bu.originalCellKey);
          if (upg && !upg.collected) {
            upg.collected = true;
            s.cellContents.delete(bu.originalCellKey);
            applyUpgrade(s, bu.upgradeType, false);
          }
        }
      }

      for (const bc of (b.chests || [])) {
        if (bc.collected) {
          const chest = (s.chestObjs || []).find(c => c.cellKey === bc.originalCellKey);
          if (chest && !chest.collected) {
            chest.collected = true;
            s.cellContents.delete(bc.originalCellKey);
          }
        }
      }
    }

    function exitBattleMode(s) {
      if (!s.battle) return;

      const b = s.battle;

      // Конвертируем позицию игрока обратно
      const battleCellX = Math.floor(b.player.x / BATTLE_CELL_PX);
      const battleCellY = Math.floor(b.player.y / BATTLE_CELL_PX);
      const mapCellX = battleCellX + b.cellOffsetX;
      const mapCellY = battleCellY + b.cellOffsetY;
      const localX = b.player.x - battleCellX * BATTLE_CELL_PX;
      const localY = b.player.y - battleCellY * BATTLE_CELL_PX;
      s.player.x = mapCellX * CP + localX / BATTLE_SCALE;
      s.player.y = mapCellY * CP + localY / BATTLE_SCALE;

      // Переносим оставшихся врагов обратно
      s.activeSpiders = [];
      for (const bg of b.activeSpiders) {
        const bx = Math.floor(bg.x / BATTLE_CELL_PX);
        const by = Math.floor(bg.y / BATTLE_CELL_PX);
        const mx = bx + b.cellOffsetX;
        const my = by + b.cellOffsetY;
        const lx = bg.x - bx * BATTLE_CELL_PX;
        const ly = bg.y - by * BATTLE_CELL_PX;
        s.activeSpiders.push({
          x: mx * CP + lx / BATTLE_SCALE,
          y: my * CP + ly / BATTLE_SCALE,
          vx: 0, vy: 0,
          hp: bg.hp,
          type: bg.type,
          phase: bg.phase,
          wobble: bg.wobble,
          shootCd: bg.shootCd || 0,
          radius: bg.radius,
          state: bg.state,
          stateTimer: bg.stateTimer,
          dashTargetX: bg.dashTargetX,
          dashTargetY: bg.dashTargetY,
          dashDirX: bg.dashDirX,
          dashDirY: bg.dashDirY,
          dashDistance: bg.dashDistance,
          currentSpeed: bg.currentSpeed,
          speedAccumulator: bg.speedAccumulator,
        });
      }

      s.battle = null;
      s.phase = 'play';
    }

    function inRoom(px, py, openCells) {
      const c = cellOf(px, py);
      return openCells.has(cellKey(c.x, c.y));
    }

    function getRoomCells(openCells) {
      return [...openCells].map(cellFromKey);
    }

    function getAdjacentTo(openCells, disabledCells, permanentlyClosed) {
      const adj = new Set();
      for (const k of openCells) {
        const { x, y } = cellFromKey(k);
        for (const [dx, dy] of CARDINAL_DIRECTIONS) {
          const nx = x + dx, ny = y + dy;
          const nk = cellKey(nx, ny);
          if (inBounds(nx, ny) &&
            !openCells.has(nk) &&
            !disabledCells?.has(nk) &&
            !permanentlyClosed?.has(nk)) {
            adj.add(nk);
          }
        }
      }
      return adj;
    }

    function getAdjacentOpen(openCells, targetKey) {
      const { x, y } = cellFromKey(targetKey);
      for (const [dx, dy] of CARDINAL_DIRECTIONS) {
        const nk = cellKey(x + dx, y + dy);
        if (openCells.has(nk)) return true;
      }
      return false;
    }

    // ============================================================
    // BOSS BATTLE MODE
    // ============================================================
    function startBossBattleZoomTransition() {
      if (!state) return;
      // Вычисляем границы battle-локации по всем открытым клеткам
      const battleCells = new Set([...state.openCells]);
      const { minX: fMinX, minY: fMinY, maxX: fMaxX, maxY: fMaxY } = getCellBounds(battleCells);
      const fCols = fMaxX - fMinX + 1;
      const fRows = fMaxY - fMinY + 1;
      const battleWallPad = BATTLE_CELL_PX * 0.125;
      const battleW = fCols * BATTLE_CELL_PX + battleWallPad * 2;
      const battleH = fRows * BATTLE_CELL_PX + battleWallPad * 2;
      const staticScale = Math.min(VIEW_W / battleW, VIEW_H / battleH, 1);
      const toScale = staticScale * BATTLE_SCALE;
      const fCenterX = (fMinX + fCols / 2) * CP;
      const fCenterY = (fMinY + fRows / 2) * CP;
      const fromCenterX = camera.x + VIEW_W / 2;
      const fromCenterY = camera.y + VIEW_H / 2;

      zoomTransition = {
        fromCenterX, fromCenterY,
        toCenterX: fCenterX, toCenterY: fCenterY,
        fromScale: 1,
        toCamX: fCenterX - VIEW_W / (2 * toScale),
        toCamY: fCenterY - VIEW_H / (2 * toScale),
        toScale,
        t: 0,
        pendingCellKey: null,
        frozenAngle: Math.atan2(state.mouse.y - state.player.y, state.mouse.x - state.player.x),
        isBossBattle: true,
      };
      Sounds.zoom();
      state.phase = 'zoom_transition';
    }

    function enterBossBattleMode(s) {
      // Используем все открытые клетки как арену боя
      const battleCells = new Set([...s.openCells]);

      // Находим клетку игрока
      const playerCell = cellOf(s.player.x, s.player.y);

      // Вычисляем границы battle-локации
      const { minX, minY, maxX, maxY } = getCellBounds(battleCells);
      const cellOffsetX = minX;
      const cellOffsetY = minY;
      const battleWidth = (maxX - minX + 1) * BATTLE_CELL_PX;
      const battleHeight = (maxY - minY + 1) * BATTLE_CELL_PX;

      // Конвертируем позицию игрока в battle-координаты
      const playerLocalX = s.player.x - playerCell.x * CP;
      const playerLocalY = s.player.y - playerCell.y * CP;
      const playerBattleX = (playerCell.x - cellOffsetX) * BATTLE_CELL_PX + playerLocalX * BATTLE_SCALE;
      const playerBattleY = (playerCell.y - cellOffsetY) * BATTLE_CELL_PX + playerLocalY * BATTLE_SCALE;

      // Находим самую дальнюю открытую клетку от игрока для спавна босса
      let farthestCell = null;
      let maxDist = -1;
      for (const k of battleCells) {
        const { x, y } = cellFromKey(k);
        const cx = (x + 0.5) * CP;
        const cy = (y + 0.5) * CP;
        const dist = Math.hypot(cx - s.player.x, cy - s.player.y);
        if (dist > maxDist) {
          maxDist = dist;
          farthestCell = { x, y };
        }
      }

      // Создаем босса (солдат с 4x HP) в дальней клетке от игрока
      const margin = CONFIG.SPIDER_RADIUS * BATTLE_SCALE + 20;
      let bossX, bossY;
      if (farthestCell) {
        const bossCellX = (farthestCell.x - cellOffsetX) * BATTLE_CELL_PX;
        const bossCellY = (farthestCell.y - cellOffsetY) * BATTLE_CELL_PX;
        // Позиция босса в углу клетки, дальнем от игрока
        const playerRelX = playerBattleX - bossCellX;
        const playerRelY = playerBattleY - bossCellY;
        bossX = bossCellX + (playerRelX < BATTLE_CELL_PX / 2 ? BATTLE_CELL_PX - margin : margin);
        bossY = bossCellY + (playerRelY < BATTLE_CELL_PX / 2 ? BATTLE_CELL_PX - margin : margin);
      } else {
        // Fallback - центр battle-зоны
        bossX = battleWidth / 2;
        bossY = battleHeight / 2;
      }

      // Босс - солдат с 10x HP
      const bossHp = CONFIG.SPIDER_HP * 10;
      const battleActiveSpiders = [{
        x: bossX,
        y: bossY,
        vx: 0, vy: 0,
        radius: CONFIG.SPIDER_RADIUS,
        hp: bossHp,
        maxHp: bossHp,
        type: 'soldier',
        isBoss: true,
        shootCd: 0,
        state: 'chase',
        stateTimer: 0,
        dashTargetX: 0, dashTargetY: 0,
        dashDirX: 0, dashDirY: 0,
        dashDistance: 0,
        currentSpeed: undefined,
        speedAccumulator: 0,
        spawnTimer: undefined,
        stunTimer: 0,
      }];

      // Battle-копии коллектиблов (сердечки, ключи, апгрейды, оружие)
      const battleHearts = [];
      const battleKeys = [];
      const battleUpgrades = [];
      const battleWeapons = [];
      const battleChests = [];

      for (const heart of s.hearts) {
        if (heart.collected) continue;
        const hc = cellOf(heart.x, heart.y);
        if (battleCells.has(cellKey(hc.x, hc.y))) {
          battleHearts.push({
            x: (hc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (hc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            originalCellKey: cellKey(hc.x, hc.y),
            collected: false
          });
        }
      }

      for (const keyObj of s.keyObjs) {
        if (keyObj.collected) continue;
        const kc = cellOf(keyObj.x, keyObj.y);
        if (battleCells.has(cellKey(kc.x, kc.y))) {
          battleKeys.push({
            x: (kc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (kc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            originalCellKey: cellKey(kc.x, kc.y),
            collected: false
          });
        }
      }

      for (const upg of s.upgradeObjs) {
        if (upg.collected) continue;
        const uc = cellOf(upg.x, upg.y);
        if (battleCells.has(cellKey(uc.x, uc.y))) {
          battleUpgrades.push({
            x: (uc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (uc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            originalCellKey: cellKey(uc.x, uc.y),
            upgradeType: upg.upgradeType,
            collected: false
          });
        }
      }

      for (const chest of (s.chestObjs || [])) {
        if (chest.collected) continue;
        const cc = cellOf(chest.x, chest.y);
        if (battleCells.has(cellKey(cc.x, cc.y))) {
          battleChests.push({
            x: (cc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (cc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            originalCellKey: cellKey(cc.x, cc.y),
            collected: false,
          });
        }
      }

      for (const dw of s.droppedWeapons) {
        const wc = cellOf(dw.x, dw.y);
        if (battleCells.has(cellKey(wc.x, wc.y))) {
          battleWeapons.push({
            x: (wc.x - cellOffsetX) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            y: (wc.y - cellOffsetY) * BATTLE_CELL_PX + BATTLE_CELL_PX / 2,
            weaponId: dw.weaponId,
            originalX: dw.x,
            originalY: dw.y,
            picked: false,
          });
        }
      }

      // Переносим уже активных врагов в battle (кроме босса)
      const battleSpiders = [];
      for (const g of s.activeSpiders) {
        const gc = cellOf(g.x, g.y);
        if (battleCells.has(cellKey(gc.x, gc.y))) {
          const battleX = (gc.x - cellOffsetX) * BATTLE_CELL_PX + (g.x - gc.x * CP) * BATTLE_SCALE;
          const battleY = (gc.y - cellOffsetY) * BATTLE_CELL_PX + (g.y - gc.y * CP) * BATTLE_SCALE;
          battleSpiders.push({
            x: battleX, y: battleY,
            vx: 0, vy: 0,
            hp: g.hp,
            type: g.type,
            phase: g.phase,
            wobble: g.wobble,
            shootCd: g.shootCd || 0,
            radius: g.radius,
            state: g.state,
            stateTimer: g.stateTimer,
            dashTargetX: g.dashTargetX,
            dashTargetY: g.dashTargetY,
            dashDirX: g.dashDirX,
            dashDirY: g.dashDirY,
            dashDistance: g.dashDistance,
            currentSpeed: g.currentSpeed,
            speedAccumulator: g.speedAccumulator,
          });
        }
      }

      s.battle = {
        openCells: battleCells,
        cellOffsetX,
        cellOffsetY,
        width: battleWidth,
        height: battleHeight,
        hearts: battleHearts,
        keys: battleKeys,
        upgrades: battleUpgrades,
        chests: battleChests,
        weapons: battleWeapons,
        spiders: battleSpiders,
        activeSpiders: battleActiveSpiders,
        bullets: [],
        enemyBullets: [],
        particles: [],
        deathCorpses: [],
        freezeTimer: s.upgrades.freeze ? 1.5 : 0,
        damageNumbers: [],
        player: {
          x: playerBattleX,
          y: playerBattleY,
        },
        openedCellKey: null,
        cellContents: s.cellContents,
        isBossBattle: true,
      };

      // Устанавливаем мышь на игрока для корректного направления стрельбы
      s.mouse.x = playerBattleX + 50;
      s.mouse.y = playerBattleY;

      s.phase = 'battle';
      s.bossSummonReady = false;

      // Вычисляем статичную камеру battle
      const wallPad = BATTLE_CELL_PX * 0.125;
      const bCols = maxX - minX + 1;
      const bRows = maxY - minY + 1;
      const scaleX2 = VIEW_W / (bCols * BATTLE_CELL_PX + wallPad * 2);
      const scaleY2 = VIEW_H / (bRows * BATTLE_CELL_PX + wallPad * 2);
      s.battle.staticScale = Math.min(scaleX2, scaleY2, 1);
      s.battle.staticCamX = (battleWidth * s.battle.staticScale - VIEW_W) / 2 - wallPad * s.battle.staticScale;
      s.battle.staticCamY = (battleHeight * s.battle.staticScale - VIEW_H) / 2 - wallPad * s.battle.staticScale;
      s.battle.playCenterX = (minX + bCols / 2) * CP;
      s.battle.playCenterY = (minY + bRows / 2) * CP;
      s.battle.playZoomScale = s.battle.staticScale * BATTLE_SCALE;
    }

