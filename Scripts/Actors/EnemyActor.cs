using System.Collections.Generic;
using Godot;
using SpaceOrLife.Combat;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Actors;

public partial class EnemyActor : CharacterBody2D, IDamageable, IStatusTarget
{
	[Signal] public delegate void EnemyDiedEventHandler(EnemyActor enemy);

	private CollisionShape2D? _shape;
	private EnemyBehavior? _behavior;
	private Sprite2D? _sprite;
	private float _hp;
	private float _maxHp;
	private float _radius;
	private float _visualScale;
	private EnemyKind _kind;
	private int _level;
	private int _roomIdx;
	private bool _isBoss;
	private bool _isDead;
	private bool _stasis;
	private float _stunTimer;
	private float _hitFlash;
	private float _displayedHp;
	private float _hpDamageTimer;
	private float _hpDamageStart;
	private bool _hpBarVisible;
	private float _freezeTimer;
	private float _animTimer;
	private int _animFrame;
	private string? _animState;
	private float _animTime;
	private Vector2 _velocityBeforeMove;
	private Vector2 _playerPos;
	private float _baseScale;
	public int BurnVfxId = -1;
	public int FreezeVfxId = -1;

	public EnemyKind Kind => _kind;
	public int Level => _level;
	public int RoomIdx => _roomIdx;
	public bool IsBoss => _isBoss;
	public float MaxHp => _maxHp;
	public float Hp => _hp;
	public float Radius => _radius;
	public float VisualScale => _visualScale;
	public float DrawSize => _radius * _visualScale;
	public bool IsDead => _isDead;
	public bool IsShooter => _kind == EnemyKind.Shooter || _kind == EnemyKind.Wallshooter;
	public bool Stasis
	{
		get => _stasis;
		set => _stasis = value;
	}
	public float StunTimer => _stunTimer;
	public float HitFlash => _hitFlash;
	public float FreezeTimer => _freezeTimer;
	public bool IsFrozen => _freezeTimer > 0f;
	public int AnimFrame { get => _animFrame; set => _animFrame = value; }
	public string? AnimState { get => _animState; set => _animState = value; }
	public float AnimTime { get => _animTime; set => _animTime = value; }
	public Dictionary<StatusKind, StatusEffect> Statuses { get; } = new();

	Vector2 IDamageable.Position => GlobalPosition;
	float IDamageable.Radius => _radius;
	bool IDamageable.Stasis => _stasis;
	bool IDamageable.IsBoss => _isBoss;
	void IDamageable.ApplyStun(float duration) => SetStun(duration);

	public Vector2 PlayerPos { set => _playerPos = value; }

	public void Setup(
		EnemyKind kind, float hp, float radius, float visualScale,
		int level, int roomIdx, bool isBoss, EnemyBehavior behavior)
	{
		_kind = kind;
		_hp = hp;
		_maxHp = hp;
		_radius = radius;
		_visualScale = visualScale;
		_level = level;
		_roomIdx = roomIdx;
		_isBoss = isBoss;
		_behavior = behavior;
		_displayedHp = hp;
		_hpDamageStart = hp;
	}

	public void SetBossDefinition(SpaceOrLife.Domain.BossDefinition bossDef)
	{
		if (_behavior is BossBehavior bossBehavior)
			bossBehavior.SetBossDefinition(bossDef);
	}

	public override void _Ready()
	{
		MotionMode = MotionModeEnum.Floating;
		CollisionLayer = 4u;
		CollisionMask = 1u | 2u;

		_shape = new CollisionShape2D();
		var circle = new CircleShape2D { Radius = _radius };
		_shape.Shape = circle;
		AddChild(_shape);

		_sprite = new Sprite2D();
		var tex = LoadEnemyTexture(_kind);
		if (tex != null)
		{
			_sprite.Texture = tex;
			var drawSize = _radius * _visualScale;
			var (frameW, frameH, useRegion) = GetFrameDimensions(_kind);
			if (useRegion)
			{
				_sprite.RegionEnabled = true;
				_sprite.RegionRect = new Rect2(0, 0, frameW, frameH);
			}
			var effectiveH = frameH > 0 ? frameH : tex.GetHeight();
			var s = drawSize / effectiveH;
			_baseScale = s;
			_sprite.Scale = new Vector2(s, s);
		}
		AddChild(_sprite);
	}

