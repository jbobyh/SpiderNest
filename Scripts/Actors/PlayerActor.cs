using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Actors;

public partial class PlayerActor : CharacterBody2D
{
    [Signal] public delegate void DashStateChangedEventHandler(bool isDashing);

    private CollisionShape2D? _shape;
    private Sprite2D? _bodySprite;
    private Sprite2D? _legsSprite;
    private Sprite2D? _weaponSprite;
    private Sprite2D? _armUpperLeft;
    private Sprite2D? _armForeLeft;
    private Sprite2D? _armUpperRight;
    private Sprite2D? _armForeRight;
    private Sprite2D? _armSouthUpperLeft;
    private Sprite2D? _armSouthForeLeft;
    private Sprite2D? _armSouthUpperRight;
    private Sprite2D? _armSouthForeRight;
    private bool _isDashing;
    private Vector2 _dashDir;
    private float _dashProgress;
    private float _dashCooldown;
    private float _invulnerable;
    private float _speedMult = 1f;
    private float _roomSpeedVectorMult = 1f;
    private int _facingCol;
    private int _legsRow = -1;
    private int _legsCol;
    private float _legsTimer;
    private bool _legsFlip;
    private string? _weaponId;
    private WeaponDefinition? _weaponDef;
    private float _weaponShootAnim;
    private float _weaponShootAnimMax;
    private float _weaponReloadAnim;
    private float _weaponReloadAnimMax;
    private bool _weaponFlipY;

    public bool IsDashing => _isDashing;
    public bool IsInvulnerable => _invulnerable > 0f;
    public float Invulnerable => _invulnerable;
    public float DashCooldown => _dashCooldown;
    public float SpeedMult
    {
        get => _speedMult;
        set => _speedMult = value;
    }

    public void SetRoomSpeedVectorMult(float mult)
    {
        _roomSpeedVectorMult = mult;
    }

    public override void _Ready()
    {
        MotionMode = MotionModeEnum.Floating;

        CollisionLayer = 2u;
        CollisionMask = 1u | 4u;

        _shape = new CollisionShape2D();
        var circle = new CircleShape2D
        {
            Radius = GameConstants.PlayerRadius,
        };
        _shape.Shape = circle;
        AddChild(_shape);

        _bodySprite = new Sprite2D();
        var tex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/player_body_spritesheet.png");
        if (tex != null)
        {
            _bodySprite.Texture = tex;
            _bodySprite.RegionEnabled = true;
            var sw = 64;
            _bodySprite.RegionRect = new Rect2(0, 0, sw, 64);
            var drawSize = GameConstants.PlayerSpriteRadius * 2f;
            var s = drawSize / 64f;
            _bodySprite.Scale = new Vector2(s, s);
            _bodySprite.ZIndex = 1;
        }
        AddChild(_bodySprite);

        _legsSprite = new Sprite2D();
        var legsTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/player_legs_spritesheet.png");
        if (legsTex != null)
        {
            _legsSprite.Texture = legsTex;
            _legsSprite.RegionEnabled = true;
            _legsSprite.RegionRect = new Rect2(0, 0, 64, 64);
            var legsDrawSize = GameConstants.PlayerSpriteRadius * 2f;
            var legsS = legsDrawSize / 64f;
            _legsSprite.Scale = new Vector2(legsS, legsS);
            _legsSprite.ZIndex = 0;
        }
        AddChild(_legsSprite);

        _weaponSprite = new Sprite2D();
        _weaponSprite.Visible = false;
        AddChild(_weaponSprite);

        var armUpperTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/lefthand2.png");
        var armForeTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/lefthand1.png");
        var armSouthUpperTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/southhand2.png");
        var armSouthForeTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Entities/southhand1.png");

        _armUpperLeft = CreateArmSprite(armUpperTex);
        _armForeLeft = CreateArmSprite(armForeTex);
        _armUpperRight = CreateArmSprite(armUpperTex);
        _armForeRight = CreateArmSprite(armForeTex);
        _armSouthUpperLeft = CreateArmSprite(armSouthUpperTex);
        _armSouthForeLeft = CreateArmSprite(armSouthForeTex);
        _armSouthUpperRight = CreateArmSprite(armSouthUpperTex);
        _armSouthForeRight = CreateArmSprite(armSouthForeTex);

        SetArmAnchor(_armUpperLeft, GameConstants.ArmUpperPivot, 0.5f);
        SetArmAnchor(_armUpperRight, GameConstants.ArmUpperPivot, 0.5f);
        SetArmAnchor(_armForeLeft, 1f - GameConstants.ArmForearmPivot, 0.5f);
        SetArmAnchor(_armForeRight, 1f - GameConstants.ArmForearmPivot, 0.5f);
        SetArmAnchor(_armSouthUpperLeft, 0.5f, GameConstants.ArmSouthUpperPivot);
        SetArmAnchor(_armSouthUpperRight, 0.5f, GameConstants.ArmSouthUpperPivot);
        SetArmAnchor(_armSouthForeLeft, 0.5f, 1f - GameConstants.ArmSouthForearmPivot);
        SetArmAnchor(_armSouthForeRight, 0.5f, 1f - GameConstants.ArmSouthForearmPivot);

        AddChild(_armUpperLeft);
        AddChild(_armForeLeft);
        AddChild(_armUpperRight);
        AddChild(_armForeRight);
        AddChild(_armSouthUpperLeft);
        AddChild(_armSouthForeLeft);
        AddChild(_armSouthUpperRight);
        AddChild(_armSouthForeRight);
    }

