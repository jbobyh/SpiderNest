using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Combat;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.Presentation;
using SpaceOrLife.World;

namespace SpaceOrLife.Actors;

public partial class EnemyManager : Node
{
    [Signal] public delegate void BossKilledEventHandler(Vector2 bossPos);
    [Signal] public delegate void StasisEnemyHitEventHandler(Vector2 enemyPos);

    private readonly List<EnemyActor> _enemies = new();
    private readonly List<CorpseVisual> _corpses = new();
    private readonly FlowField _flowField = new();

    private EnemyCatalog? _catalog;
    private LevelState? _level;
    private BulletSimulation? _bulletSim;
    private Random _rng = new();
    private PlayerProgress? _progress;
    private BossCatalog? _bossCatalog;
    private PlayerActor? _player;
    private readonly List<IDamageable> _damageableCache = new();
    private VfxPool? _vfx;
    private SheetVfxPool? _sheetVfx;

    private Vector2 _lastFlowTarget;
    private int _lastFlowCellHash;
    private float _time;
    private int _lastRevealedCount;

    private const float CorpseDuration = 2.0f;

    private static readonly HashSet<EnemyKind> CorpseTypes = new()
    {
        EnemyKind.Soldier, EnemyKind.Bat, EnemyKind.Shooter, EnemyKind.Bull,
        EnemyKind.Buldyga, EnemyKind.Bloated, EnemyKind.Wallshooter, EnemyKind.Ghost,
        EnemyKind.BossPhase,
    };

    public IReadOnlyList<EnemyActor> Enemies => _enemies;
    public FlowField FlowField => _flowField;
    public float Time => _time;
    public int ActiveEnemyCount
    {
        get
        {
            int count = 0;
            for (int i = 0; i < _enemies.Count; i++)
            {
                if (!_enemies[i].IsDead && !_enemies[i].Stasis)
                    count++;
            }
            return count;
        }
    }

    public void Setup(
        EnemyCatalog catalog,
        BulletSimulation bulletSim,
        PlayerActor? player = null,
        BossCatalog? bossCatalog = null,
        PlayerProgress? progress = null)
    {
        _catalog = catalog;
        _bulletSim = bulletSim;
        _player = player;
        _bossCatalog = bossCatalog;
        _progress = progress;
    }

    public void SpawnFromStasis(LevelState level)
    {
        _level = level;
        ClearAll();

        if (_catalog == null)
            return;

        foreach (var data in level.TrappedSpiders)
        {
            var actor = EnemyFactory.CreateFromStasis(data, _catalog);
            actor.EnemyDied += OnEnemyDied;
            var cell = CellCoord.FromWorld(data.X, data.Y, GameConstants.CellPx);
            actor.Visible = level.EverRevealedCells.Contains(cell);
            AddChild(actor);
            _enemies.Add(actor);
        }

        _lastRevealedCount = level.EverRevealedCells.Count;
    }

    public void ClearAll()
    {
        foreach (var e in _enemies)
        {
            if (GodotObject.IsInstanceValid(e))
            {
                e.EnemyDied -= OnEnemyDied;
                e.QueueFree();
            }
        }
        _enemies.Clear();

        foreach (var c in _corpses)
        {
            if (GodotObject.IsInstanceValid(c))
                c.QueueFree();
        }
        _corpses.Clear();
    }

    public void SetVfxPool(VfxPool vfx) => _vfx = vfx;
    public void SetSheetVfxPool(SheetVfxPool sheetVfx) => _sheetVfx = sheetVfx;

    public void ActivateRoom(int roomIdx)
    {
        foreach (var e in _enemies)
        {
            if (e.RoomIdx == roomIdx && e.Stasis)
                e.ActivateFromStasis();
        }
    }

    public void ActivateAll()
    {
        foreach (var e in _enemies)
        {
            if (e.Stasis)
                e.ActivateFromStasis();
        }
    }

    public void ActivateBattleCells(HashSet<CellCoord> battleCells)
    {
        var cp = GameConstants.CellPx;
        foreach (var e in _enemies)
        {
            if (!e.Stasis) continue;
            var cell = CellCoord.FromWorld(e.GlobalPosition.X, e.GlobalPosition.Y, cp);
            if (battleCells.Contains(cell))
                e.ActivateFromStasis();
        }
    }

    public EnemyActor? SpawnBoss(BossDefinition bossDef, Vector2 pos, int level)
    {
        if (_catalog == null) return null;
        var actor = EnemyFactory.CreateBoss(bossDef, pos, _catalog, level);
        actor.EnemyDied += OnEnemyDied;
        AddChild(actor);
        _enemies.Add(actor);
        return actor;
    }