	public override void _PhysicsProcess(double delta)
	{
		var dt = (float)delta;

		if (_isDead)
			return;

		if (_hitFlash > 0f)
			_hitFlash -= dt;
		if (_stunTimer > 0f)
			_stunTimer -= dt;

		TickHpAnim(dt);

		if (_stasis)
		{
			Velocity = Vector2.Zero;
			QueueRedraw();
			return;
		}

		if (_freezeTimer > 0f)
		{
			_freezeTimer -= dt;
			Velocity = Vector2.Zero;
			MoveAndSlide();
			StatusSystem.UpdateStatuses(this, dt);
			QueueRedraw();
			return;
		}

		if (_behavior != null)
		{
			_behavior.UpdateBehavior(dt, this);
		}

		_velocityBeforeMove = Velocity;
		MoveAndSlide();

		if (!_stasis && !_isDead)
		{
			var speedBefore = _velocityBeforeMove.Length();
			var speedAfter = Velocity.Length();
			if (speedBefore > 1f && speedAfter < speedBefore * 0.3f)
			{
				NotifyWallHit();
			}
		}

		StatusSystem.UpdateStatuses(this, dt);

		if (_sprite != null)
		{
			if (_stasis)
			{
				_sprite.Modulate = new Color(0.3f, 0.5f, 0.9f, 0.7f);
			}
			else if (_hitFlash > 0f)
			{
				_sprite.Modulate = Colors.White;
			}
			else if (_freezeTimer > 0f)
			{
				_sprite.Modulate = new Color(0.5f, 0.8f, 1f);
			}
			else
			{
				_sprite.Modulate = Colors.White;
			}

			if (!_stasis)
				_sprite.FlipH = _playerPos.X < GlobalPosition.X;

			if (_hitFlash > 0f && _baseScale > 0f)
			{
				var punch = 1f + GameConstants.EnemyHitPunch * (_hitFlash / GameConstants.EnemyHitFlashDuration);
				_sprite.Scale = new Vector2(_baseScale * punch, _baseScale * punch);
			}
			else if (_baseScale > 0f)
			{
				_sprite.Scale = new Vector2(_baseScale, _baseScale);
			}
		}

		UpdateSpriteFrame();

		QueueRedraw();
	}

	public void SetBehaviorContext(EnemyUpdateContext ctx)
	{
		_behavior?.SetContext(ctx);
	}

	public void ActivateFromStasis()
	{
		_stasis = false;
	}

	public void SetFreeze(float duration)
	{
		_freezeTimer = Mathf.Max(_freezeTimer, duration);
	}

	public void SetStun(float duration)
	{
		_stunTimer = Mathf.Max(_stunTimer, duration);
	}

	public void TakeDamage(float damage, bool isCrit)
	{
		if (_isDead)
			return;

		_hpBarVisible = true;
		_hpDamageStart = _displayedHp;
		_hpDamageTimer = 0f;
		_hp -= damage;
		_hitFlash = GameConstants.EnemyHitFlashDuration;

		if (_hp <= 0f)
		{
			Die();
		}
	}

	public void Die()
	{
		if (_isDead)
			return;
		_isDead = true;
		EmitSignal(SignalName.EnemyDied, this);
	}

	public void NotifyWallHit()
	{
		_behavior?.OnWallHit();
	}

	public void AdvanceBatAnim(float dt)
	{
		_animTimer += dt;
		const float fps = 15f;
		if (_animTimer >= 1f / fps)
		{
			_animTimer = 0f;
			_animFrame = (_animFrame + 1) % 7;
		}
	}

	public void AdvanceGhostAnim(float dt)
	{
		if (_animState == null) return;
		_animTimer += dt;
		var fps = _animState == "death" ? 10f : 15f;
		var frameCount = _animState switch
		{
			"idle" => GhostIdleFrames.Length,
			"move" => GhostMoveFrames.Length,
			"death" => GhostDeathFrames.Length,
			_ => GhostMoveFrames.Length,
		};
		if (_animTimer >= 1f / fps)
		{
			_animTimer = 0f;
			_animFrame = (_animFrame + 1) % frameCount;
		}
	}