    private static Sprite2D CreateArmSprite(Texture2D? tex)
    {
        var spr = new Sprite2D
        {
            Visible = false,
            Centered = true,
        };
        if (tex != null)
            spr.Texture = tex;
        return spr;
    }

    private static void SetArmAnchor(Sprite2D? spr, float ax, float ay)
    {
        if (spr == null || spr.Texture == null) return;
        spr.Offset = new Vector2(
            (0.5f - ax) * spr.Texture.GetWidth(),
            (0.5f - ay) * spr.Texture.GetHeight());
    }

    public override void _PhysicsProcess(double delta)
    {
        var dt = (float)delta;

        if (_invulnerable > 0f)
            _invulnerable -= dt;
        if (_dashCooldown > 0f)
            _dashCooldown -= dt;

        if (_isDashing)
        {
            StepDash(dt);
        }
        else
        {
            StepMovement(dt);

            if (Input.IsActionJustPressed("dash") && _dashCooldown <= 0f)
            {
                StartDash();
            }
        }

        UpdateCollisionMask();
        UpdatePlayerSprite(dt);
        QueueRedraw();
    }

    private void UpdatePlayerSprite(float dt)
    {
        if (_bodySprite == null) return;

        var mouse = GetGlobalMousePosition();
        var aim = mouse - GlobalPosition;
        var aimAngle = Mathf.Atan2(aim.Y, aim.X);

        var dir = Input.GetVector("move_left", "move_right", "move_up", "move_down");
        var moving = dir != Vector2.Zero;

        int col;
        bool flip;
        var southMin = -Mathf.Pi / 4f + GameConstants.FacingSouthShrink;
        var southMax = Mathf.Pi / 4f - GameConstants.FacingSouthShrink;
        if (aimAngle > southMin && aimAngle <= southMax)
        { col = 2; flip = true; }
        else if (aimAngle > southMax && aimAngle <= 3f * Mathf.Pi / 4f)
        { col = 0; flip = false; }
        else if (aimAngle > -3f * Mathf.Pi / 4f && aimAngle <= southMin)
        { col = 1; flip = false; }
        else
        { col = 2; flip = false; }

        if (col != _facingCol)
        {
            _facingCol = col;
            _bodySprite.RegionRect = new Rect2(col * 64, 0, 64, 64);
        }
        _bodySprite.FlipH = flip;

        if (_invulnerable > 0f && ((int)Math.Floor(_invulnerable * 20f)) % 2 == 0)
            _bodySprite.Modulate = new Color(1f, 1f, 1f, 0.4f);
        else
            _bodySprite.Modulate = Colors.White;

        UpdateLegsSprite(dt);
        UpdateWeaponSprite();
        UpdateIKArms(aimAngle);
    }

