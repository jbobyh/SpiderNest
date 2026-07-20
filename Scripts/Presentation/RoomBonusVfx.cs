using System.Collections.Generic;
using Godot;
using SpaceOrLife.Core;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Presentation;

public partial class RoomBonusVfx : Node2D
{
    private const int PoolSize = 30;
    private const float SpawnInterval = 0.4f;
    private const float LifeMin = 2.0f;
    private const float LifeMax = 3.0f;
    private const int FontSize = 12;

    private struct ActiveVfx
    {
        public Label Label;
        public float Vx;
        public float Vy;
        public float Life;
        public float MaxLife;
        public float BaseX;
        public int CellX;
        public int CellY;
        public float WobblePhase;
        public float WobbleAmp;
    }

    private readonly List<Label> _pool = new();
    private readonly List<ActiveVfx> _active = new();
    private float _timer;
    private LevelState? _state;
    private RoomBonusCatalog? _catalog;
    private bool _active_phase;

    public override void _Ready()
    {
        for (int i = 0; i < PoolSize; i++)
        {
            var label = new Label
            {
                Visible = false,
                ZIndex = 50,
            };
            label.AddThemeFontSizeOverride("font_size", FontSize);
            label.AddThemeColorOverride("font_color", Colors.White);
            AddChild(label);
            _pool.Add(label);
        }
    }

    public void SetState(LevelState state, RoomBonusCatalog catalog)
    {
        _state = state;
        _catalog = catalog;
    }

    public void SetActive(bool active)
    {
        _active_phase = active;
        if (!active && _active.Count > 0)
            Clear();
    }

    public void Clear()
    {
        for (int i = _active.Count - 1; i >= 0; i--)
        {
            var a = _active[i];
            a.Label.Visible = false;
            _pool.Add(a.Label);
        }
        _active.Clear();
    }

    public override void _Process(double delta)
    {
        var dt = (float)delta;

        if (_state == null || _catalog == null || !_active_phase)
        {
            if (_active.Count > 0)
                Clear();
            return;
        }

        _timer += dt;
        if (_timer >= SpawnInterval)
        {
            _timer = 0f;
            Spawn();
        }

        var cellPx = GameConstants.CellPx;

        for (int i = _active.Count - 1; i >= 0; i--)
        {
            var a = _active[i];
            a.Life -= dt;

            if (a.Life <= 0f)
            {
                a.Label.Visible = false;
                _pool.Add(a.Label);
                _active.RemoveAt(i);
                continue;
            }

            a.BaseX += a.Vx * dt;
            a.Label.Position = new Vector2(a.BaseX, a.Label.Position.Y + a.Vy * dt);
            a.WobblePhase += dt * 2f;
            a.Label.Position = new Vector2(a.BaseX + Mathf.Sin(a.WobblePhase) * a.WobbleAmp, a.Label.Position.Y);

            var cellMinX = a.CellX * cellPx;
            var cellMaxX = (a.CellX + 1) * cellPx;
            var cellMinY = a.CellY * cellPx;
            var cellMaxY = (a.CellY + 1) * cellPx;
            if (a.Label.Position.X < cellMinX || a.Label.Position.X > cellMaxX ||
                a.Label.Position.Y < cellMinY || a.Label.Position.Y > cellMaxY)
            {
                a.Life = 0f;
            }

            var t = 1f - a.Life / a.MaxLife;
            float alpha;
            if (t < 0.2f)
                alpha = t / 0.2f;
            else if (t > 0.7f)
                alpha = (1f - t) / 0.3f;
            else
                alpha = 1f;
            a.Label.Modulate = new Color(1f, 1f, 1f, alpha);

            var scale = 1f + Mathf.Sin(a.WobblePhase * 1.5f) * 0.1f;
            a.Label.Scale = new Vector2(scale, scale);

            _active[i] = a;
        }
    }

    private void Spawn()
    {
        if (_state == null || _catalog == null) return;
        var bonuses = _state.RoomBonuses;
        if (bonuses.Count == 0) return;
        var rooms = _state.Rooms;
        if (rooms.Count == 0) return;
        var everRevealed = _state.EverRevealedCells;

        var cellPx = GameConstants.CellPx;

        foreach (var rb in bonuses)
        {
            if (rb.RoomIdx < 0 || rb.RoomIdx >= rooms.Count) continue;
            var room = rooms[rb.RoomIdx];
            if (room.Cells.Count == 0) continue;

            var revealedCells = new List<CellCoord>();
            foreach (var c in room.Cells)
            {
                if (everRevealed.Contains(c))
                    revealedCells.Add(c);
            }
            if (revealedCells.Count == 0) continue;

            var def = _catalog.GetById(rb.BonusType);
            if (def == null || string.IsNullOrEmpty(def.Icon)) continue;

            var cell = revealedCells[GD.RandRange(0, revealedCells.Count - 1)];
            var margin = cellPx * 0.2f;
            var px = (cell.X + 0.5f) * cellPx + (float)GD.RandRange(-(cellPx - margin * 2) * 0.5, (cellPx - margin * 2) * 0.5);
            var py = (cell.Y + 0.5f) * cellPx + (float)GD.RandRange(-(cellPx - margin * 2) * 0.5, (cellPx - margin * 2) * 0.5);

            if (_pool.Count == 0) return;
            var label = _pool[_pool.Count - 1];
            _pool.RemoveAt(_pool.Count - 1);

            label.Text = def.Icon;
            label.Position = new Vector2(px, py);
            label.Modulate = new Color(1f, 1f, 1f, 0f);
            label.Scale = Vector2.One;
            label.Visible = true;

            var life = LifeMin + (float)GD.RandRange(0, LifeMax - LifeMin);
            _active.Add(new ActiveVfx
            {
                Label = label,
                Vx = (float)GD.RandRange(-5, 5),
                Vy = -5f - (float)GD.RandRange(0, 8),
                Life = life,
                MaxLife = life,
                BaseX = px,
                CellX = cell.X,
                CellY = cell.Y,
                WobblePhase = (float)GD.RandRange(0, Mathf.Tau),
                WobbleAmp = 3f + (float)GD.RandRange(0, 4),
            });
        }
    }
}