	public void AdvanceShooterAnim(float dt)
	{
		if (_animState == null) return;
		_animTimer += dt;
		var (fps, frameCount) = _animState switch
		{
			"run" => (3f, 3),
			"shoot" => (3f, 3),
			_ => (2f, 2),
		};
		if (_animTimer >= 1f / fps)
		{
			_animTimer = 0f;
			_animFrame = (_animFrame + 1) % frameCount;
			if (_animState == "shoot" && _animFrame == 0)
			{
				_animState = "idle";
				_animFrame = 0;
			}
		}
	}

	private void UpdateSpriteFrame()
	{
		var sprite = _sprite;
		if (sprite == null || !sprite.RegionEnabled) return;

		switch (_kind)
		{
			case EnemyKind.Bat:
				if (_hitFlash > 0f)
					sprite.RegionRect = new Rect2(7 * 64, 0, 64, 64);
				else
				{
					var f = Mathf.Min(_animFrame, 6);
					sprite.RegionRect = new Rect2(f * 64, 0, 64, 64);
				}
				break;

			case EnemyKind.Ghost:
			{
				int flatIdx;
				if (_hitFlash > 0f)
					flatIdx = GhostHitFrame;
				else
				{
					var frames = _animState switch
					{
						"idle" => GhostIdleFrames,
						"death" => GhostDeathFrames,
						_ => GhostMoveFrames,
					};
					var idx = Mathf.Min(_animFrame, frames.Length - 1);
					flatIdx = frames[idx];
				}
				var col = flatIdx % 8;
				var row = flatIdx / 8;
				sprite.RegionRect = new Rect2(col * 32, row * 32, 32, 32);
				break;
			}

			case EnemyKind.Shooter:
			{
				var row = _animState switch
				{
					"run" => 0,
					"shoot" => 2,
					_ => 1,
				};
				var maxFrames = _animState == "idle" ? 2 : 3;
				var f = Mathf.Min(_animFrame, maxFrames - 1);
				sprite.RegionRect = new Rect2(f * 500, row * 500, 500, 500);
				break;
			}

			case EnemyKind.Cocoon:
			{
				var frame = (int)Mathf.Floor(_animTime * 8f) % 7;
				if (frame < 0) frame += 7;
				sprite.RegionRect = new Rect2(frame * 500, 0, 500, 500);
				break;
			}
		}
	}

	public override void _Draw()
	{
		if (_sprite == null || _sprite.Texture == null)
		{
			var color = GetKindColor(_kind);
			var drawRadius = _radius * _visualScale * 0.5f;

			if (_stasis)
				color = new Color(0.3f, 0.5f, 0.9f, 0.7f);
			if (_hitFlash > 0f)
				color = new Color(1f, 1f, 1f);

			DrawCircle(Vector2.Zero, drawRadius, color);
			var strokeColor = _kind == EnemyKind.Wallshooter
				? new Color(0.8f, 0.27f, 0f)
				: new Color(0.1f, 0.1f, 0.1f);
			var strokeWidth = _kind == EnemyKind.Wallshooter ? 3f : 1.5f;
			DrawCircle(Vector2.Zero, drawRadius, strokeColor, filled: false, width: strokeWidth);

			if (_freezeTimer > 0f)
				DrawCircle(Vector2.Zero, drawRadius + 1f, new Color(0.5f, 0.8f, 1f, 0.3f));
		}

		if (_hpBarVisible && !_isDead && _hp < _maxHp)
		{
			var drawRadius = _radius * _visualScale * 0.5f;
			var barWidth = drawRadius * 2f;
			var barHeight = 3f;
			var barY = -drawRadius - 8f;
			var hpPct = Mathf.Max(0f, _hp / _maxHp);
			var dispPct = Mathf.Max(0f, _displayedHp / _maxHp);

			DrawRect(
				new Rect2(-barWidth * 0.5f, barY, barWidth, barHeight),
				new Color(0.2f, 0.05f, 0.05f), true);

			if (dispPct > hpPct)
			{
				DrawRect(
					new Rect2(-barWidth * 0.5f + barWidth * hpPct, barY, barWidth * (dispPct - hpPct), barHeight),
					new Color(1f, 1f, 1f), true);
			}

			DrawRect(
				new Rect2(-barWidth * 0.5f, barY, barWidth * hpPct, barHeight),
				new Color(0.8f, 0.2f, 0.2f), true);
		}
	}

