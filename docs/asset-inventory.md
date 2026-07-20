# Asset Inventory — SpiderNest Godot Port

From `core/assets.js` manifest + filesystem scan. Ignore `arts/*.aseprite`, `arts/PXO/`.

---

## 1. Sprites — Tiles (`img/`)

### Level palettes (floor/wall/corner ×3)
| Level | Floor base | Right exit | Right+bottom | L+R+bottom | Top+down | 4-exit | Wall | Corner |
|---|---|---|---|---|---|---|---|---|
| 1 (blue) | `floor-blue.png` | `floor-rightexit-blue.png` | `floor-rightbottomexit-blue.png` | `floor-leftrightbottomexit-blue.png` | `floor-topdownexit-blue.png` | `floor-4exit-blue.png` | `wall.png` | `corner.png` |
| 2 (green) | `floor-green.png` | `floor-rightexit-green.png` | `floor-rightbottomexit-green.png` | `floor-leftrightbottomexit-green.png` | `floor-topdownexit-green.png` | `floor-4exit-green.png` | `wall-green.png` | `corner-green.png` |
| 3 (yellow) | `floor-y.png` | `floor-rightexit-y.png` | `floor-rightbottomexit-y.png` | `floor-leftrightbottomexit-y.png` | `floor-topdownexit-y.png` | `floor-4exit-y.png` | `wall-y.png` | `corner-y.png` |

### Special cells
| Asset | File |
|---|---|
| closed cell | `closedcell.png` |
| rock | `rock.png` |
| closed exit L1-3 | `closedexit1.png`, `closedexit2.png`, `closedexit3.png` |
| open exit | `openexit.png` |
| altar | `altar.png` |
| room altar | `room_altar.png` |

### Kenney textures (`img/kenney_textures/`)
`floor_stone.png`, `floor_stone_dark.png`, `floor_stone_pattern.png`, `floor_stone_pattern_dark.png`, `floor_stone_pattern_small.png`, `floor_stone_pattern_small_dark.png`, `floor_ground_sand.png`, `floor_ground_dirt.png`

### Background
`background.png` (508KB — parallax bg)

---

## 2. Sprites — Entities (`img/` + `arts/`)

### Player (`arts/`)
| Asset | File | Format |
|---|---|---|
| body spritesheet | `player_body_spritesheet.png` | 192×64, 3 frames × 64×64 |
| hands spritesheet | `player_hands_spritesheet.png` | 320×192, 3 rows × 5 cols × 64×64 |
| legs spritesheet | `player_legs_spritesheet.png` | 320×192, 3 rows × 5 cols × 64×64 |
| arm upper (west) | `lefthand2.png` | |
| arm forearm (west) | `lefthand1.png` | |
| arm upper (south) | `southhand2.png` | |
| arm forearm (south) | `southhand1.png` | |

### Enemies (`img/`)
| Enemy | Sprite | Dead sprite | Notes |
|---|---|---|---|
| soldier | `soldier.png` | `soldier_dead.png` | static |
| bloated | `bloated.png` | `bloated_dead.png` | static |
| buldyga | `buldyga.png` | `buldyga_dead.png` | static |
| bull | `bull.png` | `bull_dead.png` | static |
| shooter | `shooter.png` + `shooter_anim.png` | `shooter_dead.png` | animated: 1500×1500, 3×3 grid |
| cocoon | `cocoon.png` | — | animated: 3500×500, 7 frames |
| bat | `Bat_NoContour.png` | — | animated: 512×64, 8 frames × 64×64 |
| ghost | `ghost_spritesheet.png` | — | animated: 256×224, 32×32/frame, 8 cols × 7 rows |
| tank | uses `soldier.png`? | — | verify in enemy-types.js (Phase 5) |

### VFX sheets (`img/`)
| VFX | File | Frames | FPS | Size |
|---|---|---|---|---|
| shoot (muzzle) | `shoot-vfx.png` | 9 | 35 | 64×64 |
| wall hit | `wallhit-vfx.png` | 10 | 60 | 64×64 |
| enemy hit | `enemyhit-vfx.png` | 8 | 45 | 64×64 |
| burn status | `firestatus-vfx.png` | 16 | 48 | 64×64 |
| freeze status | `freeze-vfx.png` | 12 (row 2) | 48 | 64×64 |

### Screens (`img/`)
`death.png`, `gameover.png`, `gameover-text.png`, `deathtext.png`

---

## 3. Sprites — HUD & Collectibles (`img/`)

| Asset | File |
|---|---|
| heart | `heart.png` |
| heart container | `heart-container.png` |
| key | `key.png` |
| shield | `shield.png` |
| locked | `locked.png` |
| unlocked | `unlocked.png` |
| open treasure chest | `open-treasure-chest.png` |
| chest | `chest.png` |
| cursed chest | `chest_cursed.png` |
| sphere (summon) | `sphere.png` |