    public void SetWeaponState(string? weaponId, WeaponDefinition? def,
        float shootAnim, float shootAnimMax,
        float reloadAnim, float reloadAnimMax)
    {
        _weaponId = weaponId;
        _weaponDef = def;
        _weaponShootAnim = shootAnim;
        _weaponShootAnimMax = shootAnimMax;
        _weaponReloadAnim = reloadAnim;
        _weaponReloadAnimMax = reloadAnimMax;
    }

    private string GetFacingDir()
    {
        if (_facingCol == 0) return "south";
        if (_facingCol == 1) return "north";
        return _bodySprite?.FlipH == true ? "east" : "west";
    }

    private void UpdateIKArms(float aimAngle)
    {
        HideAllArms();

        if (_weaponDef == null || string.IsNullOrEmpty(_weaponId))
            return;
        if (_bodySprite == null || !_bodySprite.Visible)
            return;

        var facing = GetFacingDir();
        var anchors = GetArmAnchors(facing);
        if (anchors == null) return;
        var a = anchors.Value;

        var drawSize = GameConstants.PlayerSpriteRadius * 2f;
        var scale = drawSize / 28f;

        var spriteAngle = _weaponDef.SpriteAngle;
        var weaponAngle = aimAngle + (_weaponFlipY ? -spriteAngle : spriteAngle);
        var wDrawSize = drawSize * _weaponDef.SpriteScale;
        var ws = wDrawSize / 64f;
        var offsetDist = drawSize * _weaponDef.SpriteOffset;
        var pivotY = _weaponDef.SpritePivotY;

        var weaponCx = GlobalPosition.X + Mathf.Cos(aimAngle) * offsetDist;
        var weaponCy = GlobalPosition.Y + Mathf.Sin(aimAngle) * offsetDist + pivotY;

        var cos = Mathf.Cos(weaponAngle);
        var sin = Mathf.Sin(weaponAngle);

        var bend = GetBendSign(facing);
        var z = GetZOrder(facing);

        var armScale = scale * GameConstants.ArmSpriteScale;
        var L1 = GameConstants.ArmUpperW * scale;
        var L2 = GameConstants.ArmForearmW * scale;

        UpdateArmSide("left", a.Left, _weaponDef.GripLeft, bend.Left, z.Left,
            weaponCx, weaponCy, cos, sin, ws, armScale, facing, L1, L2);
        UpdateArmSide("right", a.Right, _weaponDef.GripRight, bend.Right, z.Right,
            weaponCx, weaponCy, cos, sin, ws, armScale, facing, L1, L2);
    }

