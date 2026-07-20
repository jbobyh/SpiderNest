using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.Core.Catalogs;

public static class FallbackCatalogs
{
    public static WeaponCatalog BuildWeapons()
    {
        var cat = new WeaponCatalog();
        cat.Weapons.Add(MakeWeapon("pistol", "ПИСТОЛЕТ", "Обычный пистолет", "#00d4ff",
            damage: 20, cooldown: 0.2f, reloadTime: 1.5f, bulletSpeed: 400, range: 13,
            pellets: 1, penetrate: 0, magazineSize: 12, spread: 0.05f, maxSpread: 0.8f,
            bloomPerShot: 0.08f, bloomRecoveryTime: 0.4f, shakeAmount: 0,
            spriteAngle: 0.1f, spriteScale: 0.5f, spriteOffset: 0.4f, spritePivotY: -2,
            spriteWidth: 64, reloadSpriteWidth: 64, reloadAnchorX: 0.58f, reloadAnchorY: 0.36f,
            gripLeft: new Vector2(-23, 7), gripRight: new Vector2(-23, 7),
            shootAnimRatio: 0.3f, reloadAnimRatio: 1.0f));

        cat.Weapons.Add(MakeWeapon("shotgun", "ДРОБОВИК", "Стреляет дробью.", "#ffaa00",
            damage: 20, cooldown: 0.3f, reloadTime: 2, bulletSpeed: 440, range: 10,
            pellets: 3, penetrate: 0, magazineSize: 6, spread: 0.20f, maxSpread: 1,
            bloomPerShot: 0.35f, bloomRecoveryTime: 0.5f, shakeAmount: 0.5f,
            spriteAngle: 0.55f, spriteScale: 0.3f, spriteOffset: 0.3f, spritePivotY: 0,
            gripLeft: new Vector2(-12, 1), gripRight: new Vector2(4, 0)));

        cat.Weapons.Add(MakeWeapon("smg", "ПП", "Высокая скорострельность.", "#ff44ff",
            damage: 8, cooldown: 0.12f, reloadTime: 2, bulletSpeed: 500, range: 18,
            pellets: 1, penetrate: 0, magazineSize: 30, spread: 0.05f, maxSpread: 1,
            bloomPerShot: 0.06f, bloomRecoveryTime: 0.4f, shakeAmount: 0,
            spriteAngle: 0f, spriteScale: 0.6f, spriteOffset: 0.25f, spritePivotY: -2,
            spriteWidth: 80, reloadSpriteWidth: 80, reloadAnchorX: 0.5f, reloadAnchorY: 0.47f,
            gripLeft: new Vector2(-6, -5), gripRight: new Vector2(-18, -3),
            shootAnimRatio: 1.0f, reloadAnimRatio: 1.0f));

        cat.Weapons.Add(MakeWeapon("rifle", "ВИНТОВКА", "Высокая точность и урон. Пробивает 2 врагов.", "#44ff44",
            damage: 60, cooldown: 1.0f, reloadTime: 2.6f, bulletSpeed: 700, range: 40,
            pellets: 1, penetrate: 2, magazineSize: 5, spread: 0.02f, maxSpread: 1,
            bloomPerShot: 0.25f, bloomRecoveryTime: 0.4f, shakeAmount: 0.8f,
            spriteAngle: 0.05f, spriteScale: 0.8f, spriteOffset: 0.3f, spritePivotY: 0,
            spriteWidth: 160, reloadSpriteWidth: 160, reloadAnchorX: 0.63f, reloadAnchorY: 0.5f,
            gripLeft: new Vector2(-10, 1), gripRight: new Vector2(-20, 3),
            shootAnimRatio: 1.0f, reloadAnimRatio: 1.0f));

        cat.Weapons.Add(MakeWeapon("revolver", "РЕВОЛЬВЕР", "Высокая точность. Пробивает 1 врага.", "#8b4513",
            damage: 40, cooldown: 0.6f, reloadTime: 2, bulletSpeed: 500, range: 20,
            pellets: 1, penetrate: 1, magazineSize: 6, spread: 0.03f, maxSpread: 1,
            bloomPerShot: 0.15f, bloomRecoveryTime: 0.4f, shakeAmount: 0.2f,
            spriteAngle: 0f, spriteScale: 0.3f, spriteOffset: 0.3f, spritePivotY: 0,
            gripLeft: new Vector2(-10, 1), gripRight: new Vector2(4, 0)));

        cat.Weapons.Add(MakeWeapon("carbine", "КАРАБИН", "Очередь из 3 пуль.", "#556b2f",
            damage: 20, cooldown: 0.8f, reloadTime: 2, bulletSpeed: 450, range: 25,
            pellets: 1, penetrate: 0, magazineSize: 15, spread: 0.05f, maxSpread: 1,
            bloomPerShot: 0.08f, bloomRecoveryTime: 0.3f, shakeAmount: 0.3f,
            spriteAngle: 0f, spriteScale: 0.8f, spriteOffset: 0.3f, spritePivotY: 0,
            spriteWidth: 128, reloadSpriteWidth: 128, reloadAnchorX: 0.67f, reloadAnchorY: 0.38f,
            gripLeft: new Vector2(-9, 1), gripRight: new Vector2(-18, 3),
            burstSize: 3, burstDuration: 0.2f,
            shootAnimRatio: 0.15f, reloadAnimRatio: 1.0f));

        return cat;
    }

