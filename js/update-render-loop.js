    // ============================================================
    // WEAPON SPRITE DRAWING
    // ============================================================
    function drawWeaponSprite(ctx, weaponId, x, y, size, alpha, pulse) {
      const img = weaponImages[weaponId];
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const a = alpha !== undefined ? alpha : 1;
      const p = pulse !== undefined ? pulse : 1;
      ctx.save();
      ctx.globalAlpha = a * p;
      const drawSize = size || 32;
      ctx.drawImage(img, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      ctx.restore();
    }

    // ============================================================
    // UPDATE
    // ============================================================
    function update(s, dt) {
      if (s.phase !== 'play') return;
      s.time += dt;

      // Инвулнерабельность
      if (s.player.invulnerable > 0) s.player.invulnerable -= dt;

      // Движение игрока
      const spd = CONFIG.PLAYER_SPEED * s.upgrades.speedMult;
      let mvx = 0, mvy = 0;
      const k = s.keys;
      if (k['w'] || k['W'] || k['ц'] || k['Ц'] || k['ArrowUp'] || k['arrowup']) mvy -= 1;
      if (k['s'] || k['S'] || k['ы'] || k['Ы'] || k['ArrowDown'] || k['arrowdown']) mvy += 1;
      if (k['a'] || k['A'] || k['ф'] || k['Ф'] || k['ArrowLeft'] || k['arrowleft']) mvx -= 1;
      if (k['d'] || k['D'] || k['в'] || k['В'] || k['ArrowRight'] || k['arrowright']) mvx += 1;
      if (mvx && mvy) { mvx *= Math.SQRT1_2; mvy *= Math.SQRT1_2; }
      if (mvx !== 0 || mvy !== 0) Sounds.footstep(dt); else Sounds._footstepTimer = 0;

      // Обновление анимации персонажа
      updatePlayerAnim(mvx, mvy, s.mouse.x - s.player.x, s.mouse.y - s.player.y, dt);

      const pr = CONFIG.PLAYER_RADIUS;
      let npx = s.player.x + mvx * spd * dt;
      let npy = s.player.y + mvy * spd * dt;

      // Движение только в открытых клетках
      const tcX = cellOf(npx, s.player.y);
      if (s.openCells.has(cellKey(tcX.x, tcX.y))) {
        s.player.x = npx;
      }
      const tcY = cellOf(s.player.x, npy);
      if (s.openCells.has(cellKey(tcY.x, tcY.y))) {
        s.player.y = npy;
      }

      // Сбор сердечек
      for (const heart of s.hearts) {
        if (!heart.collected) {
          const dist = Math.hypot(s.player.x - heart.x, s.player.y - heart.y);
          if (dist < CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE) {
            heart.collected = true;
            s.cellContents.delete(heart.cellKey);
            s.player.lives += CONFIG.LIVES_PER_HEART;
            s.heartsCollected++;
            Sounds.heartcollect();
            // Частицы
            addParticles(heart.x, heart.y, CONFIG.PICKUP_PARTICLES_COUNT, CONFIG.PICKUP_PARTICLES_SPEED, CONFIG.PICKUP_PARTICLES_LIFE, '#ff6b9d');
          }
        }
      }

      // Сбор ключей
      for (const keyObj of s.keyObjs) {
        if (!keyObj.collected) {
          const dist = Math.hypot(s.player.x - keyObj.x, s.player.y - keyObj.y);
          if (dist < CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE) {
            keyObj.collected = true;
            s.cellContents.delete(keyObj.cellKey);
            s.keysCollected++;
            Sounds.keycollect();
            // Частицы
            addParticles(keyObj.x, keyObj.y, CONFIG.PICKUP_PARTICLES_COUNT, CONFIG.PICKUP_PARTICLES_SPEED, CONFIG.PICKUP_PARTICLES_LIFE, '#ffd700');
          }
        }
      }

      // Сбор апгрейдов
      for (const upg of s.upgradeObjs) {
        if (!upg.collected) {
          const dist = Math.hypot(s.player.x - upg.x, s.player.y - upg.y);
          if (dist < CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE) {
            upg.collected = true;
            s.cellContents.delete(upg.cellKey);
            applyUpgrade(s, upg.upgradeType);
            Sounds.upgradecollect();
            // Частицы
            const upgDef = UPGRADE_TYPES.find(u => u.id === upg.upgradeType);
            const color = upgDef ? upgDef.color : '#ffcc00';
            addParticles(upg.x, upg.y, CONFIG.PICKUP_PARTICLES_COUNT, CONFIG.PICKUP_PARTICLES_SPEED, CONFIG.PICKUP_PARTICLES_LIFE, color);
          }
        }
      }

      // Сбор проклятых сундуков
      for (const chest of (s.chestObjs || [])) {
        if (!chest.collected) {
          const dist = Math.hypot(s.player.x - chest.x, s.player.y - chest.y);
          if (dist < CONFIG.PLAYER_RADIUS + CONFIG.PICKUP_DISTANCE) {
            openCursedChoice(s, chest);
            break;
          }
        }
      }

      // Таймер попапа апгрейда
      if (upgradePopupTimer > 0) {
        upgradePopupTimer -= dt;
        if (upgradePopupTimer <= 0) {
          document.getElementById('upgrade-popup').classList.remove('visible');
        }
      }

      // Обновление кулдауна стрельбы и пуль
      s.shootCooldown = Math.max(0, s.shootCooldown - dt);
      s.burstCooldown = Math.max(0, s.burstCooldown - dt);
      // Стреляем если: (1) зажата кнопка и нет кд, или (2) активна очередь карабина
      const weapon = getActiveWeapon(s);
      const isBurstActive = weapon && weapon.burstSize && weapon.burstSize > 1 && s.burstRemaining > 0 && s.burstWeaponId === weapon.id;
      if ((mouseHeld || isBurstActive) && s.shootCooldown <= 0) shoot(s);
      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;

        if (b.life <= 0) {
          Sounds.wallhit();
          addParticles(b.x, b.y, CONFIG.WALL_HIT_PARTICLES_COUNT, CONFIG.WALL_HIT_PARTICLES_SPEED, CONFIG.WALL_HIT_PARTICLES_LIFE, '#88aaff');
          s.bullets.splice(i, 1);
          continue;
        }
        if (!inRoom(b.x, b.y, s.openCells)) {
          if (b.ricochet && !b._ricocheted) {
            b._ricocheted = true;
            const prevX = b.x - b.vx * dt;
            const prevY = b.y - b.vy * dt;
            const xOk = inRoom(b.x, prevY, s.openCells);
            const yOk = inRoom(prevX, b.y, s.openCells);
            if (xOk) { b.vy = -b.vy; b.y = prevY; }
            else if (yOk) { b.vx = -b.vx; b.x = prevX; }
            else { b.vx = -b.vx; b.vy = -b.vy; b.x = prevX; b.y = prevY; }
            b.hitSpiders = undefined;
            Sounds.wallhit();
            addParticles(b.x, b.y, CONFIG.WALL_HIT_PARTICLES_COUNT, CONFIG.WALL_HIT_PARTICLES_SPEED, CONFIG.WALL_HIT_PARTICLES_LIFE, '#22ffdd');
          } else {
            Sounds.wallhit();
            addParticles(b.x, b.y, CONFIG.WALL_HIT_PARTICLES_COUNT, CONFIG.WALL_HIT_PARTICLES_SPEED, CONFIG.WALL_HIT_PARTICLES_LIFE, '#88aaff');
            s.bullets.splice(i, 1);
            continue;
          }
        } else {
          b._ricocheted = false;
        }

        // Попадание в выпущенных (активных) призраков
        let hit = false;
        for (let j = s.activeSpiders.length - 1; j >= 0; j--) {
          const g = s.activeSpiders[j];
          if (b.hitSpiders && b.hitSpiders.has(j)) continue; // уже попадали в этого
          const dist = Math.hypot(b.x - g.x, b.y - g.y);
          if (dist < CONFIG.SPIDER_RADIUS + CONFIG.BULLET_RADIUS) {
            // Усиленное пробитие: пуля пробила врага -> 50% шанс двойного урона следующему
            if (b.hitCount > 0 && s.upgrades.enhancedPierce && b.enhancedPierceActive) {
              b.damage *= 2;
            }
            g.hp -= (b.damage || CONFIG.BULLET_DAMAGE);
            hit = true;
            Sounds.hit();
            addParticles(g.x, g.y, CONFIG.HIT_PARTICLES_COUNT, CONFIG.HIT_PARTICLES_SPEED, CONFIG.HIT_PARTICLES_LIFE, '#44cc22');
            if (g.hp <= 0) {
              s.activeSpiders.splice(j, 1);
              for (let k = 0; k < CONFIG.DEATH_PARTICLES_COUNT; k++) {
                const speed = CONFIG.DEATH_PARTICLES_SPEED_MIN + Math.random() * (CONFIG.DEATH_PARTICLES_SPEED_MAX - CONFIG.DEATH_PARTICLES_SPEED_MIN);
                const color = k % 2 === 0 ? '#44cc22' : '#88ff44';
                addParticles(g.x, g.y, 1, speed, CONFIG.DEATH_PARTICLES_LIFE, color);
              }
              // Оружейный разгон: +0.2% за убийство, макс 90%
              if (s.upgrades.killAccel) {
                s.upgrades.killAccelPercent = Math.min(90, s.upgrades.killAccelPercent + 0.2);
                playerProgress.upgrades.killAccelPercent = s.upgrades.killAccelPercent;
              }
              // Распухший: выстрел при смерти в игрока
              if (g.type === 'bloated') {
                const pdx = s.player.x - g.x;
                const pdy = s.player.y - g.y;
                const pdist = Math.hypot(pdx, pdy);
                if (pdist > 0) {
                  s.enemyBullets.push({
                    x: g.x, y: g.y,
                    vx: (pdx / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED,
                    vy: (pdy / pdist) * CONFIG.BLOATED_DEATH_SHOT_SPEED,
                    life: 6,
                  });
                }
              }
            }
            // Логика пробития: отслеживаем сколько врагов прошла пуля
            b.hitCount++;
            if (!b.hitSpiders) b.hitSpiders = new Set();
            b.hitSpiders.add(j);
            // Усиленное пробитие: 50% шанс активировать после первого пробития
            if (b.hitCount === 1 && s.upgrades.enhancedPierce && !b.enhancedPierceActive) {
              b.enhancedPierceActive = Math.random() < 0.5;
            }
            // Пуля уничтожается если hitCount > penetrate (0=1 враг, 2=3 врага)
            if (b.hitCount > b.penetrate) {
              s.bullets.splice(i, 1);
              break;
            }
          }
        }
      }

      // Пауки в закрытых комнатах статичны (без анимации движения)
      // Нет обновления позиции для trapped spiders - они стоят на месте

      // Обновление активных пауков
      for (let i = s.activeSpiders.length - 1; i >= 0; i--) {
        const g = s.activeSpiders[i];

        const dx = s.player.x - g.x;
        const dy = s.player.y - g.y;
        const dist = Math.hypot(dx, dy);

        if (g.type === 'plevaka' || g.type === 'shooter') {
          // Плевака: движется к игроку, пока не достигнет дистанции SHOOTER_STOP_DIST
          if (dist > SHOOTER_STOP_DIST && dist > 0) {
            const spd = CONFIG.SHOOTER_SPEED;
            g.x += (dx / dist) * spd * dt;
            g.y += (dy / dist) * spd * dt;
          }
          // Стрельба
          if (g.shootCd > 0) g.shootCd -= dt;
          if (dist <= SHOOTER_SHOOT_RANGE && g.shootCd <= 0) {
            g.shootCd = CONFIG.SHOOTER_SHOOT_CD;
            if (dist > 0) {
              s.enemyBullets.push({
                x: g.x, y: g.y,
                vx: (dx / dist) * CONFIG.SHOOTER_BULLET_SPEED,
                vy: (dy / dist) * CONFIG.SHOOTER_BULLET_SPEED,
                life: 6,
              });
            }
          }
        } else if (g.type === 'bull') {
          // Бык: FSM — chase → prepare → dash → rest → chase
          const effectiveRadius = g.radius || CONFIG.BULL_RADIUS;
          const hitDist = effectiveRadius + CONFIG.PLAYER_RADIUS;
          
          if (!g.state) g.state = 'chase';
          if (g.stateTimer === undefined) g.stateTimer = 0;
          
          switch (g.state) {
            case 'chase':
              // Идёт к игроку пока не достигнет дистанции CHARGE_DIST
              if (dist > BULL_CHARGE_DIST && dist > 0) {
                const spd = CONFIG.BULL_SPEED;
                g.x += (dx / dist) * spd * dt;
                g.y += (dy / dist) * spd * dt;
              } else if (dist <= BULL_CHARGE_DIST) {
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
                const ddx = s.player.x - g.x;
                const ddy = s.player.y - g.y;
                const ddist = Math.hypot(ddx, ddy);
                if (ddist > 0) {
                  g.dashDirX = ddx / ddist;
                  g.dashDirY = ddy / ddist;
                } else {
                  g.dashDirX = dx / dist;
                  g.dashDirY = dy / dist;
                }
                g.dashDistance = BULL_DASH_DISTANCE;
                g.stateTimer = 0; // счётчик пройденной дистанции
              }
              break;
              
            case 'dash':
              // Быстрый рывок
              {
                const dashSpeed = CONFIG.BULL_SPEED * 4; // в 4 раза быстрее обычного
                const moveDist = dashSpeed * dt;
                let newX = g.x + g.dashDirX * moveDist;
                let newY = g.y + g.dashDirY * moveDist;
                
                // Проверяем столкновение со стенами
                const cellX = Math.floor(g.x / CP);
                const cellY = Math.floor(g.y / CP);
                const newCellX = Math.floor(newX / CP);
                const newCellY = Math.floor(newY / CP);
                
                let hitWall = false;
                // Проверяем выход за границы текущей или открытых клеток
                if (!s.openCells.has(cellKey(newCellX, newCellY))) {
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
                const newDist = Math.hypot(s.player.x - g.x, s.player.y - g.y);
                if (newDist < hitDist) {
                  dealPlayerDamage(s, false);
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
            dealPlayerDamage(s, false);
            s.activeSpiders.splice(i, 1);
            for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
              const a = Math.random() * Math.PI * 2;
              s.particles.push({
                x: s.player.x, y: s.player.y,
                vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED, vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
                life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444',
              });
            }
            continue;
          }
        } else if (g.type === 'buldyga') {
          // Булдыга: инерционное движение с нарастающей скоростью
          if (g.currentSpeed === undefined) g.currentSpeed = CONFIG.BULDYGA_SPEED;
          if (g.speedAccumulator === undefined) g.speedAccumulator = 0;
          if (g.vx === undefined) g.vx = 0;
          if (g.vy === undefined) g.vy = 0;

          // Ускорение максимальной скорости каждую секунду
          g.speedAccumulator += dt;
          if (g.speedAccumulator >= 1.0) {
            const secondsPassed = Math.floor(g.speedAccumulator);
            g.currentSpeed += CONFIG.BULDYGA_SPEED_INCREMENT * secondsPassed;
            g.speedAccumulator -= secondsPassed;
          }

          // Инерция: разгоняем vx/vy к целевому направлению, ограничиваем currentSpeed
          if (dist > 0) {
            const targetVx = (dx / dist) * g.currentSpeed;
            const targetVy = (dy / dist) * g.currentSpeed;
            const accel = CONFIG.BULDYGA_ACCEL * dt;
            g.vx += (targetVx - g.vx) * Math.min(1, accel / g.currentSpeed);
            g.vy += (targetVy - g.vy) * Math.min(1, accel / g.currentSpeed);
          } else {
            g.vx *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * dt);
            g.vy *= Math.max(0, 1 - CONFIG.BULDYGA_FRICTION * dt);
          }

          let newX = g.x + g.vx * dt;
          let newY = g.y + g.vy * dt;
          // Проверка стен - не выходим за открытые клетки
          const newCellX = Math.floor(newX / CP);
          const newCellY = Math.floor(newY / CP);
          if (s.openCells.has(cellKey(newCellX, newCellY))) {
            g.x = newX;
            g.y = newY;
          } else {
            g.vx *= -0.3;
            g.vy *= -0.3;
          }
          // Касание игрока
          if (dist < (g.radius || CONFIG.BULDYGA_RADIUS) + CONFIG.PLAYER_RADIUS) {
            dealPlayerDamage(s, false);
            s.activeSpiders.splice(i, 1);
            for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
              const a = Math.random() * Math.PI * 2;
              s.particles.push({
                x: s.player.x, y: s.player.y,
                vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED, vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
                life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444',
              });
            }
            continue;
          }
        } else if (g.type === 'bloated') {
          // Распухший: как солдат, но взрывается при смерти
          let newX = g.x;
          let newY = g.y;
          if (dist > 0) {
            newX += (dx / dist) * CONFIG.BLOATED_SPEED * dt;
            newY += (dy / dist) * CONFIG.BLOATED_SPEED * dt;
          }
          // Проверка стен
          const newCellX = Math.floor(newX / CP);
          const newCellY = Math.floor(newY / CP);
          if (s.openCells.has(cellKey(newCellX, newCellY))) {
            g.x = newX;
            g.y = newY;
          }
          // Касание игрока
          if (dist < (g.radius || CONFIG.BLOATED_RADIUS) + CONFIG.PLAYER_RADIUS) {
            dealPlayerDamage(s, false);
            s.activeSpiders.splice(i, 1);
            for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
              const a = Math.random() * Math.PI * 2;
              s.particles.push({
                x: s.player.x, y: s.player.y,
                vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED, vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
                life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444',
              });
            }
            continue;
          }
        } else if (g.type === 'cocoon') {
          // Кокон: стоит на месте, спавнит солдат
          if (g.spawnTimer === undefined) g.spawnTimer = CONFIG.COCOON_SPAWN_INTERVAL;
          g.spawnTimer -= dt;
          if (g.spawnTimer <= 0) {
            g.spawnTimer = CONFIG.COCOON_SPAWN_INTERVAL;
            // Спавним солдата рядом с коконом
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnDist = (g.radius || CONFIG.COCOON_RADIUS) + CONFIG.SPIDER_RADIUS + 5;
            s.activeSpiders.push({
              x: g.x + Math.cos(spawnAngle) * spawnDist,
              y: g.y + Math.sin(spawnAngle) * spawnDist,
              vx: 0, vy: 0,
              radius: CONFIG.SPIDER_RADIUS,
              hp: CONFIG.SPIDER_HP,
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
            });
          }
        } else {
          // Солдат: летит к игроку
          let newX = g.x;
          let newY = g.y;
          if (dist > 0) {
            newX += (dx / dist) * CONFIG.SPIDER_SPEED * dt;
            newY += (dy / dist) * CONFIG.SPIDER_SPEED * dt;
          }
          // Проверка стен
          const newCellX = Math.floor(newX / CP);
          const newCellY = Math.floor(newY / CP);
          if (s.openCells.has(cellKey(newCellX, newCellY))) {
            g.x = newX;
            g.y = newY;
          }
          // Касание игрока
          if (dist < (g.radius || CONFIG.SPIDER_RADIUS) + CONFIG.PLAYER_RADIUS) {
            dealPlayerDamage(s, false);
            s.activeSpiders.splice(i, 1);
            for (let k = 0; k < CONFIG.PLAYER_HIT_PARTICLES_COUNT; k++) {
              const a = Math.random() * Math.PI * 2;
              s.particles.push({
                x: s.player.x, y: s.player.y,
                vx: Math.cos(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED, vy: Math.sin(a) * CONFIG.PLAYER_HIT_PARTICLES_SPEED,
                life: CONFIG.PLAYER_HIT_PARTICLES_LIFE, maxLife: CONFIG.PLAYER_HIT_PARTICLES_LIFE, color: '#ff4444',
              });
            }
            continue;
          }
        }
      }

      // Обновление вражеских пуль
      for (let i = s.enemyBullets.length - 1; i >= 0; i--) {
        const eb = s.enemyBullets[i];
        eb.x += eb.vx * dt;
        eb.y += eb.vy * dt;
        eb.life -= dt;

        if (!inRoom(eb.x, eb.y, s.openCells) || eb.life <= 0) {
          for (let j = 0; j < 4; j++) {
            const a = Math.random() * Math.PI * 2;
            s.particles.push({
              x: eb.x, y: eb.y,
              vx: Math.cos(a) * 30, vy: Math.sin(a) * 30,
              life: 0.25, maxLife: 0.25, color: '#ff6600',
            });
          }
          s.enemyBullets.splice(i, 1);
          continue;
        }

        // Попадание в игрока
        const pd = Math.hypot(eb.x - s.player.x, eb.y - s.player.y);
        if (pd < CONFIG.PLAYER_RADIUS + CONFIG.BULLET_RADIUS) {
          dealPlayerDamage(s, false);
          s.enemyBullets.splice(i, 1);
          for (let k = 0; k < 8; k++) {
            const a = Math.random() * Math.PI * 2;
            s.particles.push({
              x: s.player.x, y: s.player.y,
              vx: Math.cos(a) * 70, vy: Math.sin(a) * 70,
              life: 0.4, maxLife: 0.4, color: '#ff4444',
            });
          }
        }
      }

      // Коллизии между врагами - с учетом реальных радиусов и проверкой стен
      for (let i = 0; i < s.activeSpiders.length; i++) {
        const g1 = s.activeSpiders[i];
        for (let j = i + 1; j < s.activeSpiders.length; j++) {
          const g2 = s.activeSpiders[j];

          const dx = g2.x - g1.x;
          const dy = g2.y - g1.y;
          const distSq = dx * dx + dy * dy;
          // Используем реальные радиусы врагов
          const r1 = g1.radius || CONFIG.SPIDER_RADIUS;
          const r2 = g2.radius || CONFIG.SPIDER_RADIUS;
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

            // Проверяем что новые позиции внутри открытых клеток
            const cell1 = cellOf(newX1, newY1);
            const cell2 = cellOf(newX2, newY2);
            if (s.openCells.has(cellKey(cell1.x, cell1.y))) {
              g1.x = newX1;
              g1.y = newY1;
            }
            if (s.openCells.has(cellKey(cell2.x, cell2.y))) {
              g2.x = newX2;
              g2.y = newY2;
            }
          }
        }
      }

      // Частицы
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.life -= dt;
        if (p.life <= 0) {
          returnParticle(p);
          s.particles.splice(i, 1);
        }
      }

      // Летящее сердечко
      if (flyingHeart) {
        const fh = flyingHeart;
        // Обновляем цель если есть homing
        if (fh.getTarget) {
          const t = fh.getTarget();
          fh.targetX = t.x;
          fh.targetY = t.y;
        }
        // Движение к текущей цели с постоянной скоростью
        const dx = fh.targetX - fh.x;
        const dy = fh.targetY - fh.y;
        const dist = Math.hypot(dx, dy);
        const speed = dist / Math.max(fh.duration - fh.t, 0.001);
        if (dist < speed * dt || dist < 2) {
          fh.x = fh.targetX;
          fh.y = fh.targetY;
          fh.t = fh.duration;
        } else {
          fh.x += (dx / dist) * speed * dt;
          fh.y += (dy / dist) * speed * dt;
        }
        fh.t += dt;
        if (fh.t >= fh.duration) {
          const cb = fh.onArrive;
          flyingHeart = null;
          if (cb) cb();
        }
      }

      // Смерть
      if (s.player.lives <= 0) {
        s.player.lives = 0;
        s.phase = 'dead';
      }
    }

    // ============================================================
    // BATTLE DRAW
    // ============================================================
    function drawBattle(s) {
      const b = s.battle;
      if (!b) return;

      beginFrame();

      // Статичная камера battle: всё поле умещается на экране
      const sc = b.staticScale || 1;
      camera.x = b.staticCamX || 0;
      camera.y = b.staticCamY || 0;

      // Apply screen shake in bullet direction
      const shakeX = Math.cos(screenShake.angle) * screenShake.amount;
      const shakeY = Math.sin(screenShake.angle) * screenShake.amount;
      screenShake.amount *= CONFIG.SHAKE_DECAY;

      // Пересчитываем мировые координаты мыши каждый кадр (battle)
      s.mouse.x = (mouseScreen.x - VIEW_W / 2) / sc + b.width / 2;
      s.mouse.y = (mouseScreen.y - VIEW_H / 2) / sc + b.height / 2;

      ctx.save();
      ctx.translate(VIEW_W / 2 + shakeX, VIEW_H / 2 + shakeY);
      ctx.scale(sc, sc);
      ctx.translate(-b.width / 2, -b.height / 2);

      // Фон battle
      ctx.fillStyle = '#030810';
      ctx.fillRect(0, 0, b.width, b.height);


      // Отрисовка клеток battle
      for (const k of b.openCells) {
        const { x, y } = cellFromKey(k);
        // Позиция в battle-координатах
        const bx = (x - b.cellOffsetX) * BATTLE_CELL_PX;
        const by = (y - b.cellOffsetY) * BATTLE_CELL_PX;

        // Фон клетки
        drawFloorCell(ctx, x, y, BATTLE_CELL_PX, b.openCells, b.cellOffsetX, b.cellOffsetY);

      }

      // Стены по краям открытых клеток (battle)
      drawOpenCellWalls(b.openCells, BATTLE_CELL_PX, BATTLE_CELL_PX * 0.125, b.cellOffsetX, b.cellOffsetY);
      drawOpenCellCorners(b.openCells, BATTLE_CELL_PX, BATTLE_CELL_PX * 0.125, b.cellOffsetX, b.cellOffsetY);

      // Сердечки
      for (const heart of b.hearts) {
        if (heart.collected) continue;
        const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.008);
        ctx.fillStyle = `rgba(255, 107, 157, ${pulse})`;
        ctx.shadowColor = '#ff6b9d';
        ctx.shadowBlur = 15 * BATTLE_SCALE;
        ctx.font = `bold ${24 * BATTLE_SCALE}px "Share Tech Mono"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', heart.x, heart.y);
        ctx.shadowBlur = 0;
      }

      // Ключи
      for (const keyObj of b.keys) {
        if (keyObj.collected) continue;
        const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.008);
        ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15 * BATTLE_SCALE;
        ctx.font = `bold ${24 * BATTLE_SCALE}px "Share Tech Mono"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔑', keyObj.x, keyObj.y);
        ctx.shadowBlur = 0;
      }

      // Апгрейды
      for (const upg of b.upgrades) {
        if (upg.collected) continue;
        const upgDef = UPGRADE_TYPES.find(u => u.id === upg.upgradeType);
        if (upgDef) {
          ctx.fillStyle = upgDef.color;
          ctx.shadowColor = upgDef.color;
          ctx.shadowBlur = 15 * BATTLE_SCALE;
          ctx.font = `bold ${24 * BATTLE_SCALE}px "Share Tech Mono"`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⬆', upg.x, upg.y);
          ctx.shadowBlur = 0;
        }
      }

      // Проклятые сундуки в battle
      for (const bc of (b.chests || [])) {
        if (bc.collected) continue;
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#cc44ff';
        ctx.shadowBlur = 18 * BATTLE_SCALE;
        ctx.font = `bold ${26 * BATTLE_SCALE}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', bc.x, bc.y);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Оружие на полу в battle
      if (b.weapons) {
        for (const bw of b.weapons) {
          if (bw.picked) continue;
          const wDef = WEAPON_DEFS[bw.weaponId];
          if (!wDef) continue;
          const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.007);
          ctx.shadowColor = wDef.color;
          ctx.shadowBlur = 12 * BATTLE_SCALE;
          drawWeaponSprite(ctx, bw.weaponId, bw.x, bw.y - 8 * BATTLE_SCALE, 28 * BATTLE_SCALE, 1, pulse);
          ctx.shadowBlur = 0;
          ctx.font = `bold ${9 * BATTLE_SCALE}px "Share Tech Mono"`;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.9;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(wDef.label, bw.x, bw.y + 12 * BATTLE_SCALE);
          ctx.globalAlpha = 1;
        }
      }

      // Пули игрока
      for (const b of s.battle.bullets) {
        ctx.fillStyle = '#ffffaa';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 8 * BATTLE_SCALE;
        ctx.beginPath();
        ctx.arc(b.x, b.y, CONFIG.BULLET_RADIUS * BATTLE_SCALE, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Вражеские пули
      for (const eb of s.battle.enemyBullets) {
        ctx.fillStyle = '#ff4400';
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 10 * BATTLE_SCALE;
        ctx.beginPath();
        ctx.arc(eb.x, eb.y, 4 * BATTLE_SCALE, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Враги в battle (масштабированы)
      for (const g of b.activeSpiders) {
        drawSpider(g, 1, BATTLE_SCALE, true);
      }

      // Частицы
      for (const p of b.particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 * BATTLE_SCALE, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Вылетающие цифры ХП
      for (let i = b.damageNumbers.length - 1; i >= 0; i--) {
        const dn = b.damageNumbers[i];
        const alpha = dn.life / dn.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = dn.color;
        ctx.font = `bold ${13 * BATTLE_SCALE * dn.scale}px "Share Tech Mono"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = dn.color;
        ctx.shadowBlur = 4 * BATTLE_SCALE;
        ctx.fillText(dn.text, dn.x, dn.y);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // Игрок в battle
      const p = b.player;
      const blinkOk = s.player.invulnerable <= 0 || Math.floor(s.player.invulnerable * 10) % 2 === 0;
      if (blinkOk) {
        const HERO_DRAW_SCALE = (CONFIG.PLAYER_SPRITE_RADIUS * 2 * BATTLE_SCALE) / HERO_SW;
        drawPlayerSprite(p.x, p.y, HERO_DRAW_SCALE);
      }

      // Индикатор разброса в battle
      if (CONFIG.DEBUG_SPREAD_INDICATOR) {
        const weapon = getActiveWeapon(s);
        if (weapon) {
          let totalSpread = weapon.spread * s.upgrades.spreadMult;
          if (s.upgrades.sniper && s.battle && s.battle.openCells) {
            const roomCount = s.battle.openCells.size;
            if (roomCount <= 2) totalSpread = 0;
            else totalSpread *= (1 + 0.10 * (roomCount - 2));
          }
          const aimA = Math.atan2(s.mouse.y - b.player.y, s.mouse.x - b.player.x);
          const lineLen = (weapon.range != null ? weapon.range * RANGE_SCALE : 150) * BATTLE_SCALE;
          const startOffset = CONFIG.PLAYER_SPRITE_RADIUS * BATTLE_SCALE + 2;
          const halfSpread = totalSpread / 2;
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#aaaaaa';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6 * BATTLE_SCALE, 5 * BATTLE_SCALE]);
          for (const side of [-1, 1]) {
            const a = aimA + side * halfSpread;
            ctx.beginPath();
            ctx.moveTo(b.player.x + Math.cos(a) * startOffset, b.player.y + Math.sin(a) * startOffset);
            ctx.lineTo(b.player.x + Math.cos(a) * (startOffset + lineLen), b.player.y + Math.sin(a) * (startOffset + lineLen));
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      ctx.restore();

      // Виньетка при малом количестве жизней
      if (s.player.lives === 2) {
        const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 3, VIEW_W / 2, VIEW_H / 2, Math.sqrt((VIEW_W) ** 2 + (VIEW_H) ** 2));
        grad.addColorStop(0, 'rgba(255, 120, 0, 0)');
        grad.addColorStop(1, 'rgba(255, 120, 0, 0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      } else if (s.player.lives === 1) {
        const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 3, VIEW_W / 2, VIEW_H / 2, Math.sqrt((VIEW_W) ** 2 + (VIEW_H) ** 2));
        grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(255, 0, 0, 0.55)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }

      // Индикатор battle mode
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 14px "Share Tech Mono"';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('⚔ BATTLE MODE', 10, 10);

      // Tooltip оружия при наведении (battle mode) — только когда все враги убиты
      if (b.weapons && b.activeSpiders.length === 0) {
        const hoverR = BATTLE_CELL_PX * 0.2;
        for (const bw of b.weapons) {
          if (bw.picked) continue;
          const dist = Math.hypot(s.mouse.x - bw.x, s.mouse.y - bw.y);
          if (dist < hoverR) {
            const wDef = WEAPON_DEFS[bw.weaponId];
            if (wDef) {
              const sx = VIEW_W / 2 + (bw.x - b.width / 2) * sc;
              const sy = VIEW_H / 2 + (bw.y - b.height / 2) * sc;
              drawUpgradeTooltip(sx, sy, wDef);
            }
            break;
          }
        }
      }

      // Tooltip апгрейда при наведении (battle mode) — только когда все враги убиты
      if (b.activeSpiders.length === 0) {
        const hoverR = BATTLE_CELL_PX * 0.2;
        for (const upg of b.upgrades) {
          if (upg.collected) continue;
          const dist = Math.hypot(s.mouse.x - upg.x, s.mouse.y - upg.y);
          if (dist < hoverR) {
            const upgDef = UPGRADE_TYPES.find(u => u.id === upg.upgradeType);
            if (upgDef) {
              const sx = VIEW_W / 2 + (upg.x - b.width / 2) * sc;
              const sy = VIEW_H / 2 + (upg.y - b.height / 2) * sc;
              drawUpgradeTooltip(sx, sy, upgDef);
            }
            break;
          }
        }
      }

      drawHUD(s);

      if (showStatsPanel) {
        drawStatsPanel(s);
      }
    }

    // ============================================================
    // DRAW
    // ============================================================
    function draw(s) {
      beginFrame();

      // Камера всегда центрирована на игроке
      camera.x = s.player.x - VIEW_W / 2;
      camera.y = s.player.y - VIEW_H / 2;
      const worldW = s.gridSize * CP;
      const worldH = s.gridSize * CP;
      // camera.x = Math.max(0, Math.min(camera.x, worldW - VIEW_W));
      // camera.y = Math.max(0, Math.min(camera.y, worldH - VIEW_H));

      // Пересчитываем мировые координаты мыши каждый кадр
      s.mouse.x = mouseScreen.x + camera.x;
      s.mouse.y = mouseScreen.y + camera.y;

      // Кешируем видимые клетки для оптимизации
      const visibleCells = new Set();
      for (let y = 0; y < s.gridSize; y++) {
        for (let x = 0; x < s.gridSize; x++) {
          if (isCellVisible(x, y)) {
            visibleCells.add(cellKey(x, y));
          }
        }
      }

      // Apply screen shake in bullet direction
      const shakeX = Math.cos(screenShake.angle) * screenShake.amount;
      const shakeY = Math.sin(screenShake.angle) * screenShake.amount;
      screenShake.amount *= CONFIG.SHAKE_DECAY;

      ctx.save();
      ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

      // Фон
      ctx.fillStyle = '#030810';
      ctx.fillRect(0, 0, worldW, worldH);


      // Навсегда закрытые (чёрные) клетки — только те, что смежны с хотя бы одной открытой или everRevealed
      const blackCells = new Set([...s.permanentlyClosed, ...s.disabledCells]);
      for (const k of blackCells) {
        const { x, y } = cellFromKey(k);
        // Показываем только если хотя бы один сосед когда-либо был реально открыт
        if (!someAdjacentCell(x, y, (nx, ny, nk) => s.everOpenedCells.has(nk))) continue;
        if (!visibleCells.has(k)) continue;
        ctx.fillStyle = '#000000';
        ctx.fillRect(x * CP, y * CP, CP, CP);
      }

      // Неоткрытые клетки (не исследованные) — рисуем closedcell.png
      for (let y = 0; y < s.gridSize; y++) {
        for (let x = 0; x < s.gridSize; x++) {
          const k = cellKey(x, y);
          // Пропускаем если клетка уже открыта, открывалась ранее, или недоступна
          if (s.openCells.has(k) || s.everRevealedCells.has(k) ||
              s.disabledCells.has(k) || s.permanentlyClosed.has(k)) continue;
          if (!visibleCells.has(k)) continue;
          if (closedCellImg.complete && closedCellImg.naturalWidth > 0) {
            ctx.drawImage(closedCellImg, x * CP, y * CP, CP, CP);
          } else {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(x * CP, y * CP, CP, CP);
          }
        }
      }

      // Открытые клетки
      for (const k of s.openCells) {
        if (!visibleCells.has(k)) continue;
        const { x, y } = cellFromKey(k);
        const isExit = x === s.exitCell.x && y === s.exitCell.y;

        if (isExit) {
          ctx.fillStyle = `rgba(0,60,20,0.9)`;
          ctx.fillRect(x * CP, y * CP, CP, CP);
        } else {
          drawFloorCell(ctx, x, y, CP, s.openCells);
        }

        if (isExit) {
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
          ctx.font = 'bold 10px "Share Tech Mono"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (s.keysCollected >= s.keysRequired) {
            ctx.strokeStyle = `rgba(0,255,100,${0.5 + pulse * 0.5})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(x * CP + 1, y * CP + 1, CP - 2, CP - 2);
            ctx.fillStyle = `rgba(0,255,100,${0.6 + pulse * 0.4})`;
            ctx.fillText('ВЫХОД', (x + 0.5) * CP, (y + 0.5) * CP);
          } else {
            ctx.strokeStyle = `rgba(255,170,0,${0.5 + pulse * 0.5})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(x * CP + 1, y * CP + 1, CP - 2, CP - 2);
            ctx.fillStyle = `rgba(255,170,0,${0.6 + pulse * 0.4})`;
            ctx.fillText(`ВЫХОД (КЛЮЧИ ${s.keysCollected}/${s.keysRequired})`, (x + 0.5) * CP, (y + 0.5) * CP);
          }
        }
      }

      // Стены по краям открытых клеток
      drawOpenCellWalls(s.openCells, CP, CP * 0.125);
      drawOpenCellCorners(s.openCells, CP, CP * 0.125);

      // Смежные закрытые клетки (видно содержимое) — все когда-либо виденные, не открытые и не чёрные
      const adj = new Set();
      for (const k of s.everRevealedCells) {
        if (!s.openCells.has(k) && !s.disabledCells.has(k) && !s.permanentlyClosed.has(k)) adj.add(k);
      }

      // Пауки в закрытых комнатах (видны)
      for (const g of s.spiders) {
        if (!g.trapped) continue;
        const gc = cellOf(g.x, g.y);
        const cellKey_gc = cellKey(gc.x, gc.y);
        // Видны если клетка когда-либо была смежной с открытой И сейчас видна
        if (!s.everRevealedCells.has(cellKey_gc) || !visibleCells.has(cellKey_gc)) continue;

        drawSpider(g, 1); // Непрозрачные, статичны
      }
      
      // Клетки, смежные с игроком — доступны для открытия (ПКМ), подсвечиваем зелёным
      const playerCellForDraw = cellOf(s.player.x, s.player.y);
      const playerAdjOpen = new Set();
      for (const [ddx, ddy] of CARDINAL_DIRECTIONS) {
        const nx = playerCellForDraw.x + ddx, ny = playerCellForDraw.y + ddy;
        const nk = cellKey(nx, ny);
        if (nx >= 0 && nx < s.gridSize && ny >= 0 && ny < s.gridSize &&
            !s.openCells.has(nk) && !s.disabledCells.has(nk) && !s.permanentlyClosed.has(nk)) {
          playerAdjOpen.add(nk);
        }
      }

      for (const k of adj) {
        if (!visibleCells.has(k)) continue;
        const { x, y } = cellFromKey(k);
        if (x < 0 || x >= s.gridSize || y < 0 || y >= s.gridSize) continue;

        // Фон смежной клетки
        if (playerAdjOpen.has(k)) {
          ctx.fillStyle = 'rgba(45,138,69,0.15)';
          ctx.fillRect(x * CP + 1, y * CP + 1, CP - 2, CP - 2);
        } else {
          ctx.fillStyle = 'rgba(40,30,50,0.3)';
          ctx.fillRect(x * CP + 1, y * CP + 1, CP - 2, CP - 2);
        }

        // Показываем содержимое
        const isExitCell = x === s.exitCell.x && y === s.exitCell.y;
        if (isExitCell) {
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
          ctx.font = 'bold 11px "Share Tech Mono"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (s.keysCollected >= s.keysRequired) {
            ctx.fillStyle = `rgba(0,255,100,${0.6 + pulse * 0.4})`;
            ctx.fillText('ВЫХОД', (x + 0.5) * CP, (y + 0.5) * CP);
          } else {
            ctx.fillStyle = `rgba(255,170,0,${0.6 + pulse * 0.4})`;
            ctx.fillText('ВЫХОД (ЗАКРЫТ)', (x + 0.5) * CP, (y + 0.5) * CP);
          }
        }

        const content = s.cellContents.get(k);
        if (content) {
          if (content.type === 'heart') {
            // Рисуем сердечко
            const hx = (x + 0.5) * CP;
            const hy = (y + 0.5) * CP;
            const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.008);
            ctx.fillStyle = `rgba(255, 107, 157, ${pulse})`;
            ctx.shadowColor = '#ff6b9d';
            ctx.shadowBlur = 15;
            ctx.font = 'bold 20px "Share Tech Mono"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('♥', hx, hy);
            ctx.shadowBlur = 0;
            // } else if (content.type === 'enemies') {
            //   // Рисуем индикатор врагов
            //   ctx.fillStyle = 'rgba(176, 96, 255, 0.6)';
            //   ctx.font = 'bold 14px "Share Tech Mono"';
            //   ctx.textAlign = 'center';
            //   ctx.textBaseline = 'middle';
            //   ctx.fillText(`${content.enemyCount}👻`, (x+0.5)*CP, (y+0.5)*CP);
          } else if (content.type === 'key') {
            // Рисуем ключик
            const hx = (x + 0.5) * CP;
            const hy = (y + 0.5) * CP;
            const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.008);
            ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
            ctx.font = 'bold 20px "Share Tech Mono"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔑', hx, hy);
            ctx.shadowBlur = 0;
          } else if (content.type === 'upgrade') {
            const hx = (x + 0.5) * CP;
            const hy = (y + 0.5) * CP;
            const upgDef = UPGRADE_TYPES.find(u => u.id === content.upgradeType);
            if (upgDef) {
              ctx.fillStyle = upgDef.color;
              ctx.shadowColor = upgDef.color;
              ctx.shadowBlur = 10;
              ctx.font = 'bold 20px "Share Tech Mono"';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('⬆', hx, hy);
              ctx.shadowBlur = 0;
            }
          }
        }

        // Оружие в закрытых смежных клетках (видно через стены)
        for (const dw of s.droppedWeapons) {
          const wc = cellOf(dw.x, dw.y);
          if (cellKey(wc.x, wc.y) !== k) continue;
          const wDef = WEAPON_DEFS[dw.weaponId];
          if (!wDef) continue;
          const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.007);
          ctx.shadowColor = wDef.color;
          ctx.shadowBlur = 12;
          drawWeaponSprite(ctx, dw.weaponId, dw.x, dw.y - 8, 28, 0.7, pulse);
          ctx.shadowBlur = 0;
          ctx.font = 'bold 9px "Share Tech Mono"';
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.6;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(wDef.label, dw.x, dw.y + 8);
          ctx.globalAlpha = 1;
        }
      }

      // Зелёная подсветка клеток у игрока, не попавших в adj (ещё не в everRevealedCells)
      for (const k of playerAdjOpen) {
        if (adj.has(k)) continue; // уже нарисована выше
        if (!visibleCells.has(k)) continue;
        const { x, y } = cellFromKey(k);
        if (x < 0 || x >= s.gridSize || y < 0 || y >= s.gridSize) continue;
        ctx.fillStyle = 'rgba(20,60,30,0.15)';
        ctx.fillRect(x * CP + 1, y * CP + 1, CP - 2, CP - 2);
      }

      // Сердечки в открытых клетках
      for (const heart of s.hearts) {
        if (heart.collected) continue;
        const hc = cellOf(heart.x, heart.y);
        const heartCellKey = cellKey(hc.x, hc.y);
        if (!s.openCells.has(heartCellKey) || !visibleCells.has(heartCellKey)) continue;

        const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.008);
        ctx.fillStyle = `rgba(255, 107, 157, ${pulse})`;
        ctx.shadowColor = '#ff6b9d';
        ctx.shadowBlur = 15;
        ctx.font = 'bold 24px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', heart.x, heart.y);
        ctx.shadowBlur = 0;
      }

      // Ключи в открытых клетках
      for (const keyObj of s.keyObjs) {
        if (keyObj.collected) continue;
        const kc = cellOf(keyObj.x, keyObj.y);
        const keyCellKey = cellKey(kc.x, kc.y);
        if (!s.openCells.has(keyCellKey) || !visibleCells.has(keyCellKey)) continue;

        const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.008);
        ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
        ctx.font = 'bold 24px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔑', keyObj.x, keyObj.y);
        ctx.shadowBlur = 0;
      }

      // Апгрейды в открытых клетках
      for (const upg of s.upgradeObjs) {
        if (upg.collected) continue;
        const uc = cellOf(upg.x, upg.y);
        const upgCellKey = cellKey(uc.x, uc.y);
        if (!s.openCells.has(upgCellKey) || !visibleCells.has(upgCellKey)) continue;

        const upgDef = UPGRADE_TYPES.find(u => u.id === upg.upgradeType);
        if (upgDef) {
          ctx.fillStyle = upgDef.color;
          ctx.shadowColor = upgDef.color;
          ctx.shadowBlur = 15;
          ctx.font = 'bold 24px "Share Tech Mono"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⬆', upg.x, upg.y);
          ctx.shadowBlur = 0;
        }
      }

      // Проклятые сундуки (видны в открытых И в revealed-клетках)
      for (const chest of (s.chestObjs || [])) {
        if (chest.collected) continue;
        const cc = cellOf(chest.x, chest.y);
        const ck = cellKey(cc.x, cc.y);
        if (!visibleCells.has(ck)) continue;
        const isOpen = s.openCells.has(ck);
        const isRevealed = s.everRevealedCells.has(ck);
        if (!isOpen && !isRevealed) continue;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#cc44ff';
        ctx.shadowBlur = isOpen ? 18 : 8;
        ctx.font = 'bold 26px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', chest.x, chest.y);
        ctx.shadowBlur = 0;
      }

      // Оружие на полу
      for (const dw of s.droppedWeapons) {
        const wc = cellOf(dw.x, dw.y);
        const weaponCellKey = cellKey(wc.x, wc.y);
        if (!s.openCells.has(weaponCellKey) || !visibleCells.has(weaponCellKey)) continue;
        const wDef = WEAPON_DEFS[dw.weaponId];
        if (!wDef) continue;
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.007);
        ctx.shadowColor = wDef.color;
        ctx.shadowBlur = 12;
        drawWeaponSprite(ctx, dw.weaponId, dw.x, dw.y - 8, 28, 1, pulse);
        ctx.shadowBlur = 0;
        ctx.font = 'bold 9px "Share Tech Mono"';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wDef.label, dw.x, dw.y + 8);
        ctx.globalAlpha = 1;
      }

      // Пули игрока
      for (const b of s.bullets) {
        ctx.fillStyle = '#ffffaa';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, CONFIG.BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Вражеские пули
      for (const eb of s.enemyBullets) {
        ctx.fillStyle = '#ff4400';
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(eb.x, eb.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Активные пауки (выпущенные)
      for (const g of s.activeSpiders) {
        drawSpider(g, 1);
      }

      // Частицы
      for (const p of s.particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Летящее сердечко (поверх всего в мировых координатах)
      drawFlyingHeartInWorld();

      // Игрок
      const p = s.player;
      const blinkOk = s.player.invulnerable <= 0 || Math.floor(s.player.invulnerable * 10) % 2 === 0;
      if (blinkOk) {
        const HERO_DRAW_SCALE = (CONFIG.PLAYER_SPRITE_RADIUS * 2) / HERO_SW;
        drawPlayerSprite(p.x, p.y, HERO_DRAW_SCALE);
      }

      // Индикатор разброса: две полупрозрачных линии от игрока
      if (CONFIG.DEBUG_SPREAD_INDICATOR) {
        const weapon = getActiveWeapon(s);
        if (weapon) {
          let totalSpread = weapon.spread * s.upgrades.spreadMult;
          if (s.upgrades.sniper && s.battle && s.battle.openCells) {
            const roomCount = s.battle.openCells.size;
            if (roomCount <= 2) totalSpread = 0;
            else totalSpread *= (1 + 0.10 * (roomCount - 2));
          }
          const aimA = Math.atan2(s.mouse.y - s.player.y, s.mouse.x - s.player.x);
          const lineLen = (weapon.range != null ? weapon.range * RANGE_SCALE : 150);
          const startOffset = CONFIG.PLAYER_SPRITE_RADIUS + 2;
          const halfSpread = totalSpread / 2;
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#aaaaaa';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 5]);
          for (const side of [-1, 1]) {
            const a = aimA + side * halfSpread;
            ctx.beginPath();
            ctx.moveTo(s.player.x + Math.cos(a) * startOffset, s.player.y + Math.sin(a) * startOffset);
            ctx.lineTo(s.player.x + Math.cos(a) * (startOffset + lineLen), s.player.y + Math.sin(a) * (startOffset + lineLen));
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      ctx.restore();

      // Виньетка при малом количестве жизней
      if (s.player.lives === 2) {
        const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 3, VIEW_W / 2, VIEW_H / 2, Math.sqrt((VIEW_W) ** 2 + (VIEW_H) ** 2));
        grad.addColorStop(0, 'rgba(255, 120, 0, 0)');
        grad.addColorStop(1, 'rgba(255, 120, 0, 0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      } else if (s.player.lives === 1) {
        const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 3, VIEW_W / 2, VIEW_H / 2, Math.sqrt((VIEW_W) ** 2 + (VIEW_H) ** 2));
        grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(255, 0, 0, 0.55)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }

      // Interact hint (F key prompt)
      {
        const px = s.player.x, py = s.player.y;
        const ec = s.exitCell;
        const onExit = s.openCells.has(cellKey(ec.x, ec.y)) &&
          px > ec.x * CP && px < (ec.x + 1) * CP &&
          py > ec.y * CP && py < (ec.y + 1) * CP &&
          s.keysCollected >= s.keysRequired;
        let nearWeapon = false;
        for (const dw of s.droppedWeapons) {
          const wc = cellOf(dw.x, dw.y);
          if (!s.openCells.has(cellKey(wc.x, wc.y))) continue;
          if (Math.hypot(px - dw.x, py - dw.y) < CONFIG.PLAYER_RADIUS + CONFIG.WEAPON_PICKUP_DISTANCE) { nearWeapon = true; break; }
        }
        if (onExit || nearWeapon) {
          const text = 'F';
          const bx = VIEW_W / 2;
          const by = VIEW_H - 36;
          ctx.save();
          ctx.font = 'bold 13px "Share Tech Mono"';
          const tw = 50;
          const pad = 10;
          const bw = tw + pad * 2 + 28;
          const bh = 28;
          ctx.fillStyle = 'rgba(5, 12, 22, 0.88)';
          ctx.strokeStyle = '#00d4ff';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = '#00d4ff';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 4);
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(0, 212, 255, 0.45)';
          const keySize = 18;
          const kx = bx - bw / 2 + pad;
          const ky = by - keySize / 2;
          ctx.beginPath();
          ctx.roundRect(kx, ky, keySize, keySize, 3);
          ctx.fill();
          ctx.strokeStyle = '#00d4ff';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#00d4ff';
          ctx.font = 'bold 12px "Share Tech Mono"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('F', kx + keySize / 2, by);
          ctx.fillStyle = 'rgba(160, 200, 224, 0.9)';
          ctx.font = '11px "Share Tech Mono"';
          ctx.textAlign = 'left';
          ctx.fillText(onExit ? 'Выход' : 'Подобрать', kx + keySize + 6, by);
          ctx.restore();
        }
      }

      // Tooltip оружия при наведении (play mode)
      for (const dw of s.droppedWeapons) {
        const wc = cellOf(dw.x, dw.y);
        const wck = cellKey(wc.x, wc.y);
        if (!s.everRevealedCells.has(wck) || !visibleCells.has(wck)) continue;
        const dist = Math.hypot(s.mouse.x - dw.x, s.mouse.y - dw.y);
        if (dist < CP * 0.2) {
          const wDef = WEAPON_DEFS[dw.weaponId];
          if (wDef) {
            const sx = dw.x - camera.x;
            const sy = dw.y - camera.y;
            drawUpgradeTooltip(sx, sy, wDef);
          }
          break;
        }
      }

      // Tooltip апгрейда при наведении (play mode, экранные координаты)
      for (const upg of s.upgradeObjs) {
        if (upg.collected) continue;
        const uc = cellOf(upg.x, upg.y);
        const upgCk = cellKey(uc.x, uc.y);
        if (!s.everRevealedCells.has(upgCk)) continue;
        const dist = Math.hypot(s.mouse.x - upg.x, s.mouse.y - upg.y);
        if (dist < CP * 0.2) {
          const upgDef = UPGRADE_TYPES.find(u => u.id === upg.upgradeType);
          if (upgDef) {
            const sx = upg.x - camera.x;
            const sy = upg.y - camera.y;
            drawUpgradeTooltip(sx, sy, upgDef);
          }
          break;
        }
      }

      drawHUD(s);

      if (showStatsPanel) {
        drawStatsPanel(s);
      }
    }

    function drawStatsPanel(s) {
      const panelW = 280;
      const lineH = 22;
      const pad = 16;
      const weapon = getActiveWeapon(s);
      
      // Расчет точности с учетом снайпера
      let totalSpread = (weapon?.spread || 0) * (s.upgrades.spreadMult || 1);
      if (s.upgrades.sniper && s.battle && s.battle.openCells) {
        const roomCount = s.battle.openCells.size;
        if (roomCount <= 2) {
          totalSpread = 0; // Максимальная точность при 2 комнатах или меньше
        } else {
          const extraRooms = roomCount - 2;
          totalSpread *= (1 + 0.10 * extraRooms); // +10% разброса за каждую дополнительную комнату
        }
      }
      const spreadDeg = Math.round(totalSpread * (180 / Math.PI));
      
      // Расчет дальности с учетом дальнобойщика
      let baseRange = weapon?.range || CONFIG.BULLET_LIFE;
      if (s.upgrades.longRange && s.battle && s.battle.openCells) {
        const roomCount = s.battle.openCells.size;
        baseRange = Math.round(baseRange * (1 + 0.20 * roomCount));
      }
      
      const rows = [
        { label: 'ЖИЗНИ', value: `${s.player.lives}`, color: '#ff4444' },
        { label: 'СКОРОСТЬ БЕГА', value: `${Math.round(CONFIG.PLAYER_SPEED * s.upgrades.speedMult)}`, color: '#44ff88' },
        { label: 'УРОН ПУЛИ', value: `${weapon?.damage || CONFIG.BULLET_DAMAGE}`, color: '#ff8800' },
        { label: 'ПУЛЬ ЗА ВЫСТРЕЛ', value: `${(weapon?.pellets || 1) + s.upgrades.pellets}`, color: '#00d4ff' },
        { label: 'ТОЧНОСТЬ', value: spreadDeg === 0 ? 'Идеальная' : `±${spreadDeg}°`, color: '#ff66aa' },
        { label: 'ДАЛЬНОСТЬ ПУЛИ', value: `${baseRange}`, color: '#88ff44' },
        { label: 'ПРОБИТИЕ ВРАГОВ', value: `${(weapon?.penetrate || 0) + s.upgrades.penetrate}`, color: '#aa44ff' },
        { label: 'СКОРОСТЬ ПУЛИ', value: `${Math.round((weapon?.bulletSpeed || CONFIG.BULLET_SPEED) * s.upgrades.bulletSpeedMult)}`, color: '#ffff44' },
        { label: 'ПЕРЕЗАРЯДКА', value: `${((weapon?.cooldown || 0.35) * s.upgrades.cooldownMult).toFixed(2)}с`, color: '#00ccff' },
        { label: 'ШАНС КРИТА', value: `${Math.round(s.upgrades.critChance * 100)}%`, color: '#ff0000' },
      ];

      if (s.upgrades.shield > 0) rows.push({ label: 'ЩИТЫ', value: `${s.upgrades.shield}`, color: '#00aaff' });
      if (s.upgrades.killAccel) rows.push({ label: 'РАЗГОН ПЕРЕЗАРЯДКИ', value: `${s.upgrades.killAccelPercent.toFixed(1)}%`, color: '#ff8800' });

      const panelH = pad * 2 + rows.length * lineH + 24;
      const panelX = (VIEW_W - panelW) / 2;
      const panelY = (VIEW_H - panelH) / 2;

      ctx.save();
      ctx.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);

      // Background
      ctx.shadowBlur = 30;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.fillStyle = 'rgba(8,12,20,0.95)';
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 12);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Border
      ctx.strokeStyle = 'rgba(0,212,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 12);
      ctx.stroke();

      // Title
      ctx.font = 'bold 16px "Orbitron", sans-serif';
      ctx.fillStyle = '#00d4ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('ХАРАКТЕРИСТИКИ', panelX + panelW / 2, panelY + pad);

      // Rows
      let y = panelY + pad + 28;
      for (const row of rows) {
        ctx.font = '12px "Share Tech Mono"';
        ctx.fillStyle = 'rgba(140,160,180,0.8)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(row.label, panelX + pad, y);

        ctx.font = 'bold 14px "Orbitron", sans-serif';
        ctx.fillStyle = row.color;
        ctx.textAlign = 'right';
        ctx.fillText(row.value, panelX + panelW - pad, y);

        y += lineH;
      }

      ctx.restore();
    }

    function drawUpgradeTooltip(screenX, screenY, upgDef) {
      const label = upgDef.label;
      const desc = upgDef.description || '';
      const color = upgDef.color;
      const pad = 10;
      const lineGap = 6;
      ctx.font = 'bold 13px "Share Tech Mono"';
      const labelW = ctx.measureText(label).width;
      ctx.font = '11px "Share Tech Mono"';
      const descW = ctx.measureText(desc).width;
      const boxW = Math.max(labelW, descW) + pad * 2;
      const boxH = 13 + lineGap + 11 + pad * 2;
      let tx = screenX + 18;
      let ty = screenY - boxH / 2;
      if (tx + boxW > VIEW_W - 4) tx = screenX - boxW - 10;
      if (ty < 4) ty = 4;
      if (ty + boxH > VIEW_H - 4) ty = VIEW_H - 4 - boxH;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(5, 12, 22, 0.93)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(tx, ty, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = color;
      ctx.font = 'bold 13px "Share Tech Mono"';
      ctx.fillText(label, tx + pad, ty + pad);
      ctx.fillStyle = 'rgba(200,220,240,0.85)';
      ctx.font = '11px "Share Tech Mono"';
      ctx.fillText(desc, tx + pad, ty + pad + 13 + lineGap);
      ctx.restore();
    }

    function drawSpider(g, baseAlpha, scale = 1, skipVisibilityCheck = false) {
      const spiderRadius = (g.radius || CONFIG.SPIDER_RADIUS) * scale;
      if (!skipVisibilityCheck && (g.x + spiderRadius < camera.x || g.x - spiderRadius > camera.x + VIEW_W ||
        g.y + spiderRadius < camera.y || g.y - spiderRadius > camera.y + VIEW_H)) return;

      const r = spiderRadius;
      const alpha = baseAlpha;

      const isPlevaka = g.type === 'plevaka' || g.type === 'shooter';
      const isBull = g.type === 'bull';
      const isBuldyga = g.type === 'buldyga';
      const isSoldier = g.type === 'soldier' || g.type === 'chaser';
      const isCocoon = g.type === 'cocoon';
      const isBloated = g.type === 'bloated';
      ctx.globalAlpha = 1.0;

      if (isCocoon) {
        // Кокон — будет отрисован ниже как спрайт без тени
      } else if (isBloated) {
        // Распухший — жёлто-зелёный, вздутый
        ctx.fillStyle = '#88aa22';
        ctx.shadowColor = '#556611';
      } else if (isBull) {
        // Бык — крупный, тёмно-красный, массивный
        ctx.fillStyle = '#8b0000';
        ctx.shadowColor = '#4a0000';
      } else if (isBuldyga) {
        // Булдыга — фиолетовый, тяжёлый
        ctx.fillStyle = '#4b0082';
        ctx.shadowColor = '#2d0050';
      } else if (isPlevaka) {
        ctx.fillStyle = '#ff6020';
        ctx.shadowColor = '#ff2200';
      } else {
        ctx.fillStyle = '#228822';
        ctx.shadowColor = '#114411';
      }
      ctx.shadowBlur = 18 * scale;

      if (isCocoon) {
        // Кокон: sprite sheet animation (no shadow glow)
        ctx.shadowBlur = 0; // disable glow for cocoon
        if (cocoonImg.complete && cocoonImg.naturalWidth > 0) {
          // Calculate animation frame based on global time
          const animDuration = COCOON_ANIM.frames / COCOON_ANIM.fps;
          const animTime = (state.time % animDuration) / animDuration;
          const frame = Math.floor(animTime * COCOON_ANIM.frames);
          const sx = frame * COCOON_SW;
          const drawSize = r * 2.2; // simple size based on radius (r already includes scale)
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.drawImage(
            cocoonImg,
            sx, 0, COCOON_SW, COCOON_SH,
            g.x - drawSize / 2, g.y - drawSize / 2, drawSize, drawSize
          );
          ctx.restore();
        } else {
          // Fallback: овальная форма если картинка не загрузилась
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#cccccc';
          ctx.beginPath(); ctx.ellipse(g.x, g.y, r * 0.8, r * 1.0, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#aaaaaa';
          ctx.beginPath(); ctx.ellipse(g.x - r * 0.2, g.y - r * 0.2, r * 0.4, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        // Skip rest of drawing (no legs for cocoon)
        ctx.globalAlpha = 1;

        // HP бар для кокона
        const maxHp = CONFIG.COCOON_HP;
        if (g.hp !== undefined && g.hp < maxHp) {
          const hpFrac = Math.max(0, g.hp / maxHp);
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = '#1a0030';
          ctx.fillRect(g.x - r, g.y - r - 8 * scale, r * 2, 3 * scale);
          ctx.fillStyle = hpFrac > 0.5 ? '#aaaaaa' : '#666666';
          ctx.fillRect(g.x - r, g.y - r - 8 * scale, r * 2 * hpFrac, 3 * scale);
        }
        ctx.globalAlpha = 1;
        return;
      } else if (isBloated) {
        // Распухший: вздутое тело, почти круглое
        ctx.beginPath(); ctx.ellipse(g.x, g.y + r * 0.1, r * 0.9, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
        // Верхняя часть
        ctx.beginPath(); ctx.ellipse(g.x, g.y - r * 0.5, r * 0.6, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        // Пузырьки/вздутость
        ctx.fillStyle = '#aacc33';
        ctx.shadowColor = '#88aa22';
        ctx.shadowBlur = 4 * scale;
        ctx.beginPath(); ctx.arc(g.x + r * 0.3, g.y, r * 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x - r * 0.3, g.y + r * 0.2, r * 0.2, 0, Math.PI * 2); ctx.fill();
      } else if (isBull) {
        // Бык: массивное тело (более крупное и круглое)
        ctx.beginPath(); ctx.ellipse(g.x, g.y, r * 0.9, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
        // Дополнительное плечевое бронирование
        ctx.beginPath(); ctx.ellipse(g.x, g.y - r * 0.3, r * 0.65, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        // Рога
        ctx.fillStyle = '#cccccc';
        ctx.shadowColor = '#888888';
        ctx.shadowBlur = 8 * scale;
        ctx.beginPath();
        ctx.moveTo(g.x - r * 0.5, g.y - r * 0.6);
        ctx.quadraticCurveTo(g.x - r * 0.8, g.y - r * 1.2, g.x - r * 0.6, g.y - r * 1.3);
        ctx.quadraticCurveTo(g.x - r * 0.4, g.y - r * 0.9, g.x - r * 0.3, g.y - r * 0.7);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(g.x + r * 0.5, g.y - r * 0.6);
        ctx.quadraticCurveTo(g.x + r * 0.8, g.y - r * 1.2, g.x + r * 0.6, g.y - r * 1.3);
        ctx.quadraticCurveTo(g.x + r * 0.4, g.y - r * 0.9, g.x + r * 0.3, g.y - r * 0.7);
        ctx.fill();
      } else if (isBuldyga) {
        // Булдыга: массивное широкое тело
        ctx.beginPath(); ctx.ellipse(g.x, g.y, r * 1.0, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        // Верхняя часть — более крупная
        ctx.beginPath(); ctx.ellipse(g.x, g.y - r * 0.35, r * 0.7, r * 0.65, 0, 0, Math.PI * 2); ctx.fill();
        // Шипы на спине
        ctx.fillStyle = '#6a0dad';
        ctx.shadowColor = '#4b0082';
        ctx.shadowBlur = 6 * scale;
        for (let i = -2; i <= 2; i++) {
          const spikeX = g.x + i * r * 0.35;
          const spikeY = g.y - r * 0.6;
          ctx.beginPath();
          ctx.moveTo(spikeX - r * 0.1, spikeY);
          ctx.lineTo(spikeX, spikeY - r * 0.4);
          ctx.lineTo(spikeX + r * 0.1, spikeY);
          ctx.fill();
        }
      } else {
        // Обычное тело (паук) — abdomen + cephalothorax
        ctx.beginPath(); ctx.ellipse(g.x, g.y + r * 0.25, r * 0.7, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(g.x, g.y - r * 0.55, r * 0.5, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      }

      // Legs (8 legs, 4 per side) — angles relative to horizontal, spread outward
      ctx.shadowBlur = 0;
      if (isBloated) {
        ctx.strokeStyle = '#88aa22';
        ctx.lineWidth = Math.max(1, r * 0.15);
      } else if (isBull) {
        ctx.strokeStyle = '#8b0000';
        ctx.lineWidth = Math.max(2, r * 0.25);
      } else if (isBuldyga) {
        ctx.strokeStyle = '#4b0082';
        ctx.lineWidth = Math.max(2, r * 0.22);
      } else if (isPlevaka) {
        ctx.strokeStyle = '#ff6020';
        ctx.lineWidth = Math.max(1, r * 0.18);
      } else {
        ctx.strokeStyle = '#228822';
        ctx.lineWidth = Math.max(1, r * 0.18);
      }
      ctx.globalAlpha = 1.0;
      // angOffsets: angle from horizontal (0=right/left), negative=up, positive=down
      const angOffsets = [-0.55, -0.18, 0.18, 0.55];
      for (let side = -1; side <= 1; side += 2) {
        for (let li = 0; li < angOffsets.length; li++) {
          // base angle: side=-1 means left (π), side=1 means right (0)
          const baseAng = (side === -1 ? Math.PI : 0) + angOffsets[li] * side;
          const midAng = baseAng + 0.3 * side;
          const legMult = (isBull || isBuldyga) ? 1.15 : 1.0;
          const midX = g.x + Math.cos(baseAng) * r * 1.4 * legMult;
          const midY = g.y - r * 0.1 + Math.sin(baseAng) * r * 1.1 * legMult;
          const tipX = g.x + Math.cos(midAng) * r * 2.4 * legMult;
          const tipY = g.y + r * 0.5 + Math.sin(midAng) * r * 1.6 * legMult;
          ctx.beginPath();
          ctx.moveTo(g.x + side * r * 0.45, g.y - r * 0.1);
          ctx.quadraticCurveTo(midX, midY, tipX, tipY);
          ctx.stroke();
        }
      }

      // Eyes
      ctx.globalAlpha = 1.0;
      if (isBull) {
        ctx.fillStyle = '#ff0000'; // Красные глаза у быка
      } else if (isBuldyga) {
        ctx.fillStyle = '#dda0dd'; // Светло-фиолетовые глаза у булдыги
      } else if (isPlevaka) {
        ctx.fillStyle = '#ffaa00';
      } else {
        ctx.fillStyle = '#88ff44';
      }
      if (isBull) {
        // Бык: более крупные глаза, агрессивные
        ctx.beginPath(); ctx.arc(g.x - r * 0.25, g.y - r * 0.35, r * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x + r * 0.25, g.y - r * 0.35, r * 0.15, 0, Math.PI * 2); ctx.fill();
        // Злой взгляд — дополнительные "брови"
        ctx.fillStyle = '#4a0000';
        ctx.beginPath(); ctx.arc(g.x - r * 0.25, g.y - r * 0.45, r * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x + r * 0.25, g.y - r * 0.45, r * 0.08, 0, Math.PI * 2); ctx.fill();
      } else if (isBuldyga) {
        // Булдыга: крупные фиолетовые глаза
        ctx.beginPath(); ctx.arc(g.x - r * 0.28, g.y - r * 0.4, r * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x + r * 0.28, g.y - r * 0.4, r * 0.16, 0, Math.PI * 2); ctx.fill();
        // Тяжёлый взгляд — дополнительные пятна
        ctx.fillStyle = '#9932cc';
        ctx.beginPath(); ctx.arc(g.x - r * 0.3, g.y - r * 0.5, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x + r * 0.3, g.y - r * 0.5, r * 0.1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(g.x - r * 0.22, g.y - r * 0.6, r * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x + r * 0.22, g.y - r * 0.6, r * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x - r * 0.08, g.y - r * 0.72, r * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x + r * 0.08, g.y - r * 0.72, r * 0.08, 0, Math.PI * 2); ctx.fill();
      }

      // HP бар
      let maxHp;
      if (isBull) maxHp = CONFIG.BULL_HP;
      else if (isBuldyga) maxHp = CONFIG.BULDYGA_HP;
      else if (isPlevaka) maxHp = CONFIG.SHOOTER_HP;
      else if (isCocoon) maxHp = CONFIG.COCOON_HP;
      else if (isBloated) maxHp = CONFIG.BLOATED_HP;
      else maxHp = CONFIG.SPIDER_HP;
      if (g.hp !== undefined && g.hp < maxHp) {
        const hpFrac = Math.max(0, g.hp / maxHp);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#1a0030';
        ctx.fillRect(g.x - r, g.y - r - 8 * scale, r * 2, 3 * scale);
        if (isBull) {
          ctx.fillStyle = hpFrac > 0.5 ? '#cc4444' : '#ff0000';
        } else if (isBuldyga) {
          ctx.fillStyle = hpFrac > 0.5 ? '#9932cc' : '#dda0dd';
        } else if (isPlevaka) {
          ctx.fillStyle = hpFrac > 0.5 ? '#ff8800' : '#ff4400';
        } else if (isCocoon) {
          ctx.fillStyle = hpFrac > 0.5 ? '#aaaaaa' : '#666666';
        } else if (isBloated) {
          ctx.fillStyle = hpFrac > 0.5 ? '#aacc33' : '#88aa22';
        } else {
          ctx.fillStyle = hpFrac > 0.5 ? '#44cc22' : '#88ff44';
        }
        ctx.fillRect(g.x - r, g.y - r - 8 * scale, r * 2 * hpFrac, 3 * scale);
      }

      // Индикатор состояния быка (подготовка/рывок)
      if (isBull && g.state) {
        if (g.state === 'prepare') {
          // Пульсирующий индикатор подготовки
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100);
          ctx.globalAlpha = pulse;
          ctx.fillStyle = '#ffff00';
          ctx.beginPath(); ctx.arc(g.x, g.y - r - 12 * scale, 3 * scale, 0, Math.PI * 2); ctx.fill();
        } else if (g.state === 'dash') {
          // Индикатор рывка
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#ff0000';
          ctx.beginPath(); ctx.arc(g.x, g.y - r - 12 * scale, 4 * scale, 0, Math.PI * 2); ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
    }

    // Проверка видимости клетки на экране
    function isCellVisible(cx, cy) {
      const x = cx * CP;
      const y = cy * CP;
      return x + CP > camera.x && x < camera.x + VIEW_W &&
        y + CP > camera.y && y < camera.y + VIEW_H;
    }

    function drawHUD(s) {
      if (!s) return;
      const barH = 36;
      const pad = 12;

      ctx.save();
      ctx.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);

      // Background bar
      ctx.fillStyle = 'rgba(5,10,15,0.82)';
      ctx.fillRect(0, 0, VIEW_W, barH);
      ctx.strokeStyle = 'rgba(26,58,92,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, barH - 0.5);
      ctx.lineTo(VIEW_W, barH - 0.5);
      ctx.stroke();

      const cy = barH / 2;
      let cursor = pad;

      // Helper: label + value side by side
      function hudItem(label, value, valueColor, extraWidth) {
        const gap = 4;
        ctx.font = '9px "Share Tech Mono"';
        ctx.fillStyle = 'rgba(42,74,106,1)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cursor, cy - 7);
        ctx.font = 'bold 13px "Orbitron", sans-serif';
        ctx.fillStyle = valueColor;
        ctx.fillText(value, cursor, cy + 6);
        const w = Math.max(ctx.measureText(label).width, ctx.measureText(value).width);
        cursor += (extraWidth || w) + 20;
      }

      // УРОВЕНЬ
      hudItem('УРОВЕНЬ', String(currentLevel), '#00d4ff');

      // Separator
      ctx.strokeStyle = 'rgba(26,58,92,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursor - 10, 6);
      ctx.lineTo(cursor - 10, barH - 6);
      ctx.stroke();

      // ЖИЗНИ — hearts
      ctx.font = '9px "Share Tech Mono"';
      ctx.fillStyle = 'rgba(42,74,106,1)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('ЖИЗНИ', cursor, cy - 7);
      const maxHearts = Math.max(3, s.player.lives);
      for (let i = 0; i < maxHearts; i++) {
        ctx.font = '13px sans-serif';
        ctx.fillStyle = i < s.player.lives ? '#ff3a3a' : 'rgba(42,74,106,0.5)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', cursor + i * 16, cy + 6);
      }
      cursor += maxHearts * 16 + 20;

      // Separator
      ctx.strokeStyle = 'rgba(26,58,92,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursor - 10, 6);
      ctx.lineTo(cursor - 10, barH - 6);
      ctx.stroke();

      // КЛЮЧИ
      hudItem('КЛЮЧИ', `${s.keysCollected}/${s.keysRequired}`, '#ffd700');

      // Separator
      ctx.strokeStyle = 'rgba(26,58,92,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursor - 10, 6);
      ctx.lineTo(cursor - 10, barH - 6);
      ctx.stroke();

      // ОРУЖИЕ — slots
      ctx.font = '9px "Share Tech Mono"';
      ctx.fillStyle = 'rgba(42,74,106,1)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('ОРУЖИЕ', cursor, cy - 7);
      let wCursor = cursor;
      for (let i = 0; i < s.maxSlots; i++) {
        const wId = s.weaponSlots[i];
        const wDef = wId ? WEAPON_DEFS[wId] : null;
        const label = wDef ? wDef.label : '—';
        const active = i === s.activeSlot;
        ctx.font = `${active ? 'bold' : ''} 11px "Share Tech Mono"`;
        ctx.fillStyle = active ? (wDef ? wDef.color : '#ffffff') : 'rgba(42,74,106,1)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`[${i+1}]${label}`, wCursor, cy + 6);
        wCursor += ctx.measureText(`[${i+1}]${label}`).width + 10;
      }
      cursor = wCursor + 10;

      // Separator
      ctx.strokeStyle = 'rgba(26,58,92,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursor - 10, 6);
      ctx.lineTo(cursor - 10, barH - 6);
      ctx.stroke();

      // UPGRADES - иконки
      ctx.font = '9px "Share Tech Mono"';
      ctx.fillStyle = 'rgba(42,74,106,1)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('УСИЛЕНИЯ', cursor, cy - 7);
      
      // Отображаем иконки активных улучшений
      let iconCursor = cursor;
      const iconSize = 16;
      const iconGap = 4;
      
      // Собираем активные улучшения с их уровнями
      const activeUpgrades = [];
      for (const upg of UPGRADE_TYPES) {
        let level = 0;
        if (upg.id === 'pellets') level = s.upgrades.pellets || 0;
        else if (upg.id === 'damage') level = s.upgrades.damage || 0;
        else if (upg.id === 'penetrate') level = s.upgrades.penetrate || 0;
        else if (upg.id === 'bulletSpeed') level = s.upgrades.bulletSpeedMult > 1 ? 1 : 0;
        else if (upg.id === 'critChance') level = s.upgrades.critChance > 0 ? Math.ceil(s.upgrades.critChance * 20) : 0;
        else if (upg.id === 'killAccel') level = s.upgrades.killAccel ? 1 : 0;
        else if (upg.id === 'enhancedPierce') level = s.upgrades.enhancedPierce ? 1 : 0;
        else if (upg.id === 'shield') level = s.upgrades.shield || 0;
        else if (upg.id === 'retreat') level = s.upgrades.retreat > 0 ? 1 : 0;
        else if (upg.id === 'reflection') level = s.upgrades.reflection ? 1 : 0;
        else if (upg.id === 'cooldown') level = s.upgrades.cooldownMult < 1 ? Math.ceil((1 - s.upgrades.cooldownMult) * 6.67) : 0;
        else if (upg.id === 'speed') level = s.upgrades.speedMult > 1 ? Math.ceil((s.upgrades.speedMult - 1) * 10) : 0;
        
        if (level > 0) {
          activeUpgrades.push({ ...upg, level: Math.min(level, upg.max) });
        }
      }
      
      // Рисуем иконки
      for (const upg of activeUpgrades) {
        ctx.font = '14px sans-serif';
        ctx.fillStyle = upg.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(upg.icon, iconCursor, cy + 6);
        
        // Если уровень > 1, показываем цифру
        if (upg.level > 1) {
          ctx.font = 'bold 9px "Share Tech Mono"';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(upg.level), iconCursor + 7, cy + 2);
        }
        
        iconCursor += iconSize + iconGap;
      }
      
      // Если нет улучшений, показываем прочерк
      if (activeUpgrades.length === 0) {
        ctx.font = 'bold 11px "Share Tech Mono"';
        ctx.fillStyle = 'rgba(42,74,106,1)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('—', cursor, cy + 6);
        iconCursor += 20;
      }

      // ── Secondary icon HUD (top-left, below the bar) ──────────────
      {
        const iconSize = 20;
        const iconGap  = 4;
        const rowGap   = 4;
        const panelPad = 8;
        const startX   = panelPad;
        let   rowY     = barH + panelPad;

        function drawHudRow(img, total, filled) {
          for (let i = 0; i < total; i++) {
            ctx.save();
            ctx.globalAlpha = i < filled ? 1 : 0.25;
            if (img.complete && img.naturalWidth > 0) {
              ctx.drawImage(img, startX + i * (iconSize + iconGap), rowY, iconSize, iconSize);
            }
            ctx.restore();
          }
          rowY += iconSize + rowGap;
        }

        // Hearts — only show collected (no dim slots)
        if (s.player.lives > 0) {
          drawHudRow(hudHeartImg, s.player.lives, s.player.lives);
        }

        // Shields — only show collected (no dim slots)
        const shieldCount = s.upgrades.shield || 0;
        if (shieldCount > 0) {
          drawHudRow(hudShieldImg, shieldCount, shieldCount);
        }

        // Keys — show all slots, dim uncollected
        drawHudRow(hudKeyImg, s.keysRequired, s.keysCollected);
      }

      // ── Weapon slots (bottom-left) ─────────────────────────────────
      {
        const slotSize  = 44;
        const slotGap   = 6;
        const slotPad   = 8;
        const labelH    = 14;
        const totalH    = slotSize + labelH + slotPad * 2;
        const totalW    = s.maxSlots * slotSize + (s.maxSlots - 1) * slotGap + slotPad * 2;
        const screenMargin = 8;
        const panelX    = screenMargin;
        const panelY    = VIEW_H - totalH - screenMargin;

        ctx.fillStyle = 'rgba(5,10,15,0.75)';
        ctx.fillRect(panelX, panelY, totalW, totalH);
        ctx.strokeStyle = 'rgba(26,58,92,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, totalW, totalH);

        for (let i = 0; i < s.maxSlots; i++) {
          const sx = panelX + slotPad + i * (slotSize + slotGap);
          const sy = panelY + slotPad;
          const wId    = s.weaponSlots[i];
          const active = i === s.activeSlot;

          // Slot background
          ctx.fillStyle = active ? 'rgba(0,180,255,0.12)' : 'rgba(0,0,0,0.3)';
          ctx.fillRect(sx, sy, slotSize, slotSize);

          // Slot border
          ctx.strokeStyle = active ? '#00d4ff' : 'rgba(26,58,92,0.9)';
          ctx.lineWidth   = active ? 1.5 : 1;
          ctx.strokeRect(sx, sy, slotSize, slotSize);

          // Weapon image
          if (wId) {
            const img = weaponImages[wId];
            if (img && img.complete && img.naturalWidth > 0) {
              ctx.save();
              ctx.globalAlpha = active ? 1 : 0.6;
              const margin = 6;
              ctx.drawImage(img, sx + margin, sy + margin, slotSize - margin * 2, slotSize - margin * 2);
              ctx.restore();
            }
          }

          // Slot number label
          ctx.font = 'bold 9px "Share Tech Mono"';
          ctx.fillStyle = active ? '#00d4ff' : 'rgba(42,74,106,1)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(String(i + 1), sx + slotSize / 2, sy + slotSize + 2);
        }
      }

      ctx.restore();
    }

    // ============================================================
    // OVERLAY
    // ============================================================
    function showOverlay(title, color, lines, btnText, action = 'startGame') {
      const ov = document.getElementById('overlay');
      ov.style.display = 'flex';
      ov.innerHTML = `
    <h2 style="color:${color}">${title}</h2>
    ${lines.map(l => `<p>${l}</p>`).join('')}
    <button class="btn" id="start-btn" style="border-color:${color};color:${color}">
      ${btnText}
    </button>
  `;
      
      const btn = document.getElementById('start-btn');
      if (action === 'nextLevel') {
        btn.onclick = () => {
          hideOverlay();
          nextLevel();
        };
      } else if (action === 'startGame') {
        btn.onclick = startGame;
      } else if (action === 'continueGame') {
        btn.onclick = continueGame;
      }
    }

    function showStartOverlay() {
      const ov = document.getElementById('overlay');
      ov.style.display = 'flex';
      const saveExists = hasSave();
      ov.innerHTML = `
    <h2 style="color:var(--accent)">SPIDER NEST</h2>
    <p>Найди выход. Не дай паукам добраться до тебя.</p>
    ${saveExists ? `<button class="btn" id="continue-btn" style="border-color:#00ff88;color:#00ff88">ПРОДОЛЖИТЬ</button>` : ''}
    <button class="btn" id="start-btn">${saveExists ? 'НОВАЯ ИГРА' : 'НАЧАТЬ ИГРУ'}</button>
  `;
      document.getElementById('start-btn').onclick = startGame;
      if (saveExists) {
        document.getElementById('continue-btn').onclick = continueGame;
      }
    }

    function hideOverlay() {
      document.getElementById('overlay').style.display = 'none';
    }

    // ============================================================
    // ZOOM DRAW (play map with zoom transform)
    // ============================================================
    function drawZoom(s, scale, camX, camY, progress, pendingCellKey, frozenAngle) {
      beginFrame();
      ctx.save();
      // Трансформация: зум от центра экрана
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-camX - VIEW_W / (2 * scale), -camY - VIEW_H / (2 * scale));

      // Фон
      ctx.fillStyle = '#030810';
      const zoomWorldW = s.gridSize * CP;
      const zoomWorldH = s.gridSize * CP;
      ctx.fillRect(0, 0, zoomWorldW, zoomWorldH);

      // Содержимое клеток с fade-out (кроме pendingCellKey)
      const fadeAlpha = 1 - progress; // 1 -> 0

      // Чёрные (disabled + permanently closed) клетки
      const blackCellsZ = new Set([...s.permanentlyClosed, ...s.disabledCells]);
      ctx.globalAlpha = fadeAlpha;
      for (const k of blackCellsZ) {
        const { x, y } = cellFromKey(k);
        if (!someAdjacentCell(x, y, (nx, ny, nk) => s.everOpenedCells.has(nk))) continue;
        ctx.fillStyle = '#000000';
        ctx.fillRect(x * CP, y * CP, CP, CP);
      }
      ctx.globalAlpha = 1;

      // Открытые клетки
      for (const k of s.openCells) {
        const { x, y } = cellFromKey(k);
        drawFloorCell(ctx, x, y, CP, s.openCells);
      }

      // Стены по краям открытых клеток (zoom)
      drawOpenCellWalls(s.openCells, CP, CP * 0.125);
      drawOpenCellCorners(s.openCells, CP, CP * 0.125);

      
      // Сердечки в открытых клетках
      for (const heart of s.hearts) {
        if (heart.collected) continue;
        const hc = cellOf(heart.x, heart.y);
        if (!s.openCells.has(cellKey(hc.x, hc.y))) continue;
        const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.008);
        ctx.globalAlpha = fadeAlpha;
        ctx.fillStyle = `rgba(255, 107, 157, ${pulse})`;
        ctx.shadowColor = '#ff6b9d';
        ctx.shadowBlur = 15;
        ctx.font = 'bold 24px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', heart.x, heart.y);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // Ключи в открытых клетках
      for (const keyObj of s.keyObjs) {
        if (keyObj.collected) continue;
        const kc = cellOf(keyObj.x, keyObj.y);
        if (!s.openCells.has(cellKey(kc.x, kc.y))) continue;
        const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.008);
        ctx.globalAlpha = fadeAlpha;
        ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
        ctx.font = 'bold 24px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔑', keyObj.x, keyObj.y);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // Апгрейды в открытых клетках
      for (const upg of s.upgradeObjs) {
        if (upg.collected) continue;
        const uc = cellOf(upg.x, upg.y);
        if (!s.openCells.has(cellKey(uc.x, uc.y))) continue;
        const upgDef = UPGRADE_TYPES.find(u => u.id === upg.upgradeType);
        if (upgDef) {
          ctx.globalAlpha = fadeAlpha;
          ctx.fillStyle = upgDef.color;
          ctx.shadowColor = upgDef.color;
          ctx.shadowBlur = 15;
          ctx.font = 'bold 24px "Share Tech Mono"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⬆', upg.x, upg.y);
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;

      // Проклятые сундуки (открытые + revealed)
      for (const chest of (s.chestObjs || [])) {
        if (chest.collected) continue;
        const cc = cellOf(chest.x, chest.y);
        const ck = cellKey(cc.x, cc.y);
        const isOpen = s.openCells.has(ck);
        const isRevealed = s.everRevealedCells.has(ck);
        if (!isOpen && !isRevealed) continue;
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#cc44ff';
        ctx.shadowBlur = isOpen ? 18 : 8;
        ctx.font = 'bold 26px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', chest.x, chest.y);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // Оружие в открытых клетках
      for (const dw of s.droppedWeapons) {
        const wc = cellOf(dw.x, dw.y);
        if (!s.openCells.has(cellKey(wc.x, wc.y))) continue;
        const wDef = WEAPON_DEFS[dw.weaponId];
        if (!wDef) continue;
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.007);
        ctx.globalAlpha = fadeAlpha * pulse;
        ctx.fillStyle = wDef.color;
        ctx.shadowColor = wDef.color;
        ctx.shadowBlur = 12;
        ctx.font = 'bold 18px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔫', dw.x, dw.y - 8);
        ctx.font = 'bold 9px "Share Tech Mono"';
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fadeAlpha * 0.9;
        ctx.fillText(wDef.label, dw.x, dw.y + 8);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // Пауки в закрытых клетках (fade-out, кроме pendingCellKey)
      for (const g of s.spiders) {
        if (!g.trapped) continue;
        const gc = cellOf(g.x, g.y);
        const cellK = cellKey(gc.x, gc.y);
        const visible = s.everRevealedCells.has(cellK);
        if (!visible) continue;
        const isPending = cellK === pendingCellKey;
        const gAlpha = isPending ? 1 : fadeAlpha;
        drawSpider(g, gAlpha * 0.5, 1, true);
      }

      // Игрок
      const p = s.player;
      const HERO_DRAW_SCALE = (CONFIG.PLAYER_SPRITE_RADIUS * 2) / HERO_SW;
      drawPlayerSprite(p.x, p.y, HERO_DRAW_SCALE);

      // Летящее сердечко (в мировых координатах зума)
      drawFlyingHeartInWorld();

      ctx.restore();

      // Виньетка при малом количестве жизней
      if (s.player.lives === 2) {
        const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 3, VIEW_W / 2, VIEW_H / 2, Math.sqrt((VIEW_W) ** 2 + (VIEW_H) ** 2));
        grad.addColorStop(0, 'rgba(255, 120, 0, 0)');
        grad.addColorStop(1, 'rgba(255, 120, 0, 0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      } else if (s.player.lives === 1) {
        const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 3, VIEW_W / 2, VIEW_H / 2, Math.sqrt((VIEW_W) ** 2 + (VIEW_H) ** 2));
        grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(255, 0, 0, 0.55)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }

      // Оверлей с текстом
      ctx.fillStyle = 'rgba(255,68,68,0.85)';
      ctx.font = 'bold 14px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('⚔ ENTERING BATTLE...', VIEW_W / 2, 10);

      drawHUD(s);
    }

    // drawZoomOut: используем drawZoom с play-координатами
    function drawZoomOut(s, scale, camX, camY, progress, playerX, playerY, frozenAngle) {
      // Временно подменяем позицию игрока на battle-позицию в play-коорд
      const origX = s.player.x, origY = s.player.y;
      s.player.x = playerX; s.player.y = playerY;
      drawZoom(s, scale, camX, camY, 1 - progress, null, frozenAngle);
      s.player.x = origX; s.player.y = origY;
      // Поверх - текст ≄ поверх виньетки
      ctx.fillStyle = 'rgba(0,255,136,0.85)';
      ctx.font = 'bold 14px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('✓ BATTLE COMPLETE', VIEW_W / 2, 10);
    }

    // ============================================================
    // PAUSE MENU
    // ============================================================
    const PAUSE = {
      w: 320, h: 180,
      get x() { return (VIEW_W - this.w) / 2; },
      get y() { return (VIEW_H - this.h) / 2; },
      sliderX() { return this.x + 24; },
      sliderY() { return this.y + 110; },
      sliderW() { return this.w - 48; },
      sliderH: 6,
      btnX() { return this.x + (this.w - 160) / 2; },
      btnY() { return this.y + 134; },
      btnW: 160, btnH: 30,
    };

    function drawPauseMenu() {
      const p = PAUSE;
      ctx.save();

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      ctx.shadowBlur = 24;
      ctx.shadowColor = 'rgba(0,180,255,0.18)';
      ctx.fillStyle = 'rgba(5,14,28,0.97)';
      const r = 12;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, r);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(0,180,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, r);
      ctx.stroke();

      ctx.font = 'bold 20px "Share Tech Mono"';
      ctx.fillStyle = '#e0f0ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('ПАУЗА', VIEW_W / 2, p.y + 20);

      ctx.font = '12px "Share Tech Mono"';
      ctx.fillStyle = 'rgba(160,200,240,0.8)';
      ctx.textAlign = 'left';
      ctx.fillText('ГРОМКОСТЬ', p.sliderX(), p.sliderY() - 18);

      const sx = p.sliderX(), sy = p.sliderY(), sw = p.sliderW(), sh = p.sliderH;
      ctx.fillStyle = 'rgba(0,100,180,0.35)';
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 3);
      ctx.fill();

      const filled = sw * Sounds._volume;
      ctx.fillStyle = '#1ab4ff';
      ctx.beginPath();
      ctx.roundRect(sx, sy, filled, sh, 3);
      ctx.fill();

      const kx = sx + filled;
      const ky = sy + sh / 2;
      ctx.beginPath();
      ctx.arc(kx, ky, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#1ab4ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '11px "Share Tech Mono"';
      ctx.fillStyle = 'rgba(160,200,240,0.7)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(Sounds._volume * 100) + '%', p.x + p.w - 24, p.sliderY() + sh / 2);

      const bx = p.btnX(), by = p.btnY(), bw = p.btnW, bh = p.btnH;
      const mx = mouseScreen.x, my = mouseScreen.y;
      const hovered = mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6);
      ctx.fillStyle = hovered ? 'rgba(0,200,120,0.3)' : 'rgba(0,140,80,0.2)';
      ctx.fill();
      ctx.strokeStyle = hovered ? '#00e87a' : '#00aa55';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 13px "Share Tech Mono"';
      ctx.fillStyle = hovered ? '#00ff99' : '#00cc66';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ПРОДОЛЖИТЬ', bx + bw / 2, by + bh / 2);

      ctx.restore();

      if (showStatsPanel && state) {
        drawStatsPanel(state);
      }
    }

    function resumeGame() {
      paused = false;
      pauseSliderDragging = false;
      lastTime = performance.now();
    }

    // ============================================================
    // CURSED CHOICE PANEL
    // ============================================================
    function openCursedChoice(s, chest) {
      const available = CURSED_UPGRADE_TYPES.filter(u => !s.upgrades[u.id]);
      shuffleInPlace(available);
      const offers = available.slice(0, Math.min(3, available.length));
      if (offers.length === 0) {
        chest.collected = true;
        s.cellContents.delete(chest.cellKey);
        return;
      }
      cursedChoiceState = { offers, chest };
      paused = true;
    }

    function drawCursedChoice() {
      if (!cursedChoiceState) return;
      const { offers } = cursedChoiceState;
      const mx = mouseScreen.x, my = mouseScreen.y;

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      const panelW = Math.min(VIEW_W - 40, 680);
      const cardW = Math.floor((panelW - 48) / 3);
      const cardH = 190;
      const panelH = cardH + 90;
      const panelX = (VIEW_W - panelW) / 2;
      const panelY = (VIEW_H - panelH) / 2;

      ctx.shadowBlur = 40;
      ctx.shadowColor = 'rgba(180,0,255,0.25)';
      ctx.fillStyle = 'rgba(8,4,20,0.97)';
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(180,60,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.stroke();

      ctx.font = 'bold 15px "Share Tech Mono"';
      ctx.fillStyle = '#cc88ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('☠ ПРОКЛЯТЫЕ УЛУЧШЕНИЯ — ВЫБЕРИ ОДНО', VIEW_W / 2, panelY + 16);

      ctx.font = '10px "Share Tech Mono"';
      ctx.fillStyle = 'rgba(180,100,255,0.55)';
      ctx.fillText('Эффект активен постоянно. Отмена невозможна.', VIEW_W / 2, panelY + 36);

      for (let i = 0; i < offers.length; i++) {
        const upg = offers[i];
        const cx = panelX + 16 + i * (cardW + 8);
        const cy = panelY + 58;
        const hovered = mx >= cx && mx <= cx + cardW && my >= cy && my <= cy + cardH;

        ctx.shadowBlur = hovered ? 24 : 8;
        ctx.shadowColor = upg.color + (hovered ? 'cc' : '44');
        ctx.fillStyle = hovered ? `${upg.color}22` : 'rgba(20,8,40,0.9)';
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 10);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = hovered ? upg.color : upg.color + '66';
        ctx.lineWidth = hovered ? 2 : 1.2;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 10);
        ctx.stroke();

        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', cx + cardW / 2, cy + 36);

        ctx.font = `bold 11px "Share Tech Mono"`;
        ctx.fillStyle = hovered ? '#ffffff' : upg.color;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';

        const labelLines = wrapText(upg.label, cardW - 16);
        let ty = cy + 66;
        for (const line of labelLines) {
          ctx.fillText(line, cx + cardW / 2, ty);
          ty += 14;
        }

        ctx.font = '9px "Share Tech Mono"';
        ctx.fillStyle = hovered ? 'rgba(255,255,255,0.85)' : 'rgba(200,160,255,0.7)';
        const descLines = wrapText(upg.description, cardW - 16);
        ty += 4;
        for (const line of descLines) {
          ctx.fillText(line, cx + cardW / 2, ty);
          ty += 12;
        }
      }

      ctx.restore();
    }

    function wrapText(text, maxWidth) {
      const words = text.split(' ');
      const lines = [];
      let line = '';
      ctx.font = '9px "Share Tech Mono"';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    // Открывает клетку после того как сердечко долетело (запускает zoom или сохраняет)
    function doOpenCellAfterHeart(openKey, openCX, openCY) {
      const content = state.cellContents.get(openKey);
      const hasContent = content && (content.type === 'heart' || content.type === 'key' || content.type === 'upgrade' || content.type === 'chest' ||
                         (content.enemyCount && content.enemyCount > 0 && !content.enemiesReleased));
      if (hasContent) {
        const allOpenCells = new Set([...state.openCells]);
        allOpenCells.add(openKey);
        const playerCell2 = cellOf(state.player.x, state.player.y);
        const playerKey2 = cellKey(playerCell2.x, playerCell2.y);
        const futureCells = getConnectedCells(allOpenCells, playerKey2);
        const { minX: fMinX, minY: fMinY, maxX: fMaxX, maxY: fMaxY } = getCellBounds(futureCells);
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
          pendingCellKey: openKey,
          frozenAngle: Math.atan2(state.mouse.y - state.player.y, state.mouse.x - state.player.x),
        };
        Sounds.zoom();
        state.phase = 'zoom_transition';
      } else {
        saveGame();
      }
    }

    // ============================================================
    // GAME LOOP
    // ============================================================
    function loop(ts) {
      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      if (paused) {
        if (state) {
          if (state.phase === 'play') draw(state);
          else if (state.phase === 'battle') drawBattle(state);
        }
        if (cursedChoiceState) {
          drawCursedChoice();
        } else {
          drawPauseMenu();
        }
        animId = requestAnimationFrame(loop);
        return;
      }

      if (state && state.phase === 'play') {
        update(state, dt);
        draw(state);
      } else if (state && state.phase === 'zoom_transition') {
        // Анимация зума перед battle (1 сек)
        const ZOOM_DUR = 0.5;
        zoomTransition.t = Math.min(zoomTransition.t + dt, ZOOM_DUR);
        const zt = zoomTransition;
        const p = easeInOutQuad(zt.t / ZOOM_DUR);
        const curScale = zt.fromScale + (zt.toScale - zt.fromScale) * p;
        const curCenterX = zt.fromCenterX + (zt.toCenterX - zt.fromCenterX) * p;
        const curCenterY = zt.fromCenterY + (zt.toCenterY - zt.fromCenterY) * p;
        const curCamX = curCenterX - VIEW_W / (2 * curScale);
        const curCamY = curCenterY - VIEW_H / (2 * curScale);
        camera.x = curCamX;
        camera.y = curCamY;
        drawZoom(state, curScale, curCamX, curCamY, zt.t / ZOOM_DUR, zt.pendingCellKey, zt.frozenAngle);

        if (zt.t >= ZOOM_DUR) {
          enterBattleMode(state, zt.pendingCellKey);
          zoomTransition = null;
        }
      } else if (state && state.phase === 'zoom_out_transition') {
        // Анимация zoom-out из battle на карту (1 сек)
        const ZOOM_OUT_DUR = 0.5;
        zoomOutTransition.t = Math.min(zoomOutTransition.t + dt, ZOOM_OUT_DUR);
        const zot = zoomOutTransition;
        const p = easeInOutQuad(zot.t / ZOOM_OUT_DUR);
        const curScale = zot.fromScale + (zot.toScale - zot.fromScale) * p;
        const curCenterX = zot.fromCenterX + (zot.toCenterX - zot.fromCenterX) * p;
        const curCenterY = zot.fromCenterY + (zot.toCenterY - zot.fromCenterY) * p;
        const curCamX = curCenterX - VIEW_W / (2 * curScale);
        const curCamY = curCenterY - VIEW_H / (2 * curScale);
        camera.x = curCamX;
        camera.y = curCamY;
        drawZoomOut(state, curScale, curCamX, curCamY, zot.t / ZOOM_OUT_DUR, zot.playerX, zot.playerY, zot.frozenAngle);

        if (zot.t >= ZOOM_OUT_DUR) {
          exitBattleMode(state);
          zoomOutTransition = null;
          saveGame();
        }
      } else if (state && state.phase === 'battle') {
        updateBattle(state, dt);
        drawBattle(state);
      } else if (state && state.phase === 'level_complete') {
        draw(state);
        const levelCfg = getLevelConfig(currentLevel);
        showOverlay('УРОВЕНЬ ПРОЙДЕН!', '#00ff88',
          [`Собрано сердечек: ${state.heartsCollected}/${levelCfg.heartsCount}`, `Время: ${Math.round(state.time)}с`],
          'СЛЕДУЮЩИЙ УРОВЕНЬ', 'nextLevel');
        state.phase = 'stopped';
      } else if (state && state.phase === 'win') {
        draw(state);
        Sounds.ambienceStop();
        showOverlay('ПОБЕДА!', '#ffd700',
          [`Все уровни пройдены!`, `Общее время: ${Math.round(state.time)}с`],
          'ИГРАТЬ СНОВА', 'startGame');
        state.phase = 'stopped';
      } else if (state && state.phase === 'dead') {
        // Если умерли в battle mode, рисуем battle экран
        if (state.battle) {
          drawBattle(state);
        } else {
          draw(state);
        }
        const levelCfg = getLevelConfig(currentLevel);
        Sounds.ambienceStop();
        showOverlay('GAME OVER', '#ff3a3a',
          ['Жизни закончились!', `Собрано сердечек: ${state.heartsCollected}/${levelCfg.heartsCount}`, `Время: ${Math.round(state.time)}с`],
          'ПОПРОБОВАТЬ СНОВА', 'startGame');
        state.phase = 'stopped';
      }

      animId = requestAnimationFrame(loop);
    }