    private void UpdateArmSide(string side, Vector2 anchor, Vector2 grip, float bendSign, int zVal,
        float weaponCx, float weaponCy, float cos, float sin, float ws, float armScale,
        string facing, float L1, float L2)
    {
        if (grip == Vector2.Zero) return;

        var scale = GameConstants.PlayerSpriteRadius * 2f / 28f;
        var sx = GlobalPosition.X + anchor.X * scale;
        var sy = GlobalPosition.Y + anchor.Y * scale;

        var gx = grip.X * ws;
        var gy = (_weaponFlipY ? -grip.Y : grip.Y) * ws;
        var targetX = weaponCx + cos * gx - sin * gy;
        var targetY = weaponCy + sin * gx + cos * gy;

        var elbow = SolveIK(sx, sy, targetX, targetY, L1, L2, bendSign);

        var upperAngle = Mathf.Atan2(elbow.Y - sy, elbow.X - sx);
        var foreAngle = Mathf.Atan2(targetY - elbow.Y, targetX - elbow.X);

        if (facing == "west" || facing == "east")
        {
            var upper = side == "left" ? _armUpperLeft : _armUpperRight;
            var fore = side == "left" ? _armForeLeft : _armForeRight;
            if (upper == null || fore == null) return;

            var scaleX = facing == "west" ? armScale : -armScale;
            var rotOffset = facing == "west" ? Mathf.Pi : 0f;

            upper.Visible = true;
            upper.Position = new Vector2(sx - GlobalPosition.X, sy - GlobalPosition.Y);
            upper.Rotation = upperAngle + rotOffset;
            upper.Scale = new Vector2(scaleX, armScale);
            upper.ZIndex = zVal;

            fore.Visible = true;
            fore.Position = new Vector2(targetX - GlobalPosition.X, targetY - GlobalPosition.Y);
            fore.Rotation = foreAngle + rotOffset;
            fore.Scale = new Vector2(scaleX, armScale);
            fore.ZIndex = zVal;
        }
        else
        {
            var upper = side == "left" ? _armSouthUpperLeft : _armSouthUpperRight;
            var fore = side == "left" ? _armSouthForeLeft : _armSouthForeRight;
            if (upper == null || fore == null) return;

            var rotOffset = -Mathf.Pi / 2f;
            var scaleX = side == "right" ? -armScale : armScale;

            upper.Visible = true;
            upper.Position = new Vector2(sx - GlobalPosition.X, sy - GlobalPosition.Y);
            upper.Rotation = upperAngle + rotOffset;
            upper.Scale = new Vector2(scaleX, armScale);
            upper.ZIndex = zVal;

            fore.Visible = true;
            fore.Position = new Vector2(targetX - GlobalPosition.X, targetY - GlobalPosition.Y);
            fore.Rotation = foreAngle + rotOffset;
            fore.Scale = new Vector2(scaleX, armScale);
            fore.ZIndex = zVal;
        }
    }

    private void HideAllArms()
    {
        if (_armUpperLeft != null) _armUpperLeft.Visible = false;
        if (_armForeLeft != null) _armForeLeft.Visible = false;
        if (_armUpperRight != null) _armUpperRight.Visible = false;
        if (_armForeRight != null) _armForeRight.Visible = false;
        if (_armSouthUpperLeft != null) _armSouthUpperLeft.Visible = false;
        if (_armSouthForeLeft != null) _armSouthForeLeft.Visible = false;
        if (_armSouthUpperRight != null) _armSouthUpperRight.Visible = false;
        if (_armSouthForeRight != null) _armSouthForeRight.Visible = false;
    }

    private static Vector2 SolveIK(float shoulderX, float shoulderY,
        float targetX, float targetY, float L1, float L2, float bendSign)
    {
        var dx = targetX - shoulderX;
        var dy = targetY - shoulderY;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        var maxReach = L1 + L2 - 0.01f;
        var minReach = Mathf.Abs(L1 - L2) + 0.01f;
        if (dist > maxReach) dist = maxReach;
        if (dist < minReach) dist = minReach;

        var cosElbow = Mathf.Clamp((L1 * L1 + dist * dist - L2 * L2) / (2f * L1 * dist), -1f, 1f);
        var elbowAngle = Mathf.Acos(cosElbow) * bendSign;
        var baseAngle = Mathf.Atan2(dy, dx);
        var elbowDir = baseAngle + elbowAngle;

        return new Vector2(
            shoulderX + Mathf.Cos(elbowDir) * L1,
            shoulderY + Mathf.Sin(elbowDir) * L1);
    }

    private static ArmAnchors? GetArmAnchors(string facing)
    {
        return facing switch
        {
            "south" => new ArmAnchors(new Vector2(4, -2), new Vector2(-3, -2)),
            "north" => new ArmAnchors(new Vector2(-2, 0), new Vector2(3, 0)),
            "west" => new ArmAnchors(new Vector2(2, -3), new Vector2(1, -4)),
            "east" => new ArmAnchors(new Vector2(-1, -4), new Vector2(-2, -3)),
            _ => null,
        };
    }