    private static WeaponDefinition MakeWeapon(
        string id, string label, string desc, string colorHex,
        float damage, float cooldown, float reloadTime, float bulletSpeed, float range,
        int pellets, int penetrate, int magazineSize, float spread, float maxSpread,
        float bloomPerShot, float bloomRecoveryTime, float shakeAmount,
        float spriteAngle, float spriteScale, float spriteOffset, float spritePivotY,
        int spriteWidth = 64, int reloadSpriteWidth = 64,
        float reloadAnchorX = 0.5f, float reloadAnchorY = 0.5f,
        Vector2? gripLeft = null, Vector2? gripRight = null,
        float flipThreshold = 0.10f, int burstSize = 1, float burstDuration = 0f,
        float shootAnimRatio = 0.3f, float reloadAnimRatio = 1.0f)
    {
        return new WeaponDefinition
        {
            Id = id, Label = label, Description = desc,
            Color = Color.FromHtml(colorHex),
            Damage = damage, Cooldown = cooldown, ReloadTime = reloadTime,
            BulletSpeed = bulletSpeed, Range = range,
            Pellets = pellets, Penetrate = penetrate, MagazineSize = magazineSize,
            Spread = spread, MaxSpread = maxSpread,
            BloomPerShot = bloomPerShot, BloomRecoveryTime = bloomRecoveryTime,
            ShakeAmount = shakeAmount,
            SpriteAngle = spriteAngle, SpriteScale = spriteScale,
            SpriteOffset = spriteOffset, SpritePivotY = spritePivotY,
            SpriteWidth = spriteWidth, ReloadSpriteWidth = reloadSpriteWidth,
            ReloadAnchorX = reloadAnchorX, ReloadAnchorY = reloadAnchorY,
            GripLeft = gripLeft ?? Vector2.Zero, GripRight = gripRight ?? Vector2.Zero,
            FlipThreshold = flipThreshold,
            BurstSize = burstSize, BurstDuration = burstDuration,
            ShootAnimRatio = shootAnimRatio, ReloadAnimRatio = reloadAnimRatio
        };
    }

