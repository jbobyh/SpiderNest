# Truth Table — SpiderNest Godot Port

Resolved conflicts and authoritative values from JS source. Code is authority over plan prose.

---

## 1. Coordinate System

| Item | Value | Source |
|---|---|---|
| `CELL_PX` | **126** | `world/constants.js:5` — runtime authority for physics/collision |
| `config.js` CELL_PX | 124.8 (96*1.3) | `config.js:9` — **DEAD**, not imported by any module |
| `RANGE_SCALE` | 126/10 = **12.6** | derived from CELL_PX |
| `FLOOR_TILES_PER_CELL` | 5 | `constants.js:7` |
| `FLOOR_TILE_PX` | 126/5 = **25.2** | `constants.js:8` |
| `FLOW_SUB` | 5 | plan §12.1 (sub-cells per cell axis) |
| `FLOW_SUB_PX` | 25.2 | = FLOOR_TILE_PX |
| `GRID_SIZE` | 9 | `config.js:8` |
| `VIEW_W` | 1024 | `config.js:10` |
| `VIEW_H` | 576 | `config.js:11` |
| `BATTLE_SCALE` | 1 | `config.js:279` — unified coords, no separate battle space |

---

## 2. Initial Visibility (state.js)

**Plan §4.7 was WRONG.** Actual behavior from `state.js:119-142`:

| Set | Initial value | Source |
|---|---|---|
| `openCells` | `{startCell}` | `state.js:119` |
| `everOpenedCells` | `{startCell}` | `state.js:120` |
| `everRevealedCells` | `{startCell}` + all cells of initially-purified rooms + all cells of rooms adjacent to purified rooms | `state.js:121-142` |

Initially purified = room 0 (start room) only, per `level-gen.js`. So `everRevealedCells` = start room cells + cells of rooms cardinal-adjacent to start room (whole rooms, not just border cells).

---

## 3. Default Player Progress (state.js)

**Plan §3.5 had wrong slot count.** Actual from `state.js:16-78`:

| Field | Value | Note |
|---|---|---|
| `totalLives` | 3 | |
| `souls` | 0 | |
| `weaponSlots` | `['pistol', null]` | **2 elements**, not 3 |
| `activeSlot` | 0 | |
| `maxSlots` | 1 | |
| `ammo` | `[12, 0]` | **2 elements** matching weaponSlots |
| `spawnedWeapons` | `[]` | |
| `spawnedUpgrades` | `{}` | |
| `upgradeLevels` | `{}` | |

Upgrade defaults: `speedMult=1, damageMult=0, cooldownMult=1, spreadMult=1, bulletSpeedMult=1, pellets=0, penetrate=0, critChance=0, critDamage=0, shield=0, lastLife=false, reflection=false, ricochet=false, infinitePenetrate=false, infiniteRange=false, incendiaryChance=0, freezeChance=0, hitStun=0, extraBulletChance=0, bloomReduction=0, killAccel=false, killAccelPercent=0, sniper=false, longRange=false, enhancedPierce=false, retreat=0, freeze=false, battleSpeed=false, randomBonus=false, farSight=false` + 16 spatial upgrade flags (all false).

---

## 4. longRange Room Bonus

**Plan §11.1 was WRONG.** Actual from `bullet-manager.js:181-185`:

| Source | Behavior |
|---|---|
| `bullet-manager.js:182` | `b._rangeDecayMult = 0.1` when entering longRange room |
| `bullet-manager.js:184` | reset to `1` when leaving |
| Effect | Distance accumulates at ×0.1 rate → bullet travels 10× further |
| Description "+1000%" | mathematically equivalent: 100% + 1000% = 1100% range = ~10× |

**Resolution:** Implement as `_rangeDecayMult = 0.1` on distance accumulation. NOT a flat range multiplier.

---

## 5. Battle Cell Computation

From `battle-mode.js:40-48`:

```
allOpenCells = openCells ∪ {openedCellKey}
playerCell = cellOf(player.x, player.y)
battleCells = getConnectedCells(allOpenCells, playerKey)
```

- BFS flood-fill within `allOpenCells` from player's cell
- NOT single room's cells — connected component across rooms
- Boss battle: `battleCells = all openCells` (no openedCellKey)

---

## 6. Battle Zoom Calculation

From `battle-mode.js:52-57`:

```
bCols = maxX - minX + 1
bRows = maxY - minY + 1
wallPad = CELL_PX * 0.125
scaleX = VIEW_W / (bCols * CELL_PX + wallPad * 2)
scaleY = VIEW_H / (bRows * CELL_PX + wallPad * 2)
zoom = min(scaleX, scaleY) * battleZoomMult  // battleZoomMult = 1
centerX = (minX + bCols/2) * CELL_PX
centerY = (minY + bRows/2) * CELL_PX
```

---

## 7. Save Format

