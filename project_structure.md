# Структура папки `pixijs/`

Краткое описание архитектуры: `pixijs/` — это браузерная версия игры на PixiJS v8 + Matter.js. Все JS-модули подключаются из `index.html` через `type="module"` и используют общий глобальный конфиг `config.js`.

```
pixijs/
├── main.js                 // точка входа (boot)
├── game-loop.js            // главный игровой цикл
├── core/                   // движковые модули (рендерер, ввод, звук, ресурсы)
├── game/                   // игровая логика (AI, пули, враги, апгрейды, стены)
├── modes/                  // режимы: исследование, бой, переходы
├── render/                 // отрисовка (тайлы, спрайты, HUD, частицы, UI)
└── world/                  // мир: генерация уровня, физика, координатная сетка
```

---

## Корневые файлы

### `main.js`
- **За что отвечает:** загрузка и старт игры.
- **Содержит:**
  - `async function boot()` — последовательность: показать экран загрузки, `initApp()`, `loadAssets()` с прогресс-баром, скрыть загрузку, показать стартовый оверлей.
  - Обработчики кнопок "Начать игру" / "Продолжить".
  - При запуске восстанавливает сохранение через `loadGame()` и передаёт в `startGameLoop()`.
- **Ключевые импорты:** `core/app.js`, `core/assets.js`, `core/sound.js`, `game-loop.js`, `game/state.js`.

### `game-loop.js`
- **За что отвечает:** центральный диспетчер игры — тикер, фазы, рендер, физика, сохранения.
- **Содержит:**
  - `startGameLoop()` — инициализация всех подсистем: физика, камера, слои, рендереры, ввод, сохранение, музыка, запуск тикера.
  - `stopGameLoop()` — остановка тикера и очистка всех рендер-объектов.
  - `_loop(dt)` — главный шаг: физика, синхронизация тел, обновление flow-field, диспетчер фаз (`play`, `battle`, `zoom_in`, `zoom_out`, `dead`, `win`), рендер.
  - `_handlePhysicsCollision()` — столкновения игрока с врагами (контактный урон).
  - `_render()` — синхронизация всех рендереров с состоянием.
  - Callbacks переходов: `_onEnterBattle`, `_onBattleWon`, `_onPlayerDead`, `_onLevelComplete`, `restartLevel()`, `nextLevel()`.
- **Состояние модуля:** `_state`, `_camera`, `_currentLevel`, `_playerProgress`, `_levelStartProgress`.
---

## `core/` — движок

### `core/app.js`
- **За что отвечает:** инициализация и масштабирование PixiJS Application.
- **Содержит:**
  - `export const app = new Application()`.
  - `initApp()` — создание canvas, подгонка под размер контейнера, обработка fullscreen и resize.
  - `_fitCanvas()` / `_applyStageScale()` — логическая разрешающая способность 1024×576 с сохранением чёткости текста.
  - `enterFullscreen()` — запуск полноэкранного режима.
  - Установка `PixiText.defaultResolution = dpr * 2` для чёткого текста.

### `core/assets.js`
- **За что отвечает:** загрузка текстур и звуков через PixiJS Assets.
- **Содержит:**
  - `MANIFEST` с бандлами: `tiles`, `entities`, `hud`, `sfx`, `music`.
  - `loadAssets(onProgress)` — загрузка всех бандлов кроме музыки.
  - `loadMusicBundle(onProgress)` — ленивая загрузка музыки.

### `core/input.js`
- **За что отвечает:** отслеживание клавиатуры и мыши.
- **Содержит:**
  - `export const keys = {}` и `export const mouse = { x, y, held, rightHeld }`.
  - `initInput(canvas)` / `destroyInput()` — регистрация/снятие listeners.
  - `getMovementDir()` — нормализованный вектор движения по WASD/стрелкам/русской раскладке.
  - `isInteractPressed()` — нажата ли F/А.

### `core/sound.js`
- **За что отвечает:** проигрывание звуков и музыки через `@pixi/sound`.
- **Содержит:**
  - `export const Sounds` — объект с методами: `play`, `shot`, `hit`, `wallhit`, `footstep`, `keycollect`, `heartcollect`, `weaponcollect`, `death`, `levelcomplete`, `zoom` и т.д.
  - `playLevelMusic()`, `playBossMusic()`, `stopBossMusic()` с кроссфейдом.
  - `updateMusicFade(dt)` — плавная смена громкости между треками.
  - `resumeAudioContext()` — разблокировка AudioContext после пользовательского клика.

