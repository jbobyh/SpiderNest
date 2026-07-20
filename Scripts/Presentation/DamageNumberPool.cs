using System.Collections.Generic;
using Godot;

namespace SpaceOrLife.Presentation;

public partial class DamageNumberPool : Node2D
{
    private const int PoolSize = 64;
    private const float Duration = 0.7f;
    private const float PopDuration = 0.12f;
    private const float PopOvershoot = 4.8f;
    private const float FadeStart = 0.4f;
    private const float RiseSpeed = 30f;
    private const float DriftSpeed = 80f;

    private struct ActiveNumber
    {
        public Label Label;
        public Vector2 StartPos;
        public float Elapsed;
        public bool IsCrit;
        public float DriftVx;
    }

    private readonly List<Label> _pool = new();
    private readonly List<ActiveNumber> _active = new();
    private FontFile? _font;

    public override void _Ready()
    {
        _font = ResourceLoader.Load<FontFile>("res://Assets/Fonts/boldpixels.ttf");

        for (int i = 0; i < PoolSize; i++)
        {
            var label = new Label { Visible = false };
            if (_font != null)
                label.AddThemeFontOverride("font", _font);
            label.AddThemeColorOverride("font_color", Colors.White);
            label.ZIndex = 100;
            AddChild(label);
            _pool.Add(label);
        }
    }

    public void SpawnNumber(Vector2 pos, float damage, bool isCrit)
    {
        Label? label = null;
        for (int i = 0; i < _pool.Count; i++)
        {
            if (!_pool[i].Visible)
            {
                label = _pool[i];
                break;
            }
        }
        if (label == null) return;

        var rounded = Mathf.RoundToInt(damage);
        label.Text = rounded.ToString();
        label.AddThemeFontSizeOverride("font_size", isCrit ? 16 : 13);
        label.AddThemeColorOverride("font_color", isCrit ? new Color(1f, 0.85f, 0.2f) : Colors.White);

        var offsetX = GD.RandRange(-8, 8);
        var driftVx = (float)GD.RandRange(-DriftSpeed, DriftSpeed);
        label.Position = new Vector2(pos.X + offsetX, pos.Y);
        label.Scale = Vector2.Zero;
        label.Visible = true;

        _active.Add(new ActiveNumber
        {
            Label = label,
            StartPos = label.Position,
            Elapsed = 0f,
            IsCrit = isCrit,
            DriftVx = driftVx,
        });
    }

    public override void _Process(double delta)
    {
        var dt = (float)delta;

        for (int i = _active.Count - 1; i >= 0; i--)
        {
            var a = _active[i];
            a.Elapsed += dt;
            var t = a.Elapsed / Duration;

            if (t >= 1f)
            {
                a.Label.Visible = false;
                a.Label.Modulate = Colors.White;
                a.Label.Scale = Vector2.One;
                _active.RemoveAt(i);
                continue;
            }

            var popT = Mathf.Min(1f, a.Elapsed / PopDuration);
            var scale = EaseOutBack(popT, PopOvershoot);
            a.Label.Scale = new Vector2(scale, scale);

            var driftX = a.DriftVx * a.Elapsed * 0.5f;
            var riseY = RiseSpeed * a.Elapsed;
            a.Label.Position = new Vector2(a.StartPos.X + driftX, a.StartPos.Y - riseY);

            float alpha = 1f;
            if (t > FadeStart)
            {
                var fadeT = (t - FadeStart) / (1f - FadeStart);
                alpha = 1f - fadeT * fadeT;
            }
            a.Label.Modulate = new Color(1, 1, 1, alpha);

            _active[i] = a;
        }
    }

    private static float EaseOutBack(float t, float overshoot)
    {
        var c1 = overshoot;
        var c3 = c1 + 1f;
        return 1f + c3 * Mathf.Pow(t - 1f, 3f) + c1 * Mathf.Pow(t - 1f, 2f);
    }
}

