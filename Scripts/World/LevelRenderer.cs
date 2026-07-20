using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.World;

public partial class LevelRenderer : Node2D
{
    private LevelState? _state;
    private float _wallThickness;
    private int _cellPxI;

    private static readonly Dictionary<string, Texture2D> _floorTextures = new();
    private static bool _floorTexLoaded;

    private static void LoadFloorTextures()
    {
        if (_floorTexLoaded) return;
        _floorTexLoaded = true;
        _floorTextures["floor-stone"] = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/Kenney/floor_stone.png");
        _floorTextures["floor-stone-dark"] = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/Kenney/floor_stone_dark.png");
        _floorTextures["floor-stone-pattern"] = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/Kenney/floor_stone_pattern.png");
        _floorTextures["floor-stone-pattern-dark"] = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/Kenney/floor_stone_pattern_dark.png");
        _floorTextures["floor-stone-pattern-small"] = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/Kenney/floor_stone_pattern_small.png");
        _floorTextures["floor-stone-pattern-small-dark"] = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/Kenney/floor_stone_pattern_small_dark.png");
        _floorTextures["floor-ground-sand"] = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/Kenney/floor_ground_sand.png");
        _floorTextures["floor-ground-dirt"] = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/Kenney/floor_ground_dirt.png");
    }

    public override void _Ready()
    {
        ZIndex = -2;
    }

    public void SetLevel(LevelState state)
    {
        _state = state;
        _wallThickness = GameConstants.CellPx * 0.05f;
        _cellPxI = (int)GameConstants.CellPx;
        QueueRedraw();
    }

    public void Refresh()
    {
        QueueRedraw();
    }

    public override void _Draw()
    {
        if (_state == null) return;

        float cellPx = GameConstants.CellPx;
        var state = _state;

        DrawFloors(state, cellPx);
        DrawWalls(state, cellPx);
        DrawCollectibles(state, cellPx);
    }

    private void DrawFloors(LevelState state, float cellPx)
    {
        LoadFloorTextures();
        float tilePx = GameConstants.FloorTilePx;
        int tilesPerCell = GameConstants.FloorTilesPerCell;

        foreach (var cell in state.EverRevealedCells)
        {
            if (!state.BlobCells.Contains(cell)) continue;

            var tex = SelectFloorTexture(state, cell);
            if (tex == null) continue;

            float originX = cell.X * cellPx;
            float originY = cell.Y * cellPx;

            for (int sy = 0; sy < tilesPerCell; sy++)
            {
                for (int sx = 0; sx < tilesPerCell; sx++)
                {
                    var dest = new Rect2(
                        originX + sx * tilePx,
                        originY + sy * tilePx,
                        tilePx, tilePx);
                    DrawTextureRect(tex, dest, false);
                }
            }
        }
    }

    private static Texture2D? SelectFloorTexture(LevelState state, CellCoord cell)
    {
        int roomIdx = -1;
        state.CellToRoom.TryGetValue(cell, out roomIdx);
        bool isPurified = roomIdx >= 0 && state.Purified.Contains(roomIdx);

        bool hasHeart = false;
        bool hasChest = false;
        bool hasSphere = false;

        if (roomIdx >= 0)
        {
            foreach (var h in state.Hearts)
            {
                if (state.CellToRoom.TryGetValue(h.Cell, out var hr) && hr == roomIdx)
                {
                    hasHeart = true;
                    break;
                }
            }

            if (!hasHeart)
            {
                foreach (var c in state.UpgradeChests)
                {
                    if (state.CellToRoom.TryGetValue(c.Cell, out var cr) && cr == roomIdx)
                    {
                        hasChest = true;
                        break;
                    }
                }
                if (!hasChest)
                {
                    foreach (var c in state.SpatialChests)
                    {
                        if (state.CellToRoom.TryGetValue(c.Cell, out var cr) && cr == roomIdx)
                        {
                            hasChest = true;
                            break;
                        }
                    }
                }
            }

            if (!hasHeart && !hasChest && state.SummonSphere != null)
            {
                if (state.CellToRoom.TryGetValue(state.SummonSphere.Cell, out var sr) && sr == roomIdx)
                    hasSphere = true;
            }
        }

        string alias;
        if (hasSphere)
            alias = isPurified ? "floor-ground-sand" : "floor-ground-dirt";
        else if (hasHeart)
            alias = isPurified ? "floor-stone-pattern-small" : "floor-stone-pattern-small-dark";
        else if (hasChest)
            alias = isPurified ? "floor-stone-pattern" : "floor-stone-pattern-dark";
        else
            alias = isPurified ? "floor-stone" : "floor-stone-dark";

        _floorTextures.TryGetValue(alias, out var tex);
        return tex;
    }

