using System;
using Godot;
using SpaceOrLife.Actors;
using SpaceOrLife.Combat;
using SpaceOrLife.Core;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.Presentation;
using SpaceOrLife.UI;

namespace SpaceOrLife.World;

public partial class PlayModeController : Node
{
    private GameSession? _session;
    private PlayerActor? _player;
    private CameraController? _camera;
    private WallCollisionManager? _wallCollision;
    private LevelRenderer? _levelRenderer;

    private WeaponCatalog? _weaponCatalog;
    private RoomBonusCatalog? _roomBonusCatalog;
    private UpgradeCatalog? _upgradeCatalog;
    private BulletSimulation? _bulletSim;
    private BulletRenderer? _bulletRenderer;
    private EnemyManager? _enemyManager;
    private CombatState _combatState = new();
    private Random _rng = new();

    private bool _rWasPressed;
    private bool _qWasPressed;
    private bool _slot1WasPressed;
    private bool _slot2WasPressed;
    private bool _fWasPressed;
    private bool _spaceWasPressed;
    private Vector2 _cachedMouseWorld;

    public Action<IDamageable>? OnStasisHit;
    public Action<IDamageable>? OnEnemyKilled;
    public CombatState CombatState => _combatState;

    private AudioSystem? _audio;
    private ChoiceOverlay? _choiceOverlay;
    private DamageNumberPool? _damageNumbers;
    private VfxPool? _vfx;
    private SheetVfxPool? _sheetVfx;
    private bool _choiceOverlayWired;
    private int _prevHeartsCollected;
    private bool _prevSummonCollected;

    public void Setup(
        GameSession session,
        PlayerActor player,
        CameraController camera,
        WallCollisionManager wallCollision,
        LevelRenderer levelRenderer,
        WeaponCatalog weaponCatalog,
        RoomBonusCatalog roomBonusCatalog,
        UpgradeCatalog upgradeCatalog,
        BulletSimulation bulletSim,
        BulletRenderer bulletRenderer,
        EnemyManager enemyManager)
    {
        _session = session;
        _player = player;
        _camera = camera;
        _wallCollision = wallCollision;
        _levelRenderer = levelRenderer;
        _weaponCatalog = weaponCatalog;
        _roomBonusCatalog = roomBonusCatalog;
        _upgradeCatalog = upgradeCatalog;
        _bulletSim = bulletSim;
        _bulletRenderer = bulletRenderer;
        _enemyManager = enemyManager;
    }

    public void SetPresentation(AudioSystem audio, ChoiceOverlay choiceOverlay, DamageNumberPool damageNumbers, VfxPool vfx, SheetVfxPool sheetVfx)
    {
        _audio = audio;
        _choiceOverlay = choiceOverlay;
        _damageNumbers = damageNumbers;
        _vfx = vfx;
        _sheetVfx = sheetVfx;

        if (_choiceOverlay != null && !_choiceOverlayWired)
        {
            _choiceOverlay.ChoiceSelected += OnChoiceSelected;
            _choiceOverlayWired = true;
        }

        StatusSystem.OnBurnTick = OnBurnTick;
    }

    private void OnBurnTick(IStatusTarget target, float damage)
    {
        if (_damageNumbers == null) return;
        if (target is not IDamageable dmg) return;
        _damageNumbers.SpawnNumber(dmg.Position, damage, false);
    }

    public override void _ExitTree()
    {
        if (_choiceOverlay != null && _choiceOverlayWired)
        {
            _choiceOverlay.ChoiceSelected -= OnChoiceSelected;
            _choiceOverlayWired = false;
        }

        if (StatusSystem.OnBurnTick == OnBurnTick)
            StatusSystem.OnBurnTick = null;
    }

    public override void _PhysicsProcess(double delta)
    {
        if (_session == null || _player == null || _camera == null) return;
        if (_session.Phase != GamePhase.Play) return;

        var state = _session.CurrentLevel;
        var progress = _session.Progress;
        if (state == null || progress == null) return;
        if (_weaponCatalog == null || _roomBonusCatalog == null) return;
        if (_bulletSim == null || _bulletRenderer == null) return;

        var dt = (float)delta;

        TickShared(dt);

        CollectibleSystem.UpdateCollectibles(state, progress, _player.GlobalPosition);

        if (state.HeartsCollected > _prevHeartsCollected)
        {
            _audio?.HeartCollect();
        }
        _prevHeartsCollected = state.HeartsCollected;

        if (state.SummonSphereCollected && !_prevSummonCollected)
        {
            _audio?.KeyCollect();
        }
        _prevSummonCollected = state.SummonSphereCollected;

        HandleWallToggle(state, progress);
        HandleInteractables(state, progress);
        HandleBossSummon(state);
        ApplyPlayerSpeedBonus(state, progress);

        var mouseWorld = _cachedMouseWorld;
        _camera.Follow(_player.GlobalPosition, mouseWorld);
        _camera.Update(dt);
    }

