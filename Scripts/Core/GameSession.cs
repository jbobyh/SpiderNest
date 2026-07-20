using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Actors;
using SpaceOrLife.Combat;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.Presentation;
using SpaceOrLife.UI;
using SpaceOrLife.World;

namespace SpaceOrLife.Core;

public partial class GameSession : Node
{
	[Signal] public delegate void PhaseChangedEventHandler(GamePhase oldPhase, GamePhase newPhase);

	private GamePhase _phase = GamePhase.Start;
	private SaveManager? _saveManager;
	private GameCatalog? _catalog;
	private LevelRenderer? _levelRenderer;
	private LevelState? _currentLevel;
	private PlayerProgress? _progress;
	private PlayerActor? _player;
	private CameraController? _camera;
	private WallCollisionManager? _wallCollision;
	private PlayModeController? _playMode;
	private BulletSimulation? _bulletSim;
	private BulletRenderer? _bulletRenderer;
	private EnemyManager? _enemyManager;
	private TransitionManager? _transitionManager;
	private BattleModeController? _battleMode;
	private BossCatalog? _bossCatalog;
	private AudioSystem? _audio;
	private HudController? _hud;
	private ChoiceOverlay? _choiceOverlay;
	private DeathScreen? _deathScreen;
	private LevelCompleteScreen? _levelCompleteScreen;
	private DamageNumberPool? _damageNumbers;
	private VfxPool? _vfx;
	private SheetVfxPool? _sheetVfx;
	private RoomBonusVfx? _roomBonusVfx;
	private AccuracyIndicator? _accuracyIndicator;
	private TooltipController? _tooltipController;

	private CellCoord? _pendingBattleCell;
	private bool _pendingBossBattle;
	private readonly Random _cursedRng = new();
	private PlayerProgress? _levelStartProgress;

	public GamePhase Phase => _phase;
	public SaveManager SaveManager => _saveManager!;
	public GameCatalog? Catalog => _catalog;
	public LevelState? CurrentLevel => _currentLevel;
	public PlayerProgress? Progress => _progress;
	public PlayerActor? Player => _player;
	public CameraController? Camera => _camera;
	public WallCollisionManager? WallCollision => _wallCollision;

	public void RequestBattle(int cellX, int cellY)
	{
		RequestBattle(new CellCoord(cellX, cellY));
	}

	public void RequestBattle(CellCoord cell)
	{
		if (_phase != GamePhase.Play) return;
		if (_currentLevel == null || _camera == null || _transitionManager == null) return;

		_pendingBattleCell = cell;
		_pendingBossBattle = false;

		_transitionManager.StartZoomIn(_camera, _currentLevel, cell, false, OnZoomInComplete);
		SetPhase(GamePhase.ZoomIn);
	}

	public void RequestBossBattle()
	{
		if (_phase != GamePhase.Play) return;
		if (_currentLevel == null || _camera == null || _transitionManager == null) return;

		_pendingBattleCell = null;
		_pendingBossBattle = true;

		_transitionManager.StartZoomIn(_camera, _currentLevel, null, true, OnZoomInComplete);
		SetPhase(GamePhase.ZoomIn);
	}

	public void OnZoomInComplete()
	{
		if (_currentLevel == null || _player == null || _enemyManager == null) return;

		if (_pendingBossBattle)
		{
			var bossDef = _bossCatalog?.GetByLevel(_currentLevel.Level);
			if (bossDef == null)
			{
				GD.PrintErr("No boss definition for level ", _currentLevel.Level);
				SetPhase(GamePhase.Play);
				return;
			}

			var battleState = BattleSystem.CreateBossBattleState(_currentLevel, bossDef, _player.GlobalPosition);
			_currentLevel.Battle = battleState;

			var farthestCell = BattleSystem.FindFarthestCell(battleState.BattleCells, _player.GlobalPosition, GameConstants.CellPx);
			if (farthestCell.HasValue)
			{
				var bossPos = BattleSystem.CalculateBossSpawnPos(farthestCell.Value, _player.GlobalPosition, GameConstants.CellPx, 20f);
				_enemyManager.SpawnBoss(bossDef, bossPos, _currentLevel.Level);
			}

			_enemyManager.ActivateBattleCells(battleState.BattleCells);
			_levelRenderer?.Refresh();
			SetPhase(GamePhase.Battle);
		}
		else if (_pendingBattleCell.HasValue)
		{
			var battleState = BattleSystem.CreateBattleState(_currentLevel, _pendingBattleCell.Value, _player.GlobalPosition);
			_currentLevel.Battle = battleState;
			_enemyManager.ActivateBattleCells(battleState.BattleCells);
			_levelRenderer?.Refresh();
			SetPhase(GamePhase.Battle);
		}
		else
		{
			SetPhase(GamePhase.Play);
		}
	}