    private void DrawWalls(LevelState state, float cellPx)
    {
        var closedFill = new Color(0x14 / 255f, 0x08 / 255f, 0x1e / 255f, 0.92f);
        var closedStroke = new Color(0x78 / 255f, 0x50 / 255f, 0x90 / 255f, 0.5f);
        var purifiedFill = new Color(0xaf / 255f, 0xaf / 255f, 0xaf / 255f, 0.92f);
        var purifiedStroke = new Color(0x9a / 255f, 0x70 / 255f, 0xb0 / 255f, 0.5f);
        var openFill = new Color(0x14 / 255f, 0x08 / 255f, 0x1e / 255f, 0.29f);
        var openStroke = new Color(0x78 / 255f, 0x50 / 255f, 0x90 / 255f, 0.05f);

        foreach (var cell in state.EverRevealedCells)
        {
            if (!state.BlobCells.Contains(cell)) continue;

            foreach (var d in WallDirs)
            {
                var nc = new CellCoord(cell.X + d.X, cell.Y + d.Y);
                if (!state.BlobCells.Contains(nc)) continue;

                var wall = WallId.Create(cell.X, cell.Y, nc.X, nc.Y);
                if (state.InternalWalls.Contains(wall)) continue;

                bool isOpen = state.RemovedWalls.Contains(wall);
                bool isFixed = state.FixedWalls.Contains(wall);

                bool purifiedA = state.CellToRoom.TryGetValue(cell, out var roomA) && state.Purified.Contains(roomA);
                bool purifiedB = state.CellToRoom.TryGetValue(nc, out var roomB) && state.Purified.Contains(roomB);
                bool isPurifiedAdjacent = purifiedA || purifiedB;

                var mid = new Vector2(
                    (cell.X + nc.X + 1) * 0.5f * cellPx,
                    (cell.Y + nc.Y + 1) * 0.5f * cellPx);

                Color fill, stroke;
                if (isFixed)
                {
                    fill = closedFill;
                    stroke = closedStroke;
                }
                else if (isOpen)
                {
                    fill = openFill;
                    stroke = openStroke;
                }
                else if (isPurifiedAdjacent)
                {
                    fill = purifiedFill;
                    stroke = purifiedStroke;
                }
                else
                {
                    fill = closedFill;
                    stroke = closedStroke;
                }

                float ht = _wallThickness * 0.5f;
                if (wall.IsHorizontal)
                {
                    float bx = mid.X;
                    float by = mid.Y - cellPx * 0.5f;
                    DrawWallPolygon(new[]
                    {
                        new Vector2(bx - ht, by + ht),
                        new Vector2(bx,      by),
                        new Vector2(bx + ht, by + ht),
                        new Vector2(bx + ht, by + cellPx - ht),
                        new Vector2(bx,      by + cellPx),
                        new Vector2(bx - ht, by + cellPx - ht),
                    }, fill, stroke);
                }
                else
                {
                    float bx = mid.X - cellPx * 0.5f;
                    float by = mid.Y;
                    DrawWallPolygon(new[]
                    {
                        new Vector2(bx + ht,          by - ht),
                        new Vector2(bx + cellPx - ht, by - ht),
                        new Vector2(bx + cellPx,      by),
                        new Vector2(bx + cellPx - ht, by + ht),
                        new Vector2(bx + ht,          by + ht),
                        new Vector2(bx,               by),
                    }, fill, stroke);
                }
            }
        }

        foreach (var cell in state.EverRevealedCells)
        {
            if (!state.BlobCells.Contains(cell)) continue;
            DrawExternalWalls(state, cell, cellPx);
        }
    }