    public void TickShared(float dt)
    {
        if (_session == null || _player == null || _camera == null) return;
        var state = _session.CurrentLevel;
        var progress = _session.Progress;
        if (state == null || progress == null) return;
        if (_weaponCatalog == null || _roomBonusCatalog == null) return;
        if (_bulletSim == null || _bulletRenderer == null) return;

        _cachedMouseWorld = _player.GetGlobalMousePosition();

        CombatSystem.Tick(_combatState, dt, progress, _weaponCatalog);

        HandleWeaponSwitch(progress);
        HandleSlotSelect(progress);
        HandleReload(progress, _weaponCatalog);

        var burstActive = false;
        var weapon = CombatSystem.GetActiveWeapon(progress, _weaponCatalog);
        if (weapon != null && weapon.IsBurst && _combatState.BurstRemaining > 0 && _combatState.BurstWeaponId == weapon.Id)
            burstActive = true;

        if ((Input.IsActionPressed("shoot") || burstActive) && _combatState.ShootCooldown <= 0f && !_combatState.IsReloading)
        {
            var mouseWorld = _cachedMouseWorld;
            var shootResult = CombatSystem.Shoot(
                _combatState, progress, _weaponCatalog, state, _roomBonusCatalog,
                _player.GlobalPosition, mouseWorld, _bulletSim, _rng);

            if (shootResult.Fired && shootResult.ShakeAmount >= GameConstants.CameraShakeMin)
            {
                _camera.Shake(shootResult.ShakeAmount * GameConstants.CameraShakeScale, shootResult.BaseAngle);
            }

            if (shootResult.Fired)
            {
                var wId = progress.WeaponSlots.Count > progress.ActiveSlot
                    ? progress.WeaponSlots[progress.ActiveSlot] : "";
                if (!string.IsNullOrEmpty(wId))
                    _audio?.Shot(wId);

                _vfx?.SpawnMuzzle(_player.GlobalPosition, shootResult.BaseAngle);
                _sheetVfx?.SpawnShootVfx(_player.GlobalPosition, shootResult.BaseAngle);
            }
        }

        System.Collections.Generic.IReadOnlyList<IDamageable> damageables = _enemyManager != null
            ? _enemyManager.GetDamageables()
            : System.Array.Empty<IDamageable>();
        _bulletSim.Update(dt, state, _roomBonusCatalog, damageables,
            _player.GlobalPosition, _player.IsDashing, OnEnemyKilled, OnStasisHit,
            OnBulletEnemyHit, OnBulletWallHit, OnBulletRangeExpired);

        if (_enemyManager != null)
        {
            ContactDamageSystem.CheckContact(_player, _enemyManager, progress, () =>
            {
                _session.SetPhase(GamePhase.Dead);
            });
        }

        var activeWeaponId = progress.WeaponSlots.Count > progress.ActiveSlot
            ? progress.WeaponSlots[progress.ActiveSlot] : null;
        _player.SetWeaponState(
            activeWeaponId, weapon,
            _combatState.WeaponShootAnim, _combatState.WeaponShootAnimMax,
            _combatState.WeaponReloadAnim, _combatState.WeaponReloadAnimMax);
    }

    private void HandleReload(PlayerProgress progress, WeaponCatalog catalog)
    {
        var rPressed = Input.IsActionPressed("reload");
        if (rPressed && !_rWasPressed)
        {
            _rWasPressed = true;
            if (!_combatState.IsReloading)
            {
                var slot = progress.ActiveSlot;
                if (slot >= 0 && slot < progress.WeaponSlots.Count)
                {
                    var wId = progress.WeaponSlots[slot];
                    if (!string.IsNullOrEmpty(wId))
                    {
                        var wDef = catalog.GetById(wId);
                        if (wDef != null && progress.Ammo[slot] < wDef.MagazineSize)
                            CombatSystem.StartReload(_combatState, progress, catalog);
                    }
                }
            }
        }
        if (!rPressed)
            _rWasPressed = false;
    }