### `core/save.js`
- **За что отвечает:** реэкспорт функций сохранения из `game/state.js`.
- **Содержит:** `export { hasSave, loadGame, deleteSave } from '../game/state.js';`.

---

## `game/` — игровая логика

### `game/state.js`
- **За что отвечает:** создание и сериализация игрового состояния, сохранение/загрузка.
- **Содержит:**
  - `createDefaultProgress()` — начальные улучшения/жизни/слоты оружия.
  - `createGameState(level, playerProgress)` — генерация уровня через `generateLevel()` и сборка стартового состояния.
  - `saveGame()`, `loadGame()`, `hasSave()`, `deleteSave()` — localStorage (`spidernest_save`, версия 2).
  - `savePlayerProgress()` — сохранение прогресса при прохождении уровня.
  - `doOpenWall()`, `doCloseWall()` — изменение стен с пересчётом `openCells`.
  - `updateRevealedRoomsOnPurify()` — обновление видимости комнат при очищении.

### `game/enemy-ai.js`
- **За что отвечает:** обновление врагов и обработка их смертей.
- **Содержит:**
  - `updateEnemyAI(state, playerProgress, dt, onPlayerDamaged)` — цикл по `activeSpiders`, вызов `g.update(dt, state)`, удаление мёртвых, спавн трупов и частиц.
  - `spawnCorpse()` — создание объекта трупа в `state.deathCorpses`.
  - `_deathParticles()` — всплеск частиц при смерти.

### `game/enemy-base.js`
- **За что отвечает:** базовый класс врага.
- **Содержит:**
  - `class Enemy` — поля: `x`, `y`, `hp`, `maxHp`, `radius`, `visualScale`, `type`, `isBoss`, `hitFlash`, `stunTimer`, `body`.
  - `update(dt, state)` — обновление таймеров, создание тела, обнаружение "застревания", вызов `updateBehavior()`, синхронизация с телом.
  - `takeDamage()`, `die()`, `serialize()`, `getRoomSpeedMult()`.

### `game/enemy-types.js`
- **За что отвечает:** конкретные типы врагов и босс.
- **Содержит:**
  - `ChaserEnemy` — преследование через flow-field.
  - `ZigzagChaserEnemy` — летучая мышь: движение по прямой + зигзаг, fallback на flow-field.
  - `ShooterEnemy` — стрелок/плевака: держит дистанцию, стреляет при LoS.
  - `BullEnemy`, `BuldygaEnemy`, `BloatedEnemy` — специальные типы ближнего/танкового поведения.
  - `CocoonEnemy` — кокон, из которого периодически спавнятся враги.
  - `PhaseBoss` — босс с фазами и специальными атаками.

### `game/enemy-factory.js`
- **За что отвечает:** создание и восстановление врагов.
- **Содержит:**
  - `class EnemyFactory` с `create(type, x, y, options)`, `fromObject(obj)`.
  - `ENEMY_DEFS` — отображение типа в ключи `CONFIG` (HP, радиус, визуальный масштаб).
  - Геттеры `getDefaultHp()`, `getDefaultRadius()`, `getDefaultVisualScale()` для боссов и обычных врагов.

### `game/boss.js`
- **За что отвечает:** обработка победы над боссом и специфичные эффекты.
- **Содержит:**
  - `handleBossKilled()` — пометка босса побеждённым, установка клетки выхода, остановка музыки, попап.
  - `createBossEntity(level, cx, cy)` — фабрика босса через `EnemyFactory`.
  - `applyFreezeUpgrade()` — применение апгрейда "заморозка" к бою.

### `game/bullet.js`
- **За что отвечает:** объект пули и пул пуль.
- **Содержит:**
  - `class Bullet` — поля: позиция, скорость, урон, владелец, пробитие, рикошет, цвет, дальность, крит, сет попавших сущностей.
  - `acquireBullet(data)` / `releaseBullet(b)` — объектный пул.

### `game/bullet-manager.js`
- **За что отвечает:** движение пуль, столкновения со стенами и сущностями.
- **Содержит:**
  - `class BulletManager` — массив `bullets`, методы `spawn()` и `update()`.
  - `update()` — движение, проверка дальности, столкновения со стенами (play/battle), рикошет, попадания по врагам/игроку.
  - Применение комнатных бонусов (скорость/пробитие) для пуль.
  - `export const bulletManager` — единственный глобальный менеджер.