    public EnemyActor? GetStasisEnemyAt(Vector2 pos, float radius)
    {
        foreach (var e in _enemies)
        {
            if (!GodotObject.IsInstanceValid(e) || e.IsDead || !e.Stasis)
                continue;
            var dist = e.GlobalPosition.DistanceTo(pos);
            if (dist < radius + e.Radius)
                return e;
        }
        return null;
    }

    public void AwardSouls(int amount)
    {
        if (_progress != null)
            _progress.Souls += amount;
    }

    public void ProcessPendingSpawns(List<PendingSpawn> pending, float dt)
    {
        for (int i = pending.Count - 1; i >= 0; i--)
        {
            var ps = pending[i];
            ps.Delay -= dt;
            if (ps.Delay <= 0f)
            {
                if (_catalog != null)
                {
                    var actor = EnemyFactory.Create(ps.Kind, ps.Pos, _catalog, _level?.Level ?? 1, ps.RoomIdx);
                    actor.EnemyDied += OnEnemyDied;
                    AddChild(actor);
                    _enemies.Add(actor);
                }
                pending.RemoveAt(i);
            }
        }
    }

    public List<IDamageable> GetDamageables()
    {
        _damageableCache.Clear();
        for (int i = 0; i < _enemies.Count; i++)
        {
            if (!_enemies[i].IsDead)
                _damageableCache.Add(_enemies[i]);
        }
        return _damageableCache;
    }

    public override void _PhysicsProcess(double delta)
    {
        var dt = (float)delta;
        _time += dt;

        if (_level == null || _catalog == null || _bulletSim == null)
            return;

        UpdateCorpses(dt);

        if (_enemies.Count == 0)
            return;

        UpdateEnemyVisibility();

        var playerPos = GetPlayerPos();
        UpdateFlowField(playerPos);

        var ctx = new EnemyUpdateContext(
            playerPos, _level, _flowField, _bulletSim, _catalog,
            _time, _rng, OnSpawnRequested);

        for (int i = _enemies.Count - 1; i >= 0; i--)
        {
            var e = _enemies[i];
            if (!GodotObject.IsInstanceValid(e))
            {
                _enemies.RemoveAt(i);
                continue;
            }

            e.SetBehaviorContext(ctx);
            e.PlayerPos = playerPos;

            UpdateStatusVfx(e);

            if (e.IsDead)
            {
                HandleEnemyDeath(e);
                _enemies.RemoveAt(i);
            }
        }
    }

    private void UpdateStatusVfx(EnemyActor e)
    {
        if (_sheetVfx == null) return;

        var hasBurn = StatusSystem.HasStatus(e, StatusKind.Burn);
        if (hasBurn && !e.IsDead)
        {
            if (e.BurnVfxId < 0)
                e.BurnVfxId = _sheetVfx.SpawnBurnVfx(e.GlobalPosition, e.DrawSize);
            else
                _sheetVfx.UpdatePosition(e.BurnVfxId, e.GlobalPosition);
        }
        else if (e.BurnVfxId >= 0)
        {
            _sheetVfx.Stop(e.BurnVfxId);
            e.BurnVfxId = -1;
        }

        var hasFreeze = StatusSystem.HasStatus(e, StatusKind.Freeze);
        if (hasFreeze && !e.IsDead)
        {
            if (e.FreezeVfxId < 0)
                e.FreezeVfxId = _sheetVfx.SpawnFreezeVfx(e.GlobalPosition, e.DrawSize);
            else
                _sheetVfx.UpdatePosition(e.FreezeVfxId, e.GlobalPosition);
        }
        else if (e.FreezeVfxId >= 0)
        {
            _sheetVfx.Stop(e.FreezeVfxId);
            e.FreezeVfxId = -1;
        }
    }

    private Vector2 GetPlayerPos()
    {
        if (_player != null && GodotObject.IsInstanceValid(_player))
            return _player.GlobalPosition;
        return Vector2.Zero;
    }

    private void UpdateEnemyVisibility()
    {
        if (_level == null) return;
        var revealedCount = _level.EverRevealedCells.Count;
        if (revealedCount == _lastRevealedCount) return;

        _lastRevealedCount = revealedCount;
        var cp = GameConstants.CellPx;
        var revealed = _level.EverRevealedCells;

        for (int i = 0; i < _enemies.Count; i++)
        {
            var e = _enemies[i];
            if (!GodotObject.IsInstanceValid(e)) continue;
            var cell = CellCoord.FromWorld(e.GlobalPosition.X, e.GlobalPosition.Y, cp);
            e.Visible = revealed.Contains(cell);
        }
    }

