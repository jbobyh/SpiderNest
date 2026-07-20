using System.Collections.Generic;
using Godot;
using SpaceOrLife.World;

namespace SpaceOrLife.Combat;

public partial class BulletRenderer : Node2D
{
    private BulletSimulation? _simulation;
    private readonly List<TrailParticle> _trails = new();
    private const int MaxTrails = 256;

    private struct TrailParticle
    {
        public Vector2 Pos;
        public Color Color;
        public float Life;
        public float MaxLife;
    }

    public void SetSimulation(BulletSimulation simulation)
    {
        _simulation = simulation;
    }

    public override void _Process(double delta)
    {
        var dt = (float)delta;
        UpdateTrails(dt);
        QueueRedraw();
    }

    private void UpdateTrails(float dt)
    {
        if (_simulation == null) return;

        var bullets = _simulation.Bullets;
        for (int i = 0; i < bullets.Count; i++)
        {
            var b = bullets[i];
            if (b.TrailTimer <= 0f && _trails.Count < MaxTrails)
            {
                var trailColor = GetBulletColor(b);
                _trails.Add(new TrailParticle
                {
                    Pos = b.Position - b.Velocity * 0.01f,
                    Color = trailColor,
                    Life = GameConstants.BulletTrailLife,
                    MaxLife = GameConstants.BulletTrailLife,
                });
            }
        }

        for (int i = _trails.Count - 1; i >= 0; i--)
        {
            var t = _trails[i];
            t.Life -= dt;
            if (t.Life <= 0f)
                _trails.RemoveAt(i);
            else
                _trails[i] = t;
        }
    }

    private static Color GetBulletColor(Bullet b)
    {
        return b.Owner == BulletOwner.Player
            ? (b.IsCrit ? new Color(0f, 0.64f, 1f)
               : b.IsIncendiary ? new Color(1f, 0.4f, 0f)
               : b.IsFreeze ? new Color(0.27f, 0.87f, 1f)
               : new Color(1f, 0.87f, 0.27f))
            : new Color(1f, 0f, 0f);
    }

    public override void _Draw()
    {
        if (_simulation == null)
            return;

        var radius = GameConstants.BulletRadius;

        for (int i = 0; i < _trails.Count; i++)
        {
            var t = _trails[i];
            var alpha = Mathf.Max(0f, t.Life / t.MaxLife) * 0.4f;
            var r = radius * 0.5f * alpha;
            DrawCircle(t.Pos, r, new Color(t.Color.R, t.Color.G, t.Color.B, alpha));
        }

        var bullets = _simulation.Bullets;
        for (int i = 0; i < bullets.Count; i++)
        {
            var b = bullets[i];
            var color = GetBulletColor(b);

            var trailEnd = b.Position - b.Velocity * 0.02f;
            DrawLine(trailEnd, b.Position, new Color(color.R, color.G, color.B, 0.3f), radius * 0.5f);

            const int steps = 6;
            for (int s = steps; s >= 1; s--)
            {
                var r = radius * s / steps;
                var t = (float)(s - 1) / (steps - 1);
                var cr = Mathf.Lerp(1f, color.R, t);
                var cg = Mathf.Lerp(1f, color.G, t);
                var cb = Mathf.Lerp(1f, color.B, t);
                DrawCircle(b.Position, r, new Color(cr, cg, cb));
            }
        }
    }

    public void ClearTrails()
    {
        _trails.Clear();
    }
}

