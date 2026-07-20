using System;
using Godot;

namespace SpaceOrLife.World;

public partial class CameraController : Camera2D
{
    private float _targetZoom;
    private float _currentZoom;
    private Vector2 _targetPos;
    private Vector2 _currentPos;
    private float _shakeAmount;
    private float _shakeAngle;
    private float _playZoom;

    public float CurrentZoom => _currentZoom;
    public Vector2 CurrentPos => _currentPos;

    public override void _Ready()
    {
        _playZoom = GameConstants.CameraPlayZoom;
        _targetZoom = _playZoom;
        _currentZoom = _playZoom;
        Enabled = true;
        ApplyTransform();
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event is InputEventMouseButton mb)
        {
            if (mb.ButtonIndex == MouseButton.WheelUp && mb.Pressed)
            {
                ZoomIn();
            }
            else if (mb.ButtonIndex == MouseButton.WheelDown && mb.Pressed)
            {
                ZoomOut();
            }
        }
    }

    public void Pan(Vector2 worldPos)
    {
        _targetPos = worldPos;
        _currentPos = worldPos;
        ApplyTransform();
    }

    public void Follow(Vector2 playerPos, Vector2 mouseWorldPos)
    {
        var offset = mouseWorldPos - playerPos;
        var dist = offset.Length();
        if (dist > GameConstants.CameraMaxOffset)
        {
            offset *= GameConstants.CameraMaxOffset / dist;
        }

        _targetPos = playerPos + offset * GameConstants.CameraCursorWeight;
        _targetZoom = _playZoom;
    }

    public void SetZoom(float scale)
    {
        _targetZoom = scale;
        _currentZoom = scale;
        ApplyTransform();
    }

    public void SetZoomAndPosition(float zoom, Vector2 worldPos)
    {
        _currentZoom = zoom;
        _targetZoom = zoom;
        _currentPos = worldPos;
        _targetPos = worldPos;
        ApplyTransform();
    }

    public void SetTransitionTarget(float zoom, Vector2 worldPos)
    {
        _targetZoom = zoom;
        _targetPos = worldPos;
    }

    public void ZoomIn()
    {
        _playZoom = Mathf.Clamp(_playZoom * (1f + GameConstants.CameraPlayZoomStep),
            GameConstants.CameraPlayZoomMin, GameConstants.CameraPlayZoomMax);
    }

    public void ZoomOut()
    {
        _playZoom = Mathf.Clamp(_playZoom * (1f - GameConstants.CameraPlayZoomStep),
            GameConstants.CameraPlayZoomMin, GameConstants.CameraPlayZoomMax);
    }

    public void Shake(float amount, float angle)
    {
        if (amount > _shakeAmount)
        {
            _shakeAmount = amount;
            _shakeAngle = angle;
        }
    }

    public void Update(float dt)
    {
        var t = 1f - MathF.Exp(-GameConstants.CameraDamping * dt);
        _currentPos += (_targetPos - _currentPos) * t;
        _currentZoom += (_targetZoom - _currentZoom) * t;

        _shakeAmount *= GameConstants.CameraShakeDecay;
        if (_shakeAmount < 0.5f) _shakeAmount = 0f;

        ApplyTransform();
    }

    public Vector2 ScreenToWorld(Vector2 screenPos)
    {
        var viewport = GetViewport();
        if (viewport == null) return screenPos;
        var canvasTransform = viewport.GetCanvasTransform();
        return canvasTransform.AffineInverse() * screenPos;
    }

    private void ApplyTransform()
    {
        var sx = MathF.Cos(_shakeAngle) * _shakeAmount;
        var sy = MathF.Sin(_shakeAngle) * _shakeAmount;

        GlobalPosition = _currentPos + new Vector2(sx, sy);
        Zoom = Vector2.One * _currentZoom;
    }
}
