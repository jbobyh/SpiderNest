import { Assets } from 'pixi.js';
import '@pixi/sound';  // registers audio parsers with PixiJS Assets

const IMG = '../img/';
const SND = '../sounds/';

// ============================================================
// ASSET MANIFEST
// Split into bundles so music can be loaded lazily.
// ============================================================

const MANIFEST = {
  bundles: [

    // ── Tilemap textures ────────────────────────────────────
    {
      name: 'tiles',
      assets: [
        { alias: 'background',                        src: IMG + 'background.png' },
        // Blue (level 1)
        { alias: 'floor-blue',                        src: IMG + 'floor-blue.png' },
        { alias: 'floor-rightexit-blue',              src: IMG + 'floor-rightexit-blue.png' },
        { alias: 'floor-rightbottomexit-blue',        src: IMG + 'floor-rightbottomexit-blue.png' },
        { alias: 'floor-leftrightbottomexit-blue',    src: IMG + 'floor-leftrightbottomexit-blue.png' },
        { alias: 'floor-topdownexit-blue',            src: IMG + 'floor-topdownexit-blue.png' },
        { alias: 'floor-4exit-blue',                  src: IMG + 'floor-4exit-blue.png' },
        { alias: 'wall',                              src: IMG + 'wall.png' },
        { alias: 'corner',                            src: IMG + 'corner.png' },
        // Green (level 2)
        { alias: 'floor-green',                       src: IMG + 'floor-green.png' },
        { alias: 'floor-rightexit-green',             src: IMG + 'floor-rightexit-green.png' },
        { alias: 'floor-rightbottomexit-green',       src: IMG + 'floor-rightbottomexit-green.png' },
        { alias: 'floor-leftrightbottomexit-green',   src: IMG + 'floor-leftrightbottomexit-green.png' },
        { alias: 'floor-topdownexit-green',           src: IMG + 'floor-topdownexit-green.png' },
        { alias: 'floor-4exit-green',                 src: IMG + 'floor-4exit-green.png' },
        { alias: 'wall-green',                        src: IMG + 'wall-green.png' },
        { alias: 'corner-green',                      src: IMG + 'corner-green.png' },
        // Yellow/brown (level 3)
        { alias: 'floor-y',                           src: IMG + 'floor-y.png' },
        { alias: 'floor-rightexit-y',                 src: IMG + 'floor-rightexit-y.png' },
        { alias: 'floor-rightbottomexit-y',           src: IMG + 'floor-rightbottomexit-y.png' },
        { alias: 'floor-leftrightbottomexit-y',       src: IMG + 'floor-leftrightbottomexit-y.png' },
        { alias: 'floor-topdownexit-y',               src: IMG + 'floor-topdownexit-y.png' },
        { alias: 'floor-4exit-y',                     src: IMG + 'floor-4exit-y.png' },
        { alias: 'wall-y',                            src: IMG + 'wall-y.png' },
        { alias: 'corner-y',                          src: IMG + 'corner-y.png' },
        // Special cells
        { alias: 'closedcell',                        src: IMG + 'closedcell.png' },
        { alias: 'rock',                              src: IMG + 'rock.png' },
        { alias: 'closedexit1',                       src: IMG + 'closedexit1.png' },
        { alias: 'closedexit2',                       src: IMG + 'closedexit2.png' },
        { alias: 'closedexit3',                       src: IMG + 'closedexit3.png' },
        { alias: 'openexit',                          src: IMG + 'openexit.png' },
        { alias: 'altar',                             src: IMG + 'altar.png' },
        { alias: 'room_altar',                        src: IMG + 'room_altar.png' },
        { alias: 'floor-stone',                       src: IMG + 'kenney_textures/floor_stone.png' },
        { alias: 'floor-stone-dark',                  src: IMG + 'kenney_textures/floor_stone_dark.png' },
        { alias: 'floor-stone-pattern',              src: IMG + 'kenney_textures/floor_stone_pattern.png' },
        { alias: 'floor-stone-pattern-dark',         src: IMG + 'kenney_textures/floor_stone_pattern_dark.png' },
        { alias: 'floor-stone-pattern-small',        src: IMG + 'kenney_textures/floor_stone_pattern_small.png' },
        { alias: 'floor-stone-pattern-small-dark',   src: IMG + 'kenney_textures/floor_stone_pattern_small_dark.png' },
        { alias: 'floor-ground-sand',                 src: IMG + 'kenney_textures/floor_ground_sand.png' },
        { alias: 'floor-ground-dirt',                 src: IMG + 'kenney_textures/floor_ground_dirt.png' },
      ],
    },

    // ── Character & entity sprites ──────────────────────────
    {
      name: 'entities',
      assets: [
        // Hero sprite sheet (192×64, 3 frames of 64×64: front, back, left)
        { alias: 'hero',              src: '../arts/player_body_spritesheet.png' },
        // Hero hands sprite sheet (320×192, 3 rows × 5 cols of 64×64)
        { alias: 'hero-hands',        src: '../arts/player_hands_spritesheet.png' },
        // IK arm sprites (pointing west)
        { alias: 'arm-upper',         src: '../arts/lefthand2.png' },
        { alias: 'arm-forearm',       src: '../arts/lefthand1.png' },
        // IK arm sprites (pointing south)
        { alias: 'arm-south-upper',   src: '../arts/southhand2.png' },
        { alias: 'arm-south-forearm', src: '../arts/southhand1.png' },
        // Hero legs sprite sheet (320×192, 3 rows × 5 cols of 64×64)
        { alias: 'hero-legs',         src: '../arts/player_legs_spritesheet.png' },
        // Enemies — static sprites
        { alias: 'soldier',           src: IMG + 'soldier.png' },
        { alias: 'soldier-dead',      src: IMG + 'soldier_dead.png' },
        { alias: 'bloated',           src: IMG + 'bloated.png' },
        { alias: 'bloated-dead',      src: IMG + 'bloated_dead.png' },
        { alias: 'buldyga',           src: IMG + 'buldyga.png' },
        { alias: 'buldyga-dead',      src: IMG + 'buldyga_dead.png' },
        { alias: 'bull',              src: IMG + 'bull.png' },
        { alias: 'bull-dead',         src: IMG + 'bull_dead.png' },
        // Shooter — animated sprite sheet (1500×1500, 3 rows × 3 cols)
        { alias: 'shooter',           src: IMG + 'shooter.png' },
        { alias: 'shooter-anim',      src: IMG + 'shooter_anim.png' },
        { alias: 'shooter-dead',      src: IMG + 'shooter_dead.png' },
        // Cocoon — animated sprite sheet (3500×500, 7 frames horizontal)
        { alias: 'cocoon',            src: IMG + 'cocoon.png' },
        // Bat — 512×64 sprite sheet, 8 frames of 64×64 (7 move + 1 damage)
        { alias: 'bat',               src: IMG + 'Bat_NoContour.png' },
        // Ghost — 256×224 sprite sheet, 32×32 per frame, 8 cols × 7 rows
        { alias: 'ghost',             src: IMG + 'ghost_spritesheet.png' },
        // Screens
        { alias: 'death-screen',      src: IMG + 'death.png' },
        { alias: 'gameover-screen',   src: IMG + 'gameover.png' },
        { alias: 'gameover-text',     src: IMG + 'gameover-text.png' },
        { alias: 'deathtext',         src: IMG + 'deathtext.png' },
        // Shoot VFX sprite sheet (9×9, 64×64px per frame)
        { alias: 'shoot-vfx',         src: IMG + 'shoot-vfx.png' },
        // Wall hit VFX sprite sheet (top row, 10 frames × 64×64px)
        { alias: 'wallhit-vfx',       src: IMG + 'wallhit-vfx.png' },
        // Enemy hit VFX sprite sheet (top row, 8 frames × 64×64px)
        { alias: 'enemyhit-vfx',      src: IMG + 'enemyhit-vfx.png' },
        // Burn status VFX sprite sheet (top row, 16 frames × 64×64px)
        { alias: 'firestatus-vfx',    src: IMG + 'firestatus-vfx.png' },
        // Freeze status VFX sprite sheet (row 3, 12 frames × 64×64px)
        { alias: 'freeze-vfx',        src: IMG + 'freeze-vfx.png' },
      ],
    },

    // ── HUD & collectibles ──────────────────────────────────
    {
      name: 'hud',
      assets: [
        { alias: 'heart',             src: IMG + 'heart.png' },
        { alias: 'heart-container',   src: IMG + 'heart-container.png' },
        { alias: 'key',               src: IMG + 'key.png' },
        { alias: 'shield',            src: IMG + 'shield.png' },
        { alias: 'locked',            src: IMG + 'locked.png' },
        { alias: 'unlocked',          src: IMG + 'unlocked.png' },
        { alias: 'open-treasure-chest', src: IMG + 'open-treasure-chest.png' },
        { alias: 'chest',                 src: IMG + 'chest.png' },
        { alias: 'cursed-chest',          src: IMG + 'chest_cursed.png' },
        { alias: 'sphere',                src: IMG + 'sphere.png' },
        // Weapon sprites (HUD + floor pickups)
        { alias: 'weapon-pistol',     src: IMG + 'weapons/pistol/[SHOOTING]PistolV1.00.png' },
        { alias: 'weapon-pistol-emptying', src: IMG + 'weapons/pistol/Pistol_V1.00 - EMPTYING.png' },
        { alias: 'weapon-pistol-reload',   src: IMG + 'weapons/pistol/Pistol_V1.00 - RELOAD.png' },
        { alias: 'weapon-shotgun',    src: IMG + 'shotgun.png' },
        { alias: 'weapon-smg',        src: IMG + 'smg.png' },
        { alias: 'weapon-rifle',      src: IMG + 'rifle.png' },
        { alias: 'weapon-revolver',   src: IMG + 'revolver.png' },
        { alias: 'weapon-carbine',    src: IMG + 'carbine.png' },
        // Input hint icons
        { alias: 'ctrl-f',            src: IMG + 'keyboard_f.png' },
        { alias: 'ctrl-shift',        src: IMG + 'keyboard_shift.png' },
        { alias: 'ctrl-tab',          src: IMG + 'keyboard_tab.png' },
        { alias: 'mouse-left',        src: IMG + 'mouse_left.png' },
        { alias: 'mouse-right',       src: IMG + 'mouse_right.png' },
        // 9-slice panel background
        { alias: 'panel-center',      src: IMG + 'panel/0.png' },
        { alias: 'panel-lt',          src: IMG + 'panel/1.png' },
        { alias: 'panel-rt',          src: IMG + 'panel/2.png' },
        { alias: 'panel-lb',          src: IMG + 'panel/3.png' },
        { alias: 'panel-rb',          src: IMG + 'panel/4.png' },
        { alias: 'panel-l',           src: IMG + 'panel/5.png' },
        { alias: 'panel-t',           src: IMG + 'panel/6.png' },
        { alias: 'panel-r',           src: IMG + 'panel/7.png' },
        { alias: 'panel-b',           src: IMG + 'panel/8.png' },
      ],
    },

    // ── Short sound effects (loaded eagerly) ────────────────
    {
      name: 'sfx',
      assets: [
        { alias: 'keycollect',    src: SND + 'keycollect.wav' },
        { alias: 'heartcollect',  src: SND + 'heartcollect.wav' },
        { alias: 'hearttravel',   src: SND + 'hearttravel.wav' },
        { alias: 'hit1',          src: SND + 'hit1.wav' },
        { alias: 'hit2',          src: SND + 'hit2.wav' },
        { alias: 'hit3',          src: SND + 'hit3.wav' },
        { alias: 'hit4',          src: SND + 'hit4.wav' },
        { alias: 'hit5',          src: SND + 'hit5.wav' },
        { alias: 'upgradecollect',src: SND + 'upgradecollect.wav' },
        { alias: 'weaponcollect', src: SND + 'weaponcollect.wav' },
        { alias: 'shot_pistol',   src: SND + 'shotpistol.wav' },
        { alias: 'shot_shotgun',  src: SND + 'shotshotgun.wav' },
        { alias: 'shot_smg',      src: SND + 'shotsmg.wav' },
        { alias: 'shot_rifle',    src: SND + 'shotrifle.wav' },
        { alias: 'shot_revolver', src: SND + 'shotrevolver.wav' },
        { alias: 'shot_carbine',  src: SND + 'shotcarbine.wav' },
        { alias: 'death',         src: SND + 'death.wav' },
        { alias: 'hitonplayer',   src: SND + 'hitonplayer.wav' },
        { alias: 'shield-sfx',    src: SND + 'shield.wav' },
        { alias: 'levelcomplete', src: SND + 'levelcomplete.wav' },
        { alias: 'wallhit1',      src: SND + 'wallhit1.wav' },
        { alias: 'wallhit2',      src: SND + 'wallhit2.wav' },
        { alias: 'wallhit3',      src: SND + 'wallhit3.wav' },
        { alias: 'zoom',          src: SND + 'zoom.wav' },
        { alias: 'footstep0',     src: SND + 'footstep_concrete_000.ogg' },
        { alias: 'footstep1',     src: SND + 'footstep_concrete_001.ogg' },
        { alias: 'footstep2',     src: SND + 'footstep_concrete_002.ogg' },
        { alias: 'footstep3',     src: SND + 'footstep_concrete_003.ogg' },
        { alias: 'footstep4',     src: SND + 'footstep_concrete_004.ogg' },
      ],
    },

    // ── Music (large files — load on demand via loadMusicBundle) ──
    {
      name: 'music',
      assets: [
        { alias: 'music_level1',  src: SND + 'Three Red Hearts Candy.ogg' },
        { alias: 'music_level2',  src: SND + 'Clement Panchout - Sweet 70s.wav' },
        { alias: 'music_level3',  src: SND + 'Three Red Hearts - Box Jump.ogg' },
        { alias: 'music_boss',    src: SND + 'GEN Death metal.wav' },
        { alias: 'ambience',      src: SND + 'Ambience.wav' },
      ],
    },

  ],
};

// ============================================================
// LOAD FUNCTIONS
// ============================================================

let _initialised = false;

/**
 * Load all non-music assets.
 * @param {(progress: number) => void} [onProgress] — called with 0..1
 */
export async function loadAssets(onProgress) {
  if (!_initialised) {
    await Assets.init({ manifest: MANIFEST });
    _initialised = true;
  }
  await Assets.loadBundle(['tiles', 'entities', 'hud', 'sfx'], onProgress);
}

/**
 * Load music bundle (large files — call once game actually starts).
 * @param {(progress: number) => void} [onProgress]
 */
export async function loadMusicBundle(onProgress) {
  if (!_initialised) {
    await Assets.init({ manifest: MANIFEST });
    _initialised = true;
  }
  await Assets.loadBundle('music', onProgress);
}