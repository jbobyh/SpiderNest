using System;
using Godot;
using SpaceOrLife.World;

namespace SpaceOrLife.Presentation;

public partial class VfxPool : Node2D
{
    private struct Particle
    {
        public Vector2 Position;
        public Vector2 Velocity;
        public float Life;
        public float MaxLife;
        public Color Color;
    }

    private const float ParticleRadius = 2f;

    private readonly Particle[] _particles = new Particle[GameConstants.ParticlePoolMaxSize];
    private int _activeCount;

    public override void _Ready()
    {
        ZIndex = 10;
    }

    public override void _PhysicsProcess(double delta)
    {
        var dt = (float)delta;
        int writeIdx = 0;

        for (int i = 0; i < _activeCount; i++)
        {
            ref var p = ref _particles[i];
            p.Life -= dt;
            if (p.Life <= 0f)
                continue;

            p.Position += p.Velocity * dt;

            if (writeIdx != i)
                _particles[writeIdx] = _particles[i];
            writeIdx++;
        }

        _activeCount = writeIdx;

        if (_activeCount > 0)
            QueueRedraw();
    }

    public override void _Draw()
    {
        for (int i = 0; i < _activeCount; i++)
        {
            ref readonly var p = ref _particles[i];
            var alpha = Mathf.Max(0f, p.Life / p.MaxLife);
            var color = new Color(p.Color.R, p.Color.G, p.Color.B, alpha);
            DrawCircle(p.Position, ParticleRadius, color);
        }
    }

    public void SpawnHit(Vector2 pos, float bulletAngle, bool isCrit)
    {
        var cfg = GameConstants.HitConfig;
        int count = isCrit && cfg.CritCount > 0 ? cfg.CritCount : cfg.Count;
        var color = ColorFromHex(cfg.Color);
        SpawnBurst(pos, bulletAngle, cfg.Spread, cfg.SpeedMin, cfg.SpeedMax, cfg.Life, count, color);
    }

    public void SpawnDeath(Vector2 pos, bool isBoss)
    {
        var cfg = GameConstants.DeathConfig;
        int count = isBoss ? cfg.Count * 3 : cfg.Count;
        for (int i = 0; i < count; i++)
        {
            if (_activeCount >= _particles.Length) break;
            var angle = (float)GD.RandRange(0, Math.PI * 2);
            var speed = (float)GD.RandRange(cfg.SpeedMin, cfg.SpeedMax);
            var color = GD.Randf() < 0.5f
                ? new Color(0.8f, 0.16f, 0.13f)
                : new Color(1f, 0.35f, 0.27f);
            AddParticle(pos, angle, speed, cfg.Life, color);
        }
    }

    public void SpawnWallHit(Vector2 pos)
    {
        var cfg = GameConstants.WallHitConfig;
        var color = new Color(0.13f, 1f, 0.87f);
        SpawnBurst(pos, 0, cfg.Spread, cfg.SpeedMin, cfg.SpeedMax, cfg.Life, cfg.Count, color);
    }

    public void SpawnMuzzle(Vector2 pos, float angle)
    {
        var cfg = GameConstants.MuzzleConfig;
        var color = new Color(1f, 0.85f, 0.3f);
        SpawnBurst(pos, angle, cfg.Spread, cfg.SpeedMin, cfg.SpeedMax, cfg.Life, cfg.Count, color);
    }

    public void SpawnPickup(Vector2 pos, Color color)
    {
        var cfg = GameConstants.PickupConfig;
        SpawnBurst(pos, 0, cfg.Spread, cfg.SpeedMin, cfg.SpeedMax, cfg.Life, cfg.Count, color);
    }

    public void Clear()
    {
        _activeCount = 0;
        QueueRedraw();
    }

    private void SpawnBurst(Vector2 pos, float baseAngle, float spread, float speedMin, float speedMax, float life, int count, Color color)
    {
        for (int i = 0; i < count; i++)
        {
            if (_activeCount >= _particles.Length) break;
            var angle = baseAngle + (float)(GD.Randf() - 0.5) * spread;
            var speed = (float)GD.RandRange(speedMin, speedMax);
            AddParticle(pos, angle, speed, life, color);
        }
    }

    private void AddParticle(Vector2 pos, float angle, float speed, float life, Color color)
    {
        _particles[_activeCount] = new Particle
        {
            Position = pos,
            Velocity = new Vector2(Mathf.Cos(angle) * speed, Mathf.Sin(angle) * speed),
            Life = life,
            MaxLife = life,
            Color = color
        };
        _activeCount++;
    }

    private static Color ColorFromHex(uint hex)
    {
        float r = ((hex >> 16) & 0xFF) / 255f;
        float g = ((hex >> 8) & 0xFF) / 255f;
        float b = (hex & 0xFF) / 255f;
        return new Color(r, g, b);
    }
}
