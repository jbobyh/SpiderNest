using System;
using Godot;

namespace SpaceOrLife.World;

public partial class FlyingHeart : Node2D
{
    private Vector2 _start;
    private Vector2 _target;
    private float _duration;
    private float _t;
    private Action? _onArrive;

    public static bool IsActive { get; private set; }

    public override void _Process(double delta)
    {
        if (!IsActive) return;

        _t += (float)delta;
        var p = Mathf.Min(_t / _duration, 1f);
        var e = p < 0.5f ? 2f * p * p : -1f + (4f - 2f * p) * p;

        GlobalPosition = new Vector2(
            _start.X + (_target.X - _start.X) * e,
            _start.Y + (_target.Y - _start.Y) * e);

        QueueRedraw();

        if (_t >= _duration)
        {
            IsActive = false;
            var cb = _onArrive;
            _onArrive = null;
            cb?.Invoke();
            QueueFree();
        }
    }

    public override void _Draw()
    {
        if (!IsActive) return;
        var color = new Color(1f, 0.2f, 0.3f);
        DrawCircle(Vector2.Zero, 6f, color);
        DrawCircle(Vector2.Zero, 6f, new Color(0.6f, 0f, 0.1f), filled: false, width: 1f);
    }

    public void Launch(Vector2 from, Vector2 to, float duration, Action onArrive)
    {
        _start = from;
        _target = to;
        _duration = duration;
        _t = 0f;
        _onArrive = onArrive;
        IsActive = true;
        GlobalPosition = from;
        QueueRedraw();
    }

    public static void Cancel()
    {
        IsActive = false;
    }
}