	public void OnBattleWon()
	{
		if (_currentLevel == null || _camera == null || _transitionManager == null || _player == null) return;

		BattleSystem.ExitBattleMode(_currentLevel);
		_levelRenderer?.Refresh();
		_wallCollision?.SyncWalls(_currentLevel);

		SaveCurrentGame();

		_transitionManager.StartZoomOut(_camera, _player.GlobalPosition, OnZoomOutComplete);
		SetPhase(GamePhase.ZoomOut);
	}

	public void OnZoomOutComplete()
	{
		SetPhase(GamePhase.Play);
	}

	private void OnBossKilled(Vector2 bossPos)
	{
		if (_currentLevel == null || _progress == null || _catalog?.Upgrades == null)
			return;

		CollectibleSystem.OpenBossCursedChoice(
			_currentLevel, _progress, _catalog.Upgrades, _cursedRng);

		SaveCurrentGame();
	}

	public override void _Ready()
	{
		_saveManager = new SaveManager();

		_catalog = GameCatalog.Load();
		var errors = CatalogValidator.Validate(_catalog);
		if (errors.Count > 0)
		{
			var errorScreen = GetNodeOrNull<ErrorScreen>("/root/Main/ErrorScreen");
			errorScreen?.ShowErrors(errors);
			GD.PushError($"Catalog validation failed with {errors.Count} errors");
			return;
		}

		var world = GetNodeOrNull<Node2D>("/root/Main/World");
		if (world != null)
		{
			_levelRenderer = new LevelRenderer();
			world.AddChild(_levelRenderer);

			_wallCollision = new WallCollisionManager();
			world.AddChild(_wallCollision);

			_player = new PlayerActor();
			world.AddChild(_player);

			_playMode = new PlayModeController();
			world.AddChild(_playMode);

			_bulletSim = new BulletSimulation();
			_bulletRenderer = new BulletRenderer();
			_bulletRenderer.SetSimulation(_bulletSim);
			world.AddChild(_bulletRenderer);

			_enemyManager = new EnemyManager();
			world.AddChild(_enemyManager);

			_transitionManager = new TransitionManager();
			world.AddChild(_transitionManager);

			_battleMode = new BattleModeController();
			world.AddChild(_battleMode);

			_damageNumbers = new DamageNumberPool();
			world.AddChild(_damageNumbers);

			_vfx = new VfxPool();
			world.AddChild(_vfx);

			_sheetVfx = new SheetVfxPool();
			world.AddChild(_sheetVfx);

			_roomBonusVfx = new RoomBonusVfx();
			world.AddChild(_roomBonusVfx);
		}

		_camera = GetNodeOrNull<CameraController>("/root/Main/World/CameraRig");
		if (_camera != null && _transitionManager != null)
			_transitionManager.Setup(_camera);

		_bossCatalog = _catalog?.Bosses;

		_audio = GetNodeOrNull<AudioSystem>("/root/Main/AudioSystem");
		_hud = GetNodeOrNull<HudController>("/root/Main/Hud/HudController");
		_choiceOverlay = GetNodeOrNull<ChoiceOverlay>("/root/Main/ChoiceOverlay");
		_deathScreen = GetNodeOrNull<DeathScreen>("/root/Main/DeathScreen");
		_levelCompleteScreen = GetNodeOrNull<LevelCompleteScreen>("/root/Main/LevelCompleteScreen");

		var hudLayer = GetNodeOrNull<CanvasLayer>("/root/Main/Hud");
		if (hudLayer != null)
		{
			_accuracyIndicator = new AccuracyIndicator();
			hudLayer.AddChild(_accuracyIndicator);

			_tooltipController = new TooltipController();
			hudLayer.AddChild(_tooltipController);
		}

		if (_audio != null)
			_audio.AmbienceStart();

		if (_accuracyIndicator != null && _camera != null)
		{
			_accuracyIndicator.Setup(
				_camera,
				() => _player?.GlobalPosition ?? Vector2.Zero,
				() => _progress,
				() => _currentLevel,
				() => _catalog?.Weapons,
				() => _playMode?.CombatState);
		}

		if (_tooltipController != null && _camera != null)
		{
			_tooltipController.Setup(
				_camera,
				() => _currentLevel,
				() => _catalog?.Weapons,
				() => _phase == GamePhase.Play);
		}

		PhaseChanged += OnPhaseChanged;

		SetPhase(GamePhase.Start);
	}

