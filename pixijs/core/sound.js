// ============================================================
// SOUND — @pixi/sound v6 wrapper
// Mirrors the old Sounds object API so game code can call the
// same methods without modification.
// All sound aliases are loaded in core/assets.js.
// ============================================================

import { sound } from '@pixi/sound';

// ── Volume ────────────────────────────────────────────────────

let _volume = CONFIG.SOUND.defaultVolume;

export function resumeAudioContext() {
  try {
    const ctx = sound.context.audioContext;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch (e) {}
}

export const Sounds = {

  get _volume()    { return _volume; },
  set _volume(v)   { _volume = v; this.ambienceSyncVolume(); },

  // ── One-shot SFX ────────────────────────────────────────────

  play(alias, opts = {}) {
    try {
      sound.play(alias, { volume: _volume * (opts.mult ?? 1), ...opts });
    } catch (e) { /* asset not loaded yet */ }
  },

  keycollect()     { this.play('keycollect'); },
  heartcollect()   { this.play('heartcollect'); },
  hearttravel()    { this.play('hearttravel'); },
  upgradecollect() { this.play('upgradecollect'); },
  weaponcollect()  { this.play('weaponcollect'); },
  death()          { this.play('death'); },
  hitonplayer()    { this.play('hitonplayer'); },
  shield()         { this.play('shield-sfx'); },
  levelcomplete()  { this.play('levelcomplete'); },
  zoom()           { this.play('zoom'); },

  hit() {
    const n = Math.floor(Math.random() * 5) + 1;
    this.play(`hit${n}`);
  },

  wallhit() {
    const n = Math.floor(Math.random() * 3) + 1;
    this.play(`wallhit${n}`);
  },

  shot(weaponId) {
    const map = {
      pistol:   'shot_pistol',
      shotgun:  'shot_shotgun',
      smg:      'shot_smg',
      carbine:  'shot_carbine',
      rifle:    'shot_rifle',
      revolver: 'shot_revolver',
    };
    const alias = map[weaponId] || 'shot_pistol';
    this.play(alias, { mult: CONFIG.SOUND.shotVolumeMult });
  },

  // ── Footstep timer ──────────────────────────────────────────

  _footstepTimer: 0,

  footstep(dt) {
    this._footstepTimer -= dt;
    if (this._footstepTimer <= 0) {
      const n = Math.floor(Math.random() * 5);
      this.play(`footstep${n}`);
      this._footstepTimer = CONFIG.SOUND.footstepInterval;
    }
  },

  // ── Ambience ────────────────────────────────────────────────

  ambienceStart() {
    try {
      if (!sound.find('ambience').isPlaying) {
        sound.play('ambience', {
          loop:   true,
          volume: _volume * CONFIG.SOUND.ambienceVolumeMult,
        });
      }
    } catch (e) {}
  },

  ambienceStop() {
    try { sound.stop('ambience'); } catch (e) {}
  },

  ambienceSyncVolume() {
    try {
      const s = sound.find('ambience');
      if (s) s.volume = _volume * CONFIG.SOUND.ambienceVolumeMult;
    } catch (e) {}
  },

  // ── Level / boss music with cross-fade ──────────────────────

  _levelMusicAlias: null,
  _bossMusicAlias:  null,
  _musicFade:       null, // { fromAlias, toAlias, fromVol, toVol, dur, elapsed, opts }

  playLevelMusic(level) {
    const cfg = CONFIG.MUSIC[level];
    if (!cfg) return;
    this.stopGameMusic();
    this._levelMusicAlias = `music_level${level}`;
    this._bossMusicAlias  = null;
    try {
      sound.play(this._levelMusicAlias, {
        loop:   true,
        volume: cfg.volume * _volume,
      });
    } catch (e) {}
  },

  stopLevelMusic(fadeDuration = 0) {
    if (!this._levelMusicAlias) return;
    if (fadeDuration > 0) {
      this._musicFade = {
        fromAlias: this._levelMusicAlias,
        toAlias:   null,
        fromVol:   _currentVol(this._levelMusicAlias),
        toVol:     0,
        dur:       fadeDuration,
        elapsed:   0,
        stopFrom:  true,
      };
    } else {
      try { sound.stop(this._levelMusicAlias); } catch (e) {}
      this._levelMusicAlias = null;
    }
  },

  playBossMusic() {
    const cfg = CONFIG.MUSIC.BOSS;
    if (!cfg) return;
    this._bossMusicAlias = 'music_boss';
    try { sound.play(this._bossMusicAlias, { loop: true, volume: 0 }); } catch (e) {}
    this._musicFade = {
      fromAlias:    this._levelMusicAlias,
      toAlias:      this._bossMusicAlias,
      fromVol:      _currentVol(this._levelMusicAlias),
      toVol:        cfg.volume * _volume,
      dur:          CONFIG.FADE_DURATION_LEVEL_TO_BOSS,
      elapsed:      0,
      pauseFrom:    true,
    };
  },

  stopBossMusic() {
    if (!this._bossMusicAlias) return;
    const level = _currentLevelForMusic();
    const cfg   = CONFIG.MUSIC[level] || CONFIG.MUSIC[1];
    const alias = `music_level${level}`;
    // Restart level music silently
    if (cfg) {
      try { sound.play(alias, { loop: true, volume: 0 }); } catch (e) {}
      this._levelMusicAlias = alias;
    }
    this._musicFade = {
      fromAlias: this._bossMusicAlias,
      toAlias:   alias,
      fromVol:   _currentVol(this._bossMusicAlias),
      toVol:     cfg ? cfg.volume * _volume : 0.3,
      dur:       CONFIG.FADE_DURATION_BOSS_TO_LEVEL,
      elapsed:   0,
      stopFrom:  true,
    };
  },

  stopGameMusic() {
    if (this._levelMusicAlias) {
      try { sound.stop(this._levelMusicAlias); } catch (e) {}
      this._levelMusicAlias = null;
    }
    if (this._bossMusicAlias) {
      try { sound.stop(this._bossMusicAlias); } catch (e) {}
      this._bossMusicAlias = null;
    }
    this._musicFade = null;
  },

  updateMusicFade(dt) {
    const fade = this._musicFade;
    if (!fade) return;
    fade.elapsed += dt;
    const t = Math.min(fade.elapsed / fade.dur, 1);
    if (fade.fromAlias) _setVol(fade.fromAlias, fade.fromVol * (1 - t));
    if (fade.toAlias)   _setVol(fade.toAlias,   fade.toVol   * t);
    if (t >= 1) {
      if (fade.stopFrom && fade.fromAlias) {
        try { sound.stop(fade.fromAlias); } catch (e) {}
      }
      if (fade.pauseFrom && fade.fromAlias) {
        try { sound.pause(fade.fromAlias); } catch (e) {}
      }
      if (fade.toAlias === null) this._levelMusicAlias = null;
      this._musicFade = null;
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────

function _currentVol(alias) {
  if (!alias) return 0;
  try { return sound.find(alias)?.volume ?? 0; } catch (e) { return 0; }
}

function _setVol(alias, vol) {
  try {
    const s = sound.find(alias);
    if (s) s.volume = Math.max(0, vol);
  } catch (e) {}
}

let _currentLevel = 1;
export function setSoundCurrentLevel(level) { _currentLevel = level; }
function _currentLevelForMusic() { return _currentLevel; }