    public static EnemyCatalog BuildEnemies()
    {
        var cat = new EnemyCatalog();

        cat.Enemies.Add(MakeEnemy(EnemyKind.Soldier, "soldier", hp: 120, speed: 1, radius: 7, visualScale: 2.9f, cost: 30,
            wobbleMin: 0.2f, wobbleMax: 0.3f, spawnMargin: 10));

        cat.Enemies.Add(MakeEnemy(EnemyKind.Bat, "bat", hp: 120, speed: 1, radius: 7, visualScale: 3.9f, cost: 30,
            animFps: 15, zigzagFreq: 4, zigzagAmp: 0.8f));

        cat.Enemies.Add(MakeEnemy(EnemyKind.Shooter, "shooter", hp: 80, speed: 1, radius: 6, visualScale: 2.5f, cost: 25,
            bulletSpeed: 100, shootRangeCells: 2, shootCd: 1.5f, stopDistCells: 2));

        cat.Enemies.Add(MakeEnemy(EnemyKind.Bull, "bull", hp: 160, speed: 1, radius: 6, visualScale: 3.2f, cost: 40,
            prepareTime: 1, restTime: 1.5f, chargeDistCells: 0.75f, dashDistCells: 0.02f));

        cat.Enemies.Add(MakeEnemy(EnemyKind.Buldyga, "buldyga", hp: 200, speed: 1, radius: 6, visualScale: 4.0f, cost: 50,
            accel: 40, friction: 3.5f, speedIncrement: 0.1f));

        cat.Enemies.Add(MakeEnemy(EnemyKind.Cocoon, "cocoon", hp: 400, speed: 0, radius: 10, visualScale: 3.2f, cost: 110,
            spawnInterval: 3.0f));

        cat.Enemies.Add(MakeEnemy(EnemyKind.Bloated, "bloated", hp: 120, speed: 1, radius: 7, visualScale: 3.2f, cost: 40,
            deathShotSpeed: 120));

        cat.Enemies.Add(MakeEnemy(EnemyKind.Tank, "tank", hp: 400, speed: 0.7f, radius: 14, visualScale: 2, cost: 80));

        cat.Enemies.Add(MakeEnemy(EnemyKind.Wallshooter, "wallshooter", hp: 40, speed: 1, radius: 8, visualScale: 2.5f, cost: 40,
            bulletSpeed: 50, shootRangeCells: 1.5f, shootCd: 3.0f, stopDistCells: 1.4f,
            wallBulletCount: 5, wallBulletSpacing: 8));

        cat.Enemies.Add(MakeEnemy(EnemyKind.Ghost, "ghost", hp: 40, speed: 1.2f, radius: 6, visualScale: 3.0f, cost: 20));

        return cat;
    }

    private static EnemyDefinition MakeEnemy(EnemyKind kind, string id, float hp, float speed, float radius,
        float visualScale, int cost, float wobbleMin = 0, float wobbleMax = 0, float spawnMargin = 10,
        float animFps = 0, float zigzagFreq = 0, float zigzagAmp = 0,
        float bulletSpeed = 0, float shootRangeCells = 0, float shootCd = 0, float stopDistCells = 0,
        float prepareTime = 0, float restTime = 0, float chargeDistCells = 0, float dashDistCells = 0,
        float accel = 0, float friction = 0, float speedIncrement = 0,
        float spawnInterval = 0, float deathShotSpeed = 0,
        int wallBulletCount = 0, float wallBulletSpacing = 0)
    {
        return new EnemyDefinition
        {
            Kind = kind, Id = id, Hp = hp, Speed = speed, Radius = radius,
            VisualScale = visualScale, Cost = cost,
            WobbleMin = wobbleMin, WobbleMax = wobbleMax, SpawnMargin = spawnMargin,
            AnimFps = animFps, ZigzagFreq = zigzagFreq, ZigzagAmp = zigzagAmp,
            BulletSpeed = bulletSpeed, ShootRangeCells = shootRangeCells, ShootCd = shootCd, StopDistCells = stopDistCells,
            PrepareTime = prepareTime, RestTime = restTime, ChargeDistCells = chargeDistCells, DashDistCells = dashDistCells,
            Accel = accel, Friction = friction, SpeedIncrement = speedIncrement,
            SpawnInterval = spawnInterval, DeathShotSpeed = deathShotSpeed,
            WallBulletCount = wallBulletCount, WallBulletSpacing = wallBulletSpacing
        };
    }