    private (float Left, float Right) GetBendSign(string facing)
    {
        return facing switch
        {
            "south" => (-1f, 1f),
            "north" => (1f, -1f),
            "west" => (-1f, -1f),
            "east" => (1f, 1f),
            _ => (-1f, 1f),
        };
    }

    private (int Left, int Right) GetZOrder(string facing)
    {
        return facing switch
        {
            "south" => (_weaponFlipY ? 6 : 4, _weaponFlipY ? 4 : 6),
            "north" => (_weaponFlipY ? 0 : -2, _weaponFlipY ? -2 : 0),
            "west" => (4, 0),
            "east" => (0, 4),
            _ => (4, 6),
        };
    }

    private readonly record struct ArmAnchors(Vector2 Left, Vector2 Right);

    private void UpdateLegsSprite(float dt)
    {
        if (_legsSprite == null) return;

        var facing = GetFacingDir();
        var row = facing switch
        {
            "south" => 0,
            "north" => 1,
            _ => 2,
        };
        var flip = facing == "east";

        if (row != _legsRow || flip != _legsFlip)
        {
            _legsRow = row;
            _legsFlip = flip;
            _legsCol = 0;
            _legsTimer = 0f;
        }

        var speed = Velocity.Length();
        var moving = speed > 0.01f;

        if (moving)
        {
            var speedRatio = Mathf.Min(3f, speed / GameConstants.PlayerSpeed);
            var fps = GameConstants.PlayerLegsWalkFps * speedRatio;
            _legsTimer += dt;
            var frameDur = 1f / fps;
            while (_legsTimer >= frameDur)
            {
                _legsTimer -= frameDur;
                _legsCol = 1 + ((_legsCol - 1 + 1) % 4);
            }
        }
        else
        {
            _legsCol = 0;
            _legsTimer = 0f;
        }

        _legsSprite.RegionRect = new Rect2(_legsCol * 64, row * 64, 64, 64);
        _legsSprite.FlipH = flip;

        if (_invulnerable > 0f && ((int)Math.Floor(_invulnerable * 20f)) % 2 == 0)
            _legsSprite.Modulate = new Color(1f, 1f, 1f, 0.4f);
        else
            _legsSprite.Modulate = Colors.White;
    }

