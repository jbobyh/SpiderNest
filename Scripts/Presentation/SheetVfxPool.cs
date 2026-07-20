using System.Collections.Generic;
using Godot;
using SpaceOrLife.World;

namespace SpaceOrLife.Presentation;

public partial class SheetVfxPool : Node2D
{
    private struct VfxInstance
    {
        public Sprite2D Sprite;
        public int Frame;
        public float Timer;
        public float Fps;
        public int FrameCount;
        public int FrameSize;
        public int RowOffset;
        public bool Loop;
        public bool Active;
    }

    private const int PoolSize = 48;
    private readonly VfxInstance[] _pool = new VfxInstance[PoolSize];
    private readonly List<int> _activeIndices = new();

    private static Texture2D? _shootTex;
    private static Texture2D? _wallHitTex;
    private static Texture2D? _enemyHitTex;
    private static Texture2D? _burnTex;
    private static Texture2D? _freezeTex;
    private static bool _texturesLoaded;

    public override void _Ready()
    {
        ZIndex = 10;

        for (int i = 0; i < PoolSize; i++)
        {
            var spr = new Sprite2D
            {
                Visible = false,
                RegionEnabled = true,
                Centered = true,
            };
            AddChild(spr);
            _pool[i] = new VfxInstance { Sprite = spr, Active = false };
        }

        LoadTextures();
    }

    private static void LoadTextures()
    {
        if (_texturesLoaded) return;
        _texturesLoaded = true;
        _shootTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/shoot-vfx.png");
        _wallHitTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/wallhit-vfx.png");
        _enemyHitTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/enemyhit-vfx.png");
        _burnTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/firestatus-vfx.png");
        _freezeTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/freeze-vfx.png");
    }

    public void SpawnShootVfx(Vector2 pos, float aimAngle)
    {
        if (_shootTex == null) return;
        var drawSize = GameConstants.PlayerSpriteRadius * 2f;
        var scale = drawSize * GameConstants.ShootVfxSizeMult / GameConstants.ShootVfxFrameSize;
        var offset = drawSize * GameConstants.ShootVfxOffsetMult;
        var spawnPos = pos + new Vector2(
            Mathf.Cos(aimAngle) * offset,
            Mathf.Sin(aimAngle) * offset);
        Spawn(_shootTex, spawnPos, aimAngle + GameConstants.ShootVfxRotationOffset, scale,
            GameConstants.ShootVfxFrameSize, GameConstants.ShootVfxFrameCount,
            GameConstants.ShootVfxFps, loop: false);
    }

    public void SpawnWallHitVfx(Vector2 pos, float normalAngle)
    {
        if (_wallHitTex == null) return;
        var drawSize = GameConstants.CellPx * GameConstants.WallHitVfxSizeMult;
        var scale = drawSize / GameConstants.WallHitVfxFrameSize;
        var offset = drawSize * GameConstants.WallHitVfxNormalOffset;
        var spawnPos = pos + new Vector2(
            Mathf.Cos(normalAngle) * offset,
            Mathf.Sin(normalAngle) * offset);
        var rotation = normalAngle + Mathf.Pi / 2f;
        Spawn(_wallHitTex, spawnPos, rotation, scale,
            GameConstants.WallHitVfxFrameSize, GameConstants.WallHitVfxFrameCount,
            GameConstants.WallHitVfxFps, loop: false);
    }

    public void SpawnEnemyHitVfx(Vector2 pos)
    {
        if (_enemyHitTex == null) return;
        var drawSize = GameConstants.CellPx * GameConstants.EnemyHitVfxSizeMult;
        var scale = drawSize / GameConstants.EnemyHitVfxFrameSize;
        Spawn(_enemyHitTex, pos, 0f, scale,
            GameConstants.EnemyHitVfxFrameSize, GameConstants.EnemyHitVfxFrameCount,
            GameConstants.EnemyHitVfxFps, loop: false);
    }

    public int SpawnBurnVfx(Vector2 pos, float enemyDrawSize)
    {
        if (_burnTex == null) return -1;
        var scale = enemyDrawSize / GameConstants.BurnVfxFrameSize;
        return Spawn(_burnTex, pos, 0f, scale,
            GameConstants.BurnVfxFrameSize, GameConstants.BurnVfxFrameCount,
            GameConstants.BurnVfxFps, loop: true);
    }

    public int SpawnFreezeVfx(Vector2 pos, float enemyDrawSize)
    {
        if (_freezeTex == null) return -1;
        var scale = enemyDrawSize / GameConstants.FreezeVfxFrameSize;
        return Spawn(_freezeTex, pos, 0f, scale,
            GameConstants.FreezeVfxFrameSize, GameConstants.FreezeVfxFrameCount,
            GameConstants.FreezeVfxFps, loop: true, rowOffset: GameConstants.FreezeVfxRow);
    }

    public override void _Process(double delta)
    {
        var dt = (float)delta;
        var frameDur = 0f;

        for (int i = _activeIndices.Count - 1; i >= 0; i--)
        {
            var idx = _activeIndices[i];
            ref var v = ref _pool[idx];
            frameDur = 1f / v.Fps;
            v.Timer += dt;

            while (v.Timer >= frameDur)
            {
                v.Timer -= frameDur;
                v.Frame++;

                if (v.Frame >= v.FrameCount)
                {
                    if (v.Loop)
                    {
                        v.Frame = 0;
                    }
                    else
                    {
                        ReturnToPool(idx);
                        _activeIndices.RemoveAt(i);
                        break;
                    }
                }
            }

            if (v.Active)
            {
                v.Sprite.RegionRect = new Rect2(
                    v.Frame * v.FrameSize, v.RowOffset * v.FrameSize,
                    v.FrameSize, v.FrameSize);
            }
        }
    }

    public int Spawn(Texture2D tex, Vector2 pos, float rotation, float scale,
        int frameSize, int frameCount, float fps, bool loop, int rowOffset = 0)
    {
        int idx = FindFreeSlot();
        if (idx < 0) return -1;

        ref var v = ref _pool[idx];
        v.Sprite.Texture = tex;
        v.Sprite.Position = pos;
        v.Sprite.Rotation = rotation;
        v.Sprite.Scale = new Vector2(scale, scale);
        v.Sprite.RegionRect = new Rect2(0, rowOffset * frameSize, frameSize, frameSize);
        v.Sprite.Visible = true;
        v.Frame = 0;
        v.Timer = 0f;
        v.Fps = fps;
        v.FrameCount = frameCount;
        v.FrameSize = frameSize;
        v.RowOffset = rowOffset;
        v.Loop = loop;
        v.Active = true;

        _activeIndices.Add(idx);
        return idx;
    }

    public void UpdatePosition(int idx, Vector2 pos)
    {
        if (idx < 0 || idx >= PoolSize) return;
        _pool[idx].Sprite.Position = pos;
    }

    public void Stop(int idx)
    {
        if (idx < 0 || idx >= PoolSize) return;
        if (!_pool[idx].Active) return;
        ReturnToPool(idx);
        _activeIndices.Remove(idx);
    }

    public void Clear()
    {
        foreach (var idx in _activeIndices)
            ReturnToPool(idx);
        _activeIndices.Clear();
    }

    private void ReturnToPool(int idx)
    {
        ref var v = ref _pool[idx];
        v.Sprite.Visible = false;
        v.Active = false;
    }

    private int FindFreeSlot()
    {
        for (int i = 0; i < PoolSize; i++)
        {
            if (!_pool[i].Active)
                return i;
        }
        return -1;
    }
}