| Item | Value | Source |
|---|---|---|
| JS save key | `"spidernest_save"` in localStorage | `state.js:227` |
| JS save version | 3 | `state.js:228` |
| Godot save path | `user://save.json` | plan §3.4 |
| Godot save version | 1 (new, no v3 migration) | plan §3.4 |
| Atomic write | temp file → replace | plan §3.4 |

**Godot save schema:** `{Version, CurrentLevel, PlayerProgress, LevelSnapshot}`

---

## 8. Mechanic Matrix

| Mechanic | Source function | Input | State mutation | Output/event | Save? |
|---|---|---|---|---|---|
| Wall open | `play-mode.js` right-click | `getWallAtPoint` + F | `removedWalls.add`, `openCells` recompute, `lives--` | heart anim, physics sync, reveal cells | yes |
| Wall close | `play-mode.js` right-click | `getWallAtPoint` + F | `removedWalls.delete`, `openCells` recompute, `lives++` | heart anim, physics sync | yes |
| Wall auto-close | `findAutoCloseWall` | lives ≤ 1, no lastLife | nearest openable wall closed | refund life | yes |
| Shoot | `play-mode.js` `shoot()` | mouse held | `ammo--`, `shootCooldown` set, `bloomSpread +=` | bullet spawn, sound, shake | no (periodic) |
| Reload | `play-mode.js` R key | R press | `isReloading=true`, `reloadCooldown` set | `ammo[slot]=magazineSize` on finish | no |
| Weapon switch | `play-mode.js` Q key | Q press | `activeSlot = (n+1)%maxSlots` | cancel reload/burst | no |
| Weapon pickup | `play-mode.js` F key | F press near weapon | slot fill/replace, `ammo` init | sound | yes |
| Dash | `play-mode.js` Shift | Shift press, cd ≤ 0 | `isDashing=true`, `dashDir`, `dashProgress` | trail particles, collision mask change | no |
| Enemy contact | `game-loop.js` collision | body overlap | `dealPlayerDamage()` | particles, invuln | no |
| Bullet hit enemy | `bullet-manager.js` | circle overlap | `enemy.hp -= damage`, `hitCount++` | damage number, particles, status | no |
| Stasis trigger | `bullet-manager.js` | bullet hits stasis enemy | `onStasisTriggered` → `createBattleState` | battle start | yes |
| Battle create | `battle-mode.js` | altar/chest/stasis | `state.battle` set, stasis removed | phase → zoom_in → battle | yes |
| Boss summon | `play-mode.js` Space | Space + sphere collected | `createBossBattleState` | boss spawn, music | yes |
| Battle win | `battle-mode.js` | all enemies dead | `exitBattleMode`, rewards, purify | phase → zoom_out → play | yes |
| Upgrade apply | `upgrades.js` | choice selected | `upgradeLevels[type]++`, effects applied | popup | yes |
| Room bonus assign | `play-mode.js` | altar F + choice | `roomBonuses.add` | battle trigger | yes |
| Heart pickup | `collectibles.js` | proximity | `lives++` (max 5), `heartsCollected++` | particles, sound | yes |
| Level complete | `game-loop.js` | exit reached after boss | `phase=win`, `savePlayerProgress` | win screen | yes |
| Death | `game-loop.js` | lives ≤ 0 | `phase=dead` | game over screen | no (restart from snapshot) |

---

## 9. Conflicts Resolved

| # | Conflict | Resolution |
|---|---|---|
| 1 | CELL_PX 124.8 vs 126 | **126** (constants.js runtime) |
| 2 | Initial everRevealedCells | start cell + purified rooms + adjacent rooms (whole rooms) |
| 3 | longRange room bonus | `_rangeDecayMult = 0.1` (code), not flat range mult |
| 4 | Default weaponSlots length | 2 (`['pistol', null]`), not 3 |
| 5 | Battle cells | connected component from player cell, not single room |
| 6 | `reflection` upgrade | commented out in config.js — NOT active |
| 7 | `spreadMult` | default state value 1.0, no upgrade modifies it |
| 8 | `farSight` | commented out in config.js — NOT active |
| 9 | `speedup` room bonus | does NOT exist (only `speeddown`) |
| 10 | `randomBonus` cursed | no effects, no onApply — custom logic grants 3 random regular upgrades |

---

## 10. Manual Baseline Captures (for later phases)

Reference list — not executed this session:
- Level generation L1 (grid), L2/L3 (random)
- First wall open (life spend, heart anim, reveal)
- Wall close (life refund)
- One room battle (stasis → activate → win → reward → purify)
- Each weapon: pistol, shotgun, smg, rifle, revolver, carbine (burst)
- Each enemy: soldier, tank, bat, shooter, wallshooter, bull, buldyga, bloated, cocoon, ghost
- Boss per level (3 bosses, phase transitions)
- Death → restart from level-start snapshot
- Level advance (cross-level progress retention)