    private void HandleWeaponSwitch(PlayerProgress progress)
    {
        var qPressed = Input.IsActionPressed("switch_weapon");
        if (qPressed && !_qWasPressed)
        {
            _qWasPressed = true;
            CombatSystem.SwitchWeapon(progress, _combatState);
        }
        if (!qPressed)
            _qWasPressed = false;
    }

    private void HandleSlotSelect(PlayerProgress progress)
    {
        var slot1 = Input.IsActionPressed("slot_1");
        if (slot1 && !_slot1WasPressed)
        {
            _slot1WasPressed = true;
            CombatSystem.SelectSlot(progress, _combatState, 0);
        }
        if (!slot1)
            _slot1WasPressed = false;

        var slot2 = Input.IsActionPressed("slot_2");
        if (slot2 && !_slot2WasPressed)
        {
            _slot2WasPressed = true;
            CombatSystem.SelectSlot(progress, _combatState, 1);
        }
        if (!slot2)
            _slot2WasPressed = false;
    }

    private void HandleInteractables(LevelState state, PlayerProgress progress)
    {
        if (_session == null || _player == null) return;
        if (_upgradeCatalog == null || _roomBonusCatalog == null || _weaponCatalog == null) return;

        if (state.PendingChoice != null && state.PendingChoice.Active)
        {
            if (_choiceOverlay != null && !_choiceOverlay.IsActive)
            {
                var pc = state.PendingChoice;
                _choiceOverlay.ShowChoices(
                    pc.Type, pc.ChoiceIds, _upgradeCatalog, _roomBonusCatalog);
            }
            return;
        }

        var fPressed = Input.IsActionPressed("interact");
        if (fPressed && !_fWasPressed)
        {
            _fWasPressed = true;
            var playerPos = _player.GlobalPosition;

            if (CollectibleSystem.HandleWeaponPickup(state, progress, _weaponCatalog, playerPos))
            {
                _audio?.WeaponCollect();
                _levelRenderer?.Refresh();
                _session?.SaveCurrentGame();
                return;
            }

            if (CollectibleSystem.CheckUpgradeChestActivation(state, progress, _upgradeCatalog, playerPos, _rng))
                return;

            if (CollectibleSystem.CheckSpatialChestActivation(state, progress, _upgradeCatalog, playerPos, _rng))
                return;

            if (CollectibleSystem.CheckRoomBonusAltarActivation(state, progress, _roomBonusCatalog, playerPos, _rng))
                return;

            foreach (var altar in state.RoomAltars)
            {
                if (altar.Activated) continue;
                if (!state.OpenCells.Contains(altar.Cell)) continue;
                if (state.CellContents.TryGetValue(altar.Cell, out var content) &&
                    content.EnemyCount > 0 && !content.EnemiesReleased)
                {
                    var altarPos = altar.Cell.ToWorldCenter(GameConstants.CellPx);
                    var dist = playerPos.DistanceTo(altarPos);
                    if (dist < GameConstants.PlayerRadius + GameConstants.PickupDistance)
                    {
                        altar.Activated = true;
                        _session.RequestBattle(altar.Cell);
                        return;
                    }
                }
            }
        }
        if (!fPressed)
            _fWasPressed = false;
    }

    private void OnChoiceSelected(string choiceId)
    {
        if (_session == null) return;
        var state = _session.CurrentLevel;
        var progress = _session.Progress;
        if (state == null || progress == null) return;
        if (_upgradeCatalog == null) return;

        var pc = state.PendingChoice;
        if (pc == null || !pc.Active) return;

        if (!string.IsNullOrEmpty(choiceId))
        {
            var idx = pc.ChoiceIds.IndexOf(choiceId);
            if (idx > 0)
            {
                pc.ChoiceIds.RemoveAt(idx);
                pc.ChoiceIds.Insert(0, choiceId);
            }
        }
        else
        {
            pc.ChoiceIds.Clear();
        }

        var battleCell = CollectibleSystem.ResolvePendingChoice(
            state, progress, _upgradeCatalog, _rng);

        _audio?.UpgradeCollect();

        _session?.SaveCurrentGame();

        if (battleCell.HasValue && _session != null)
            _session.RequestBattle(battleCell.Value);
    }