### Weapons (`img/` + `img/weapons/`)
| Weapon | Files |
|---|---|
| pistol | `weapons/pistol/[SHOOTING]PistolV1.00.png`, `weapons/pistol/Pistol_V1.00 - EMPTYING.png`, `weapons/pistol/Pistol_V1.00 - RELOAD.png` |
| shotgun | `shotgun.png` |
| smg | `weapons/smg/[SHOOT] Submachine - MP5A3.png`, `weapons/smg/[EMPTY] Submachine - MP5A3.png`, `weapons/smg/[RELOAD] Submachine - MP5A3.png` |
| rifle | `rifle.png`, `weapons/sniper/[SNIPER_SHOOTING]_Sniper_rifle_[KAR98]_V1.00.png`, `weapons/sniper/[SNIPER_ONLY_FIVE_ROUND_RELOADING]_Sniper_rifle_[KAR98]_V1.00-Sheet-sheet.png` |
| revolver | `revolver.png` |
| carbine | `weapons/rifle/[SINGLE_SHOT] Assault_rifle_V1.00.png`, `weapons/rifle/[EMPTYING] Assault_rifle_V1.00.png`, `weapons/rifle/[RELOAD] Assault_rifle_V1.00 - Reload.png` |

### Input hint icons
`keyboard_f.png`, `keyboard_shift.png`, `keyboard_tab.png`, `mouse_left.png`, `mouse_right.png`

### 9-slice panel (`img/panel/`)
`0.png` (center), `1.png` (LT), `2.png` (RT), `3.png` (LB), `4.png` (RB), `5.png` (L), `6.png` (T), `7.png` (R), `8.png` (B)

### Cursor
`crosshairs_white.png` (battle crosshair)

---

## 4. Unused Files (NOT in assets.js manifest — skip)

- `img/hero.png` — old hero sprite, not loaded
- `img/idleмного.png`, `idleмного2.png`, `idleмного3.png` — old idle frames
- `img/runbackмного.png`, `runfrontмного.png`, `runsideмного.png` — old run frames
- `img/player_spritesheet.png` (arts) — old, superseded by body/hands/legs sheets
- `arts/hand.aseprite`, `arts/PXO/` — source files, ignore

---

## 5. Font

| Asset | File | Format |
|---|---|---|
| BoldPixels | `fonts/boldpixels.ttf` | TTF, pixel font |

Godot import: FontFile, no filter (pixel).

---

## 6. Audio (`sounds/`)

### Music (lazy-loaded)
| Track | File | Size | Volume |
|---|---|---|---|
| Level 1 | `Three Red Hearts Candy.ogg` | 1.7MB | 0.0 (muted) |
| Level 2 | `Clement Panchout - Sweet 70s.wav` | 20MB | 0.0 |
| Level 3 | `Three Red Hearts - Box Jump.ogg` | 3.5MB | 0.0 |
| Boss | `GEN Death metal.wav` | 11MB | 0.0 |
| Ambience | `Ambience.wav` | 48MB | 0.6× mult |

### SFX (eager-loaded)
| SFX | File |
|---|---|
| key collect | `keycollect.wav` |
| heart collect | `heartcollect.wav` |
| heart travel | `hearttravel.wav` |
| hits ×5 | `hit1.wav`–`hit5.wav` |
| upgrade collect | `upgradecollect.wav` |
| weapon collect | `weaponcollect.wav` |
| shots ×6 | `shotpistol.wav`, `shotshotgun.wav`, `shotsmg.wav`, `shotrifle.wav`, `shotrevolver.wav`, `shotcarbine.wav` |
| death | `death.wav` |
| hit on player | `hitonplayer.wav` |
| shield | `shield.wav` |
| level complete | `levelcomplete.wav` |
| wall hits ×3 | `wallhit1.wav`, `wallhit2.wav`, `wallhit3.wav` |
| zoom | `zoom.wav` |
| footsteps ×5 | `footstep_concrete_000.ogg`–`004.ogg` |

### Unused audio
- `hit.wav` (superseded by hit1-5)
- `shot1.wav` (superseded by weapon-specific shots)

Godot import: `.wav` → AudioStreamWAV, `.ogg` → AudioStreamOggVorbis.

---

## 7. Godot Import Settings

| Asset type | Setting |
|---|---|
| PNG sprites | Texture2D, filter **off** (pixel art), compression lossless |
| TTF font | FontFile, antialiasing none, subpixel positioning off |
| .wav | AudioStreamWAV, loop off (except ambience) |
| .ogg | AudioStreamOggVorbis, loop off |

## 8. Godot Target Paths

```
Assets/
├── Audio/
│   ├── Music/     (5 music files)
│   └── Sfx/       (25 sfx files)
├── Fonts/         (boldpixels.ttf)
├── Sprites/
│   ├── Tiles/     (floor/wall/corner/special)
│   ├── Entities/  (player, enemies, vfx)
│   ├── Hud/       (hearts, chests, weapons, panel, icons)
│   └── Screens/   (death, gameover)
└── (Kenney textures under Tiles/)
```