    public static BossCatalog BuildBosses()
    {
        var cat = new BossCatalog();

        var boss1 = new BossDefinition
        {
            Level = 1, Id = "boss_1", Name = "БОСС",
            HpSource = BossHpSource.Soldier, HpMult = 30,
            RadiusMult = 2.25f, SpeedMult = 1.1f, VisualScale = 4.0f
        };
        boss1.Phases.Add(new BossPhase { Id = BossPhaseId.Soldier, Duration = 5 });
        boss1.Phases.Add(new BossPhase { Id = BossPhaseId.Shooter, Duration = 5 });
        cat.Bosses.Add(boss1);

        var boss2 = new BossDefinition
        {
            Level = 2, Id = "boss_2", Name = "БОСС",
            HpSource = BossHpSource.Buldyga, HpMult = 40,
            RadiusMult = 2.5f, SpeedMult = 1.0f, VisualScale = 4.0f
        };
        boss2.Phases.Add(new BossPhase { Id = BossPhaseId.Buldyga, Duration = 6, AccelMult = 40, FrictionMult = 3.5f });
        boss2.Phases.Add(new BossPhase { Id = BossPhaseId.Shooter, Duration = 5, ShootCdMult = 0.4f, BulletSpeedMult = 0.8f });
        cat.Bosses.Add(boss2);

        var boss3 = new BossDefinition
        {
            Level = 3, Id = "boss_3", Name = "БОСС",
            HpSource = BossHpSource.Fixed, HpMult = 1, HpFixed = 3000,
            RadiusMult = 2.5f, SpeedMult = 1.0f, VisualScale = 4.0f
        };
        boss3.Phases.Add(new BossPhase { Id = BossPhaseId.Buldyga, Duration = 10, AccelMult = 2, FrictionMult = 0.6f });
        boss3.Phases.Add(new BossPhase { Id = BossPhaseId.Pause, Duration = 1 });
        boss3.Phases.Add(new BossPhase { Id = BossPhaseId.Shooter, Duration = 6, ShootCdMult = 0.4f, BulletSpeedMult = 1.8f });
        boss3.Phases.Add(new BossPhase { Id = BossPhaseId.Pause, Duration = 1 });
        boss3.Phases.Add(new BossPhase { Id = BossPhaseId.BullLimited, MaxDashes = 3, DashCells = 5, DashSpeedMult = 1.5f });
        boss3.Phases.Add(new BossPhase { Id = BossPhaseId.Pause, Duration = 1 });
        cat.Bosses.Add(boss3);

        return cat;
    }

    public static LevelCatalog BuildLevels()
    {
        var cat = new LevelCatalog();

        var level1 = new LevelDefinition
        {
            Level = 1, GenType = GenerationType.Grid, RoomCount = 25,
            Size4 = 1, Size3 = 2, Size2 = 3,
            Weapons = 1, Upgrades = 4, Cursed = 1, Bonuses = 3, Hearts = 1,
            EnemyRoomPercent = 0.4f
        };
        AddSpawnTable(level1, (EnemyKind.Bat, 5), (EnemyKind.Shooter, 2), (EnemyKind.Bloated, 1),
            (EnemyKind.Tank, 1), (EnemyKind.Wallshooter, 1), (EnemyKind.Ghost, 2));
        cat.Levels.Add(level1);

        var level2 = new LevelDefinition
        {
            Level = 2, GenType = GenerationType.Random, RoomCount = 25,
            Size4 = 1, Size3 = 2, Size2 = 3,
            Weapons = 2, Upgrades = 10, Cursed = 1, Bonuses = 3, Hearts = 2,
            EnemyRoomPercent = 0.5f
        };
        AddSpawnTable(level2, (EnemyKind.Soldier, 5), (EnemyKind.Shooter, 2), (EnemyKind.Bull, 2),
            (EnemyKind.Buldyga, 1), (EnemyKind.Bloated, 1), (EnemyKind.Tank, 1),
            (EnemyKind.Wallshooter, 2), (EnemyKind.Ghost, 2));
        cat.Levels.Add(level2);

        var level3 = new LevelDefinition
        {
            Level = 3, GenType = GenerationType.Random, RoomCount = 25,
            Size4 = 1, Size3 = 2, Size2 = 3,
            Weapons = 2, Upgrades = 16, Cursed = 1, Bonuses = 3, Hearts = 3,
            EnemyRoomPercent = 0.6f
        };
        AddSpawnTable(level3, (EnemyKind.Soldier, 4), (EnemyKind.Shooter, 2), (EnemyKind.Bull, 2),
            (EnemyKind.Buldyga, 1), (EnemyKind.Bloated, 1), (EnemyKind.Cocoon, 1),
            (EnemyKind.Tank, 1), (EnemyKind.Wallshooter, 2), (EnemyKind.Ghost, 2));
        cat.Levels.Add(level3);

        return cat;
    }

    private static void AddSpawnTable(LevelDefinition def, params (EnemyKind, int)[] entries)
    {
        foreach (var (kind, weight) in entries)
        {
            def.SpawnKinds.Add(kind);
            def.SpawnWeights.Add(weight);
        }
    }