	public void GenerateLevelFromProgress()
	{
		if (_progress == null) return;
		GenerateAndRenderLevel(_progress.Level);
		SetPhase(GamePhase.Play);
	}

	public override void _ExitTree()
	{
		if (_phase == GamePhase.Play)
			SaveCurrentGame();

		PhaseChanged -= OnPhaseChanged;

		if (_enemyManager != null)
			_enemyManager.BossKilled -= OnBossKilled;

		_transitionManager?.Cancel();
		_bulletSim?.Clear();
		_enemyManager?.ClearAll();
	}

	private void OnPhaseChanged(GamePhase oldPhase, GamePhase newPhase)
	{
		if (newPhase == GamePhase.Dead)
		{
			_audio?.Death();
			_deathScreen?.ShowDeath();
		}
		else if (newPhase == GamePhase.Play && oldPhase == GamePhase.ZoomOut)
		{
			if (_currentLevel != null && _currentLevel.BossDefeated)
			{
				_levelCompleteScreen?.Show(_currentLevel.Level, _progress?.Souls ?? 0);
			}
		}
	}

	public override void _UnhandledInput(InputEvent @event)
	{
		if (@event is InputEventKey key && key.Pressed && !key.Echo)
		{
			if (key.Keycode == Key.F5)
			{
				RegenerateLevel();
			}
		}
	}

	public void SetPhase(GamePhase newPhase)
	{
		if (newPhase == _phase) return;
		var old = _phase;
		_phase = newPhase;
		if (_roomBonusVfx != null)
			_roomBonusVfx.SetActive(newPhase == GamePhase.Play);
		EmitSignal(SignalName.PhaseChanged, (int)old, (int)newPhase);
	}

	public void StartNewGame()
	{
		GD.Print("GameSession: StartNewGame");
		_progress = new PlayerProgress();
		GenerateAndRenderLevel(1);
		SetPhase(GamePhase.Play);
	}

	public void ContinueGame()
	{
		GD.Print("GameSession: ContinueGame");
		var data = _saveManager?.TryLoad();
		if (data == null)
		{
			StartNewGame();
			return;
		}

		_progress = SaveSerializer.FromDto(data.PlayerProgress);

		if (data.LevelState != null)
		{
			_currentLevel = SaveSerializer.FromDto(data.LevelState);
			RestoreLevelFromState();
		}
		else
		{
			GenerateAndRenderLevel(data.CurrentLevel);
		}

		SetPhase(GamePhase.Play);
	}