    private void UpdateFlowField(Vector2 playerPos)
    {
        if (_level == null)
            return;

        var subPx = GameConstants.FlowSubPx;
        var playerScx = (int)Mathf.Floor(playerPos.X / subPx);
        var playerScy = (int)Mathf.Floor(playerPos.Y / subPx);
        var cellHash = ComputeOpenCellHash();

        if (playerScx == (int)Mathf.Floor(_lastFlowTarget.X / subPx) &&
            playerScy == (int)Mathf.Floor(_lastFlowTarget.Y / subPx) &&
            cellHash == _lastFlowCellHash)
            return;

        _lastFlowTarget = playerPos;
        _lastFlowCellHash = cellHash;
        _flowField.Compute(_level.OpenCells, _level.RemovedWalls, playerPos);
    }

    private int ComputeOpenCellHash()
    {
        if (_level == null)
            return 0;
        int hash = _level.OpenCells.Count;
        hash = hash * 31 + _level.RemovedWalls.Count;
        return hash;
    }

    private void OnEnemyDied(EnemyActor enemy)
    {
        HandleEnemyDeath(enemy);
        var idx = _enemies.IndexOf(enemy);
        if (idx >= 0)
            _enemies.RemoveAt(idx);
    }

    private void HandleEnemyDeath(EnemyActor enemy)
    {
        if (!GodotObject.IsInstanceValid(enemy))
            return;

        if (_sheetVfx != null)
        {
            if (enemy.BurnVfxId >= 0)
            {
                _sheetVfx.Stop(enemy.BurnVfxId);
                enemy.BurnVfxId = -1;
            }
            if (enemy.FreezeVfxId >= 0)
            {
                _sheetVfx.Stop(enemy.FreezeVfxId);
                enemy.FreezeVfxId = -1;
            }
        }

        if (CorpseTypes.Contains(enemy.Kind))
            SpawnCorpse(enemy);

        _vfx?.SpawnDeath(enemy.GlobalPosition, enemy.IsBoss);

        if (enemy.IsBoss)
        {
            if (_level != null)
            {
                _level.BossDefeated = true;
                var bossCell = CellCoord.FromWorld(enemy.GlobalPosition.X, enemy.GlobalPosition.Y, GameConstants.CellPx);
                _level.ExitCell = bossCell;
            }
            EmitSignal(SignalName.BossKilled, enemy.GlobalPosition);
        }
        else
        {
            AwardSouls(1);

            if (_progress != null && _progress.Upgrades.KillAccel)
            {
                _progress.Upgrades.KillAccelPercent = MathF.Min(80f, _progress.Upgrades.KillAccelPercent + 0.1f);
            }
        }

        if (enemy.Kind == EnemyKind.Bloated && _bulletSim != null && _player != null)
        {
            var def = _catalog?.GetByKind(EnemyKind.Bloated);
            var speed = def != null && def.DeathShotSpeed > 0f ? def.DeathShotSpeed : 120f;
            var dx = _player.GlobalPosition.X - enemy.GlobalPosition.X;
            var dy = _player.GlobalPosition.Y - enemy.GlobalPosition.Y;
            var dist = Mathf.Sqrt(dx * dx + dy * dy);
            if (dist > 0f)
            {
                var vx = (dx / dist) * speed;
                var vy = (dy / dist) * speed;
                _bulletSim.Spawn(new BulletSpawnData
                {
                    Position = enemy.GlobalPosition,
                    Velocity = new Vector2(vx, vy),
                    Owner = BulletOwner.Enemy,
                    Damage = 10f,
                    MaxRange = Mathf.Sqrt(vx * vx + vy * vy) * GameConstants.EnemyBulletTime,
                    Color = new Color(1f, 0.27f, 0f),
                });
            }
        }

        enemy.EnemyDied -= OnEnemyDied;
        enemy.QueueFree();
    }

    private void SpawnCorpse(EnemyActor enemy)
    {
        var corpseTex = LoadCorpseTexture(enemy.Kind);
        Rect2? regionRect = null;
        int frameHeight = 0;
        bool ghostDeath = false;

        if (enemy.Kind == EnemyKind.Bat)
        {
            regionRect = new Rect2(7 * 64, 0, 64, 64);
            frameHeight = 64;
        }
        else if (enemy.Kind == EnemyKind.Ghost)
        {
            frameHeight = 32;
            ghostDeath = true;
        }

        var corpse = new CorpseVisual(
            enemy.GlobalPosition,
            enemy.Radius * enemy.VisualScale * 0.5f,
            CorpseDuration,
            GetKindCorpseColor(enemy.Kind),
            corpseTex,
            enemy.Radius * enemy.VisualScale,
            regionRect,
            frameHeight,
            ghostDeath);
        AddChild(corpse);
        _corpses.Add(corpse);
    }