    public static UpgradeCatalog BuildUpgrades()
    {
        var cat = new UpgradeCatalog();

        cat.Regular.Add(MakeUpgrade("extraBulletChance", UpgradeCategory.Regular, "+5% доп пуля",
            "5% шанс выпустить дополнительную пулю при выстреле", "#ffaa44", "✨", 3,
            effects: new() { { "extraBulletChance", 0.05f } }));

        cat.Regular.Add(MakeUpgrade("damage", UpgradeCategory.Regular, "+20% урона от пули",
            "Каждая пуля наносит на 20% урона больше", "#ff4444", "💥", 5,
            effects: new() { { "damageMult", 0.20f } }));

        cat.Regular.Add(MakeUpgrade("penetrate", UpgradeCategory.Regular, "+1 пробитие врага",
            "Пуля пролетает сквозь одного дополнительного врага", "#ff44ff", "🎯", 2,
            effects: new() { { "penetrate", 1 } }));

        cat.Regular.Add(MakeUpgrade("bulletSpeed", UpgradeCategory.Regular, "+30% скорость пули",
            "Пули летят быстрее на +30%", "#ffff44", "⚡", 2,
            effects: new() { { "bulletSpeedMult", 0.30f } }));

        cat.Regular.Add(MakeUpgrade("critChance", UpgradeCategory.Regular, "+5% шанс крита",
            "+5% шанс нанести двойной урон", "#ff0000", "⚔️", 3,
            effects: new() { { "critChance", 0.05f } }));

        cat.Regular.Add(MakeUpgrade("critDamage", UpgradeCategory.Regular, "+10% крит урон",
            "Увеличивает множитель критического урона на 10%", "#ff4400", "🔥", 50,
            effects: new() { { "critDamage", 0.10f } }));

        cat.Regular.Add(MakeUpgrade("killAccel", UpgradeCategory.Regular, "Убийственный разгон",
            "Каждое убийство ускоряет перезарядку на 0.1%", "#ff8800", "🏃", 1,
            effects: new() { { "killAccel", true } }));

        cat.Regular.Add(MakeUpgrade("enhancedPierce", UpgradeCategory.Regular, "Усиленное пробитие",
            "Пуля, пробившая врага, имеет шанс 50% нанести удвоенный урон", "#aa44ff", "🗡️", 1,
            effects: new() { { "enhancedPierce", true } }));

        cat.Regular.Add(MakeUpgrade("shield", UpgradeCategory.Regular, "Щит",
            "Поглощает один удар без потери жизни. Тратится.", "#00aaff", "🛡️", 2,
            effects: new() { { "shield", 1 } }));

        cat.Regular.Add(MakeUpgrade("retreat", UpgradeCategory.Regular, "Отступление",
            "После получения урона получи неуязвимость на 1.5 секунды", "#00ffaa", "🏃‍♂️", 2,
            effects: new() { { "retreat", 1 } }));

        cat.Regular.Add(MakeUpgrade("cooldown", UpgradeCategory.Regular, "Перезарядка -10%",
            "Уменьшает время между выстрелами на 10%", "#00ccff", "⏱️", 5,
            effects: new() { { "cooldownMult", -0.10f } }));

        cat.Regular.Add(MakeUpgrade("speed", UpgradeCategory.Regular, "Скорость бега +10%",
            "Увеличивает скорость передвижения на 10%", "#44ff88", "💨", 3,
            effects: new() { { "speedMult", 0.10f } }));

        cat.Regular.Add(MakeUpgrade("hitStun", UpgradeCategory.Regular, "Стан при попадании",
            "Враги застывают на 0.05с при попадании.", "#88ddff", "⏳", 5,
            effects: new() { { "hitStun", 0.05f } }));

        cat.Regular.Add(MakeUpgrade("incendiary", UpgradeCategory.Regular, "+5% поджигающая пуля",
            "5% шанс что пуля подожжёт врага. Горение наносит урон каждые 0.2с в течение 2с.", "#ff6600", "🔥", 3,
            effects: new() { { "incendiaryChance", 0.05f } }));

        cat.Regular.Add(MakeUpgrade("freezeBullet", UpgradeCategory.Regular, "+5% охлаждающая пуля",
            "5% шанс заморозить врага. Замедление в 2 раза на 2с.", "#44ddff", "❄️", 3,
            effects: new() { { "freezeChance", 0.05f } }));

        cat.Regular.Add(MakeUpgrade("bloomReduction", UpgradeCategory.Regular, "-5% отдачи",
            "Уменьшает отдачу оружия на 5%", "#88ff88", "🎯", 20,
            effects: new() { { "bloomReduction", 0.05f } }));

        cat.Cursed.Add(MakeUpgrade("infinitePenetrate", UpgradeCategory.Cursed, "Бесконечное пробитие",
            "Пули пробивают всех врагов насквозь, но -20% скорости перезарядки", "#7fff44", "🔮", 1,
            effects: new() { { "infinitePenetrate", true }, { "cooldownMult", 0.20f } }));

        cat.Cursed.Add(MakeUpgrade("infiniteRange", UpgradeCategory.Cursed, "Бесконечная дальность",
            "Пули летят бесконечно, но -30% скорости передвижения", "#2238ff", "🌀", 1,
            effects: new() { { "infiniteRange", true }, { "speedMult", -0.30f } }));

        cat.Cursed.Add(MakeUpgrade("ricochet", UpgradeCategory.Cursed, "Рикошет",
            "Пули отскакивают от стен, +50% к дальности", "#ff8922", "↩️", 1,
            effects: new() { { "ricochet", true } }));

        cat.Cursed.Add(MakeUpgrade("weaponSlot", UpgradeCategory.Cursed, "+1 слот для оружия",
            "Дополнительный слот оружия.", "#ffaa00", "🗃️", 3,
            onApplyId: "weaponSlot"));

        cat.Cursed.Add(MakeUpgrade("lastLife", UpgradeCategory.Cursed, "Последняя жизнь",
            "При смертельном уроне все враги в бою умрут, урон не получишь. Одноразовый.", "#ff0000", "💀", 1,
            effects: new() { { "lastLife", true } }));

        cat.Cursed.Add(MakeUpgrade("battleSpeed", UpgradeCategory.Cursed, "Боевое ускорение",
            "+25% скорости при 2 комнатах в бою, -10% за каждую комнату сверх двух", "#00ff88", "⚡", 1,
            effects: new() { { "battleSpeed", true } }));

        cat.Cursed.Add(MakeUpgrade("freeze", UpgradeCategory.Cursed, "Заморозка",
            "В начале боя враги не могут двигаться 1 секунду", "#ffa200", "❄️", 1,
            effects: new() { { "freeze", true } }));

        cat.Cursed.Add(MakeUpgrade("randomBonus", UpgradeCategory.Cursed, "Что попало",
            "Получить 3 случайных обычных бонуса", "#e5ff00", "🎲", 1,
            onApplyId: "randomBonus"));

        cat.Cursed.Add(MakeUpgrade("longRange", UpgradeCategory.Cursed, "Дальнобойщик",
            "За каждую открытую комнату в бою +20% к дальности полета пули", "#0066ff", "🏹", 1,
            effects: new() { { "longRange", true } }));

        cat.Cursed.Add(MakeUpgrade("sniper", UpgradeCategory.Cursed, "Снайпер",
            "Максимальная точность при 2 комнатах в бою, +10% разброса за каждую дополнительную комнату", "#00ff00", "🎯", 1,
            effects: new() { { "sniper", true } }));

        cat.Spatial.Add(MakeSpatial("spatialReloadRooms", SpatialAxis.Reload, SpatialSource.Rooms, "spatialReloadHearts",
            "Пространственный ритм", "Скорость перезарядки +10% за каждую открытую комнату.", "#00d4ff", "🔄",
            effects: new() { { "reloadPerRoom", 0.10f } }));

        cat.Spatial.Add(MakeSpatial("spatialReloadHearts", SpatialAxis.Reload, SpatialSource.Hearts, "spatialReloadRooms",
            "Сердечный ритм", "Скорость перезарядки +10% за каждое сердце.", "#ff4444", "❤️",
            effects: new() { { "reloadPerHeart", 0.10f } }));

        cat.Spatial.Add(MakeSpatial("spatialRangeRooms", SpatialAxis.Range, SpatialSource.Rooms, "spatialRangeHearts",
            "Дальние горизонты", "Дальность стрельбы +20% за каждую открытую комнату.", "#ffff44", "🔭",
            effects: new() { { "rangePerRoom", 0.20f } }));

        cat.Spatial.Add(MakeSpatial("spatialRangeHearts", SpatialAxis.Range, SpatialSource.Hearts, "spatialRangeRooms",
            "Жизненная дистанция", "Дальность стрельбы +20% за каждое сердце.", "#ff8800", "🏹",
            effects: new() { { "rangePerHeart", 0.20f } }));

        cat.Spatial.Add(MakeSpatial("spatialAccuracyRooms", SpatialAxis.Accuracy, SpatialSource.Rooms, "spatialAccuracyHearts",
            "Геометрическая точность", "Точность +20% за каждую открытую комнату.", "#44ff44", "📐",
            effects: new() { { "accuracyPerRoom", 0.20f } }));

        cat.Spatial.Add(MakeSpatial("spatialAccuracyHearts", SpatialAxis.Accuracy, SpatialSource.Hearts, "spatialAccuracyRooms",
            "Интуитивная точность", "Точность +20% за каждое сердце.", "#ff00ff", "👁️",
            effects: new() { { "accuracyPerHeart", 0.20f } }));

        cat.Spatial.Add(MakeSpatial("spatialBulletSpeedRooms", SpatialAxis.BulletSpeed, SpatialSource.Rooms, "spatialBulletSpeedHearts",
            "Пространственное ускорение", "Скорость пули +20% за каждую открытую комнату.", "#00ffff", "⚡",
            effects: new() { { "bulletSpeedPerRoom", 0.20f } }));

        cat.Spatial.Add(MakeSpatial("spatialBulletSpeedHearts", SpatialAxis.BulletSpeed, SpatialSource.Hearts, "spatialBulletSpeedRooms",
            "Сердечное ускорение", "Скорость пули +20% за каждое сердце.", "#ff6666", "🚀",
            effects: new() { { "bulletSpeedPerHeart", 0.20f } }));

        cat.Spatial.Add(MakeSpatial("spatialSpeedRooms", SpatialAxis.Speed, SpatialSource.Rooms, "spatialSpeedHearts",
            "Пространственный маневр", "Скорость бега +10% за каждую открытую комнату.", "#66ff66", "🏃",
            effects: new() { { "speedPerRoom", 0.10f } }));

        cat.Spatial.Add(MakeSpatial("spatialSpeedHearts", SpatialAxis.Speed, SpatialSource.Hearts, "spatialSpeedRooms",
            "Сердечный маневр", "Скорость бега +10% за каждое сердце.", "#ff66ff", "💨",
            effects: new() { { "speedPerHeart", 0.10f } }));

        cat.Spatial.Add(MakeSpatial("spatialCritChanceRooms", SpatialAxis.CritChance, SpatialSource.Rooms, "spatialCritChanceHearts",
            "Пространственный фокус", "Шанс крита +5% за каждую открытую комнату.", "#ffcc00", "🎯",
            effects: new() { { "critChancePerRoom", 0.05f } }));

        cat.Spatial.Add(MakeSpatial("spatialCritChanceHearts", SpatialAxis.CritChance, SpatialSource.Hearts, "spatialCritChanceRooms",
            "Сердечный фокус", "Шанс крита +5% за каждое сердце.", "#ff3300", "💥",
            effects: new() { { "critChancePerHeart", 0.05f } }));

        cat.Spatial.Add(MakeSpatial("spatialCritDamageRooms", SpatialAxis.CritDamage, SpatialSource.Rooms, "spatialCritDamageHearts",
            "Пространственная мощь", "Крит урон +50% за каждую открытую комнату.", "#ccff00", "🔱",
            effects: new() { { "critDamagePerRoom", 0.50f } }));

        cat.Spatial.Add(MakeSpatial("spatialCritDamageHearts", SpatialAxis.CritDamage, SpatialSource.Hearts, "spatialCritDamageRooms",
            "Сердечная мощь", "Крит урон +50% за каждое сердце.", "#990000", "🩸",
            effects: new() { { "critDamagePerHeart", 0.50f } }));

        cat.Spatial.Add(MakeSpatial("spatialPenetrateRooms", SpatialAxis.Penetrate, SpatialSource.Rooms, "spatialPenetrateHearts",
            "Пространственный прокол", "Пуля пробивает 1 врага за каждую открытую комнату.", "#cc00ff", "🗡️",
            effects: new() { { "penetratePerRoom", 1 } }));

        cat.Spatial.Add(MakeSpatial("spatialPenetrateHearts", SpatialAxis.Penetrate, SpatialSource.Hearts, "spatialPenetrateRooms",
            "Сердечный прокол", "Пуля пробивает 1 врага за каждое сердце.", "#ff0066", "💉",
            effects: new() { { "penetratePerHeart", 1 } }));

        return cat;
    }