    private static readonly CellCoord[] WallDirs =
    {
        new(1, 0), new(0, 1), new(-1, 0), new(0, -1)
    };

    private void DrawExternalWalls(LevelState state, CellCoord cell, float cellPx)
    {
        var extColor = new Color(0x14 / 255f, 0x08 / 255f, 0x1e / 255f, 0.92f);
        var extStroke = new Color(0x78 / 255f, 0x50 / 255f, 0x90 / 255f, 0.5f);

        var dirs = new[]
        {
            (new CellCoord(1, 0), true),
            (new CellCoord(-1, 0), true),
            (new CellCoord(0, 1), false),
            (new CellCoord(0, -1), false)
        };

        float eht = _wallThickness * 0.5f;
        foreach (var (d, isXDir) in dirs)
        {
            var nc = new CellCoord(cell.X + d.X, cell.Y + d.Y);
            if (state.BlobCells.Contains(nc)) continue;

            if (isXDir)
            {
                float bx = d.X > 0 ? (cell.X + 1) * cellPx : cell.X * cellPx;
                float by = cell.Y * cellPx;
                DrawWallPolygon(new[]
                {
                    new Vector2(bx - eht, by + eht),
                    new Vector2(bx,       by),
                    new Vector2(bx + eht, by + eht),
                    new Vector2(bx + eht, by + cellPx - eht),
                    new Vector2(bx,       by + cellPx),
                    new Vector2(bx - eht, by + cellPx - eht),
                }, extColor, extStroke);
            }
            else
            {
                float bx = cell.X * cellPx;
                float by = d.Y > 0 ? (cell.Y + 1) * cellPx : cell.Y * cellPx;
                DrawWallPolygon(new[]
                {
                    new Vector2(bx + eht,          by - eht),
                    new Vector2(bx + cellPx - eht, by - eht),
                    new Vector2(bx + cellPx,       by),
                    new Vector2(bx + cellPx - eht, by + eht),
                    new Vector2(bx + eht,          by + eht),
                    new Vector2(bx,                by),
                }, extColor, extStroke);
            }
        }
    }

    private void DrawWallPolygon(Vector2[] points, Color fill, Color stroke)
    {
        var colors = new Color[points.Length];
        for (int i = 0; i < points.Length; i++)
            colors[i] = fill;
        DrawPolygon(points, colors);

        var strokePts = new Vector2[points.Length + 1];
        for (int i = 0; i < points.Length; i++)
            strokePts[i] = points[i];
        strokePts[points.Length] = points[0];
        DrawPolyline(strokePts, stroke, 1f);
    }

    private static Texture2D? _heartTex;
    private static Texture2D? _chestTex;
    private static Texture2D? _cursedChestTex;
    private static Texture2D? _sphereTex;
    private static Texture2D? _altarTex;
    private static Texture2D? _roomAltarTex;
    private static bool _collectibleTexLoaded;

    private static void LoadCollectibleTextures()
    {
        if (_collectibleTexLoaded) return;
        _collectibleTexLoaded = true;
        _heartTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/heart.png");
        _chestTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/chest.png");
        _cursedChestTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/chest_cursed.png");
        _sphereTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/sphere.png");
        _altarTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/altar.png");
        _roomAltarTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Tiles/room_altar.png");
    }