    private void UpdateWeaponSprite()
    {
        if (_weaponSprite == null) return;

        if (string.IsNullOrEmpty(_weaponId) || _weaponDef == null)
        {
            _weaponSprite.Visible = false;
            return;
        }

        var info = GetWeaponTexInfo(_weaponId!);
        var isReloadAnim = _weaponReloadAnim > 0f && info.IsAnimated;
        var isShootAnim = _weaponShootAnim > 0f && info.IsAnimated;

        if (info.IsAnimated && info.ShootTex != null)
        {
            if (isReloadAnim && info.ReloadTex1 != null)
            {
                var progress = 1f - _weaponReloadAnim / Mathf.Max(_weaponReloadAnimMax, 0.001f);
                var frame = Mathf.Min(info.ReloadTotal - 1, (int)Mathf.Floor(progress * info.ReloadTotal));

                if (frame < info.ReloadFrames1 || info.ReloadTex2 == null)
                {
                    if (_weaponSprite.Texture != info.ReloadTex1)
                        _weaponSprite.Texture = info.ReloadTex1;
                    _weaponSprite.RegionEnabled = true;
                    _weaponSprite.RegionRect = new Rect2(
                        (info.ReloadStartIdx1 + frame) * info.ReloadFrameW, 0,
                        info.ReloadFrameW, info.ReloadFrameH);
                }
                else
                {
                    var localFrame = frame - info.ReloadFrames1;
                    if (_weaponSprite.Texture != info.ReloadTex2)
                        _weaponSprite.Texture = info.ReloadTex2;
                    _weaponSprite.RegionEnabled = true;
                    _weaponSprite.RegionRect = new Rect2(
                        (info.ReloadStartIdx2 + localFrame) * info.ReloadFrameW, 0,
                        info.ReloadFrameW, info.ReloadFrameH);
                }
            }
            else if (isShootAnim)
            {
                var progress = 1f - _weaponShootAnim / Mathf.Max(_weaponShootAnimMax, 0.001f);
                if (_weaponSprite.Texture != info.ShootTex)
                    _weaponSprite.Texture = info.ShootTex;
                _weaponSprite.RegionEnabled = true;

                var frame = info.ShootStartFrame +
                    Mathf.Min(info.ShootAnimFrames - 1, (int)Mathf.Floor(progress * info.ShootAnimFrames));

                if (info.ShootVertical)
                    _weaponSprite.RegionRect = new Rect2(0, frame * info.ShootFrameH, info.ShootFrameW, info.ShootFrameH);
                else
                    _weaponSprite.RegionRect = new Rect2(frame * info.ShootFrameW, 0, info.ShootFrameW, info.ShootFrameH);
            }
            else
            {
                if (_weaponSprite.Texture != info.ShootTex)
                    _weaponSprite.Texture = info.ShootTex;
                _weaponSprite.RegionEnabled = true;
                if (info.ShootVertical)
                    _weaponSprite.RegionRect = new Rect2(0, 0, info.ShootFrameW, info.ShootFrameH);
                else
                    _weaponSprite.RegionRect = new Rect2(0, 0, info.ShootFrameW, info.ShootFrameH);
            }
        }
        else if (info.StaticTex != null)
        {
            if (_weaponSprite.Texture != info.StaticTex)
                _weaponSprite.Texture = info.StaticTex;
            _weaponSprite.RegionEnabled = false;
        }
        else
        {
            _weaponSprite.Visible = false;
            return;
        }

        var mouse = GetGlobalMousePosition();
        var aim = mouse - GlobalPosition;
        var aimAngle = Mathf.Atan2(aim.Y, aim.X);

        var drawSize = GameConstants.PlayerSpriteRadius * 2f;
        var wDrawSize = drawSize * _weaponDef.SpriteScale;
        var spriteW = isReloadAnim
            ? (_weaponDef.ReloadSpriteWidth > 0 ? _weaponDef.ReloadSpriteWidth : _weaponDef.SpriteWidth)
            : _weaponDef.SpriteWidth;
        var ws = wDrawSize / spriteW;

        var threshold = _weaponDef.FlipThreshold;
        if (!_weaponFlipY)
        {
            if (aimAngle > Mathf.Pi / 2f + threshold || aimAngle < -Mathf.Pi / 2f - threshold)
                _weaponFlipY = true;
        }
        else
        {
            if (aimAngle < Mathf.Pi / 2f - threshold && aimAngle > -Mathf.Pi / 2f + threshold)
                _weaponFlipY = false;
        }

        var spriteAngle = _weaponDef.SpriteAngle;
        var pivotY = _weaponDef.SpritePivotY;
        var offsetDist = drawSize * _weaponDef.SpriteOffset;

        _weaponSprite.Position = new Vector2(
            Mathf.Cos(aimAngle) * offsetDist,
            Mathf.Sin(aimAngle) * offsetDist + pivotY);
        _weaponSprite.Rotation = aimAngle + (_weaponFlipY ? -spriteAngle : spriteAngle);
        _weaponSprite.Scale = new Vector2(ws, _weaponFlipY ? -ws : ws);

        if (isReloadAnim)
        {
            var fw = info.ReloadFrameW;
            var fh = info.ReloadFrameH;
            _weaponSprite.Offset = new Vector2(
                (0.5f - _weaponDef.ReloadAnchorX) * fw,
                (0.5f - _weaponDef.ReloadAnchorY) * fh);
        }
        else
        {
            _weaponSprite.Offset = Vector2.Zero;
        }

        var facing = GetFacingDir();
        var weaponZ = facing switch
        {
            "south" => 5,
            "west" => 0,
            "east" => 3,
            "north" => -1,
            _ => 5,
        };
        _weaponSprite.ZIndex = weaponZ;
        _weaponSprite.Visible = true;
    }

    private static readonly Dictionary<string, WeaponTexInfo> _weaponTexCache = new();

