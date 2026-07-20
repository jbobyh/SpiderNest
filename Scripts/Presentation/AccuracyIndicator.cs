using System;
using Godot;
using SpaceOrLife.Combat;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Presentation;

public partial class AccuracyIndicator : Control
{
    private CameraController? _camera;
    private Func<Vector2>? _getPlayerPos;
    private Func<PlayerProgress?>? _getProgress;
    private Func<LevelState?>? _getLevel;
    private Func<WeaponCatalog?>? _getWeaponCatalog;
    private Func<CombatState?>? _getCombatState;

    private bool _visible;

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Ignore;
        ZIndex = 50;
    }

    public void Setup(
        CameraController camera,
        Func<Vector2> getPlayerPos,
        Func<PlayerProgress?> getProgress,
        Func<LevelState?> getLevel,
        Func<WeaponCatalog?> getWeaponCatalog,
        Func<CombatState?> getCombatState)
    {
        _camera = camera;
        _getPlayerPos = getPlayerPos;
        _getProgress = getProgress;
        _getLevel = getLevel;
        _getWeaponCatalog = getWeaponCatalog;
        _getCombatState = getCombatState;
    }

    public override void _Process(double delta)
    {
        UpdateIndicator();
    }

    private void UpdateIndicator()
    {
        _visible = false;

        if (_camera == null || _getPlayerPos == null || _getProgress == null ||
            _getLevel == null || _getWeaponCatalog == null || _getCombatState == null)
            return;

        var progress = _getProgress();
        var level = _getLevel();
        var weaponCatalog = _getWeaponCatalog();
        var combatState = _getCombatState();
        if (progress == null || level == null || weaponCatalog == null || combatState == null)
            return;

        var weapon = CombatSystem.GetActiveWeapon(progress, weaponCatalog);
        if (weapon == null)
        {
            QueueRedraw();
            return;
        }

        var totalSpread = CombatSystem.GetTotalSpread(combatState, weapon, progress.Upgrades, level, progress);
        if (totalSpread < GameConstants.AccuracyIndicatorMinSpread)
        {
            QueueRedraw();
            return;
        }

        var playerPos = _getPlayerPos();
        var mouseWorld = _camera.ScreenToWorld(GetGlobalMousePosition());

        var dx = mouseWorld.X - playerPos.X;
        var dy = mouseWorld.Y - playerPos.Y;
        var dist = MathF.Sqrt(dx * dx + dy * dy);
        if (dist < 1f)
        {
            QueueRedraw();
            return;
        }

        var baseAngle = MathF.Atan2(dy, dx);
        var bulletRange = CombatSystem.GetBulletRange(weapon, progress, level);
        var effectiveDist = MathF.Min(dist, bulletRange);
        var isClamped = dist > bulletRange;

        var halfSpread = totalSpread * 0.5f;
        var leftAngle = baseAngle - halfSpread;
        var rightAngle = baseAngle + halfSpread;

        var lx = playerPos.X + MathF.Cos(leftAngle) * effectiveDist;
        var ly = playerPos.Y + MathF.Sin(leftAngle) * effectiveDist;
        var rx = playerPos.X + MathF.Cos(rightAngle) * effectiveDist;
        var ry = playerPos.Y + MathF.Sin(rightAngle) * effectiveDist;

        var ls = WorldToScreen(lx, ly);
        var rs = WorldToScreen(rx, ry);
        var ps = WorldToScreen(playerPos.X, playerPos.Y);

        var lDx = ls.X - ps.X;
        var lDy = ls.Y - ps.Y;
        var lLen = MathF.Sqrt(lDx * lDx + lDy * lDy);
        var rDx = rs.X - ps.X;
        var rDy = rs.Y - ps.Y;
        var rLen = MathF.Sqrt(rDx * rDx + rDy * rDy);
        if (lLen < 1f || rLen < 1f)
        {
            QueueRedraw();
            return;
        }

        var lux = lDx / lLen;
        var luy = lDy / lLen;
        var rux = rDx / rLen;
        var ruy = rDy / rLen;

        var halfLen = GameConstants.AccuracyIndicatorLineLength * 0.5f;
        var bendLen = GameConstants.AccuracyIndicatorBendLength;

        _leftNear = new Vector2(ls.X - lux * halfLen, ls.Y - luy * halfLen);
        _leftFar = new Vector2(ls.X + lux * halfLen, ls.Y + luy * halfLen);
        _leftBend = new Vector2(_leftFar.X - luy * bendLen, _leftFar.Y + lux * bendLen);

        _rightNear = new Vector2(rs.X - rux * halfLen, rs.Y - ruy * halfLen);
        _rightFar = new Vector2(rs.X + rux * halfLen, rs.Y + ruy * halfLen);
        _rightBend = new Vector2(_rightFar.X + ruy * bendLen, _rightFar.Y - rux * bendLen);

        _isClamped = isClamped;
        _visible = true;

        QueueRedraw();
    }

    private Vector2 WorldToScreen(float wx, float wy)
    {
        var viewport = GetViewport();
        if (viewport == null) return new Vector2(wx, wy);
        var canvas = viewport.GetCanvasTransform();
        return canvas * new Vector2(wx, wy);
    }

    private Vector2 _leftNear;
    private Vector2 _leftFar;
    private Vector2 _leftBend;
    private Vector2 _rightNear;
    private Vector2 _rightFar;
    private Vector2 _rightBend;
    private bool _isClamped;

    public override void _Draw()
    {
        if (!_visible) return;

        var color = new Color(1f, 1f, 1f, GameConstants.AccuracyIndicatorAlpha);
        var width = GameConstants.AccuracyIndicatorLineWidth;

        DrawLine(_leftNear, _leftFar, color, width);
        if (_isClamped)
            DrawLine(_leftFar, _leftBend, color, width);

        DrawLine(_rightNear, _rightFar, color, width);
        if (_isClamped)
            DrawLine(_rightFar, _rightBend, color, width);
    }
}