	private static Texture2D? LoadEnemyTexture(EnemyKind kind)
	{
		var path = kind switch
		{
			EnemyKind.Soldier => "res://Assets/Sprites/Entities/soldier.png",
			EnemyKind.Tank => null,
			EnemyKind.Bat => "res://Assets/Sprites/Entities/Bat_NoContour.png",
			EnemyKind.Shooter => "res://Assets/Sprites/Entities/shooter_anim.png",
			EnemyKind.Wallshooter => null,
			EnemyKind.Bull => "res://Assets/Sprites/Entities/bull.png",
			EnemyKind.Buldyga => "res://Assets/Sprites/Entities/buldyga.png",
			EnemyKind.Bloated => "res://Assets/Sprites/Entities/bloated.png",
			EnemyKind.Cocoon => "res://Assets/Sprites/Entities/cocoon.png",
			EnemyKind.Ghost => "res://Assets/Sprites/Entities/ghost_spritesheet.png",
			EnemyKind.BossPhase => "res://Assets/Sprites/Entities/soldier.png",
			_ => null,
		};
		if (string.IsNullOrEmpty(path))
			return null;
		return ResourceLoader.Load<Texture2D>(path);
	}

	private static Color GetKindColor(EnemyKind kind)
	{
		return kind switch
		{
			EnemyKind.Soldier => new Color(0.7f, 0.2f, 0.2f),
			EnemyKind.Tank => new Color(1f, 0f, 0f),
			EnemyKind.Bat => new Color(0.5f, 0.2f, 0.7f),
			EnemyKind.Shooter => new Color(0.8f, 0.5f, 0.2f),
			EnemyKind.Wallshooter => new Color(1f, 0.4f, 0f),
			EnemyKind.Bull => new Color(0.5f, 0.5f, 0.5f),
			EnemyKind.Buldyga => new Color(0.2f, 0.5f, 0.2f),
			EnemyKind.Bloated => new Color(0.4f, 0.6f, 0.3f),
			EnemyKind.Cocoon => new Color(0.8f, 0.8f, 0.7f),
			EnemyKind.Ghost => new Color(0.3f, 0.8f, 0.9f, 0.5f),
			EnemyKind.BossPhase => new Color(0.6f, 0.1f, 0.1f),
			_ => new Color(0.5f, 0.5f, 0.5f),
		};
	}

	private void TickHpAnim(float dt)
	{
		if (_hpDamageTimer < GameConstants.HpBarAnimDuration)
		{
			_hpDamageTimer += dt;
			var t = Mathf.Min(1f, _hpDamageTimer / GameConstants.HpBarAnimDuration);
			_displayedHp = _hpDamageStart + (_hp - _hpDamageStart) * t;
			if (t >= 1f)
				_displayedHp = _hp;
		}
		else
		{
			_displayedHp = _hp;
		}
	}

	private static readonly int[] GhostIdleFrames = { 0, 1, 2, 3, 4, 5, 6, 7 };
	private static readonly int[] GhostMoveFrames = { 9, 10, 11, 12, 13, 14, 15, 16, 17 };
	private static readonly int[] GhostDeathFrames = { 21, 22, 23, 24, 25, 26, 27, 28 };
	private const int GhostHitFrame = 36;

	private static (int w, int h, bool region) GetFrameDimensions(EnemyKind kind)
	{
		return kind switch
		{
			EnemyKind.Bat => (64, 64, true),
			EnemyKind.Ghost => (32, 32, true),
			EnemyKind.Shooter => (500, 500, true),
			EnemyKind.Cocoon => (500, 500, true),
			_ => (0, 0, false),
		};
	}
}
