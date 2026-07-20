using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.World;

public partial class TransitionManager : Node
{
    private CameraController? _camera;

    private enum TransitionType { None, ZoomIn, ZoomOut }

    private TransitionType _type = TransitionType.None;
    private float _fromZoom;
    private float _toZoom;
    private Vector2 _fromPos;
    private Vector2 _toPos;
    private float _t;
    private float _duration;
    private Action? _onComplete;

    public bool IsActive => _type != TransitionType.None;

    public void Setup(CameraController camera)
    {
        _camera = camera;
    }

    public void StartZoomIn(
        CameraController camera,
        LevelState state,
        CellCoord? pendingCell,
        bool isBoss,
        Action onComplete)
    {
        _camera = camera;
        var cp = GameConstants.CellPx;

        var (bCols, bRows, centerX, centerY) = ComputeBattleBounds(state, pendingCell, cp);

        float wallPad = cp * GameConstants.WallPad;
        float scaleX = GameConstants.ViewWidth / (bCols * cp + wallPad * 2f);
        float scaleY = GameConstants.ViewHeight / (bRows * cp + wallPad * 2f);
        float toZoom = Mathf.Min(scaleX, scaleY);

        _type = TransitionType.ZoomIn;
        _fromZoom = camera.CurrentZoom;
        _toZoom = toZoom;
        _fromPos = camera.CurrentPos;
        _toPos = new Vector2(centerX, centerY);
        _t = 0f;
        _duration = GameConstants.ZoomDuration;
        _onComplete = onComplete;
    }

    public void StartZoomOut(
        CameraController camera,
        Vector2 playerPos,
        Action onComplete)
    {
        _camera = camera;
        _type = TransitionType.ZoomOut;
        _fromZoom = camera.CurrentZoom;
        _toZoom = GameConstants.CameraPlayZoom;
        _fromPos = camera.CurrentPos;
        _toPos = playerPos;
        _t = 0f;
        _duration = GameConstants.ZoomDuration;
        _onComplete = onComplete;
    }

    public override void _PhysicsProcess(double delta)
    {
        if (_type == TransitionType.None || _camera == null) return;

        var dt = (float)delta;
        _t = Mathf.Min(1f, _t + dt / _duration);
        var ease = EaseInOutQuad(_t);

        var zoom = _fromZoom + (_toZoom - _fromZoom) * ease;
        var pos = _fromPos + (_toPos - _fromPos) * ease;

        _camera.SetZoomAndPosition(zoom, pos);

        if (_t >= 1f)
        {
            _type = TransitionType.None;
            var cb = _onComplete;
            _onComplete = null;
            cb?.Invoke();
        }
    }

    public void Cancel()
    {
        _type = TransitionType.None;
        _onComplete = null;
    }

    private static (int bCols, int bRows, float centerX, float centerY) ComputeBattleBounds(
        LevelState state, CellCoord? pendingCell, float cp)
    {
        var cells = new HashSet<CellCoord>(state.OpenCells);
        if (pendingCell.HasValue)
            cells.Add(pendingCell.Value);

        int minX = int.MaxValue, minY = int.MaxValue;
        int maxX = int.MinValue, maxY = int.MinValue;
        foreach (var c in cells)
        {
            if (c.X < minX) minX = c.X;
            if (c.X > maxX) maxX = c.X;
            if (c.Y < minY) minY = c.Y;
            if (c.Y > maxY) maxY = c.Y;
        }
        if (minX == int.MaxValue) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

        int bCols = maxX - minX + 1;
        int bRows = maxY - minY + 1;
        float centerX = (minX + bCols / 2f) * cp;
        float centerY = (minY + bRows / 2f) * cp;
        return (bCols, bRows, centerX, centerY);
    }

    private static float EaseInOutQuad(float t)
    {
        return t < 0.5f ? 2f * t * t : 1f - Mathf.Pow(-2f * t + 2f, 2f) / 2f;
    }
}