    private void HandleBossSummon(LevelState state)
    {
        if (_session == null) return;

        var spacePressed = Input.IsActionPressed("boss_summon");
        if (spacePressed && !_spaceWasPressed)
        {
            _spaceWasPressed = true;
            if (state.BossSummonReady && !state.BossDefeated)
            {
                _session.RequestBossBattle();
            }
        }
        if (!spacePressed)
            _spaceWasPressed = false;
    }

    private void ApplyPlayerSpeedBonus(LevelState state, PlayerProgress progress)
    {
        if (_player == null || _roomBonusCatalog == null) return;

        var upg = progress.Upgrades;
        var spatialSpeed = UpgradeSystem.GetSpatialBonus(upg, state, progress, SpatialAxis.Speed);
        _player.SpeedMult = upg.SpeedMult * (1f + spatialSpeed);

        var playerCell = CellCoord.FromWorld(_player.GlobalPosition.X, _player.GlobalPosition.Y, GameConstants.CellPx);
        var moveDir = _player.Velocity;
        if (moveDir.LengthSquared() > 1e-6f)
        {
            var roomMult = RoomBonusHelper.GetRoomSpeedVectorMult(state, _roomBonusCatalog, playerCell, moveDir);
            _player.SetRoomSpeedVectorMult(roomMult);
        }
        else
        {
            _player.SetRoomSpeedVectorMult(1f);
        }
    }

    private void HandleWallToggle(LevelState state, PlayerProgress progress)
    {
        if (_player == null || _camera == null || _wallCollision == null || _levelRenderer == null) return;
        if (FlyingHeart.IsActive) return;

        if (!Input.IsActionJustPressed("wall_toggle")) return;

        var mouseWorld = _player.GetGlobalMousePosition();
        var outcome = WallToggleSystem.TryToggle(state, progress, mouseWorld, _player.GlobalPosition);
        if (outcome == null) return;

        var o = outcome;

        float dist = (o.HeartTo - o.HeartFrom).Length();
        var duration = Mathf.Clamp(dist / (GameConstants.CellPx * 2.5f), 0.18f, 0.45f);

        var heart = new FlyingHeart();
        GetParent().AddChild(heart);

        _audio?.WallHit();
        _audio?.HeartTravel();
        if (o.Result == WallToggleResult.Opened)
        {
            heart.Launch(o.HeartFrom, o.HeartTo, duration, () =>
            {
                WallToggleSystem.DoOpenWall(state, o.Wall, _player.GlobalPosition);
                _wallCollision.ToggleWall(o.Wall, open: true);
                _levelRenderer.Refresh();
                _session?.SaveCurrentGame();
            });
        }
        else if (o.Result == WallToggleResult.Closed)
        {
            heart.Launch(o.HeartFrom, o.HeartTo, duration, () =>
            {
                WallToggleSystem.DoCloseWall(state, o.Wall, _player.GlobalPosition);
                progress.Lives += 1;
                state.PlayerRemovedWalls--;
                _wallCollision.ToggleWall(o.Wall, open: false);
                _levelRenderer.Refresh();
                _session?.SaveCurrentGame();
            });
        }
        else if (o.Result == WallToggleResult.AutoClosed)
        {
            if (o.AutoClosedWall != null)
            {
                _wallCollision.ToggleWall(o.AutoClosedWall.Value, open: false);
            }

            heart.Launch(o.HeartFrom, o.HeartTo, duration, () =>
            {
                WallToggleSystem.DoOpenWall(state, o.Wall, _player.GlobalPosition);
                _wallCollision.ToggleWall(o.Wall, open: true);
                _levelRenderer.Refresh();
                _session?.SaveCurrentGame();
            });
        }
    }

    private void OnBulletEnemyHit(Vector2 pos, float angle, bool isCrit, float damage)
    {
        _vfx?.SpawnHit(pos, angle, isCrit);
        _sheetVfx?.SpawnEnemyHitVfx(pos);
        _audio?.Hit();
        _damageNumbers?.SpawnNumber(pos, damage, isCrit);
    }

    private void OnBulletWallHit(Vector2 pos, float normalAngle)
    {
        _vfx?.SpawnWallHit(pos);
        _sheetVfx?.SpawnWallHitVfx(pos, normalAngle);
        _audio?.WallHit();
    }

    private void OnBulletRangeExpired(Vector2 pos)
    {
        _vfx?.SpawnWallHit(pos);
    }
}