### `game/combat.js`
- **За что отвечает:** стрельба игрока и подбор оружия.
- **Содержит:**
  - `getActiveWeapon(state)` — активное оружие из слотов.
  - `shoot(state)` — логика выстрела: разброс, количество дробинок, скорость пуль, крит, перезарядка, частицы вспышки.
  - `fireReflectionBullets()` — отражающие пули (апгрейд щита).
  - `pickupWeapon()` — подбор/замена оружия в слотах.
  - `_spawnPlayerBullet()` — внутренний спавн пули с учётом бонусов.
  - `ENEMY_BULLET_COLOR`, `enemyBulletRange()`.

### `game/collectibles.js`
- **За что отвечает:** сбор предметов, сундуки, алтари, награды за комнаты, выбор улучшений.
- **Содержит:**
  - `updateCollectibles()` / `updateBattleCollectibles()` — сбор сердец, сферы, апгрейдов, проклятых сундуков, оружия.
  - `spawnRoomRewards()` — награды за победу в комнате (апгрейды/оружие/сердца).
  - `checkAltarActivation()`, `checkUpgradeChestActivation()`, `checkCursedChestActivation()`, `checkRoomBonusAltarActivation()` — проверка близости и открытие боев.
  - `openCursedChoice()`, `openUpgradeChoice()`, `openRoomBonusChoice()` — создание панелей выбора.
  - `applyCursedChoice()`, `applyUpgradeChoice()`, `applyRoomBonusChoice()` — применение выбора.
  - `syncBattleCollectibles()` — синхронизация собранного в бою обратно в мир.

### `game/upgrades.js`
- **За что отвечает:** применение улучшений и урон по игроку.
- **Содержит:**
  - `applyUpgrade()` — декларативное применение `effects` из `UPGRADE_TYPES`/`CURSED_UPGRADE_TYPES`.
  - `showUpgradePopup()` / `hideUpgradePopup()` — DOM-попап с иконкой и цветом.
  - `dealPlayerDamage()` — учёт щита, `lastLife`, `reflection`, нанесение урона и вызов `onDead`.
  - `_applyRandomBonus()` — случайный набор бонусов.

### `game/walls.js`
- **За что отвечает:** открытие/закрытие стен между комнатами (правая кнопка мыши).
- **Содержит:**
  - `handleWallToggle()` — поиск стены под курсором, трата/возврат жизни, запуск анимации летающего сердца.
  - `findAutoCloseWall()` — автоматический поиск стены для закрытия при 1 жизни.
  - `launchFlyingHeart()`, `updateFlyingHeart()`, `getFlyingHeart()` — анимация сердца от стены к HUD.
  - `spawnRoomRewards()` — вызов наград при открытии комнаты.

### `game/flow-field.js`
- **За что отвечает:** поиск пути для врагов и линия видимости.
- **Содержит:**
  - `FLOW_SUB = 5`, `FLOW_SUB_PX` — sub-сетка для pathfinding.
  - `computeFlowField()` — BFS от позиции игрока, возвращает направления к цели.
  - `canTraverse()` — проверка проходимости sub-клетки с учётом диагональных проходов.
  - `getEnemyMoveDir()` — получение направления движения для конкретной точки.
  - `hasLineOfSight()` — DDA-проверка прямой видимости между двумя точками.

---

## `modes/` — режимы игры

### `modes/play-mode.js`
- **За что отвечает:** обновление фазы исследования.
- **Содержит:**
  - `updatePlayMode()` — движение/рывок игрока, стрельба, инпут, взаимодействие с миром, стены, враги, сбор предметов, боссы.
  - `_stepMovement()`, `_startDash()`, `_stepDash()` — движение и рывок.
  - `_syncInput()` — перевод мыши из экранных в мировые координаты через камеру.
  - `isNearWeapon()`, `isNearAltar()`, `isNearUpgradeChest()`, `isNearCursedChest()`, `isNearRoomBonusAltar()` — проверки близости.
  - `handleWeaponPickup()` — ручной подбор оружия по F.
  - `updateCursor()` — смена курсора при наведении на стену.

### `modes/battle-mode.js`
- **За что отвечает:** обновление фазы боя и создание баттл-пространства.
- **Содержит:**
  - `createBattleState(state, openedCellKey)` — переход в бой с комнатой, вычисление зума камеры, подготовка pending-спавнов врагов.
  - `createBossBattleState(state, currentLevel)` — босс-бой.
  - `updateBattleMode()` — обновление боя: спавны, враги, пули, сбор предметов, проверка победы.
  - `exitBattleMode()` — очистка battle-метаданных и возврат в `play`.
  - `_processPendingSpawns()` — отложенный спавн врагов в комнате.

