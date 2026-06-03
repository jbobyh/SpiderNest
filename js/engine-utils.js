    // ============================================================
    // PARTICLE POOL (оптимизация garbage collection)
    // ============================================================
    const particlePool = [];
    function getParticle() {
      if (particlePool.length > 0) {
        return particlePool.pop();
      }
      return {
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 0, maxLife: 0,
        color: '#ffffff',
      };
    }

    function returnParticle(particle) {
      if (particlePool.length < CONFIG.PARTICLE_POOL_MAX_SIZE) {
        particlePool.push(particle);
      }
    }

    // ============================================================
    // DAMAGE NUMBER POOL (вылетающие цифры ХП в battle mode)
    // ============================================================
    const damageNumberPool = [];
    const DAMAGE_NUMBER_POOL_MAX = 50;

    function getDamageNumber() {
      if (damageNumberPool.length > 0) {
        return damageNumberPool.pop();
      }
      return {
        x: 0, y: 0,
        vy: 0,
        text: '',
        life: 0, maxLife: 0,
        color: '#ffffff',
        scale: 1,
      };
    }

    function returnDamageNumber(dn) {
      if (damageNumberPool.length < DAMAGE_NUMBER_POOL_MAX) {
        damageNumberPool.push(dn);
      }
    }

    function spawnDamageNumber(x, y, damage, isCrit) {
      const b = state.battle;
      if (!b) return;
      const dn = getDamageNumber();
      dn.x = x;
      dn.y = y;
      dn.vy = -30 * BATTLE_SCALE; // движение вверх
      dn.text = String(damage);
      dn.life = 0.8;
      dn.maxLife = 0.8;
      dn.color = isCrit ? '#ff4400' : '#ffffff';
      dn.scale = isCrit ? 1.3 : 1.0;
      b.damageNumbers.push(dn);
    }

    function addParticles(x, y, count, speed, life, color) {
      for (let i = 0; i < count; i++) {
        const p = getParticle();
        const a = Math.random() * Math.PI * 2;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed;
        p.life = life;
        p.maxLife = life;
        p.color = color;
        state.particles.push(p);
      }
    }

    function updatePlayerDashEffects(player, px, py, dt, scale, particles) {
      if (!player.dashTrails) {
        player.dashTrails = [];
        player.dashTrailTimer = 0;
      }

      for (let i = player.dashTrails.length - 1; i >= 0; i--) {
        player.dashTrails[i].life -= dt;
        if (player.dashTrails[i].life <= 0) player.dashTrails.splice(i, 1);
      }

      if (!player.isDashing) {
        player._dashBurstFired = false;
        return;
      }

      if (!player._dashBurstFired) {
        player._dashBurstFired = true;
        for (let i = 0; i < 8; i++) {
          const p = getParticle();
          const a = Math.atan2(player.dashDirY, player.dashDirX) + (Math.random() - 0.5) * 1.2;
          const speed = 50 + Math.random() * 40;
          p.x = px;
          p.y = py;
          p.vx = Math.cos(a) * speed;
          p.vy = Math.sin(a) * speed;
          p.life = 0.18 + Math.random() * 0.1;
          p.maxLife = p.life;
          p.color = Math.random() < 0.5 ? '#a8f0ff' : '#ffffff';
          particles.push(p);
        }
      }

      player.dashTrailTimer += dt;
      if (player.dashTrailTimer >= 0.028) {
        player.dashTrailTimer -= 0.028;
        player.dashTrails.push({
          x: px,
          y: py,
          frame: playerAnim.frame,
          key: playerAnim.key,
          flip: playerAnim.flip,
          life: 0.22,
          maxLife: 0.22,
        });
      }

      if (Math.random() < 0.65) {
        const p = getParticle();
        const backOff = 5 * scale;
        p.x = px - player.dashDirX * backOff + (Math.random() - 0.5) * 6 * scale;
        p.y = py - player.dashDirY * backOff + (Math.random() - 0.5) * 6 * scale;
        p.vx = -player.dashDirX * 45 + (Math.random() - 0.5) * 18;
        p.vy = -player.dashDirY * 45 + (Math.random() - 0.5) * 18;
        p.life = 0.1 + Math.random() * 0.08;
        p.maxLife = p.life;
        p.color = Math.random() < 0.5 ? '#a8f0ff' : '#cceeff';
        particles.push(p);
      }
    }

    // ============================================================
    // UTILITY
    // ============================================================
    const CARDINAL_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const WALL_DIRECTIONS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const DIAGONAL_DIRECTIONS = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

    function cellKey(x, y) { return `${x},${y}`; }
    function cellFromKey(k) { const [x, y] = k.split(','); return { x: +x, y: +y }; }
    function cellOf(px, py) { return { x: Math.floor(px / CP), y: Math.floor(py / CP) }; }
    function inBounds(x, y) { return x >= 0 && x < 11 && y >= 0 && y < 11; }
    function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

    // Контейнеры сердец: заполненные = текущие жизни, всего = жизни + открытые комнаты
    function getHeartHudStats(s) {
      const filled = s.player.lives;
      const total = s.player.lives + s.openCells.size;
      return { filled, total };
    }

    // Helper функции для координат HUD (преобразование экранных координат в мировые)
    function getHudHeartCoords(index) {
      const iconSize = 20;
      const iconGap = 4;
      const panelPad = 8;
      const startX = panelPad;
      const rowY = 30 + panelPad; // Положение первого ряда (сердца)
      
      // Экранные координаты центра иконки
      const screenX = startX + index * (iconSize + iconGap) + iconSize / 2;
      const screenY = rowY + iconSize / 2;
      
      // Преобразуем в мировые координаты с учетом камеры
      const worldX = screenX + camera.x;
      const worldY = screenY + camera.y;
      
      return { x: worldX, y: worldY };
    }

    function getHudKeyCoords(index) {
      const iconSize = 20;
      const iconGap = 4;
      const panelPad = 8;
      const startX = panelPad;
      // Ключи в третьем ряду: сердца (ряд 1) + щиты (ряд 2) + ключи (ряд 3)
      const rowY = 30 + panelPad + (iconSize + 4) * 2; 
      
      // Экранные координаты центра иконки
      const screenX = startX + index * (iconSize + iconGap) + iconSize / 2;
      const screenY = rowY + iconSize / 2;
      
      // Преобразуем в мировые координаты с учетом камеры
      const worldX = screenX + camera.x;
      const worldY = screenY + camera.y;
      
      return { x: worldX, y: worldY };
    }

    function launchFlyingHeart(fromX, fromY, toX, toY, onArrive, getTarget) {
      const dist = Math.hypot(toX - fromX, toY - fromY);
      const duration = Math.max(0.18, Math.min(0.45, dist / (CP * 2.5)));
      flyingHeart = { x: fromX, y: fromY, startX: fromX, startY: fromY, targetX: toX, targetY: toY, t: 0, duration, onArrive, getTarget: getTarget || null };
      Sounds.hearttravel();
    }

    // Летающий ключ для анимации подбора
    let flyingKey = null;

    function launchFlyingKey(fromX, fromY, toIndex, onArrive) {
      const dist = 200; // Приблизительная дистанция для расчета длительности
      const duration = Math.max(0.18, Math.min(0.45, dist / (CP * 2.5)));
      flyingKey = { 
        x: fromX, 
        y: fromY, 
        startX: fromX, 
        startY: fromY, 
        targetIndex: toIndex, // Сохраняем индекс для динамического обновления
        t: 0, 
        duration, 
        onArrive,
        getTarget: () => getHudKeyCoords(toIndex) // Функция для получения текущих координат
      };
      Sounds.keycollect();
    }

    function drawFlyingHeartInWorld() {
      if (!flyingHeart) return;
      const fh = flyingHeart;
      const bx = fh.x;
      const by = fh.y;
      const p = Math.min(fh.t / fh.duration, 1);
      const scale = 0.8 + 0.5 * Math.sin(p * Math.PI);
      ctx.save();
      ctx.font = `bold ${Math.round(20 * scale)}px "Huninn"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff6b9d';
      ctx.shadowColor = '#ff6b9d';
      ctx.shadowBlur = 18;
      ctx.fillText('♥', bx, by);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    function drawFlyingKeyInWorld() {
      if (!flyingKey) return;
      const fk = flyingKey;
      const bx = fk.x;
      const by = fk.y;
      const p = Math.min(fk.t / fk.duration, 1);
      const scale = 0.8 + 0.5 * Math.sin(p * Math.PI);
      ctx.save();
      ctx.font = `bold ${Math.round(18 * scale)}px "Huninn"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 15;
      ctx.fillText('🗝', bx, by);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Direction constants: 0=right, 1=bottom, 2=left, 3=top
    const DIRECTION_RIGHT = 0, DIRECTION_BOTTOM = 1, DIRECTION_LEFT = 2, DIRECTION_TOP = 3;
    const DIRECTION_VECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

    // Get adjacent open cell directions for a cell
    function getAdjacentOpenDirections(x, y, openCells) {
      const directions = [];
      for (let i = 0; i < 4; i++) {
        const [dx, dy] = DIRECTION_VECTORS[i];
        const nx = x + dx, ny = y + dy;
        if (openCells.has(cellKey(nx, ny))) {
          directions.push(i);
        }
      }
      return directions;
    }

    // Draw floor cell with appropriate texture based on adjacent open cells and level
    // offsetX and offsetY are optional, for battle mode coordinate shifting
    function drawFloorCell(ctx, x, y, cellSize, openCells, offsetX = 0, offsetY = 0, level = 1) {
      const directions = getAdjacentOpenDirections(x, y, openCells);
      const count = directions.length;

      let img = null;
      let rotation = 0; // in 90-degree increments (0, 1, 2, 3)

      if (count === 1) {
        // Dead end - use floor-rightexit-blue/green/y, rotate so exit points to the open neighbor
        if (level === 2) img = floorRightExitGreenImg;
        else if (level === 3) img = floorRightExitYImg;
        else img = floorRightExitImg;
        // rightexit texture has exit to the right (direction 0)
        // we need to rotate so exit points to directions[0]
        rotation = directions[0];
      } else if (count === 2) {
        const d1 = directions[0], d2 = directions[1];
        // Check if opposite (straight line) or adjacent (corner)
        const isOpposite = (d1 + 2) % 4 === d2;
        if (isOpposite) {
          // Straight line - use floor-topdownexit-blue/green/y
          if (level === 2) img = floorTopDownExitGreenImg;
          else if (level === 3) img = floorTopDownExitYImg;
          else img = floorTopDownExitImg;
          // topdown texture has exits top and bottom (directions 3 and 1)
          if ((d1 === 3 && d2 === 1) || (d1 === 1 && d2 === 3)) {
            rotation = 0; // already correct orientation
          } else {
            rotation = 1; // rotate 90° to make left-right
          }
        } else {
          // Corner - use floor-rightbottomexit-blue/green/y
          if (level === 2) img = floorRightBottomExitGreenImg;
          else if (level === 3) img = floorRightBottomExitYImg;
          else img = floorRightBottomExitImg;
          // rightbottom texture has exits right and bottom (directions 0 and 1)
          // Find rotation to match our directions to [0, 1]
          const needed = [0, 1];
          for (let r = 0; r < 4; r++) {
            const rotated = directions.map(d => (d - r + 4) % 4).sort();
            if (rotated[0] === needed[0] && rotated[1] === needed[1]) {
              rotation = r;
              break;
            }
          }
        }
      } else if (count === 3) {
        // T-junction - use floor-leftrightbottomexit-blue/green/y
        if (level === 2) img = floorLeftRightBottomExitGreenImg;
        else if (level === 3) img = floorLeftRightBottomExitYImg;
        else img = floorLeftRightBottomExitImg;
        // leftrightbottom texture has exits left, right, bottom (directions 2, 0, 1)
        // Missing direction tells us rotation
        const allDirs = [0, 1, 2, 3];
        const missing = allDirs.find(d => !directions.includes(d));
        // Texture has top (3) missing, so rotate so missing direction becomes 3
        rotation = (missing + 1) % 4;
      } else if (count === 4) {
        // Cross - use floor-4exit-blue/green/y
        if (level === 2) img = floor4ExitGreenImg;
        else if (level === 3) img = floor4ExitYImg;
        else img = floor4ExitImg;
        rotation = 0;
      }

      const drawX = (x - offsetX) * cellSize;
      const drawY = (y - offsetY) * cellSize;

      if (!img || !img.complete || img.naturalWidth === 0) {
        // Fallback to default floor or solid color
        let fallbackImg;
        if (level === 2) fallbackImg = floorGreenImg;
        else if (level === 3) fallbackImg = floorYImg;
        else fallbackImg = floorImg;
        if (fallbackImg.complete && fallbackImg.naturalWidth > 0) {
          ctx.drawImage(fallbackImg, drawX, drawY, cellSize, cellSize);
        } else {
          ctx.fillStyle = 'rgb(10,25,40)';
          ctx.fillRect(drawX, drawY, cellSize, cellSize);
        }
        return;
      }

      // Draw with rotation
      const cx = drawX + cellSize / 2;
      const cy = drawY + cellSize / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation * Math.PI / 2);
      ctx.drawImage(img, -cellSize / 2, -cellSize / 2, cellSize, cellSize);
      ctx.restore();
    }

    function shuffleInPlace(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    }

    function getCanvasPoint(e) {
      const rect = C.getBoundingClientRect();
      const scaleX = VIEW_W / rect.width;
      const scaleY = VIEW_H / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function getConnectedCells(openCells, startKey) {
      const connected = new Set();
      const queue = [startKey];
      connected.add(startKey);

      while (queue.length) {
        const k = queue.shift();
        const { x, y } = cellFromKey(k);
        for (const [dx, dy] of CARDINAL_DIRECTIONS) {
          const nk = cellKey(x + dx, y + dy);
          if (openCells.has(nk) && !connected.has(nk)) {
            connected.add(nk);
            queue.push(nk);
          }
        }
      }

      return connected;
    }

    function getCellBounds(cells) {
      let minX = G, minY = G, maxX = 0, maxY = 0;
      for (const k of cells) {
        const { x, y } = cellFromKey(k);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return { minX, minY, maxX, maxY };
    }

    function revealAdjacentCells(targetSet, x, y, disabledCells, permanentlyClosed = null, requireBounds = true) {
      for (const [dx, dy] of CARDINAL_DIRECTIONS) {
        const nx = x + dx, ny = y + dy;
        const nk = cellKey(nx, ny);
        if ((!requireBounds || inBounds(nx, ny)) && !disabledCells.has(nk) && !permanentlyClosed?.has(nk)) {
          targetSet.add(nk);
        }
      }
    }

    function revealDiagonalCells(targetSet, x, y, disabledCells, permanentlyClosed = null, requireBounds = true) {
      for (const [dx, dy] of DIAGONAL_DIRECTIONS) {
        const nx = x + dx, ny = y + dy;
        const nk = cellKey(nx, ny);
        if ((!requireBounds || inBounds(nx, ny)) && !disabledCells.has(nk) && !permanentlyClosed?.has(nk)) {
          targetSet.add(nk);
        }
      }
    }

    function someAdjacentCell(x, y, predicate) {
      for (const [dx, dy] of CARDINAL_DIRECTIONS) {
        const nx = x + dx, ny = y + dy;
        if (predicate(nx, ny, cellKey(nx, ny))) return true;
      }
      return false;
    }

    // ============================================================
    // WALL RENDERING
    // ============================================================
    // Draws wall.png on each border edge of openCells set.
    // wallW/wallH: size of one wall strip in world-units for this context (cellPx wide, depth fraction tall).
    // The wall is drawn OUTSIDE the open cell (into closed space), clipped to not overdraw open cells.
    function drawOpenCellWalls(openCells, cellPx, wallDepth, offsetX = 0, offsetY = 0, level = 1) {
      let wallImgToUse;
      if (level === 2) wallImgToUse = wallGreenImg;
      else if (level === 3) wallImgToUse = wallYImg;
      else wallImgToUse = wallImg;
      if (!wallImgToUse.complete || wallImgToUse.naturalWidth === 0) return;

      for (const k of openCells) {
        const { x, y } = cellFromKey(k);

        // dx,dy: direction toward the neighbour (outside)
        // Wall drawn starting at the edge going outward by wallDepth
        const sides = [
          { dx: 0, dy: -1 }, // top
          { dx: 0, dy:  1 }, // bottom
          { dx: -1, dy: 0 }, // left
          { dx:  1, dy: 0 }, // right
        ];

        for (const { dx, dy } of sides) {
          const nk = cellKey(x + dx, y + dy);
          if (openCells.has(nk)) continue; // neighbour is open — no wall here

          const cx0 = (x - offsetX) * cellPx;
          const cy0 = (y - offsetY) * cellPx;

          ctx.save();

          // Place and rotate the wall strip so its length runs along the shared edge.
          // edgeMid = midpoint of the shared edge between this cell and neighbour.
          // After rotate, local -Y points outward (away from open cell).
          // Wall image designed for top: drawn at y=-wallDepth going upward (outward).
          const edgeMidX = cx0 + (0.5 + dx * 0.5) * cellPx;
          const edgeMidY = cy0 + (0.5 + dy * 0.5) * cellPx;

          const angle = Math.atan2(dy, dx) + Math.PI / 2; // 0=top, rotates for each side

          ctx.translate(edgeMidX, edgeMidY);
          ctx.rotate(angle);
          // Local coords: X along edge, -Y = outward direction
          ctx.drawImage(wallImgToUse, -cellPx / 2, -wallDepth, cellPx, wallDepth);

          ctx.restore();
        }
      }
    }

    // Draws corner.png at each corner of the open area boundary.
    // cornerSize: size of the corner square in world-units.
    // Image is designed for top-left corner (outside), rotated for other corners.
    // Two cases per diagonal direction (ddx, ddy):
    //   External corner: both cardinal neighbours are closed → draw into diagonal cell
    //   Internal (concave) corner: both cardinal neighbours are open, diagonal is closed → draw into diagonal cell
    function drawOpenCellCorners(openCells, cellPx, cornerSize, offsetX = 0, offsetY = 0, level = 1) {
      let cornerImgToUse;
      if (level === 2) cornerImgToUse = cornerGreenImg;
      else if (level === 3) cornerImgToUse = cornerYImg;
      else cornerImgToUse = cornerImg;
      if (!cornerImgToUse.complete || cornerImgToUse.naturalWidth === 0) return;

      // Diagonal directions with their rotation angle (image = top-left = 0)
      const diagonals = [
        { ddx: -1, ddy: -1, angle: 0 },              // top-left
        { ddx:  1, ddy: -1, angle: Math.PI / 2 },    // top-right
        { ddx:  1, ddy:  1, angle: Math.PI },         // bottom-right
        { ddx: -1, ddy:  1, angle: -Math.PI / 2 },   // bottom-left
      ];

      for (const k of openCells) {
        const { x, y } = cellFromKey(k);

        for (const { ddx, ddy, angle } of diagonals) {
          const sideA = openCells.has(cellKey(x + ddx, y));
          const sideB = openCells.has(cellKey(x, y + ddy));
          const diagOpen = openCells.has(cellKey(x + ddx, y + ddy));

          const isExternal = !sideA && !sideB;       // outer convex corner
          const isInternal = sideA && sideB && !diagOpen; // inner concave corner

          if (!isExternal && !isInternal) continue;

          // Corner point in world coords (shared by this cell and the diagonal)
          const cornerX = (x - offsetX + (ddx > 0 ? 1 : 0)) * cellPx;
          const cornerY = (y - offsetY + (ddy > 0 ? 1 : 0)) * cellPx;

          ctx.save();
          ctx.translate(cornerX, cornerY);
          if (isInternal) {
            // Flip around image centre: rotate by angle+PI, draw at (0,0) so image
            // occupies the same diagonal cell but mirrored — top-left corner faces inward
            ctx.rotate(angle + Math.PI);
            ctx.drawImage(cornerImgToUse, 0, 0, cornerSize, cornerSize);
          } else {
            ctx.rotate(angle);
            ctx.drawImage(cornerImgToUse, -cornerSize, -cornerSize, cornerSize, cornerSize);
          }
          ctx.restore();
        }
      }
    }

