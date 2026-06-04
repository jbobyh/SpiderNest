    // ============================================================
    // DEATH CORPSE HELPER
    // ============================================================
    const CORPSE_DURATION = 2.0;

    function spawnCorpse(corpseArray, g, radius) {
      const type = g.type || 'soldier';
      const hasDead = type === 'soldier' || type === 'chaser' ||
                      type === 'plevaka' || type === 'shooter' ||
                      type === 'bull' || type === 'buldyga';
      if (!hasDead) return;
      Sounds.death();
      corpseArray.push({
        x: g.x,
        y: g.y,
        type: type,
        radius: radius,
        visualScale: g.visualScale || 3.2,
        life: CORPSE_DURATION,
        maxLife: CORPSE_DURATION,
      });
    }

    // ============================================================
    // UPGRADES
    // ============================================================
    let upgradePopupTimer = 0;

    function applyUpgrade(s, type, showPopup = true) {
      const upg = UPGRADE_TYPES.find(u => u.id === type);
      switch (type) {
        case 'pellets': 
          s.upgrades.pellets++; 
          playerProgress.upgrades.pellets++; 
          break;
        case 'damage': 
          s.upgrades.damage = s.upgrades.damage + 2; 
          playerProgress.upgrades.damage = playerProgress.upgrades.damage + 2; 
          break;
        case 'penetrate': 
          s.upgrades.penetrate++; 
          playerProgress.upgrades.penetrate++; 
          break;
        case 'cooldown': 
          s.upgrades.cooldownMult = Math.max(0.1, s.upgrades.cooldownMult - 0.15); 
          playerProgress.upgrades.cooldownMult = s.upgrades.cooldownMult; 
          break;
        case 'speed': 
          s.upgrades.speedMult += 0.10; 
          playerProgress.upgrades.speedMult = s.upgrades.speedMult; 
          break;
        case 'spread':
          s.upgrades.spreadMult += 0.10;
          playerProgress.upgrades.spreadMult = s.upgrades.spreadMult;
          break;
        case 'bulletSpeed':
          s.upgrades.bulletSpeedMult += 0.30;
          playerProgress.upgrades.bulletSpeedMult = s.upgrades.bulletSpeedMult;
          break;
        case 'critChance':
          s.upgrades.critChance += 0.05;
          playerProgress.upgrades.critChance = s.upgrades.critChance;
          break;
        case 'killAccel':
          s.upgrades.killAccel = true;
          playerProgress.upgrades.killAccel = true;
          break;
        case 'enhancedPierce':
          s.upgrades.enhancedPierce = true;
          playerProgress.upgrades.enhancedPierce = true;
          break;
        case 'shield':
          s.upgrades.shield++;
          playerProgress.upgrades.shield++;
          break;
        case 'retreat':
          s.upgrades.retreat++;
          playerProgress.upgrades.retreat++;
          break;
        case 'reflection':
          s.upgrades.reflection = true;
          playerProgress.upgrades.reflection = true;
          break;
        case 'infinitePenetrate':
          s.upgrades.infinitePenetrate = true;
          playerProgress.upgrades.infinitePenetrate = true;
          s.upgrades.cooldownMult *= 1.20;
          playerProgress.upgrades.cooldownMult = s.upgrades.cooldownMult;
          break;
        case 'infiniteRange':
          s.upgrades.infiniteRange = true;
          playerProgress.upgrades.infiniteRange = true;
          s.upgrades.speedMult *= 0.70;
          playerProgress.upgrades.speedMult = s.upgrades.speedMult;
          break;
        case 'ricochet':
          s.upgrades.ricochet = true;
          playerProgress.upgrades.ricochet = true;
          break;
        case 'weaponSlot':
          s.maxSlots++;
          s.weaponSlots.push(null);
          playerProgress.maxSlots = s.maxSlots;
          playerProgress.weaponSlots = [...s.weaponSlots];
          break;
        case 'lastLife':
          s.upgrades.lastLife = true;
          playerProgress.upgrades.lastLife = true;
          break;
        case 'battleSpeed':
          s.upgrades.battleSpeed = true;
          playerProgress.upgrades.battleSpeed = true;
          break;
        case 'freeze':
          s.upgrades.freeze = true;
          playerProgress.upgrades.freeze = true;
          break;
        case 'randomBonus':
          // Даем 3 случайных обычных бонуса с проверкой max
          const availableUpgrades = [];
          for (const upg of UPGRADE_TYPES) {
            const currentLevel = s.upgrades[upg.id] || 0;
            if (currentLevel < upg.max) {
              availableUpgrades.push(upg.id);
            }
          }
          
          // Перемешиваем и берем первые 3
          shuffleInPlace(availableUpgrades);
          const bonusesToGive = availableUpgrades.slice(0, 3);
          
          // Применяем бонусы без попапов (покажем один общий попап в конце)
          for (const bonusId of bonusesToGive) {
            applyUpgrade(s, bonusId, false);
          }
          
          // Показываем общий попап
          if (bonusesToGive.length > 0) {
            showUpgradePopup(`ПОЛУЧЕНО БОНУСОВ: ${bonusesToGive.length}`, '#ff00ff');
          }
          break;
        case 'farSight':
          s.upgrades.farSight = true;
          playerProgress.upgrades.farSight = true;
          break;
        case 'longRange':
          s.upgrades.longRange = true;
          playerProgress.upgrades.longRange = true;
          break;
        case 'sniper':
          s.upgrades.sniper = true;
          playerProgress.upgrades.sniper = true;
          break;
      }
      const upgDef = UPGRADE_TYPES.find(u => u.id === type) || CURSED_UPGRADE_TYPES.find(u => u.id === type);
      if (upgDef && showPopup) showUpgradePopup(upgDef.label, upgDef.color, upgDef.icon);
    }

    function showUpgradePopup(text, color, icon = '⬆') {
      const el = document.getElementById('upgrade-popup');
      el.textContent = icon + ' ' + text;
      el.style.borderColor = color;
      el.style.color = color;
      el.style.textShadow = `0 0 12px ${color}`;
      el.style.boxShadow = `0 0 20px ${color}44`;
      el.classList.add('visible');
      upgradePopupTimer = CONFIG.UPGRADE_POPUP_DURATION;
    }

    // ============================================================
    // PLAYER DAMAGE HELPER
    // ============================================================
    function dealPlayerDamage(s, isBattleMode) {
      if (s.player.invulnerable > 0 || CONFIG.DEBUG_INVULNERABLE) return false;

      // Щит поглощает урон
      if (s.upgrades.shield > 0) {
        s.upgrades.shield--;
        playerProgress.upgrades.shield--;
        Sounds.shield();
        // Даем неуязвимость как при потере жизни
        s.player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME + s.upgrades.retreat;
        // Отражение: выпускаем 3 пули в ближайших врагов
        if (s.upgrades.reflection) {
          fireReflectionBullets(s, isBattleMode);
        }
        return true; // Урон поглощен щитом
      }

      // Последняя жизнь - если это смертельный урон (останется 0 жизней)
      if (s.upgrades.lastLife && s.player.lives <= 1) {
        s.upgrades.lastLife = false;
        playerProgress.upgrades.lastLife = false;
        
        // Убиваем всех врагов в бою
        const enemiesArray = isBattleMode ? s.battle.activeSpiders : s.activeSpiders;
        const particlesArray = isBattleMode ? s.battle.particles : s.particles;
        const scale = isBattleMode ? BATTLE_SCALE : 1;
        
        // Удаляем все вражеские пули
        if (isBattleMode && s.battle.enemyBullets) {
          for (let i = s.battle.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = s.battle.enemyBullets[i];
            // Создаем маленькие партиклы для каждой пули
            for (let k = 0; k < 3; k++) {
              const a = Math.random() * Math.PI * 2;
              particlesArray.push({
                x: bullet.x, y: bullet.y,
                vx: Math.cos(a) * 30 * scale,
                vy: Math.sin(a) * 30 * scale,
                life: 0.3, maxLife: 0.3, color: '#ff8800',
              });
            }
          }
          s.battle.enemyBullets.length = 0; // Очищаем массив вражеских пуль
        } else if (!isBattleMode && s.enemyBullets) {
          for (let i = s.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = s.enemyBullets[i];
            for (let k = 0; k < 3; k++) {
              const a = Math.random() * Math.PI * 2;
              particlesArray.push({
                x: bullet.x, y: bullet.y,
                vx: Math.cos(a) * 30,
                vy: Math.sin(a) * 30,
                life: 0.3, maxLife: 0.3, color: '#ff8800',
              });
            }
          }
          s.enemyBullets.length = 0; // Очищаем массив вражеских пуль
        }
        
        const corpseArray = isBattleMode ? s.battle.deathCorpses : s.deathCorpses;
        for (let i = enemiesArray.length - 1; i >= 0; i--) {
          const enemy = enemiesArray[i];
          if (!enemy || enemy.x === undefined || enemy.y === undefined) {
            enemiesArray.splice(i, 1);
            continue;
          }
          if (enemy.isBoss) continue;
          spawnCorpse(corpseArray, enemy, (enemy.radius || CONFIG.SPIDER_RADIUS) * scale);
          // Создаем партиклы смерти врага
          for (let k = 0; k < CONFIG.DEATH_PARTICLES_COUNT; k++) {
            const a = Math.random() * Math.PI * 2;
            const speed = CONFIG.DEATH_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.DEATH_PARTICLES_SPEED_MAX - CONFIG.DEATH_PARTICLES_SPEED_MIN);
            particlesArray.push({
              x: enemy.x, y: enemy.y,
              vx: Math.cos(a) * speed * scale,
              vy: Math.sin(a) * speed * scale,
              life: CONFIG.DEATH_PARTICLES_LIFE,
              maxLife: CONFIG.DEATH_PARTICLES_LIFE,
              color: CONFIG.DEATH_PARTICLES_COLOR || '#ff4444',
            });
          }
          enemiesArray.splice(i, 1);
        }
        
        // Показываем попап
        showUpgradePopup('ПОСЛЕДНЯЯ ЖИЗНЬ АКТИВИРОВАНА!', '#ff0000');
        // Даем неуязвимость как при потере жизни
        s.player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME + s.upgrades.retreat;
        return true; // Урон предотвращен
      }

      // Обычный урон - отнимаем жизнь
      s.player.lives--;
      Sounds.hitonplayer();

      // Отступление: дополнительная неуязвимость
      const retreatBonus = s.upgrades.retreat;
      s.player.invulnerable = CONFIG.PLAYER_INVULNERABLE_TIME + retreatBonus;

      // Отражение при получении урона
      if (s.upgrades.reflection) {
        fireReflectionBullets(s, isBattleMode);
      }

      return true;
    }

    function fireReflectionBullets(s, isBattleMode) {
      const scale = isBattleMode ? BATTLE_SCALE : 1;
      const bulletsArray = isBattleMode ? s.battle.bullets : s.bullets;
      const enemiesArray = isBattleMode ? s.battle.activeSpiders : s.activeSpiders;
      const playerX = isBattleMode ? s.battle.player.x : s.player.x;
      const playerY = isBattleMode ? s.battle.player.y : s.player.y;

      const weapon = getActiveWeapon(s);
      if (!weapon) return;

      // Находим до 3 ближайших врагов
      const nearestEnemies = [];
      for (const enemy of enemiesArray) {
        const dist = Math.hypot(enemy.x - playerX, enemy.y - playerY);
        nearestEnemies.push({ enemy, dist });
      }
      nearestEnemies.sort((a, b) => a.dist - b.dist);

      const targets = nearestEnemies.slice(0, 3);
      const bulletSpeed = weapon.bulletSpeed * s.upgrades.bulletSpeedMult * scale;

      for (const target of targets) {
        const angle = Math.atan2(target.enemy.y - playerY, target.enemy.x - playerX);
        const damage = weapon.damage + s.upgrades.damage;
        bulletsArray.push({
          x: playerX, y: playerY,
          vx: Math.cos(angle) * bulletSpeed,
          vy: Math.sin(angle) * bulletSpeed,
          life: s.upgrades.infiniteRange
            ? 999999
            : (() => {
                let baseLife = (weapon.range != null ? weapon.range * RANGE_SCALE * scale : CONFIG.BULLET_LIFE * weapon.bulletSpeed) / bulletSpeed * (s.upgrades.ricochet ? 1.5 : 1);
                
                // Дальнобойщик: +20% дальности за каждую открытую клетку в бою
                if (s.upgrades.longRange && s.battle && s.battle.openCells) {
                  const roomCount = s.battle.openCells.size;
                  baseLife *= (1 + 0.20 * roomCount);
                }
                
                return baseLife;
              })(),
          damage: damage,
          penetrate: s.upgrades.infinitePenetrate ? Infinity : weapon.penetrate + s.upgrades.penetrate,
          hitCount: 0,
          isCrit: false,
          enhancedPierceActive: false,
          ricochet: s.upgrades.ricochet ? true : false,
        });
      }
    }

    // ============================================================
    // SHOOT
    // ============================================================
    function getActiveWeapon(s) {
      const weaponId = s.weaponSlots[s.activeSlot];
      return weaponId ? WEAPON_DEFS[weaponId] : null;
    }

    function createBullet(s, weapon, baseAngle, bulletSpeed) {
      const isCrit = Math.random() < s.upgrades.critChance;
      let damage = weapon.damage + s.upgrades.damage;
      if (isCrit) damage *= 2;
      screenShake = { amount: weapon.shakeAmount || CONFIG.SHAKE_AMOUNT, angle: baseAngle };
      let bulletLife = s.upgrades.infiniteRange
        ? 999999
        : (weapon.range != null ? weapon.range * RANGE_SCALE : CONFIG.BULLET_LIFE * weapon.bulletSpeed) / bulletSpeed * (s.upgrades.ricochet ? 1.5 : 1);
      
      // Дальнобойщик: +20% дальности за каждую открытую клетку в бою
      if (s.upgrades.longRange && s.battle && s.battle.openCells) {
        const roomCount = s.battle.openCells.size;
        bulletLife *= (1 + 0.20 * roomCount);
      }
      s.bullets.push({
        x: s.player.x, y: s.player.y,
        vx: Math.cos(baseAngle) * bulletSpeed,
        vy: Math.sin(baseAngle) * bulletSpeed,
        life: bulletLife,
        damage: damage,
        penetrate: s.upgrades.infinitePenetrate ? Infinity : weapon.penetrate + s.upgrades.penetrate,
        hitCount: 0,
        isCrit: isCrit,
        enhancedPierceActive: false,
        ricochet: s.upgrades.ricochet ? true : false,
      });
    }

    function getBurstStepDelay(weapon, burstSizeTotal) {
      if (!weapon.burstDuration || burstSizeTotal <= 1) return 0;
      return weapon.burstDuration / (burstSizeTotal - 1);
    }

    function shoot(s) {
      // Проверяем кд основного выстрела и кд между пулями в очереди
      if (s.shootCooldown > 0) return;

      const weapon = getActiveWeapon(s);
      if (!weapon) return;

      // Проверяем, есть ли активная очередь карабина
      if (s.burstRemaining > 0 && s.burstWeaponId === weapon.id) {
        // Продолжаем очередь - проверяем кд между пулями
        if (s.burstCooldown > 0) return;
      } else if (s.burstRemaining > 0) {
        // Сменили оружие во время очереди - сбрасываем
        s.burstRemaining = 0;
        s.burstWeaponId = null;
        s.burstCooldown = 0;
      }

      const killAccelMult = s.upgrades.killAccel ? Math.max(0.1, 1 - s.upgrades.killAccelPercent / 100) : 1.0;
      const cooldown = weapon.cooldown * s.upgrades.cooldownMult * killAccelMult;
      Sounds.shot(weapon.id);

      const dx = s.mouse.x - s.player.x;
      const dy = s.mouse.y - s.player.y;
      const baseAngle = Math.atan2(dy, dx);

      const isBurstWeapon = weapon.burstSize && weapon.burstSize > 1;
      const pellets = isBurstWeapon ? weapon.pellets : weapon.pellets + s.upgrades.pellets;
      const burstSizeTotal = isBurstWeapon ? weapon.burstSize + s.upgrades.pellets : weapon.burstSize;
      const burstStepDelay = getBurstStepDelay(weapon, burstSizeTotal);
      let totalSpread = weapon.spread * s.upgrades.spreadMult;
      const bulletSpeed = weapon.bulletSpeed * s.upgrades.bulletSpeedMult;
      
      // Снайпер: максимальная точность при 2 комнатах, +10% разброса за каждую дополнительную
      if (s.upgrades.sniper && s.battle && s.battle.openCells) {
        const roomCount = s.battle.openCells.size;
        if (roomCount <= 2) {
          totalSpread = 0; // Максимальная точность при 2 комнатах или меньше
        } else {
          const extraRooms = roomCount - 2;
          totalSpread *= (1 + 0.10 * extraRooms); // +10% разброса за каждую дополнительную комнату
        }
      }

      for (let i = 0; i < pellets; i++) {
        const spread = (Math.random() - 0.5) * totalSpread;
        const a = baseAngle + spread;
        createBullet(s, weapon, a, bulletSpeed);
      }

      // Проверяем, начинаем ли очередь карабина
      if (isBurstWeapon) {
        if (s.burstRemaining === 0) {
          // Начинаем новую очередь
          s.burstRemaining = burstSizeTotal - 1;
          s.burstWeaponId = weapon.id;
          s.burstCooldown = burstStepDelay;
          s.shootCooldown = 0; // Не блокируем, ждём burstCooldown
        } else {
          // Продолжаем очередь
          s.burstRemaining--;
          if (s.burstRemaining > 0) {
            s.burstCooldown = burstStepDelay;
            s.shootCooldown = 0; // Не блокируем, ждём burstCooldown
          } else {
            // Очередь закончилась
            s.burstWeaponId = null;
            s.shootCooldown = cooldown; // Теперь кд между очередями
            s.maxShootCooldown = cooldown;
          }
        }
      } else {
        s.shootCooldown = cooldown;
        s.maxShootCooldown = cooldown;
      }

      // Particle muzzle flash
      weaponRecoil = 1.0;
      for (let i = 0; i < CONFIG.MUZZLE_PARTICLES_COUNT; i++) {
        const a = baseAngle + (Math.random() - 0.5) * CONFIG.MUZZLE_PARTICLES_SPREAD;
        s.particles.push({
          x: s.player.x, y: s.player.y,
          vx: Math.cos(a) * (CONFIG.MUZZLE_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.MUZZLE_PARTICLES_SPEED_MAX - CONFIG.MUZZLE_PARTICLES_SPEED_MIN)),
          vy: Math.sin(a) * (CONFIG.MUZZLE_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.MUZZLE_PARTICLES_SPEED_MAX - CONFIG.MUZZLE_PARTICLES_SPEED_MIN)),
          life: CONFIG.MUZZLE_PARTICLES_LIFE, maxLife: CONFIG.MUZZLE_PARTICLES_LIFE, color: '#ffff00',
        });
      }
    }

    // ============================================================
    // WEAPON PICKUP
    // ============================================================
    // px, py — координаты частиц (battle или play в зависимости от контекста)
    // dropPlayX, dropPlayY — play-координаты куда бросить вытесненное оружие
    function pickupWeapon(s, weaponId, particles, px, py, scale, dropPlayX, dropPlayY) {
      if (scale === undefined) scale = 1;
      // Есть свободный слот в пределах maxSlots
      let freeSlot = -1;
      for (let i = 0; i < s.maxSlots; i++) {
        if (!s.weaponSlots[i]) { freeSlot = i; break; }
      }

      if (freeSlot >= 0) {
        // Есть свободный слот — кладём туда и сразу выбираем
        s.weaponSlots[freeSlot] = weaponId;
        s.activeSlot = freeSlot;
      } else {
        // Нет свободных — сбрасываем оружие в активном слоте на землю
        const droppedId = s.weaponSlots[s.activeSlot];
        if (droppedId) {
          const dox = dropPlayX !== undefined ? dropPlayX : px;
          const doy = dropPlayY !== undefined ? dropPlayY : py;
          s.droppedWeapons.push({ x: dox, y: doy, weaponId: droppedId });
        }
        s.weaponSlots[s.activeSlot] = weaponId;
      }

      // Звук подбора оружия
      Sounds.weaponcollect();

      // Партиклы
      const wDef = WEAPON_DEFS[weaponId];
      for (let i = 0; i < CONFIG.PICKUP_PARTICLES_COUNT; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({
          x: px, y: py,
          vx: Math.cos(a) * CONFIG.PICKUP_PARTICLES_SPEED * scale, vy: Math.sin(a) * CONFIG.PICKUP_PARTICLES_SPEED * scale,
          life: CONFIG.PICKUP_PARTICLES_LIFE, maxLife: CONFIG.PICKUP_PARTICLES_LIFE, color: wDef ? wDef.color : '#ffffff',
        });
      }

      playerProgress.weaponSlots = [...s.weaponSlots];
      playerProgress.activeSlot = s.activeSlot;
      playerProgress.maxSlots = s.maxSlots;
      drawHUD(s);
    }

    // ============================================================
    // BATTLE UPDATE
    // ============================================================
    function updateBattle(s, dt) {
      const b = s.battle;
      if (!b) return;

      s.time += dt;

      // Таймер попапа апгрейда
      if (upgradePopupTimer > 0) {
        upgradePopupTimer -= dt;
        if (upgradePopupTimer <= 0) {
          document.getElementById('upgrade-popup').classList.remove('visible');
        }
      }

      // Инвулнерабельность
      if (s.player.invulnerable > 0) s.player.invulnerable -= dt;

      // Кулдаун деша
      if (s.player.dashCooldown > 0) s.player.dashCooldown -= dt;
      updatePlayerDashEffects(s.player, b.player.x, b.player.y, dt, BATTLE_SCALE, b.particles);

      // Таймер заморозки врагов
      if (b.freezeTimer > 0) {
        b.freezeTimer -= dt;
        if (b.freezeTimer <= 0) {
          b.freezeTimer = 0;
        }
      }

      // Обработка деша в battle mode
      if (s.player.isDashing) {
        const dashSpeed = CONFIG.PLAYER_DASH_SPEED * BATTLE_SCALE;
        const dashDist = CONFIG.PLAYER_DASH_DISTANCE * BATTLE_SCALE;
        const dashMove = dashSpeed * dt;
        s.player.dashProgress += dashMove;

        let newX = b.player.x + s.player.dashDirX * dashMove;
        let newY = b.player.y + s.player.dashDirY * dashMove;

        // Проверяем столкновение со стенами (battle cell check)
        const newCellX = Math.floor(newX / BATTLE_CELL_PX);
        const newCellY = Math.floor(newY / BATTLE_CELL_PX);
        const mapNewX = newCellX + b.cellOffsetX;
        const mapNewY = newCellY + b.cellOffsetY;
        if (!b.openCells.has(cellKey(mapNewX, mapNewY))) {
          // Ударились о стену - прекращаем деш
          s.player.isDashing = false;
        } else {
          b.player.x = newX;
          b.player.y = newY;
        }

        // Проверяем завершение деша по дистанции
        if (s.player.dashProgress >= dashDist) {
          s.player.isDashing = false;
        }

        // Проверка границ battle-локации
        const pr = CONFIG.PLAYER_RADIUS * BATTLE_SCALE;
        b.player.x = Math.max(pr, Math.min(b.player.x, b.width - pr));
        b.player.y = Math.max(pr, Math.min(b.player.y, b.height - pr));

        // Анимация деша - бег в направлении деша
        updatePlayerAnim(s.player.dashDirX, s.player.dashDirY, s.mouse.x - b.player.x, s.mouse.y - b.player.y, dt);
      } else {
        // Обычное движение игрока в battle mode (масштабированная скорость)
        let speedMult = s.upgrades.speedMult;

        // Боевое ускорение: модификатор скорости от количества открытых комнат
        if (s.upgrades.battleSpeed && b.openCells) {
          const roomCount = b.openCells.size;
          if (roomCount === 2) {
            speedMult *= 1.25; // +25% скорости при 2 комнатах
          } else if (roomCount > 2) {
            const penalty = 0.10 * (roomCount - 2); // -10% за каждую комнату сверх двух
            speedMult *= Math.max(0.1, 1 - penalty); // Не даем скорости упасть ниже 10%
          }
        }

        const spd = CONFIG.PLAYER_SPEED * speedMult * BATTLE_SCALE;
        let mvx = 0, mvy = 0;
        const k = s.keys;
        if (k['w'] || k['W'] || k['ц'] || k['Ц'] || k['ArrowUp'] || k['arrowup']) mvy -= 1;
        if (k['s'] || k['S'] || k['ы'] || k['Ы'] || k['ArrowDown'] || k['arrowdown']) mvy += 1;
        if (k['a'] || k['A'] || k['ф'] || k['Ф'] || k['ArrowLeft'] || k['arrowleft']) mvx -= 1;
        if (k['d'] || k['D'] || k['в'] || k['В'] || k['ArrowRight'] || k['arrowright']) mvx += 1;
        if (mvx && mvy) { mvx *= Math.SQRT1_2; mvy *= Math.SQRT1_2; }
        if (mvx !== 0 || mvy !== 0) Sounds.footstep(dt); else Sounds._footstepTimer = 0;

        // Обновление анимации персонажа
        updatePlayerAnim(mvx, mvy, s.mouse.x - b.player.x, s.mouse.y - b.player.y, dt);

        const pr = CONFIG.PLAYER_RADIUS * BATTLE_SCALE;
        let npx = b.player.x + mvx * spd * dt;
        let npy = b.player.y + mvy * spd * dt;

        // Проверка границ battle-локации
        npx = Math.max(pr, Math.min(npx, b.width - pr));
        npy = Math.max(pr, Math.min(npy, b.height - pr));

        // Проверка - движение только по открытым клеткам battle
        const tcX = Math.floor(npx / BATTLE_CELL_PX);
        const tcY = Math.floor(b.player.y / BATTLE_CELL_PX);
        const mapX = tcX + b.cellOffsetX;
        const mapY = tcY + b.cellOffsetY;
        if (b.openCells.has(cellKey(mapX, mapY))) {
          b.player.x = npx;
        }

        const tcY2 = Math.floor(npy / BATTLE_CELL_PX);
        const tcY2X = Math.floor(b.player.x / BATTLE_CELL_PX);
        const mapY2X = tcY2X + b.cellOffsetX;
        const mapY2Y = tcY2 + b.cellOffsetY;
        if (b.openCells.has(cellKey(mapY2X, mapY2Y))) {
          b.player.y = npy;
        }
      }

      // Сбор сердечек в battle
      for (const heart of b.hearts) {
        if (!heart.collected) {
          const dist = Math.hypot(b.player.x - heart.x, b.player.y - heart.y);
          if (dist < CONFIG.PLAYER_RADIUS * BATTLE_SCALE + CONFIG.PICKUP_DISTANCE * BATTLE_SCALE) {
            heart.collected = true;
            s.player.lives += CONFIG.LIVES_PER_HEART;
            Sounds.heartcollect();
            addParticles(heart.x, heart.y, CONFIG.PICKUP_PARTICLES_COUNT, CONFIG.PICKUP_PARTICLES_SPEED, CONFIG.PICKUP_PARTICLES_LIFE, '#ff6b9d');
          }
        }
      }

      // Сбор ключей в battle
      for (const keyObj of b.keys) {
        if (!keyObj.collected) {
          const dist = Math.hypot(b.player.x - keyObj.x, b.player.y - keyObj.y);
          if (dist < CONFIG.PLAYER_RADIUS * BATTLE_SCALE + CONFIG.PICKUP_DISTANCE * BATTLE_SCALE) {
            keyObj.collected = true;
            Sounds.keycollect();
            addParticles(keyObj.x, keyObj.y, CONFIG.PICKUP_PARTICLES_COUNT, CONFIG.PICKUP_PARTICLES_SPEED, CONFIG.PICKUP_PARTICLES_LIFE, '#ffd700');
          }
        }
      }

      // Сбор апгрейдов в battle
      for (const upg of b.upgrades) {
        if (!upg.collected) {
          const dist = Math.hypot(b.player.x - upg.x, b.player.y - upg.y);
          if (dist < CONFIG.PLAYER_RADIUS * BATTLE_SCALE + CONFIG.PICKUP_DISTANCE * BATTLE_SCALE) {
            upg.collected = true;
            const upgDef = UPGRADE_TYPES.find(u => u.id === upg.upgradeType);
            const color = upgDef ? upgDef.color : '#ffcc00';
            if (upgDef) showUpgradePopup(upgDef.label, upgDef.color);
            Sounds.upgradecollect();
            addParticles(upg.x, upg.y, CONFIG.PICKUP_PARTICLES_COUNT, CONFIG.PICKUP_PARTICLES_SPEED, CONFIG.PICKUP_PARTICLES_LIFE, color);
          }
        }
      }

      // Сбор проклятых сундуков в battle
      for (const bc of (b.chests || [])) {
        if (!bc.collected) {
          const dist = Math.hypot(b.player.x - bc.x, b.player.y - bc.y);
          if (dist < CONFIG.PLAYER_RADIUS * BATTLE_SCALE + CONFIG.PICKUP_DISTANCE * BATTLE_SCALE) {
            const chestRef = (s.chestObjs || []).find(c => c.cellKey === bc.originalCellKey);
            if (chestRef) {
              openCursedChoice(s, chestRef);
              bc.collected = true;
            }
            break;
          }
        }
      }

      // Синхронизируем собранные предметы с основным состоянием
      syncBattleCollectibles(s);

      // Стрельба в battle mode
      s.shootCooldown = Math.max(0, s.shootCooldown - dt);
      s.burstCooldown = Math.max(0, s.burstCooldown - dt);
      // Стреляем если: (1) зажата кнопка и нет кд, или (2) активна очередь карабина
      const weapon = getActiveWeapon(s);
      const isBurstActive = weapon && weapon.burstSize && weapon.burstSize > 1 && s.burstRemaining > 0 && s.burstWeaponId === weapon.id;
      if ((mouseHeld || isBurstActive) && s.shootCooldown <= 0) shootBattle(s);

      // Обновление пуль в battle
      for (let i = b.bullets.length - 1; i >= 0; i--) {
        const bullet = b.bullets[i];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;

        // Проверка границ battle
        if (bullet.life <= 0) {
          Sounds.wallhit(dt);
          for (let k = 0; k < CONFIG.WALL_HIT_PARTICLES_COUNT; k++) {
            const a = Math.random() * Math.PI * 2;
            b.particles.push({
              x: bullet.x, y: bullet.y,
              vx: Math.cos(a) * CONFIG.WALL_HIT_PARTICLES_SPEED * BATTLE_SCALE,
              vy: Math.sin(a) * CONFIG.WALL_HIT_PARTICLES_SPEED * BATTLE_SCALE,
              life: CONFIG.WALL_HIT_PARTICLES_LIFE, maxLife: CONFIG.WALL_HIT_PARTICLES_LIFE, color: '#88aaff',
            });
          }
          b.bullets.splice(i, 1);
          continue;
        }
        const outOfBounds = bullet.x < 0 || bullet.x > b.width || bullet.y < 0 || bullet.y > b.height;
        let bouncedThisFrame = false;
        if (outOfBounds) {
          if (bullet.ricochet && !bullet._ricocheted) {
            bullet._ricocheted = true;
            bouncedThisFrame = true;
            if (bullet.x < 0 || bullet.x > b.width) {
              bullet.vx = -bullet.vx;
              bullet.x = bullet.x < 0 ? 0.1 : b.width - 0.1;
            }
            if (bullet.y < 0 || bullet.y > b.height) {
              bullet.vy = -bullet.vy;
              bullet.y = bullet.y < 0 ? 0.1 : b.height - 0.1;
            }
            bullet.hitSpiders = undefined;
            Sounds.wallhit(dt);
            for (let k = 0; k < 5; k++) {
              const a = Math.random() * Math.PI * 2;
              b.particles.push({
                x: bullet.x, y: bullet.y,
                vx: Math.cos(a) * 40 * BATTLE_SCALE, vy: Math.sin(a) * 40 * BATTLE_SCALE,
                life: 0.3, maxLife: 0.3, color: '#22ffdd',
              });
            }
          } else {
            Sounds.wallhit(dt);
            for (let k = 0; k < 5; k++) {
              const a = Math.random() * Math.PI * 2;
              b.particles.push({
                x: bullet.x, y: bullet.y,
                vx: Math.cos(a) * 40 * BATTLE_SCALE, vy: Math.sin(a) * 40 * BATTLE_SCALE,
                life: 0.3, maxLife: 0.3, color: '#888888',
              });
            }
            b.bullets.splice(i, 1);
            continue;
          }
        }

        // Проверка столкновения со стенами (вне открытых клеток)
        const bulletCellX = Math.floor(bullet.x / BATTLE_CELL_PX) + b.cellOffsetX;
        const bulletCellY = Math.floor(bullet.y / BATTLE_CELL_PX) + b.cellOffsetY;
        if (!bouncedThisFrame && !b.openCells.has(cellKey(bulletCellX, bulletCellY))) {
          if (bullet.ricochet && !bullet._ricocheted) {
            bullet._ricocheted = true;
            const prevX = bullet.x - bullet.vx * dt;
            const prevY = bullet.y - bullet.vy * dt;
            const prevCellXx = Math.floor(bullet.x / BATTLE_CELL_PX) + b.cellOffsetX;
            const prevCellXy = Math.floor(prevY / BATTLE_CELL_PX) + b.cellOffsetY;
            const prevCellYx = Math.floor(prevX / BATTLE_CELL_PX) + b.cellOffsetX;
            const prevCellYy = Math.floor(bullet.y / BATTLE_CELL_PX) + b.cellOffsetY;
            const xOk = b.openCells.has(cellKey(prevCellXx, prevCellXy));
            const yOk = b.openCells.has(cellKey(prevCellYx, prevCellYy));
            if (xOk) { bullet.vy = -bullet.vy; bullet.y = prevY; }
            else if (yOk) { bullet.vx = -bullet.vx; bullet.x = prevX; }
            else { bullet.vx = -bullet.vx; bullet.vy = -bullet.vy; bullet.x = prevX; bullet.y = prevY; }
            bullet.hitSpiders = undefined;
            Sounds.wallhit(dt);
            for (let k = 0; k < 5; k++) {
              const a = Math.random() * Math.PI * 2;
              b.particles.push({
                x: bullet.x, y: bullet.y,
                vx: Math.cos(a) * 40 * BATTLE_SCALE, vy: Math.sin(a) * 40 * BATTLE_SCALE,
                life: 0.3, maxLife: 0.3, color: '#22ffdd',
              });
            }
          } else {
            // Пуля в стене - уничтожаем
            Sounds.wallhit(dt);
            for (let k = 0; k < 5; k++) {
              const a = Math.random() * Math.PI * 2;
              b.particles.push({
                x: bullet.x, y: bullet.y,
                vx: Math.cos(a) * 40 * BATTLE_SCALE, vy: Math.sin(a) * 40 * BATTLE_SCALE,
                life: 0.3, maxLife: 0.3, color: '#888888',
              });
            }
            b.bullets.splice(i, 1);
            continue;
          }
        } else {
          bullet._ricocheted = false;
        }

        // Попадание во врагов (масштабированные)
        for (let j = b.activeSpiders.length - 1; j >= 0; j--) {
          const g = b.activeSpiders[j];
          if (bullet.hitSpiders && bullet.hitSpiders.has(j)) continue; // уже попадали в этого
          const dist = Math.hypot(bullet.x - g.x, bullet.y - g.y);
          if (dist < ((g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.BULLET_RADIUS) * BATTLE_SCALE) {
            const damage = bullet.damage || CONFIG.BULLET_DAMAGE;
            g.hp -= damage;
            g.hitFlash = CONFIG.ENEMY_HIT_FLASH_DURATION;
            if (!g.isBoss) g.stunTimer = CONFIG.ENEMY_STUN_DURATION;
            Sounds.hit();
            spawnDamageNumber(g.x, g.y - CONFIG.SPIDER_RADIUS * BATTLE_SCALE, damage, bullet.isCrit);
            // Green blood particles - fly in bullet direction
            const bulletAngle = Math.atan2(bullet.vy, bullet.vx);
            for (let k = 0; k < CONFIG.HIT_PARTICLES_COUNT; k++) {
              const spreadAngle = bulletAngle + (Math.random() - 0.5) * CONFIG.HIT_PARTICLES_SPREAD;
              const speed = CONFIG.HIT_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.HIT_PARTICLES_SPEED_MAX - CONFIG.HIT_PARTICLES_SPEED_MIN);
              b.particles.push({
                x: g.x, y: g.y,
                vx: Math.cos(spreadAngle) * speed * BATTLE_SCALE,
                vy: Math.sin(spreadAngle) * speed * BATTLE_SCALE,
                life: CONFIG.HIT_PARTICLES_LIFE, maxLife: CONFIG.HIT_PARTICLES_LIFE, color: CONFIG.HIT_PARTICLES_COLOR,
              });
            }
            // Усиленное пробитие: пуля пробила врага -> 50% шанс двойного урона следующему
            if (bullet.hitCount > 0 && s.upgrades.enhancedPierce && bullet.enhancedPierceActive) {
              bullet.damage *= 2;
            }
            if (g.hp <= 0) {
              spawnCorpse(b.deathCorpses, g, (g.radius || CONFIG.SPIDER_RADIUS) * BATTLE_SCALE);
              b.activeSpiders.splice(j, 1);
              for (let k = 0; k < CONFIG.DEATH_PARTICLES_COUNT; k++) {
                const a = Math.random() * Math.PI * 2;
                b.particles.push({
                  x: g.x, y: g.y,
                  vx: Math.cos(a) * (CONFIG.DEATH_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.DEATH_PARTICLES_SPEED_MAX - CONFIG.DEATH_PARTICLES_SPEED_MIN)),
                  vy: Math.sin(a) * (CONFIG.DEATH_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.DEATH_PARTICLES_SPEED_MAX - CONFIG.DEATH_PARTICLES_SPEED_MIN)),
                  life: CONFIG.DEATH_PARTICLES_LIFE, maxLife: CONFIG.DEATH_PARTICLES_LIFE, color: k % 2 === 0 ? '#44cc22' : '#88ff44',
                });
              }
              // Оружейный разгон: +0.2% за убийство, макс 90%
              if (s.upgrades.killAccel) {
                s.upgrades.killAccelPercent = Math.min(90, s.upgrades.killAccelPercent + 0.1);
                playerProgress.upgrades.killAccelPercent = s.upgrades.killAccelPercent;
              }
              // Распухший: выстрел при смерти в игрока (масштабированный)
              if (g.type === 'bloated') {
                const pdx = b.player.x - g.x;
                const pdy = b.player.y - g.y;
                const pdist = Math.hypot(pdx, pdy);
                if (pdist > 0) {
                  b.enemyBullets.push({
                    x: g.x, y: g.y,
                    vx: (pdx / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED * BATTLE_SCALE,
                    vy: (pdy / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED * BATTLE_SCALE,
                    life: 6,
                  });
                }
              }
              // Босс убит - открываем выбор проклятого улучшения
              if (g.isBoss && b.isBossBattle) {
                s.bossDefeated = true;
                Sounds.stopBossMusic();
                showUpgradePopup('БОСС ПОБЕЖДЕН!', '#ff4400');
                openCursedChoice(s, null);
                return;
              }
            }
            // Логика пробития: отслеживаем сколько врагов прошла пуля
            bullet.hitCount++;
            if (!bullet.hitSpiders) bullet.hitSpiders = new Set();
            bullet.hitSpiders.add(j);
            // Усиленное пробитие: 50% шанс активировать после первого пробития
            if (bullet.hitCount === 1 && s.upgrades.enhancedPierce && !bullet.enhancedPierceActive) {
              bullet.enhancedPierceActive = Math.random() < 0.5;
            }
            // Пуля уничтожается если hitCount > penetrate (0=1 враг, 2=3 врага)
            if (bullet.hitCount > bullet.penetrate) {
              b.bullets.splice(i, 1);
              break;
            }
          }
        }
      }

      // Обновление врагов в battle
      for (let i = b.activeSpiders.length - 1; i >= 0; i--) {
        const g = b.activeSpiders[i];
        if (!g || g.x === undefined || g.y === undefined) continue;

        // Hit flash таймер
        if (g.hitFlash > 0) g.hitFlash -= dt;

        // Stun таймер - уменьшаем
        if (g.stunTimer > 0) g.stunTimer -= dt;

        // Проверка на застревание (кокон, плевака, бык — могут долго стоять на месте по задумке)
        if (g.type !== 'cocoon' && g.type !== 'plevaka' && g.type !== 'shooter' && g.type !== 'bull') {
          if (g.lastX === undefined) { g.lastX = g.x; g.lastY = g.y; g.stuckTimer = 0; }
          const moved = Math.hypot(g.x - g.lastX, g.y - g.lastY);
          if (moved < 1) {
            g.stuckTimer += dt;
            if (g.stuckTimer >= 7) {
              // Враг застрял на 7 секунд - умирает
              spawnCorpse(b.deathCorpses, g, (g.radius || CONFIG.SPIDER_RADIUS) * BATTLE_SCALE);
              b.activeSpiders.splice(i, 1);
              for (let k = 0; k < CONFIG.DEATH_PARTICLES_COUNT; k++) {
                const speed = CONFIG.DEATH_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.DEATH_PARTICLES_SPEED_MAX - CONFIG.DEATH_PARTICLES_SPEED_MIN);
                const color = k % 2 === 0 ? '#44cc22' : '#88ff44';
                addParticles(g.x, g.y, 1, speed, CONFIG.DEATH_PARTICLES_LIFE, color);
              }
              continue;
            }
          } else {
            g.stuckTimer = 0;
            g.lastX = g.x;
            g.lastY = g.y;
          }
        }

        const dx = b.player.x - g.x;
        const dy = b.player.y - g.y;
        const dist = Math.hypot(dx, dy);

        if (g.type === 'plevaka' || g.type === 'shooter') {
          // Плевака
          const isStunned = g.stunTimer > 0;
          if (!isStunned && b.freezeTimer <= 0 && dist > SHOOTER_STOP_DIST * BATTLE_SCALE && dist > 0) {
            const spd = CONFIG.SHOOTER_SPEED * BATTLE_SCALE;
            let newX = g.x + (dx / dist) * spd * dt;
            let newY = g.y + (dy / dist) * spd * dt;
            // Проверка стен battle-зоны
            const newCellX = Math.floor(newX / BATTLE_CELL_PX) + b.cellOffsetX;
            const newCellY = Math.floor(newY / BATTLE_CELL_PX) + b.cellOffsetY;
            if (b.openCells.has(cellKey(newCellX, newCellY))) {
              g.x = newX;
              g.y = newY;
            }
          }
          if (g.shootCd > 0) g.shootCd -= dt;
          if (dist <= SHOOTER_SHOOT_RANGE * BATTLE_SCALE && g.shootCd <= 0) {
            g.shootCd = CONFIG.SHOOTER_SHOOT_CD;
            if (dist > 0) {
              b.enemyBullets.push({
                x: g.x, y: g.y,
                vx: (dx / dist) * CONFIG.SHOOTER_BULLET_SPEED * BATTLE_SCALE,
                vy: (dy / dist) * CONFIG.SHOOTER_BULLET_SPEED * BATTLE_SCALE,
                life: 6,
              });
            }
          }
        } else if (g.type === 'bull') {
          // Бык: FSM — chase → prepare → dash → rest → chase
          const effectiveRadius = (g.radius || CONFIG.BULL_RADIUS) * BATTLE_SCALE;
          const hitDist = effectiveRadius + CONFIG.PLAYER_RADIUS * BATTLE_SCALE;
          const chargeDist = BULL_CHARGE_DIST * BATTLE_SCALE;
          const dashDist = BULL_DASH_DISTANCE * BATTLE_SCALE;
          
          if (!g.state) g.state = 'chase';
          if (g.stateTimer === undefined) g.stateTimer = 0;
          
          switch (g.state) {
            case 'chase':
              // Идёт к игроку пока не достигнет дистанции CHARGE_DIST
              if (g.stunTimer <= 0 && b.freezeTimer <= 0 && dist > chargeDist && dist > 0) {
                const spd = CONFIG.BULL_SPEED * BATTLE_SCALE;
                let newX = g.x + (dx / dist) * spd * dt;
                let newY = g.y + (dy / dist) * spd * dt;
                // Проверка стен battle-зоны
                const newCellX = Math.floor(newX / BATTLE_CELL_PX) + b.cellOffsetX;
                const newCellY = Math.floor(newY / BATTLE_CELL_PX) + b.cellOffsetY;
                if (b.openCells.has(cellKey(newCellX, newCellY))) {
                  g.x = newX;
                  g.y = newY;
                }
              } else if (dist <= chargeDist) {
                // Переход в подготовку
                g.state = 'prepare';
                g.stateTimer = CONFIG.BULL_PREPARE_TIME;
              }
              break;
              
            case 'prepare':
              // Стоит на месте, готовится к рывку
              g.stateTimer -= dt;
              if (g.stateTimer <= 0) {
                // Запоминаем позицию игрока в момент окончания подготовки
                g.state = 'dash';
                const ddx = b.player.x - g.x;
                const ddy = b.player.y - g.y;
                const ddist = Math.hypot(ddx, ddy);
                if (ddist > 0) {
                  g.dashDirX = ddx / ddist;
                  g.dashDirY = ddy / ddist;
                } else {
                  g.dashDirX = dx / dist;
                  g.dashDirY = dy / dist;
                }
                g.dashDistance = dashDist;
                g.stateTimer = 0; // счётчик пройденной дистанции
              }
              break;
              
            case 'dash':
              // Быстрый рывок - стан не прерывает рывок
              {
                const dashSpeed = CONFIG.BULL_SPEED * 3 * BATTLE_SCALE; // в 3 раза быстрее обычного
                const moveDist = dashSpeed * dt;
                let newX = g.x + g.dashDirX * moveDist;
                let newY = g.y + g.dashDirY * moveDist;
                
                // Проверяем столкновение со стенами battle-зоны
                const newCellX = Math.floor(newX / BATTLE_CELL_PX) + b.cellOffsetX;
                const newCellY = Math.floor(newY / BATTLE_CELL_PX) + b.cellOffsetY;
                
                let hitWall = false;
                if (!b.openCells.has(cellKey(newCellX, newCellY))) {
                  hitWall = true;
                }
                
                // Проверяем достижение максимальной дистанции рывка
                const moved = Math.hypot(newX - g.x, newY - g.y);
                g.stateTimer += moved;
                
                if (hitWall || g.stateTimer >= g.dashDistance) {
                  // Попали в стену или прошли полную дистанцию — переходим в отдых
                  g.state = 'rest';
                  g.stateTimer = CONFIG.BULL_REST_TIME;
                } else {
                  g.x = newX;
                  g.y = newY;
                }
                
                // Проверяем попадание в игрока во время рывка
                const newDist = Math.hypot(b.player.x - g.x, b.player.y - g.y);
                if (newDist < hitDist) {
                  dealPlayerDamage(s, true);
                  // Бык не исчезает, просто переходит в отдых
                  g.state = 'rest';
                  g.stateTimer = CONFIG.BULL_REST_TIME;
                }
              }
              break;
              
            case 'rest':
              // Отдых — стоит на месте
              g.stateTimer -= dt;
              if (g.stateTimer <= 0) {
                g.state = 'chase';
              }
              break;
          }
          
          // Проверка касания игрока (для состояний chase/rest)
          if (g.state !== 'dash' && dist < hitDist) {
            spawnCorpse(b.deathCorpses, g, (g.radius || CONFIG.BULL_RADIUS) * BATTLE_SCALE);
            dealPlayerDamage(s, true);
            b.activeSpiders.splice(i, 1);
            for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
              const a = Math.random() * Math.PI * 2;
              b.particles.push({
                x: b.player.x, y: b.player.y,
                vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED, vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
                life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444',
              });
            }
            continue;
          }
        } else if (g.type === 'buldyga') {
          // Булдыга: инерционное движение с нарастающей скоростью (масштабировано)
          if (g.currentSpeed === undefined) g.currentSpeed = CONFIG.BULDYGA_SPEED * BATTLE_SCALE;
          if (g.speedAccumulator === undefined) g.speedAccumulator = 0;
          if (g.vx === undefined) g.vx = 0;
          if (g.vy === undefined) g.vy = 0;

          // Ускорение каждую секунду
          g.speedAccumulator += dt;
          if (g.speedAccumulator >= 1.0) {
            const secondsPassed = Math.floor(g.speedAccumulator);
            g.currentSpeed += CONFIG.BULDYGA_SPEED_INCREMENT * BATTLE_SCALE * secondsPassed;
            g.speedAccumulator -= secondsPassed;
          }

          // Инерция: разгоняем vx/vy к целевому направлению
          const bulStunned = g.stunTimer > 0;
          if (!bulStunned && b.freezeTimer <= 0 && dist > 0) {
            const targetVx = (dx / dist) * g.currentSpeed;
            const targetVy = (dy / dist) * g.currentSpeed;
            const accel = CONFIG.BULDYGA_ACCEL * BATTLE_SCALE * dt;
            g.vx += (targetVx - g.vx) * Math.min(1, accel / g.currentSpeed);
            g.vy += (targetVy - g.vy) * Math.min(1, accel / g.currentSpeed);
          } else if (b.freezeTimer > 0) {
            g.vx *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * dt);
            g.vy *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * dt);
          }

          let newX = g.x + g.vx * dt;
          let newY = g.y + g.vy * dt;
          // Проверка стен battle-зоны
          const newCellX = Math.floor(newX / BATTLE_CELL_PX) + b.cellOffsetX;
          const newCellY = Math.floor(newY / BATTLE_CELL_PX) + b.cellOffsetY;
          if (b.openCells.has(cellKey(newCellX, newCellY))) {
            g.x = newX;
            g.y = newY;
          } else {
            g.vx *= -0.3;
            g.vy *= -0.3;
          }
          // Касание игрока (масштабированное)
          if (dist < ((g.radius || CONFIG.BULDYGA_RADIUS) + CONFIG.PLAYER_RADIUS) * BATTLE_SCALE) {
            spawnCorpse(b.deathCorpses, g, (g.radius || CONFIG.BULDYGA_RADIUS) * BATTLE_SCALE);
            dealPlayerDamage(s, true);
            b.activeSpiders.splice(i, 1);
            for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
              const a = Math.random() * Math.PI * 2;
              b.particles.push({
                x: b.player.x, y: b.player.y,
                vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED, vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
                life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444',
              });
            }
            continue;
          }
        } else if (g.type === 'bloated') {
          // Распухший: как солдат (масштабированный)
          let newX = g.x;
          let newY = g.y;
          if (g.stunTimer <= 0 && b.freezeTimer <= 0 && dist > 0) {
            const spd = CONFIG.BLOATED_SPEED * BATTLE_SCALE;
            newX += (dx / dist) * spd * dt;
            newY += (dy / dist) * spd * dt;
          }
          // Проверка стен battle-зоны
          const newCellX = Math.floor(newX / BATTLE_CELL_PX) + b.cellOffsetX;
          const newCellY = Math.floor(newY / BATTLE_CELL_PX) + b.cellOffsetY;
          if (b.openCells.has(cellKey(newCellX, newCellY))) {
            g.x = newX;
            g.y = newY;
          }
          // Касание игрока (масштабированное)
          if (dist < ((g.radius || CONFIG.BLOATED_RADIUS) + CONFIG.PLAYER_RADIUS) * BATTLE_SCALE) {
            dealPlayerDamage(s, true);
            b.activeSpiders.splice(i, 1);
            for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
              const a = Math.random() * Math.PI * 2;
              b.particles.push({
                x: b.player.x, y: b.player.y,
                vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED, vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
                life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444',
              });
            }
            continue;
          }
        } else if (g.type === 'cocoon') {
          // Кокон: стоит на месте, спавнит солдат (масштабированный)
          // Проверка стены - может быть вытолкнут другими врагами
          const cellX = Math.floor(g.x / BATTLE_CELL_PX) + b.cellOffsetX;
          const cellY = Math.floor(g.y / BATTLE_CELL_PX) + b.cellOffsetY;
          if (!b.openCells.has(cellKey(cellX, cellY))) {
            // Вытолкнули в стену - умирает
            b.activeSpiders.splice(i, 1);
            for (let k = 0; k < CONFIG.DEATH_PARTICLES_COUNT; k++) {
              const speed = CONFIG.DEATH_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.DEATH_PARTICLES_SPEED_MAX - CONFIG.DEATH_PARTICLES_SPEED_MIN);
              const color = k % 2 === 0 ? '#44cc22' : '#88ff44';
              addParticles(g.x, g.y, 1, speed, CONFIG.DEATH_PARTICLES_LIFE, color);
            }
            continue;
          }
          if (g.spawnTimer === undefined) g.spawnTimer = CONFIG.COCOON_SPAWN_INTERVAL;
          g.spawnTimer -= dt;
          if (g.spawnTimer <= 0) {
            g.spawnTimer = CONFIG.COCOON_SPAWN_INTERVAL;
            // Спавним солдата рядом с коконом
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnDist = ((g.radius || CONFIG.COCOON_RADIUS) + CONFIG.SPIDER_RADIUS + 5) * BATTLE_SCALE;
            b.activeSpiders.push({
              x: g.x + Math.cos(spawnAngle) * spawnDist,
              y: g.y + Math.sin(spawnAngle) * spawnDist,
              vx: 0, vy: 0,
              radius: CONFIG.SPIDER_RADIUS,
              hp: CONFIG.SPIDER_HP,
              visualScale: CONFIG.SPIDER_VISUAL_SCALE,
              type: 'soldier',
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
            });
          }
        } else if (g.type === 'boss_phase') {
          // Фазовый босс: чередует поведение по таймеру
          const bossDef = BOSS_DEFS[currentLevel] || BOSS_DEFS[1];

          // Вспомогательная функция перехода к следующей фазе
          const advancePhase = () => {
            g.phaseIndex = (g.phaseIndex + 1) % bossDef.phases.length;
            const nextPhase = bossDef.phases[g.phaseIndex];
            g.phaseTimer = nextPhase.duration || 0;
            g.dashCount = 0;
            g.state = 'chase';
            g.stateTimer = 0;
          };

          // Обновляем таймер фазы (только для тех, у кого есть duration)
          if (b.freezeTimer <= 0) {
            const cp = bossDef.phases[g.phaseIndex];
            if (cp.id !== 'bull_limited' && cp.duration !== undefined) {
              g.phaseTimer -= dt;
              if (g.phaseTimer <= 0) advancePhase();
            }
          }

          const currentPhase = bossDef.phases[g.phaseIndex] || bossDef.phases[0];
          const bossSpd = CONFIG.SPIDER_SPEED * (bossDef.speedMult || 1.0) * BATTLE_SCALE;
          let newX = g.x;
          let newY = g.y;

          if (currentPhase.id === 'pause') {
            // Фаза паузы: босс стоит, ничего не делает
          } else if (currentPhase.id === 'soldier') {
            // Фаза солдата: преследует игрока
            if (g.stunTimer <= 0 && b.freezeTimer <= 0 && dist > 0) {
              newX += (dx / dist) * bossSpd * dt;
              newY += (dy / dist) * bossSpd * dt;
            }
          } else if (currentPhase.id === 'buldyga') {
            // Фаза булдыги: инерционное движение с усиленным ускорением
            const accelMult = currentPhase.accelMult || 1.0;
            const frictionMult = currentPhase.frictionMult || 1.0;
            if (g.currentSpeed === undefined) g.currentSpeed = CONFIG.BULDYGA_SPEED * BATTLE_SCALE;
            if (g.speedAccumulator === undefined) g.speedAccumulator = 0;
            if (g.vx === undefined) g.vx = 0;
            if (g.vy === undefined) g.vy = 0;

            // Ускорение каждую секунду
            g.speedAccumulator += dt;
            if (g.speedAccumulator >= 1.0) {
              const secondsPassed = Math.floor(g.speedAccumulator);
              g.currentSpeed += CONFIG.BULDYGA_SPEED_INCREMENT * BATTLE_SCALE * secondsPassed;
              g.speedAccumulator -= secondsPassed;
            }

            const bulStunned = g.stunTimer > 0;
            if (!bulStunned && b.freezeTimer <= 0 && dist > 0) {
              const targetVx = (dx / dist) * g.currentSpeed;
              const targetVy = (dy / dist) * g.currentSpeed;
              const accel = CONFIG.BULDYGA_ACCEL * accelMult * BATTLE_SCALE * dt;
              g.vx += (targetVx - g.vx) * Math.min(1, accel / g.currentSpeed);
              g.vy += (targetVy - g.vy) * Math.min(1, accel / g.currentSpeed);
            } else if (b.freezeTimer > 0) {
              g.vx *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * frictionMult * dt);
              g.vy *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * frictionMult * dt);
            }

            newX = g.x + g.vx * dt;
            newY = g.y + g.vy * dt;
          } else if (currentPhase.id === 'bull_limited') {
            // Фаза быка: используем тот же FSM что и у обычного быка
            const dashCellsPx = (currentPhase.dashCells || CONFIG.BULL_DASH_DISTANCE_CELLS) * CONFIG.CELL_PX * BATTLE_SCALE;
            const chargeDist = BULL_CHARGE_DIST * BATTLE_SCALE * 8;
            const dashDist = dashCellsPx;
            const effectiveRadius = (g.radius || CONFIG.SPIDER_RADIUS) * BATTLE_SCALE;
            const hitDist = effectiveRadius + CONFIG.PLAYER_RADIUS * BATTLE_SCALE;

            // Используем state/stateTimer как у обычного быка
            if (!g.state) g.state = 'chase';
            if (g.stateTimer === undefined) g.stateTimer = 0;

            switch (g.state) {
              case 'chase':
                if (g.stunTimer <= 0 && b.freezeTimer <= 0 && dist > chargeDist && dist > 0) {
                  const spd = CONFIG.BULL_SPEED * BATTLE_SCALE;
                  let newX = g.x + (dx / dist) * spd * dt;
                  let newY = g.y + (dy / dist) * spd * dt;
                  const chCellX = Math.floor(newX / BATTLE_CELL_PX) + b.cellOffsetX;
                  const chCellY = Math.floor(newY / BATTLE_CELL_PX) + b.cellOffsetY;
                  if (b.openCells.has(cellKey(chCellX, chCellY))) {
                    g.x = newX; g.y = newY;
                  }
                } else if (dist <= chargeDist) {
                  g.state = 'prepare';
                  g.stateTimer = CONFIG.BULL_PREPARE_TIME;
                }
                break;

              case 'prepare':
                g.stateTimer -= dt;
                if (g.stateTimer <= 0) {
                  g.state = 'dash';
                  if (dist > 0) { g.dashDirX = dx / dist; g.dashDirY = dy / dist; }
                  else { g.dashDirX = 1; g.dashDirY = 0; }
                  g.dashDistance = dashDist;
                  g.stateTimer = 0;
                }
                break;

              case 'dash': {
                const dashSpeed = CONFIG.BULL_SPEED * 3 * BATTLE_SCALE;
                const moveDist = dashSpeed * dt;
                let newX = g.x + g.dashDirX * moveDist;
                let newY = g.y + g.dashDirY * moveDist;
                const newCellX = Math.floor(newX / BATTLE_CELL_PX) + b.cellOffsetX;
                const newCellY = Math.floor(newY / BATTLE_CELL_PX) + b.cellOffsetY;
                const hitWall = !b.openCells.has(cellKey(newCellX, newCellY));
                const moved = Math.hypot(newX - g.x, newY - g.y);
                g.stateTimer += moved;

                if (hitWall || g.stateTimer >= g.dashDistance) {
                  g.state = 'rest';
                  g.stateTimer = CONFIG.BULL_REST_TIME;
                  g.dashCount = (g.dashCount || 0) + 1;
                  if (g.dashCount >= (currentPhase.maxDashes || 3)) advancePhase();
                } else {
                  g.x = newX; g.y = newY;
                }

                const newDist = Math.hypot(b.player.x - g.x, b.player.y - g.y);
                if (newDist < hitDist) {
                  dealPlayerDamage(s, true);
                  g.state = 'rest';
                  g.stateTimer = CONFIG.BULL_REST_TIME;
                  g.dashCount = (g.dashCount || 0) + 1;
                  if (g.dashCount >= (currentPhase.maxDashes || 3)) advancePhase();
                }
                break;
              }

              case 'rest':
                g.stateTimer -= dt;
                if (g.stateTimer <= 0) {
                  g.state = 'chase';
                }
                break;
            }
          } else if (currentPhase.id === 'shooter') {
            // Фаза плеваки: стрейф перпендикулярно + стрельба
            // Вектор перпендикулярный к направлению на игрока
            if (g.stunTimer <= 0 && b.freezeTimer <= 0) {
              // Обновляем таймер смены направления стрейфа
              if (g.strafeSwitchTimer === undefined) g.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME;
              g.strafeSwitchTimer -= dt;
              if (g.strafeSwitchTimer <= 0) {
                g.strafeDir = -g.strafeDir;
                g.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME;
              }
              if (dist > 0) {
                // Перпендикуляр к (dx,dy): (-dy,dx) * strafeDir
                const strafeSpd = CONFIG.BOSS_STRAFE_SPEED * BATTLE_SCALE;
                newX += (-dy / dist) * strafeSpd * g.strafeDir * dt;
                newY += ( dx / dist) * strafeSpd * g.strafeDir * dt;
              }
            }
            // Стрельба как плевака (с опциональными множителями из фазы)
            const shootCdMult = currentPhase.shootCdMult || 0.5;
            const bulletSpeedMult = currentPhase.bulletSpeedMult || 1.0;
            if (g.shootCd > 0) g.shootCd -= dt;
            const bossShootRange = CONFIG.SHOOTER_SHOOT_RANGE_CELLS * CONFIG.CELL_PX * BATTLE_SCALE * 10;
            if (dist <= bossShootRange && g.shootCd <= 0 && b.freezeTimer <= 0) {
              g.shootCd = CONFIG.SHOOTER_SHOOT_CD * shootCdMult;
              if (dist > 0) {
                b.enemyBullets.push({
                  x: g.x, y: g.y,
                  vx: (dx / dist) * CONFIG.SHOOTER_BULLET_SPEED * bulletSpeedMult * BATTLE_SCALE,
                  vy: (dy / dist) * CONFIG.SHOOTER_BULLET_SPEED * bulletSpeedMult * BATTLE_SCALE,
                  life: 6,
                });
              }
            }
          }

          // Движение с проверкой стен (bull_limited обрабатывает движение сам внутри switch)
          if (currentPhase.id !== 'bull_limited') {
            const newCellX = Math.floor(newX / BATTLE_CELL_PX) + b.cellOffsetX;
            const newCellY = Math.floor(newY / BATTLE_CELL_PX) + b.cellOffsetY;
            if (b.openCells.has(cellKey(newCellX, newCellY))) {
              g.x = newX;
              g.y = newY;
            } else if (currentPhase.id === 'shooter' || currentPhase.id === 'buldyga') {
            // При стрейфе/инерции в стену — отражаем скорость (для булдыги) или разворачиваем стрейф
            if (currentPhase.id === 'buldyga') {
              g.vx *= -0.3;
              g.vy *= -0.3;
            } else {
              g.strafeDir = -g.strafeDir;
              g.strafeSwitchTimer = CONFIG.BOSS_STRAFE_SWITCH_TIME;
            }
          }
          }

          // Касание игрока (масштабированное)
          if (dist < ((g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.PLAYER_RADIUS) * BATTLE_SCALE) {
            dealPlayerDamage(s, true);
            for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
              const a = Math.random() * Math.PI * 2;
              b.particles.push({
                x: b.player.x, y: b.player.y,
                vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED, vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
                life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444',
              });
            }
          }
        } else {
          // Солдат - летит к игроку (масштабированная скорость)
          let newX = g.x;
          let newY = g.y;
          if (g.stunTimer <= 0 && b.freezeTimer <= 0 && dist > 0) {
            const spd = CONFIG.SPIDER_SPEED * BATTLE_SCALE;
            newX += (dx / dist) * spd * dt;
            newY += (dy / dist) * spd * dt;
          }
          // Проверка стен battle-зоны
          const newCellX = Math.floor(newX / BATTLE_CELL_PX) + b.cellOffsetX;
          const newCellY = Math.floor(newY / BATTLE_CELL_PX) + b.cellOffsetY;
          if (b.openCells.has(cellKey(newCellX, newCellY))) {
            g.x = newX;
            g.y = newY;
          }
          // Касание игрока (масштабированное)
          if (dist < ((g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.PLAYER_RADIUS) * BATTLE_SCALE) {
            spawnCorpse(b.deathCorpses, g, (g.radius || CONFIG.SPIDER_RADIUS) * BATTLE_SCALE);
            dealPlayerDamage(s, true);
            b.activeSpiders.splice(i, 1);
            for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
              const a = Math.random() * Math.PI * 2;
              b.particles.push({
                x: b.player.x, y: b.player.y,
                vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED, vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
                life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444',
              });
            }
            continue;
          }
        }
      }

      // Вражеские пули в battle
      for (let i = b.enemyBullets.length - 1; i >= 0; i--) {
        const eb = b.enemyBullets[i];
        if (!eb || eb.x === undefined || eb.y === undefined) {
          b.enemyBullets.splice(i, 1);
          continue;
        }
        eb.x += eb.vx * dt;
        eb.y += eb.vy * dt;
        eb.life -= dt;

        if (eb.x < 0 || eb.x > b.width || eb.y < 0 || eb.y > b.height || eb.life <= 0) {
          b.enemyBullets.splice(i, 1);
          continue;
        }

        // Проверка столкновения вражеских пуль со стенами
        const enemyBulletCellX = Math.floor(eb.x / BATTLE_CELL_PX) + b.cellOffsetX;
        const enemyBulletCellY = Math.floor(eb.y / BATTLE_CELL_PX) + b.cellOffsetY;
        if (!b.openCells.has(cellKey(enemyBulletCellX, enemyBulletCellY))) {
          // Пуля в стене - уничтожаем
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * Math.PI * 2;
            b.particles.push({
              x: eb.x, y: eb.y,
              vx: Math.cos(a) * 30 * BATTLE_SCALE, vy: Math.sin(a) * 30 * BATTLE_SCALE,
              life: 0.25, maxLife: 0.25, color: '#ff4400',
            });
          }
          b.enemyBullets.splice(i, 1);
          continue;
        }

        const pd = Math.hypot(eb.x - b.player.x, eb.y - b.player.y);
        if (pd < CONFIG.PLAYER_RADIUS * BATTLE_SCALE + CONFIG.BULLET_RADIUS * BATTLE_SCALE) {
          dealPlayerDamage(s, true);
          b.enemyBullets.splice(i, 1);
          for (let k = 0; k < 8; k++) {
            const a = Math.random() * Math.PI * 2;
            b.particles.push({
              x: b.player.x, y: b.player.y,
              vx: Math.cos(a) * 70, vy: Math.sin(a) * 70,
              life: 0.4, maxLife: 0.4, color: '#ff4444',
            });
          }
        }
      }

      // Коллизии между врагами в battle (масштабированные) - с учетом реальных радиусов
      for (let i = 0; i < b.activeSpiders.length; i++) {
        const g1 = b.activeSpiders[i];
        if (!g1 || g1.x === undefined || g1.y === undefined) continue;
        for (let j = i + 1; j < b.activeSpiders.length; j++) {
          const g2 = b.activeSpiders[j];
          if (!g2 || g2.x === undefined || g2.y === undefined) continue;
          const dx = g2.x - g1.x;
          const dy = g2.y - g1.y;
          const distSq = dx * dx + dy * dy;
          // Используем реальные радиусы врагов (масштабированные)
          const r1 = (g1.radius || CONFIG.SPIDER_RADIUS) * BATTLE_SCALE;
          const r2 = (g2.radius || CONFIG.SPIDER_RADIUS) * BATTLE_SCALE;
          const minDist = r1 + r2;
          if (distSq < minDist * minDist && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // Быки и булдыги тяжелее - отталкивают других сильнее
            const isHeavy1 = g1.type === 'bull' || g1.type === 'buldyga';
            const isHeavy2 = g2.type === 'bull' || g2.type === 'buldyga';
            let push1, push2;
            if (isHeavy1 && !isHeavy2) { push1 = 0.3; push2 = 0.7; }
            else if (!isHeavy1 && isHeavy2) { push1 = 0.7; push2 = 0.3; }
            else { push1 = 0.5; push2 = 0.5; }

            const newX1 = g1.x - nx * overlap * push1;
            const newY1 = g1.y - ny * overlap * push1;
            const newX2 = g2.x + nx * overlap * push2;
            const newY2 = g2.y + ny * overlap * push2;

            // Проверяем что новые позиции внутри открытых клеток battle-зоны
            const cellX1 = Math.floor(newX1 / BATTLE_CELL_PX) + b.cellOffsetX;
            const cellY1 = Math.floor(newY1 / BATTLE_CELL_PX) + b.cellOffsetY;
            const cellX2 = Math.floor(newX2 / BATTLE_CELL_PX) + b.cellOffsetX;
            const cellY2 = Math.floor(newY2 / BATTLE_CELL_PX) + b.cellOffsetY;
            if (b.openCells.has(cellKey(cellX1, cellY1))) {
              g1.x = newX1;
              g1.y = newY1;
            }
            if (b.openCells.has(cellKey(cellX2, cellY2))) {
              g2.x = newX2;
              g2.y = newY2;
            }
          }
        }
      }

      // Частицы в battle
      for (let i = b.particles.length - 1; i >= 0; i--) {
        const p = b.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.life -= dt;
        if (p.life <= 0) {
          returnParticle(p);
          b.particles.splice(i, 1);
        }
      }

      // Вылетающие цифры ХП в battle
      for (let i = b.damageNumbers.length - 1; i >= 0; i--) {
        const dn = b.damageNumbers[i];
        dn.y += dn.vy * dt;
        dn.vy *= 0.95; // замедление движения вверх
        dn.life -= dt;
        if (dn.life <= 0) {
          returnDamageNumber(dn);
          b.damageNumbers.splice(i, 1);
        }
      }

      // Обновление трупов в battle
      for (let i = b.deathCorpses.length - 1; i >= 0; i--) {
        b.deathCorpses[i].life -= dt;
        if (b.deathCorpses[i].life <= 0) b.deathCorpses.splice(i, 1);
      }

      
      // Смерть в battle - проверяем ДО завершения боя, чтобы показать Game Over сразу
      if (s.player.lives <= 0) {
        s.player.lives = 0;
        s.phase = 'dead';
        Sounds.stopGameMusic();
        return;
      }

      // Проверяем завершение боя: все враги убиты и содержимое ячейки собрано
      const hasEnemies = b.activeSpiders.length > 0;
      const cellContent = s.cellContents.get(b.openedCellKey);
      const cellContentCollected = !cellContent || cellContent.type === 'empty' || cellContent.type === 'enemies';

      if (!hasEnemies && cellContentCollected) {
        // Бой закончен — запускаем zoom-out переход
        // Игрок в battle -> play координаты
        const battleCellX = Math.floor(b.player.x / BATTLE_CELL_PX);
        const battleCellY = Math.floor(b.player.y / BATTLE_CELL_PX);
        const mapCellX = battleCellX + b.cellOffsetX;
        const mapCellY = battleCellY + b.cellOffsetY;
        const localX = b.player.x - battleCellX * BATTLE_CELL_PX;
        const localY = b.player.y - battleCellY * BATTLE_CELL_PX;
        const playPX = mapCellX * CP + localX / BATTLE_SCALE;
        const playPY = mapCellY * CP + localY / BATTLE_SCALE;

        // Начало zoom-out = конец zoom-in: тот же масштаб и центр зоны
        const fromScale = b.playZoomScale || (b.staticScale || 1) * BATTLE_SCALE;
        const zoneCX = b.playCenterX || playPX;
        const zoneCY = b.playCenterY || playPY;
        // Конечная камера: play режим, центрирована на play-игроке
        const worldW = s.gridSize * CP;
        const worldH = s.gridSize * CP;

        syncBattleCollectibles(s);

        zoomOutTransition = { 
          fromScale, toScale: 1, 
          fromCenterX: zoneCX, fromCenterY: zoneCY,
          toCenterX: playPX, toCenterY: playPY,
          playerX: playPX, playerY: playPY,
          t: 0,
          frozenAngle: Math.atan2(s.mouse.y - playPY, s.mouse.x - playPX),
        };
        Sounds.zoom();
        s.phase = 'zoom_out_transition';
        return;
      }
    }

    function createBulletBattle(b, weapon, baseAngle, bulletSpeed, upgrades) {
      const isCrit = Math.random() < upgrades.critChance;
      let damage = weapon.damage + upgrades.damage;
      if (isCrit) damage *= 2;
      screenShake = { amount: weapon.shakeAmount || CONFIG.SHAKE_AMOUNT, angle: baseAngle };
      const bBulletLife = upgrades.infiniteRange
        ? 999999
        : (weapon.range != null ? weapon.range * RANGE_SCALE * BATTLE_SCALE : CONFIG.BULLET_LIFE * weapon.bulletSpeed) / bulletSpeed * (upgrades.ricochet ? 1.5 : 1);
      b.bullets.push({
        x: b.player.x, y: b.player.y,
        vx: Math.cos(baseAngle) * bulletSpeed,
        vy: Math.sin(baseAngle) * bulletSpeed,
        life: bBulletLife,
        damage: damage,
        penetrate: upgrades.infinitePenetrate ? Infinity : weapon.penetrate + upgrades.penetrate,
        hitCount: 0,
        isCrit: isCrit,
        enhancedPierceActive: false,
        ricochet: upgrades.ricochet ? true : false,
      });
    }

    // Стрельба в battle mode
    function shootBattle(s) {
      if (s.shootCooldown > 0) return;
      if (!s.battle) return;
      const weapon = getActiveWeapon(s);
      if (!weapon) return;

      // Проверяем, есть ли активная очередь карабина
      if (s.burstRemaining > 0 && s.burstWeaponId === weapon.id) {
        if (s.burstCooldown > 0) return;
      } else if (s.burstRemaining > 0) {
        s.burstRemaining = 0;
        s.burstWeaponId = null;
        s.burstCooldown = 0;
      }

      const b = s.battle;
      const killAccelMult = s.upgrades.killAccel ? Math.max(0.1, 1 - s.upgrades.killAccelPercent / 100) : 1.0;
      const cooldown = weapon.cooldown * s.upgrades.cooldownMult * killAccelMult;
      Sounds.shot(weapon.id);

      const dx = s.mouse.x - b.player.x;
      const dy = s.mouse.y - b.player.y;
      const baseAngle = Math.atan2(dy, dx);

      const isBurstWeapon = weapon.burstSize && weapon.burstSize > 1;
      const pellets = isBurstWeapon ? weapon.pellets : weapon.pellets + s.upgrades.pellets;
      const burstSizeTotal = isBurstWeapon ? weapon.burstSize + s.upgrades.pellets : weapon.burstSize;
      const burstStepDelay = getBurstStepDelay(weapon, burstSizeTotal);
      let totalSpread = weapon.spread * s.upgrades.spreadMult;
      const bulletSpeed = weapon.bulletSpeed * s.upgrades.bulletSpeedMult * BATTLE_SCALE;
      
      // Снайпер: максимальная точность при 2 комнатах, +10% разброса за каждую дополнительную
      if (s.upgrades.sniper && s.battle && s.battle.openCells) {
        const roomCount = s.battle.openCells.size;
        if (roomCount <= 2) {
          totalSpread = 0; // Максимальная точность при 2 комнатах или меньше
        } else {
          const extraRooms = roomCount - 2;
          totalSpread *= (1 + 0.10 * extraRooms); // +10% разброса за каждую дополнительную комнату
        }
      }

      for (let i = 0; i < pellets; i++) {
        const spread = (Math.random() - 0.5) * totalSpread;
        const a = baseAngle + spread;
        createBulletBattle(b, weapon, a, bulletSpeed, s.upgrades);
      }

      // Проверяем, начинаем ли очередь карабина
      if (isBurstWeapon) {
        if (s.burstRemaining === 0) {
          s.burstRemaining = burstSizeTotal - 1;
          s.burstWeaponId = weapon.id;
          s.burstCooldown = burstStepDelay;
          s.shootCooldown = 0; // Не блокируем, ждём burstCooldown
        } else {
          s.burstRemaining--;
          if (s.burstRemaining > 0) {
            s.burstCooldown = burstStepDelay;
            s.shootCooldown = 0;
          } else {
            s.burstWeaponId = null;
            s.shootCooldown = cooldown;
            s.maxShootCooldown = cooldown;
          }
        }
      } else {
        s.shootCooldown = cooldown;
        s.maxShootCooldown = cooldown;
      }

      // Particle muzzle flash (масштабированная скорость)
      weaponRecoil = 1.0;
      for (let i = 0; i < CONFIG.MUZZLE_PARTICLES_COUNT; i++) {
        const a = baseAngle + (Math.random() - 0.5) * CONFIG.MUZZLE_PARTICLES_SPREAD;
        b.particles.push({
          x: b.player.x, y: b.player.y,
          vx: Math.cos(a) * (CONFIG.MUZZLE_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.MUZZLE_PARTICLES_SPEED_MAX - CONFIG.MUZZLE_PARTICLES_SPEED_MIN)) * BATTLE_SCALE,
          vy: Math.sin(a) * (CONFIG.MUZZLE_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.MUZZLE_PARTICLES_SPEED_MAX - CONFIG.MUZZLE_PARTICLES_SPEED_MIN)) * BATTLE_SCALE,
          life: CONFIG.MUZZLE_PARTICLES_LIFE, maxLife: CONFIG.MUZZLE_PARTICLES_LIFE, color: '#ffff00',
        });
      }
    }