### `modes/transitions.js`
- **За что отвечает:** анимации зума между режимами.
- **Содержит:**
  - `startZoomIn(state, camera, pendingCellKey, isBoss)` — запуск анимации play → battle.
  - `startZoomOut(state, camera)` — запуск анимации battle → play.
  - `updateTransition(dt, camera, onComplete)` — плавная интерполяция по `easeInOutQuad`.
  - `_battleBounds()` — вычисление границ баттл-области.

---

## `render/` — отрисовка

### `render/layers.js`
- **За что отвечает:** иерархия контейнеров PixiJS.
- **Содержит:**
  - `export const layers` — объекты слоёв: `bg`, `tiles`, `shadows`, `entities`, `particles`, `debug`, `damageNumbers`, `hud`.
  - `initLayers(camera)` — создание и подключение слоёв: world-слои внутри камеры, `damageNumbers` и `hud` в screen-space.
  - `clearWorldLayers()` — очистка и уничтожение детей всех world-слоёв.

### `render/camera.js`
- **За что отвечает:** камера: смещение, зум, тряска, плавное следование.
- **Содержит:**
  - `class Camera` — `container`, `_zoom`, `_worldX/Y`, `_currentX/Y`, `_shakeAmount/Angle`.
  - `pan()`, `moveTo()`, `setZoom()`, `shake()`, `update(dt)` — демпфирование и тряска.
  - `worldToScreen()`, `screenToWorld()` — преобразование координат.

### `render/tiles.js`
- **За что отвечает:** отрисовка тайлов пола, стен, углов, перегородок, декораций.
- **Содержит:**
  - `buildTileLayer(container, worldData, level)` — полная перестройка тайлов.
  - `floorAlias()`, `floorRotation()` — выбор спрайта пола по направлениям открытых проходов.
  - `makeFloorSprite()` — создание спрайта пола с учётом очищения, сердец, сундуков, сферы.
  - Спрайты для дверей, камней, алтарей, сундуков, ключей, выходов.

### `render/entity-pool.js`
- **За что отвечает:** кэширование текстур и фабрики спрайтов.
- **Содержит:**
  - `initEntityPool()` — нарезка кадров анимаций героя, плеваки, кокона, летучей мыши, загрузка текстур врагов/оружий/трупов.
  - `makeEnemySprite()`, `makeCorpseSprite()` — создание спрайтов врагов и трупов.
  - `getPlevakaFrame()` — кадр анимации плеваки.
  - Хранилища `heroFrames`, `plevakaFrames`, `cocoonFrames`, `batFrames`, `enemyTextures`, `corpseTextures`, `weaponTextures`.

### `render/player-renderer.js`
- **За что отвечает:** отрисовка героя и оружия.
- **Содержит:**
  - `initPlayerRenderer()`, `updatePlayerSprite()`, `destroyPlayerRenderer()`.
  - Выбор анимации по направлению движения и прицелу, отзеркаливание.
  - Позиционирование спрайта оружия относительно героя с поворотом.
  - Мигание спрайта при неуязвимости.

### `render/enemy-renderer.js`
- **За что отвечает:** отрисовка живых врагов и трупов.
- **Содержит:**
  - `syncEnemySprites()` — синхронизация спрайтов с `activeSpiders` и `deathCorpses`.
  - `clearEnemySprites()` — очистка.
  - `_syncActive()` — позиция, масштаб, поворот к игроку, вспышка от урона через `ColorMatrixFilter`, анимации плеваки/кокона/летучей мыши.
  - `_syncCorpses()` — трупы с угасанием alpha.

### `render/bullet-renderer.js`
- **За что отвечает:** отрисовка пуль через `ParticleContainer`.
- **Содержит:**
  - `initBulletRenderer()`, `syncBullets()`, `clearBullets()`.
  - Генерация белой круглой текстуры, пул частиц.

### `render/collectible-renderer.js`
- **За что отвечает:** отрисовка собираемых предметов в мире.
- **Содержит:**
  - `initCollectibleRenderer()`, `syncCollectibles()`, `clearCollectibles()`.
  - Отдельные Map для сердец, проклятых сундуков, апгрейд-сундуков, оружия, алтарей.
  - Учёт открытых/раскрытых комнат для видимости предметов.

