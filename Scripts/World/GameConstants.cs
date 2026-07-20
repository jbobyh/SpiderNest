using System;

namespace SpaceOrLife.World;

public static class GameConstants
{
	public const float CellPx = 126f;
	public const int GridSize = 9;
	public const int ViewWidth = 1024;
	public const int ViewHeight = 576;
	public const int FloorTilesPerCell = 5;
	public const float FloorTilePx = CellPx / FloorTilesPerCell;
	public const int FlowSub = 5;
	public const float FlowSubPx = CellPx / FlowSub;
	public const float BattleScale = 1f;
	public const float BattleZoomMult = 1f;

	public const int InitialLives = 3;
	public const int LivesPerHeart = 1;
	public const int MaxLives = 5;
	public const float PlayerSpeed = 2.2f * 40f;
	public const float PlayerRadius = 5f;
	public const float PlayerSpriteRadius = 14f;
	public const float PlayerLegsWalkFps = 12f;
	public const float PlayerInvulnerableTime = 1.0f;

	public const float FacingSouthShrink = 0.15f;
	public const float ArmUpperW = 15f * 0.25f;
	public const float ArmForearmW = 19f * 0.25f;
	public const float ArmSpriteScale = 0.42f;
	public const float ArmUpperPivot = 0.8f;
	public const float ArmForearmPivot = 0.8f;
	public const float ArmSouthUpperPivot = 0.2f;
	public const float ArmSouthForearmPivot = 0.2f;

	public const float PlayerDashSpeed = 8.0f * 40f;
	public const float PlayerDashDistance = 1.1f * 40f;
	public const float PlayerDashCooldown = 2.0f;
	public const float PlayerDashWallStopFraction = 0.3f;

	public const float BulletRadius = 3f;
	public const float BulletLife = 1.5f;
	public const float MaxSpreadRad = MathF.PI / 3f;
	public const float BulletTrailInterval = 0.01f;
	public const float BulletTrailLife = 0.06f;
	public const float RangeScale = CellPx / 10f;
	public const float ShootVfxOffsetMult = 0.9f;
	public const float EnemyHitFlashDuration = 0.08f;
	public const float EnemyBulletTime = 6f;
	public const float EnemySpeedScale = 40f;

	public const float WallSnapRadius = 0.30f;
	public const float WallHalfThickness = 0.025f;
	public const float WallPad = 0.125f;

	public const float CameraDamping = 2.0f;
	public const float CameraCursorWeight = 0.3f;
	public const float CameraMaxOffset = 160f;
	public const float CameraPlayZoom = 1.5f;
	public const float CameraPlayZoomMin = 0.5f;
	public const float CameraPlayZoomMax = 5.5f;
	public const float CameraPlayZoomStep = 0.15f;
	public const float CameraShakeDecay = 0.9f;
	public const float CameraShakeMin = 0.01f;
	public const float CameraShakeScale = 5f;

	public const float ZoomDuration = 0.55f;
	public const float BossStrafeSwitchTime = 1.2f;
	public const float PickupDistance = 10f;
	public const float WeaponPickupDistance = 24f;

	public const int SaveVersion = 1;
	public const string SavePath = "user://save.json";
	public const string SaveTempPath = "user://save.tmp";

	public const int ParticlePoolMaxSize = 200;

	public const float EnemyHitPunch = 0.15f;
	public const float HpBarAnimDuration = 1.0f;

	public const int ShootVfxFrameSize = 64;
	public const int ShootVfxFrameCount = 9;
	public const float ShootVfxFps = 35f;
	public const float ShootVfxSizeMult = 1.5f;
	public const float ShootVfxRotationOffset = MathF.PI / 4f;

	public const int WallHitVfxFrameSize = 64;
	public const int WallHitVfxFrameCount = 10;
	public const float WallHitVfxFps = 60f;
	public const float WallHitVfxSizeMult = 0.20f;
	public const float WallHitVfxNormalOffset = 0.2f;

	public const int EnemyHitVfxFrameSize = 64;
	public const int EnemyHitVfxFrameCount = 8;
	public const float EnemyHitVfxFps = 45f;
	public const float EnemyHitVfxSizeMult = 0.4f;

	public const int BurnVfxFrameSize = 64;
	public const int BurnVfxFrameCount = 16;
	public const float BurnVfxFps = 48f;

	public const int FreezeVfxFrameSize = 64;
	public const int FreezeVfxFrameCount = 12;
	public const float FreezeVfxFps = 48f;
	public const int FreezeVfxRow = 2;

	public const float AccuracyIndicatorLineLength = 12f;
	public const float AccuracyIndicatorLineWidth = 2f;
	public const float AccuracyIndicatorAlpha = 0.7f;
	public const float AccuracyIndicatorMinSpread = 0.001f;
	public const float AccuracyIndicatorBendLength = 3f;

	public static readonly ParticleConfig MuzzleConfig = new(8, 0.5f, 150f, 350f, 0.15f);
	public static readonly ParticleConfig HitConfig = new(8, 0.6f, 40f, 80f, 0.25f, CritCount: 14, Color: 0xe44101);
	public static readonly ParticleConfig DeathConfig = new(14, MathF.PI * 2f, 40f, 80f, 0.3f);
	public static readonly ParticleConfig WallHitConfig = new(3, MathF.PI * 2f, 80f, 80f, 0.1f);
	public static readonly ParticleConfig PickupConfig = new(12, MathF.PI * 2f, 80f, 80f, 0.6f);
}

public readonly record struct ParticleConfig(
	int Count,
	float Spread,
	float SpeedMin,
	float SpeedMax,
	float Life,
	int CritCount = -1,
	uint Color = 0xffffff);