	private void GenerateAndRenderLevel(int level)
	{
		if (_catalog == null || _progress == null) return;

		TeardownLevel();

		ulong seed = (ulong)Time.GetTicksUsec();
		_currentLevel = LevelStateFactory.Create(level, _catalog, _progress, seed);
		_levelRenderer?.SetLevel(_currentLevel);

		if (_currentLevel != null)
		{
			var startPos = _currentLevel.StartCell.ToWorldCenter(GameConstants.CellPx);

			if (_player != null)
			{
				_player.GlobalPosition = startPos;
			}

			if (_camera != null)
			{
				_camera.Pan(startPos);
			}

			_wallCollision?.SyncWalls(_currentLevel);
		}

		if (_enemyManager != null && _catalog.Enemies != null && _bulletSim != null && _currentLevel != null)
		{
			_enemyManager.BossKilled -= OnBossKilled;
			_enemyManager.Setup(_catalog.Enemies, _bulletSim, _player, _bossCatalog, _progress);
			_enemyManager.SpawnFromStasis(_currentLevel);

			if (_catalog.Upgrades != null && _progress != null)
			{
				_enemyManager.BossKilled += OnBossKilled;
			}
		}

		if (_playMode != null && this != null && _player != null && _camera != null &&
			_wallCollision != null && _levelRenderer != null && _catalog != null &&
			_bulletSim != null && _bulletRenderer != null && _enemyManager != null)
		{
			_playMode.Setup(
				this, _player, _camera, _wallCollision, _levelRenderer,
				_catalog.Weapons!, _catalog.RoomBonuses!, _catalog.Upgrades!,
				_bulletSim, _bulletRenderer, _enemyManager);
		}

		if (_battleMode != null && _playMode != null && _enemyManager != null && _camera != null)
		{
			_battleMode.Setup(this, _playMode, _enemyManager, _camera);
		}

		if (_playMode != null && _audio != null && _choiceOverlay != null && _damageNumbers != null && _vfx != null && _sheetVfx != null)
		{
			_playMode.SetPresentation(_audio, _choiceOverlay, _damageNumbers, _vfx, _sheetVfx);
		}

		if (_enemyManager != null && _vfx != null)
			_enemyManager.SetVfxPool(_vfx);

		if (_enemyManager != null && _sheetVfx != null)
			_enemyManager.SetSheetVfxPool(_sheetVfx);

		if (_roomBonusVfx != null && _catalog?.RoomBonuses != null && _currentLevel != null)
		{
			_roomBonusVfx.SetState(_currentLevel, _catalog.RoomBonuses);
			_roomBonusVfx.SetActive(true);
		}

		if (_battleMode != null && _audio != null && _choiceOverlay != null)
		{
			_battleMode.SetPresentation(_audio, _choiceOverlay);
		}

		if (_audio != null)
		{
			_audio.PlayLevelMusic(level);
		}

		if (_playMode != null && _enemyManager != null)
		{
			_playMode.OnStasisHit = (target) =>
			{
				if (_phase != GamePhase.Play) return;
				var enemy = target as EnemyActor;
				if (enemy == null) return;
				var cell = CellCoord.FromWorld(enemy.GlobalPosition.X, enemy.GlobalPosition.Y, GameConstants.CellPx);
				RequestBattle(cell);
			};
			_playMode.OnEnemyKilled = null;
		}

		GD.Print($"GameSession: Generated level {level} with seed {_currentLevel?.Seed}, " +
				 $"{_currentLevel?.Rooms.Count} rooms, {_currentLevel?.TrappedSpiders.Count} stasis enemies");

		if (_progress != null)
			_levelStartProgress = CloneProgress(_progress);

		SaveCurrentGame();
	}

	private void RegenerateLevel()
	{
		GD.Print("GameSession: Full reset (F5) — starting new game");
		_deathScreen?.HideDeath();
		_levelCompleteScreen?.Hide();
		_choiceOverlay?.Cancel();
		StartNewGame();
	}

	public void SaveCurrentGame()
	{
		if (_currentLevel == null || _progress == null || _saveManager == null) return;

		var playerPos = _player?.GlobalPosition ?? Vector2.Zero;
		var data = new SaveData
		{
			Version = GameConstants.SaveVersion,
			CurrentLevel = _currentLevel.Level,
			PlayerProgress = SaveSerializer.ToDto(_progress),
			LevelState = SaveSerializer.ToDto(_currentLevel, playerPos)
		};
		_saveManager.TrySave(data);
	}