    private void DrawCollectibles(LevelState state, float cellPx)
    {
        LoadCollectibleTextures();
        var drawSize = cellPx * 0.25f;

        foreach (var h in state.Hearts)
        {
            if (!IsRevealedCell(state, h.Cell)) continue;
            if (h.Collected) continue;
            DrawSpriteCentered(_heartTex, h.Position, drawSize);
        }

        if (state.SummonSphere != null && !state.SummonSphere.Collected && IsRevealedCell(state, state.SummonSphere.Cell))
            DrawSpriteCentered(_sphereTex, state.SummonSphere.Position, drawSize);

        foreach (var c in state.UpgradeChests)
        {
            if (!IsRevealedCell(state, c.Cell)) continue;
            if (c.Collected) continue;
            DrawSpriteCentered(_chestTex, c.Position, drawSize);
        }

        foreach (var c in state.SpatialChests)
        {
            if (!IsRevealedCell(state, c.Cell)) continue;
            if (c.Collected) continue;
            DrawSpriteCentered(_cursedChestTex, c.Position, drawSize * 0.9f);
        }

        foreach (var w in state.DroppedWeapons)
        {
            if (!IsRevealedCell(state, w.Cell)) continue;
            var (tex, region) = LoadWeaponGroundTexture(w.WeaponId);
            if (tex != null)
                DrawWeaponSprite(tex, region, w.Position, drawSize);
            else
                DrawCircle(w.Position, drawSize * 0.3f, new Color(0.2f, 0.8f, 1f));
        }

        foreach (var a in state.RoomAltars)
        {
            if (a.Activated) continue;
            if (!IsRevealedCell(state, a.Cell)) continue;
            if (state.CellContents.TryGetValue(a.Cell, out var content) &&
                (content.EnemyCount <= 0 || content.EnemiesReleased))
                continue;
            DrawSpriteCentered(_altarTex, a.Position, drawSize * 1.2f);
        }

        foreach (var a in state.RoomBonusAltars)
        {
            if (a.Activated) continue;
            if (!IsRevealedCell(state, a.Cell)) continue;
            DrawSpriteCentered(_roomAltarTex, a.Position, drawSize * 1.2f);
        }
    }

    private void DrawSpriteCentered(Texture2D? tex, Vector2 pos, float drawSize)
    {
        if (tex == null) return;
        var texW = tex.GetWidth();
        var texH = tex.GetHeight();
        if (texW == 0 || texH == 0) return;
        var scale = drawSize / Mathf.Max(texW, texH);
        var w = texW * scale;
        var h = texH * scale;
        var dest = new Rect2(pos.X - w * 0.5f, pos.Y - h * 0.5f, w, h);
        DrawTextureRect(tex, dest, false);
    }

    private static readonly Dictionary<string, (Texture2D? Tex, Rect2 Region)> _weaponGroundCache = new();

    private static (Texture2D? Tex, Rect2 Region) LoadWeaponGroundTexture(string weaponId)
    {
        if (_weaponGroundCache.TryGetValue(weaponId, out var cached))
            return cached;

        (Texture2D? Tex, Rect2 Region) result = weaponId switch
        {
            "pistol" => (
                ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/weapons/pistol/[SHOOTING]PistolV1.00.png"),
                new Rect2(0, 0, 64, 32)),
            "smg" => (
                ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/weapons/smg/[SHOOT] Submachine - MP5A3.png"),
                new Rect2(0, 0, 80, 48)),
            "carbine" => (
                ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/weapons/rifle/[SINGLE_SHOT] Assault_rifle_V1.00.png"),
                new Rect2(0, 0, 128, 48)),
            "rifle" => (
                ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/weapons/sniper/[SNIPER_SHOOTING]_Sniper_rifle_[KAR98]_V1.00.png"),
                new Rect2(0, 0, 160, 32)),
            "shotgun" => (
                ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/shotgun.png"),
                new Rect2(0, 0, 0, 0)),
            "revolver" => (
                ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/revolver.png"),
                new Rect2(0, 0, 0, 0)),
            _ => (null, new Rect2(0, 0, 0, 0)),
        };

        if (result.Tex != null && (result.Region.Size.X == 0 || result.Region.Size.Y == 0))
            result = (result.Tex, new Rect2(0, 0, result.Tex.GetWidth(), result.Tex.GetHeight()));

        _weaponGroundCache[weaponId] = result;
        return result;
    }

    private void DrawWeaponSprite(Texture2D tex, Rect2 srcRegion, Vector2 pos, float drawSize)
    {
        var srcW = (int)srcRegion.Size.X;
        var srcH = (int)srcRegion.Size.Y;
        if (srcW == 0 || srcH == 0) return;
        var scale = drawSize / Mathf.Max(srcW, srcH);
        var w = srcW * scale;
        var h = srcH * scale;
        var dest = new Rect2(pos.X - w * 0.5f, pos.Y - h * 0.5f, w, h);
        DrawTextureRectRegion(tex, dest, srcRegion);
    }

    private static bool IsRevealedCell(LevelState state, CellCoord cell)
    {
        return state.EverRevealedCells.Contains(cell);
    }
}