    private static WeaponTexInfo GetWeaponTexInfo(string weaponId)
    {
        if (_weaponTexCache.TryGetValue(weaponId, out var info))
            return info;
        info = LoadWeaponTexInfo(weaponId);
        _weaponTexCache[weaponId] = info;
        return info;
    }

    private static WeaponTexInfo LoadWeaponTexInfo(string weaponId)
    {
        return weaponId switch
        {
            "pistol" => new WeaponTexInfo
            {
                IsAnimated = true,
                ShootTex = LoadTex("res://Assets/Sprites/Hud/weapons/pistol/[SHOOTING]PistolV1.00.png"),
                ShootFrameW = 64, ShootFrameH = 32,
                ShootStartFrame = 1, ShootAnimFrames = 6,
                ReloadTex1 = LoadTex("res://Assets/Sprites/Hud/weapons/pistol/Pistol_V1.00 - EMPTYING.png"),
                ReloadFrames1 = 17, ReloadStartIdx1 = 1,
                ReloadTex2 = LoadTex("res://Assets/Sprites/Hud/weapons/pistol/Pistol_V1.00 - RELOAD.png"),
                ReloadFrames2 = 18, ReloadStartIdx2 = 5,
                ReloadFrameW = 80, ReloadFrameH = 48,
                ReloadTotal = 35,
            },
            "smg" => new WeaponTexInfo
            {
                IsAnimated = true,
                ShootTex = LoadTex("res://Assets/Sprites/Hud/weapons/smg/[SHOOT] Submachine - MP5A3.png"),
                ShootFrameW = 80, ShootFrameH = 48,
                ShootStartFrame = 1, ShootAnimFrames = 6,
                ReloadTex1 = LoadTex("res://Assets/Sprites/Hud/weapons/smg/[EMPTY] Submachine - MP5A3.png"),
                ReloadFrames1 = 12, ReloadStartIdx1 = 0,
                ReloadTex2 = LoadTex("res://Assets/Sprites/Hud/weapons/smg/[RELOAD] Submachine - MP5A3.png"),
                ReloadFrames2 = 16, ReloadStartIdx2 = 0,
                ReloadFrameW = 80, ReloadFrameH = 48,
                ReloadTotal = 28,
            },
            "carbine" => new WeaponTexInfo
            {
                IsAnimated = true,
                ShootTex = LoadTex("res://Assets/Sprites/Hud/weapons/rifle/[SINGLE_SHOT] Assault_rifle_V1.00.png"),
                ShootFrameW = 128, ShootFrameH = 48,
                ShootStartFrame = 1, ShootAnimFrames = 11,
                ReloadTex1 = LoadTex("res://Assets/Sprites/Hud/weapons/rifle/[EMPTYING] Assault_rifle_V1.00.png"),
                ReloadFrames1 = 16, ReloadStartIdx1 = 0,
                ReloadTex2 = LoadTex("res://Assets/Sprites/Hud/weapons/rifle/[RELOAD] Assault_rifle_V1.00 - Reload.png"),
                ReloadFrames2 = 16, ReloadStartIdx2 = 0,
                ReloadFrameW = 96, ReloadFrameH = 64,
                ReloadTotal = 32,
            },
            "rifle" => new WeaponTexInfo
            {
                IsAnimated = true,
                ShootTex = LoadTex("res://Assets/Sprites/Hud/weapons/sniper/[SNIPER_SHOOTING]_Sniper_rifle_[KAR98]_V1.00.png"),
                ShootFrameW = 160, ShootFrameH = 32,
                ShootVertical = true,
                ShootStartFrame = 4, ShootAnimFrames = 6,
                ReloadTex1 = LoadTex("res://Assets/Sprites/Hud/weapons/sniper/[SNIPER_ONLY_FIVE_ROUND_RELOADING]_Sniper_rifle_[KAR98]_V1.00-Sheet-sheet.png"),
                ReloadFrames1 = 46, ReloadStartIdx1 = 0,
                ReloadFrameW = 128, ReloadFrameH = 32,
                ReloadTotal = 46,
            },
            "shotgun" => new WeaponTexInfo
            {
                IsAnimated = false,
                StaticTex = LoadTex("res://Assets/Sprites/Hud/shotgun.png"),
            },
            "revolver" => new WeaponTexInfo
            {
                IsAnimated = false,
                StaticTex = LoadTex("res://Assets/Sprites/Hud/revolver.png"),
            },
            _ => new WeaponTexInfo(),
        };
    }