    private static UpgradeDefinition MakeUpgrade(string id, UpgradeCategory cat, string label,
        string desc, string colorHex, string icon, int max,
        Godot.Collections.Dictionary<string, Variant>? effects = null,
        string onApplyId = "")
    {
        return new UpgradeDefinition
        {
            Id = id, Category = cat, Label = label, Description = desc,
            Color = Color.FromHtml(colorHex), Icon = icon, Max = max,
            Effects = effects ?? new(),
            OnApplyId = onApplyId
        };
    }

    private static UpgradeDefinition MakeSpatial(string id, SpatialAxis axis, SpatialSource source,
        string blocks, string label, string desc, string colorHex, string icon,
        Godot.Collections.Dictionary<string, Variant>? effects = null)
    {
        return new UpgradeDefinition
        {
            Id = id, Category = UpgradeCategory.Spatial,
            Axis = axis, Source = source, Blocks = blocks,
            Label = label, Description = desc,
            Color = Color.FromHtml(colorHex), Icon = icon, Max = 1,
            Effects = effects ?? new()
        };
    }

    public static RoomBonusCatalog BuildRoomBonuses()
    {
        var cat = new RoomBonusCatalog();

        cat.Bonuses.Add(MakeBonus("penetrate", "Пробитие", "Пули пробивают врагов насквозь", "#ff44ff", "🎯"));
        cat.Bonuses.Add(MakeBonus("wind_east", "Поток на восток", "Движение на восток +50%, на запад −50%", "#44ddff", "→",
            windDir: new Vector2(1, 0), windStrength: 0.5f));
        cat.Bonuses.Add(MakeBonus("wind_west", "Поток на запад", "Движение на запад +50%, на восток −50%", "#44ddff", "←",
            windDir: new Vector2(-1, 0), windStrength: 0.5f));
        cat.Bonuses.Add(MakeBonus("wind_north", "Поток на север", "Движение на север +50%, на юг −50%", "#44ddff", "↑",
            windDir: new Vector2(0, -1), windStrength: 0.5f));
        cat.Bonuses.Add(MakeBonus("wind_south", "Поток на юг", "Движение на юг +50%, на север −50%", "#44ddff", "↓",
            windDir: new Vector2(0, 1), windStrength: 0.5f));
        cat.Bonuses.Add(MakeBonus("speeddown", "Замедление", "Персонаж, враги и пули замедляются на 50%", "#ff0000", "⚔️",
            speedMult: 0.5f));
        cat.Bonuses.Add(MakeBonus("ricochet", "Рикошет", "Пули рикошетят от стен внутри комнаты", "#ff8922", "↩️"));
        cat.Bonuses.Add(MakeBonus("longRange", "Дальнобой", "Дальность пуль +1000%", "#0066ff", "🏹"));
        cat.Bonuses.Add(MakeBonus("freeAmmo", "Бесконечный боезапас", "Выстрелы не тратят пули из магазина", "#ffdd00", "♾️"));
        cat.Bonuses.Add(MakeBonus("burnChance", "Поджигающая комната", "Пули выстреленные в комнате имеют +10% шанс поджечь врага при попадании.", "#ff6600", "🔥"));
        cat.Bonuses.Add(MakeBonus("freezeChance", "Охлаждающая комната", "Пули выстреленные в комнате имеют +10% шанс охладить врага при попадании.", "#44ddff", "❄️"));
        cat.Bonuses.Add(MakeBonus("bloomReduction", "Снижение отдачи", "Отдача в комнате уменьшена на 40%", "#88ff88", "🎯"));

        return cat;
    }

    private static RoomBonusDefinition MakeBonus(string id, string label, string desc, string colorHex, string icon,
        Vector2? windDir = null, float windStrength = 0.5f, float speedMult = 1f)
    {
        return new RoomBonusDefinition
        {
            Id = id, Label = label, Description = desc,
            Color = Color.FromHtml(colorHex), Icon = icon, Max = 100,
            WindDir = windDir ?? Vector2.Zero, WindStrength = windStrength,
            SpeedMult = speedMult
        };
    }
}