### `render/damage-numbers.js`
- **За что отвечает:** всплывающие цифры урона.
- **Содержит:**
  - `spawnDamageNumber()`, `updateAndSyncDamageNumbers()`, `clearDamageNumbers()`.
  - Пул `Text`-объектов, проекция world-координат в экранные через `camera.worldToScreen()`.
  - Поддержка критов (цвет, масштаб).

### `render/particles.js`
- **За что отвечает:** система частиц.
- **Содержит:**
  - `initParticles()`, `syncParticles()`, `clearParticles()`.
  - `spawnParticles()` — эмиттер в массив `state.particles`.
  - `spawnPurifyWave()` — волна очищения комнаты.
  - `ParticleContainer` с `dynamicProperties` для позиции и цвета.

### `render/flying-heart.js`
- **За что отвечает:** анимация летающего сердца при открытии/закрытии стены.
- **Содержит:** `initFlyingHeartRenderer()`, `syncFlyingHeart()`, `destroyFlyingHeartRenderer()`.

### `render/hud.js`
- **За что отвечает:** интерфейс поверх игрового мира.
- **Содержит:**
  - `initHud()`, `updateHud()`, `updateBossHpBar()`, `updateFps()`, `showLevelComplete()`, `hideLevelComplete()`, `destroyHud()`.
  - Панели: уровень, жизни, щиты, иконки улучшений, слоты оружия, подсказки управления, подсказка подбора, призыв босса, HP босса, FPS, экран прохождения уровня.

### `render/overlay.js`
- **За что отвечает:** модальные панели выбора и экран смерти.
- **Содержит:**
  - `initOverlay()`, `updateOverlay()`, `destroyOverlay()`.
  - `showGameOver()`, `hideGameOver()` — экран смерти с кнопкой рестарта.
  - `isOverlayActive()`, `isGameOverActive()`.
  - Панели выбора: проклятый сундук, апгрейд-сундук, комнатный бонус.

### `render/tooltip.js`
- **За что отвечает:** всплывающие подсказки при наведении на оружие.
- **Содержит:**
  - `initTooltip()`, `updateTooltip()`, `showTooltip()`, `hideTooltip()`, `destroyTooltip()`.
  - Проверка наведения на брошенное оружие, перевод мыши в мир, позиционирование подсказки на экране.

### `render/debug-renderer.js`
- **За что отвечает:** визуализация коллайдеров физики.
- **Содержит:**
  - `initDebugRenderer()`, `syncDebugColliders()`, `clearDebugRenderer()`.
  - Рисование кругов и полигонов всех тел Matter.js при `CONFIG.DEBUG_COLLISIONS`.

---

## `world/` — мир, генерация и физика

### `world/constants.js`
- **За что отвечает:** глобальные константы и геометрические утилиты.
- **Содержит:**
  - `CELL_PX = 126`, `FLOOR_TILES_PER_CELL`, `SUBCELL_PX`, направления.
  - `cellKey()`, `cellFromKey()`, `cellOf()`, `wallKey()`, `wallKeyFromStr()`.
  - `recomputeOpenCells()`, `getConnectedCells()`, `getCellBounds()` — BFS.
  - `crossesWall()`, `inRoom()`, `getWallAtPoint()`, `getRoomBonus()`, `getRoomSpeedMultiplier()`.
  - `easeInOutQuad()` — функция сглаживания.

### `world/level-gen.js`
- **За что отвечает:** процедурная генерация уровня.
- **Содержит:**
  - `generateLevel(level, playerProgress)` — генерация комнат, связей, содержимого, врагов, наград.
  - `generateRooms()` — BFS-расширение уровня случайными комнатами разных форм.
  - Расстановка сердец, сундуков, алтарей, сферы призыва, ключей, боссов, улучшений.
  - `shuffleInPlace()` и утилиты для выбора форм комнат.

### `world/physics.js`
- **За что отвечает:** обёртка вокруг Matter.js.
- **Содержит:**
  - `createEngine()`, `stepEngine(dtMs)`, `clearEngine()`.
  - `createPlayerBody()`, `createEnemyBody()`, `destroyBody()`, `setBodyVelocity()`, `setPlayerDashing()`.
  - `syncWallBodies()` — синхронизация статических стен по `blobCells` и `removedWalls`.
  - `syncExternalWallBodies()` — внешние границы видимых клеток.
  - `onCollision()` — регистрация обработчика столкновений.
  - `getAllBodies()` — для debug-отрисовки.
  - Категории коллизий: `CAT_WALL`, `CAT_PLAYER`, `CAT_ENEMY`.
