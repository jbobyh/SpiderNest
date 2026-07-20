using System.Collections.Generic;
using Godot;

namespace SpaceOrLife.Presentation;

public partial class AudioSystem : Node
{
    private const int SfxPoolSize = 8;
    private const float SfxVolume = 0.3f;
    private const float AmbienceVolumeMult = 0.6f;
    private const float ShotVolumeMult = 0.4f;
    private const float FootstepInterval = 0.25f;
    private const float FadeDuration = 0.5f;

    private readonly List<AudioStreamPlayer> _sfxPool = new();
    private int _sfxIndex;

    private AudioStreamPlayer? _levelMusicPlayer;
    private AudioStreamPlayer? _bossMusicPlayer;
    private AudioStreamPlayer? _ambiencePlayer;

    private readonly Dictionary<string, AudioStream> _streamCache = new();

    private float _footstepTimer;
    private int _currentLevel = 1;

    private Tween? _musicFade;

    private static void EnsureBuses()
    {
        if (AudioServer.GetBusCount() > 1) return;

        AudioServer.AddBus(); // SFX
        AudioServer.SetBusName(1, "SFX");
        AudioServer.SetBusSend(1, "Master");

        AudioServer.AddBus(); // Music
        AudioServer.SetBusName(2, "Music");
        AudioServer.SetBusSend(2, "Master");

        AudioServer.AddBus(); // Ambience
        AudioServer.SetBusName(3, "Ambience");
        AudioServer.SetBusSend(3, "Master");
    }

    public override void _Ready()
    {
        EnsureBuses();

        for (int i = 0; i < SfxPoolSize; i++)
        {
            var player = new AudioStreamPlayer
            {
                Bus = "SFX",
                VolumeDb = LinearToDb(SfxVolume)
            };
            AddChild(player);
            _sfxPool.Add(player);
        }

        _levelMusicPlayer = new AudioStreamPlayer { Bus = "Music" };
        AddChild(_levelMusicPlayer);

        _bossMusicPlayer = new AudioStreamPlayer { Bus = "Music" };
        AddChild(_bossMusicPlayer);

        _ambiencePlayer = new AudioStreamPlayer { Bus = "Ambience" };
        AddChild(_ambiencePlayer);
    }

    public override void _ExitTree()
    {
        _musicFade?.Kill();
        _musicFade = null;
    }

    private static float LinearToDb(float linear)
    {
        if (linear <= 0f) return -80f;
        return Mathf.LinearToDb(linear);
    }

    private AudioStream? LoadStream(string path)
    {
        if (_streamCache.TryGetValue(path, out var cached))
            return cached;

        var stream = ResourceLoader.Load<AudioStream>(path);
        if (stream != null)
            _streamCache[path] = stream;
        return stream;
    }

    private void PlaySfx(string path, float volumeMult = 1f)
    {
        // Audio disabled — files not importable yet
    }

    public void Shot(string weaponId)
    {
        var path = weaponId switch
        {
            "pistol" => "res://Assets/Audio/Sfx/shotpistol.wav",
            "shotgun" => "res://Assets/Audio/Sfx/shotshotgun.wav",
            "smg" => "res://Assets/Audio/Sfx/shotsmg.wav",
            "carbine" => "res://Assets/Audio/Sfx/shotcarbine.wav",
            "rifle" => "res://Assets/Audio/Sfx/shotrifle.wav",
            "revolver" => "res://Assets/Audio/Sfx/shotrevolver.wav",
            _ => "res://Assets/Audio/Sfx/shotpistol.wav"
        };
        PlaySfx(path, ShotVolumeMult);
    }

    public void Hit()
    {
        var n = GD.RandRange(1, 5);
        PlaySfx($"res://Assets/Audio/Sfx/hit{n}.wav");
    }

    public void WallHit()
    {
        var n = GD.RandRange(1, 3);
        PlaySfx($"res://Assets/Audio/Sfx/wallhit{n}.wav");
    }

    public void HeartCollect() => PlaySfx("res://Assets/Audio/Sfx/heartcollect.wav");
    public void KeyCollect() => PlaySfx("res://Assets/Audio/Sfx/keycollect.wav");
    public void UpgradeCollect() => PlaySfx("res://Assets/Audio/Sfx/upgradecollect.wav");
    public void WeaponCollect() => PlaySfx("res://Assets/Audio/Sfx/weaponcollect.wav");
    public void Death() => PlaySfx("res://Assets/Audio/Sfx/death.wav");
    public void HitOnPlayer() => PlaySfx("res://Assets/Audio/Sfx/hitonplayer.wav");
    public void Shield() => PlaySfx("res://Assets/Audio/Sfx/shield.wav");
    public void LevelComplete() => PlaySfx("res://Assets/Audio/Sfx/levelcomplete.wav");
    public void Zoom() => PlaySfx("res://Assets/Audio/Sfx/zoom.wav");
    public void HeartTravel() => PlaySfx("res://Assets/Audio/Sfx/hearttravel.wav");

    public void Footstep(float dt)
    {
        _footstepTimer -= dt;
        if (_footstepTimer <= 0f)
        {
            var n = GD.RandRange(0, 4);
            PlaySfx($"res://Assets/Audio/Sfx/footstep_concrete_{n:D3}.ogg", 0.5f);
            _footstepTimer = FootstepInterval;
        }
    }

    public void AmbienceStart()
    {
        // Music/ambience disabled — audio files not importable yet
    }

    public void AmbienceStop()
    {
        _ambiencePlayer?.Stop();
    }

    public void PlayLevelMusic(int level)
    {
        // Music disabled — audio files not importable yet
    }

    public void PlayBossMusic()
    {
        // Music disabled — audio files not importable yet
    }

    public void StopBossMusic()
    {
        // Music disabled — audio files not importable yet
    }

    public void StopAllMusic()
    {
        _musicFade?.Kill();
        _musicFade = null;
        _levelMusicPlayer?.Stop();
        _bossMusicPlayer?.Stop();
    }
}