    private static Texture2D? LoadTex(string path)
    {
        return ResourceLoader.Load<Texture2D>(path);
    }

    public override void _Draw()
    {
        if (_bodySprite == null)
        {
            var color = new Color(0.3f, 0.6f, 1f);
            if (_invulnerable > 0f && ((int)Math.Floor(_invulnerable * 20f)) % 2 == 0)
                color = new Color(1f, 1f, 1f, 0.4f);

            DrawCircle(Vector2.Zero, GameConstants.PlayerSpriteRadius, color);
            DrawCircle(Vector2.Zero, GameConstants.PlayerSpriteRadius, new Color(0.1f, 0.2f, 0.4f), filled: false, width: 1.5f);
        }
    }

    public void SetInvulnerable(float seconds)
    {
        _invulnerable = seconds;
    }

    private void StepMovement(float dt)
    {
        var dir = Input.GetVector(
            "move_left", "move_right",
            "move_up", "move_down");

        if (dir.X != 0f && dir.Y != 0f)
            dir *= MathF.Sqrt(0.5f);

        var spd = GameConstants.PlayerSpeed * _speedMult;
        if (dir != Vector2.Zero && _roomSpeedVectorMult != 1f)
            spd *= _roomSpeedVectorMult;
        Velocity = dir * spd;
        MoveAndSlide();
    }

    private void StartDash()
    {
        var dir = Input.GetVector(
            "move_left", "move_right",
            "move_up", "move_down");

        if (dir == Vector2.Zero)
        {
            var mouse = GetGlobalMousePosition();
            var aim = mouse - GlobalPosition;
            if (aim.LengthSquared() < 1e-6f) return;
            dir = aim.Normalized();
        }
        else
        {
            dir = dir.Normalized();
        }

        _isDashing = true;
        _dashDir = dir;
        _dashProgress = 0f;
        _dashCooldown = GameConstants.PlayerDashCooldown;
        Velocity = _dashDir * GameConstants.PlayerDashSpeed;
        EmitSignal(SignalName.DashStateChanged, true);
    }

    private void StepDash(float dt)
    {
        var speedBefore = Velocity.Length();

        Velocity = _dashDir * GameConstants.PlayerDashSpeed;
        MoveAndSlide();

        var speedAfter = Velocity.Length();
        _dashProgress += GameConstants.PlayerDashSpeed * dt;

        var hitWall = speedAfter < GameConstants.PlayerDashSpeed * GameConstants.PlayerDashWallStopFraction;

        if (_dashProgress >= GameConstants.PlayerDashDistance || hitWall)
        {
            _isDashing = false;
            _dashProgress = 0f;
            Velocity = Vector2.Zero;
            EmitSignal(SignalName.DashStateChanged, false);
        }
    }

    private void UpdateCollisionMask()
    {
        var skipEnemies = _isDashing || _invulnerable > 0f;
        CollisionMask = skipEnemies ? 1u : 1u | 4u;
    }
}

internal struct WeaponTexInfo
{
    public bool IsAnimated;
    public Texture2D? StaticTex;
    public Texture2D? ShootTex;
    public int ShootFrameW;
    public int ShootFrameH;
    public bool ShootVertical;
    public int ShootStartFrame;
    public int ShootAnimFrames;
    public Texture2D? ReloadTex1;
    public int ReloadFrames1;
    public int ReloadStartIdx1;
    public Texture2D? ReloadTex2;
    public int ReloadFrames2;
    public int ReloadStartIdx2;
    public int ReloadFrameW;
    public int ReloadFrameH;
    public int ReloadTotal;
}