	private static PlayerProgress CloneProgress(PlayerProgress p)
	{
		return new PlayerProgress
		{
			Level = p.Level,
			Lives = p.Lives,
			TotalLives = p.TotalLives,
			Souls = p.Souls,
			WeaponSlots = new List<string>(p.WeaponSlots),
			ActiveSlot = p.ActiveSlot,
			MaxSlots = p.MaxSlots,
			Ammo = new List<int>(p.Ammo),
			SpawnedWeapons = new List<string>(p.SpawnedWeapons),
			UpgradeLevels = new Dictionary<string, int>(p.UpgradeLevels),
			Upgrades = CloneUpgrades(p.Upgrades),
			BossDefeated = p.BossDefeated
		};
	}

	private static UpgradeState CloneUpgrades(UpgradeState u)
	{
		return new UpgradeState
		{
			DamageMult = u.DamageMult,
			CooldownMult = u.CooldownMult,
			SpeedMult = u.SpeedMult,
			SpreadMult = u.SpreadMult,
			BulletSpeedMult = u.BulletSpeedMult,
			CritChance = u.CritChance,
			CritDamage = u.CritDamage,
			BloomReduction = u.BloomReduction,
			ExtraBulletChance = u.ExtraBulletChance,
			HitStun = u.HitStun,
			IncendiaryChance = u.IncendiaryChance,
			FreezeChance = u.FreezeChance,
			Penetrate = u.Penetrate,
			Shield = u.Shield,
			Retreat = u.Retreat,
			KillAccel = u.KillAccel,
			KillAccelPercent = u.KillAccelPercent,
			EnhancedPierce = u.EnhancedPierce,
			InfinitePenetrate = u.InfinitePenetrate,
			InfiniteRange = u.InfiniteRange,
			Ricochet = u.Ricochet,
			LastLife = u.LastLife,
			BattleSpeed = u.BattleSpeed,
			Freeze = u.Freeze,
			RandomBonus = u.RandomBonus,
			LongRange = u.LongRange,
			Sniper = u.Sniper,
			SpatialReloadRooms = u.SpatialReloadRooms,
			SpatialReloadHearts = u.SpatialReloadHearts,
			SpatialRangeRooms = u.SpatialRangeRooms,
			SpatialRangeHearts = u.SpatialRangeHearts,
			SpatialAccuracyRooms = u.SpatialAccuracyRooms,
			SpatialAccuracyHearts = u.SpatialAccuracyHearts,
			SpatialBulletSpeedRooms = u.SpatialBulletSpeedRooms,
			SpatialBulletSpeedHearts = u.SpatialBulletSpeedHearts,
			SpatialSpeedRooms = u.SpatialSpeedRooms,
			SpatialSpeedHearts = u.SpatialSpeedHearts,
			SpatialCritChanceRooms = u.SpatialCritChanceRooms,
			SpatialCritChanceHearts = u.SpatialCritChanceHearts,
			SpatialCritDamageRooms = u.SpatialCritDamageRooms,
			SpatialCritDamageHearts = u.SpatialCritDamageHearts,
			SpatialPenetrateRooms = u.SpatialPenetrateRooms,
			SpatialPenetrateHearts = u.SpatialPenetrateHearts
		};
	}

	private void TeardownLevel()
	{
		_enemyManager?.ClearAll();
		_bulletSim?.Clear();
		_transitionManager?.Cancel();
	}