    private static Texture2D? LoadCorpseTexture(EnemyKind kind)
    {
        var path = kind switch
        {
            EnemyKind.Soldier => "res://Assets/Sprites/Entities/soldier_dead.png",
            EnemyKind.Bull => "res://Assets/Sprites/Entities/bull_dead.png",
            EnemyKind.Buldyga => "res://Assets/Sprites/Entities/buldyga_dead.png",
            EnemyKind.Bloated => "res://Assets/Sprites/Entities/bloated_dead.png",
            EnemyKind.Shooter => "res://Assets/Sprites/Entities/shooter_dead.png",
            EnemyKind.Tank => null,
            EnemyKind.Wallshooter => null,
            EnemyKind.Bat => "res://Assets/Sprites/Entities/Bat_NoContour.png",
            EnemyKind.Ghost => "res://Assets/Sprites/Entities/ghost_spritesheet.png",
            _ => null,
        };
        if (string.IsNullOrEmpty(path))
            return null;
        return ResourceLoader.Load<Texture2D>(path);
    }

    private void UpdateCorpses(float dt)
    {
        for (int i = _corpses.Count - 1; i >= 0; i--)
        {
            var c = _corpses[i];
            if (!GodotObject.IsInstanceValid(c))
            {
                _corpses.RemoveAt(i);
                continue;
            }

            c.Life -= dt;
            if (c.Life <= 0f)
            {
                c.QueueFree();
                _corpses.RemoveAt(i);
            }
        }
    }

    private void OnSpawnRequested(EnemyKind kind, Vector2 pos)
    {
        if (_catalog == null)
            return;

        var actor = EnemyFactory.Create(kind, pos, _catalog, _level?.Level ?? 1, -1);
        actor.EnemyDied += OnEnemyDied;
        AddChild(actor);
        _enemies.Add(actor);
    }

    private static Color GetKindCorpseColor(EnemyKind kind)
    {
        return kind switch
        {
            EnemyKind.Ghost => new Color(0.3f, 0.8f, 0.9f, 0.3f),
            EnemyKind.Tank => new Color(0.67f, 0f, 0f, 0.5f),
            EnemyKind.Wallshooter => new Color(0.67f, 0.27f, 0f, 0.5f),
            _ => new Color(0.4f, 0.15f, 0.15f, 0.5f),
        };
    }
}

public partial class CorpseVisual : Node2D
{
    private readonly Vector2 _pos;
    private readonly float _radius;
    private readonly float _maxLife;
    private readonly Color _color;
    private readonly Sprite2D? _sprite;
    private float _lastDrawnFraction = -1f;
    private readonly bool _ghostDeath;
    private static readonly int[] GhostDeathFrames = { 21, 22, 23, 24, 25, 26, 27, 28 };

    public float Life;

    public CorpseVisual(Vector2 pos, float radius, float life, Color color,
        Texture2D? tex = null, float drawSize = 0f,
        Rect2? regionRect = null, int frameHeight = 0, bool ghostDeath = false)
    {
        _pos = pos;
        _radius = radius;
        _maxLife = life;
        _color = color;
        _ghostDeath = ghostDeath;
        Life = life;
        GlobalPosition = pos;
        ZIndex = -1;

        if (tex != null && drawSize > 0f)
        {
            _sprite = new Sprite2D { Texture = tex };
            var fh = frameHeight > 0 ? frameHeight : tex.GetHeight();
            var s = drawSize / fh;
            _sprite.Scale = new Vector2(s, s);

            if (regionRect.HasValue)
            {
                _sprite.RegionEnabled = true;
                _sprite.RegionRect = regionRect.Value;
            }

            if (ghostDeath)
                _sprite.RegionEnabled = true;

            AddChild(_sprite);
        }
    }

    public override void _Process(double delta)
    {
        var fraction = Mathf.Max(0f, Life / _maxLife);

        if (_sprite != null)
        {
            if (_ghostDeath)
            {
                _sprite.Modulate = Colors.White;
                var elapsed = _maxLife - Life;
                const float fps = 10f;
                var frameIdx = Mathf.Min(GhostDeathFrames.Length - 1, (int)Mathf.Floor(elapsed * fps));
                var flatIdx = GhostDeathFrames[frameIdx];
                var col = flatIdx % 8;
                var row = flatIdx / 8;
                _sprite.RegionRect = new Rect2(col * 32, row * 32, 32, 32);
            }
            else
            {
                _sprite.Modulate = new Color(1f, 1f, 1f, fraction);
            }
        }
        else if (Mathf.Abs(fraction - _lastDrawnFraction) >= 0.01f)
        {
            _lastDrawnFraction = fraction;
            QueueRedraw();
        }
    }

    public override void _Draw()
    {
        if (_sprite != null) return;
        var fraction = Mathf.Max(0f, Life / _maxLife);
        var alpha = fraction * _color.A;
        DrawCircle(Vector2.Zero, _radius, new Color(_color.R, _color.G, _color.B, alpha));
    }
}