	private void RestoreLevelFromState()
	{
		if (_currentLevel == null) return;

		TeardownLevel();

		_levelRenderer?.SetLevel(_currentLevel);

		var playerPos = new Vector2(
			_currentLevel.StartCell.X * GameConstants.CellPx + GameConstants.CellPx * 0.5f,
			_currentLevel.StartCell.Y * GameConstants.CellPx + GameConstants.CellPx * 0.5f);

		if (_player != null)
			_player.GlobalPosition = playerPos;

		if (_camera != null)
			_camera.Pan(playerPos);

		_wallCollision?.SyncWalls(_currentLevel);

		if (_enemyManager != null && _catalog?.Enemies != null && _bulletSim != null)
		{
			_enemyManager.BossKilled -= OnBossKilled;
			_enemyManager.Setup(_catalog.Enemies, _bulletSim, _player, _bossCatalog, _progress);
			_enemyManager.SpawnFromStasis(_currentLevel);

			if (_catalog?.Upgrades != null && _progress != null)
				_enemyManager.BossKilled += OnBossKilled;
		}

		if (_playMode != null && _player != null && _camera != null &&
			_wallCollision != null && _levelRenderer != null && _catalog != null &&
			_bulletSim != null && _bulletRenderer != null && _enemyManager != null)
		{
			_playMode.Setup(
				this, _player, _camera, _wallCollision, _levelRenderer,
				_catalog.Weapons!, _catalog.RoomBonuses!, _catalog.Upgrades!,
				_bulletSim, _bulletRenderer, _enemyManager);
		}

		if (_battleMode != null && _playMode != null && _enemyManager != null && _camera != null)
		{
			_battleMode.Setup(this, _playMode, _enemyManager, _camera);
		}

		if (_playMode != null && _audio != null && _choiceOverlay != null && _damageNumbers != null && _vfx != null && _sheetVfx != null)
		{
			_playMode.SetPresentation(_audio, _choiceOverlay, _damageNumbers, _vfx, _sheetVfx);
		}

		if (_enemyManager != null && _vfx != null)
			_enemyManager.SetVfxPool(_vfx);

		if (_enemyManager != null && _sheetVfx != null)
			_enemyManager.SetSheetVfxPool(_sheetVfx);

		if (_roomBonusVfx != null && _catalog?.RoomBonuses != null && _currentLevel != null)
		{
			_roomBonusVfx.SetState(_currentLevel, _catalog.RoomBonuses);
			_roomBonusVfx.SetActive(true);
		}

		if (_battleMode != null && _audio != null && _choiceOverlay != null)
		{
			_battleMode.SetPresentation(_audio, _choiceOverlay);
		}

		if (_audio != null && _currentLevel != null)
			_audio.PlayLevelMusic(_currentLevel.Level);

		if (_playMode != null)
		{
			_playMode.OnStasisHit = (target) =>
			{
				if (_phase != GamePhase.Play) return;
				var enemy = target as EnemyActor;
				if (enemy == null) return;
				var cell = CellCoord.FromWorld(enemy.GlobalPosition.X, enemy.GlobalPosition.Y, GameConstants.CellPx);
				RequestBattle(cell);
			};
			_playMode.OnEnemyKilled = null;
		}

		if (_progress != null)
			_levelStartProgress = CloneProgress(_progress);
	}

	public void RestartLevel()
	{
		GD.Print("GameSession: RestartLevel");
		if (_levelStartProgress == null || _currentLevel == null)
		{
			StartNewGame();
			return;
		}

		_progress = CloneProgress(_levelStartProgress);
		_progress.Lives = Math.Max(1, _progress.Lives);
		GenerateAndRenderLevel(_currentLevel.Level);
		SetPhase(GamePhase.Play);
	}

	public void AdvanceLevel()
	{
		GD.Print("GameSession: AdvanceLevel");
		if (_progress == null || _currentLevel == null) return;

		_progress.Lives = _progress.Lives + _currentLevel.PlayerRemovedWalls;
		_progress.TotalLives = _progress.Lives;
		_progress.Level = Math.Min(_currentLevel.Level + 1, 3);

		var progressOnly = new SaveData
		{
			Version = GameConstants.SaveVersion,
			CurrentLevel = _progress.Level,
			PlayerProgress = SaveSerializer.ToDto(_progress),
			LevelState = null
		};
		_saveManager?.TrySave(progressOnly);

		GenerateAndRenderLevel(_progress.Level);
		SetPhase(GamePhase.Play);
	}
}
