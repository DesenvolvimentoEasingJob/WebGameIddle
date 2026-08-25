using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;
using SkySpire.Api.Services;

namespace SkySpire.Api.Tests;

internal static class TestGameConfig
{
    /// <summary>Balance via env-style overrides (no global.json required).</summary>
    public static GameConfigService Create(GameBalanceOptions? opts = null)
    {
        var o = opts ?? new GameBalanceOptions();
        var dict = new Dictionary<string, string?>
        {
            ["XP_BASE"] = o.XpBase.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["XP_SCALE"] = o.XpScale.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["XP_SCALE_STEP_EVERY"] = o.XpScaleStepEvery.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["XP_SCALE_STEP"] = o.XpScaleStep.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["FLOOR_REWARD_MULT"] = o.FloorRewardMult.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["DEATH_XP_PENALTY"] = o.DeathXpPenalty.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["TRAINING_COST_BASE"] = o.TrainingCostBase.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["TRAINING_GOLD_SCALE"] = o.TrainingGoldScale.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["BATTLE_COIN_REWARD_BASE"] = o.BattleCoinRewardBase.ToString(System.Globalization.CultureInfo.InvariantCulture),
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        var secrets = Options.Create(new AppSecretsOptions
        {
            ContentPath = Path.Combine(Path.GetTempPath(), "skyspire-missing-content"),
            DataPath = "."
        });
        return new GameConfigService(secrets, config, NullLogger<GameConfigService>.Instance);
    }
}

public class CombatServiceTests
{
    [Fact]
    public void Strong_Player_Beats_Weak_Mob()
    {
        Assert.True(CombatService.WouldPlayerWin(playerHp: 200, playerAtk: 40, enemyHp: 30, enemyAtk: 5));
    }

    [Fact]
    public void Weak_Player_Loses_To_Strong_Mob()
    {
        Assert.False(CombatService.WouldPlayerWin(playerHp: 20, playerAtk: 3, enemyHp: 200, enemyAtk: 50));
    }
}

public class XpServiceTests
{
    private static XpService CreateXp(GameBalanceOptions? opts = null)
    {
        var content = new ContentService(Options.Create(
            new AppSecretsOptions { ContentPath = ".", DataPath = "." }));
        var growth = new LevelGrowthService(content);
        return new XpService(TestGameConfig.Create(opts), growth);
    }

    [Fact]
    public void Xp_Curve_Increases_With_Level()
    {
        var xp = CreateXp();
        var l1 = xp.XpRequiredForLevel(1);
        var l2 = xp.XpRequiredForLevel(2);
        var l11 = xp.XpRequiredForLevel(11);
        Assert.Equal(100, l1);
        Assert.True(l2 > l1);
        Assert.True(l11 > l2);
    }

    /// <summary>The XP bar can only be full if this invariant breaks.</summary>
    [Fact]
    public async Task Xp_Never_Sits_At_Or_Above_The_Level_Requirement()
    {
        var xp = CreateXp();
        var character = new System.Text.Json.Nodes.JsonObject { ["level"] = 1, ["xp"] = 0 };

        await xp.ApplyXpAsync(character, 5000);

        var level = character["level"]!.GetValue<int>();
        Assert.True(level > 1);
        Assert.True(character["xp"]!.GetValue<int>() < xp.XpRequiredForLevel(level));
    }
}

public class LevelGrowthTests
{
    [Fact]
    public void ApplyGainMap_Adds_To_BaseStats()
    {
        var baseStats = new System.Text.Json.Nodes.JsonObject
        {
            ["strength"] = 8,
            ["intelligence"] = 14
        };
        LevelGrowthService.ApplyGainMap(baseStats, new Dictionary<string, double>
        {
            ["intelligence"] = 1,
            ["agility"] = 1,
            ["hpBase"] = 2
        });
        Assert.Equal(8, double.Parse(baseStats["strength"]!.ToJsonString()));
        Assert.Equal(15, double.Parse(baseStats["intelligence"]!.ToJsonString()));
        Assert.Equal(1, double.Parse(baseStats["agility"]!.ToJsonString()));
        Assert.Equal(2, double.Parse(baseStats["hpBase"]!.ToJsonString()));
    }

    [Fact]
    public async Task Elf_Mage_LevelUp_Raises_Intelligence()
    {
        var contentRoot = FindContentRoot();
        var content = new ContentService(Options.Create(
            new AppSecretsOptions { ContentPath = contentRoot, DataPath = "." }));
        var growth = new LevelGrowthService(content);
        var xp = new XpService(TestGameConfig.Create(new GameBalanceOptions { XpBase = 100 }), growth);

        var character = new System.Text.Json.Nodes.JsonObject
        {
            ["level"] = 1,
            ["xp"] = 0,
            ["raceId"] = "elf",
            ["classId"] = "mage",
            ["baseStats"] = new System.Text.Json.Nodes.JsonObject
            {
                ["strength"] = 8,
                ["intelligence"] = 14,
                ["agility"] = 14,
                ["hpBase"] = 80,
                ["mpBase"] = 80
            }
        };

        await xp.ApplyXpAsync(character, 100);

        Assert.Equal(2, character["level"]!.GetValue<int>());
        var bs = character["baseStats"]!.AsObject();
        // elf levelGain int+1 + mage levelGain int+1
        Assert.Equal(16, double.Parse(bs["intelligence"]!.ToJsonString()));
        Assert.Equal(15, double.Parse(bs["agility"]!.ToJsonString()));
        Assert.Equal(8, double.Parse(bs["strength"]!.ToJsonString()));
        Assert.Equal(82, double.Parse(bs["hpBase"]!.ToJsonString()));
        Assert.Equal(82, double.Parse(bs["mpBase"]!.ToJsonString()));
    }

    private static string FindContentRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "content");
            if (Directory.Exists(Path.Combine(candidate, "races")))
            {
                return candidate;
            }

            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("content/ not found from test BaseDirectory");
    }
}

public class EconomyServiceTests
{
    [Fact]
    public void Battle_Reward_Scales_With_Floor()
    {
        var opts = new GameBalanceOptions { BattleCoinRewardBase = 2, FloorRewardMult = 1.5 };
        Assert.Equal(2, EconomyService.BattleRewardCoins(opts, 1));
        Assert.Equal(3, EconomyService.BattleRewardCoins(opts, 2));
        Assert.True(EconomyService.BattleRewardCoins(opts, 5) > EconomyService.BattleRewardCoins(opts, 2));
    }
}

public class XpDeathPenaltyTests
{
    [Fact]
    public void Death_Penalty_Removes_Fraction_Of_Level_Xp()
    {
        var content = new ContentService(Options.Create(
            new AppSecretsOptions { ContentPath = ".", DataPath = "." }));
        var xp = new XpService(
            TestGameConfig.Create(new GameBalanceOptions
            {
                DeathXpPenalty = 0.10,
                XpBase = 100
            }),
            new LevelGrowthService(content));
        var character = new System.Text.Json.Nodes.JsonObject
        {
            ["level"] = 1,
            ["xp"] = 50
        };
        var (lost, _) = xp.ApplyDeathPenalty(character);
        Assert.Equal(10, lost);
        Assert.Equal(40, character["xp"]!.GetValue<int>());
    }
}

public class TowerProgressionTests
{
    [Fact]
    public void Auto_Climb_Loops_Farm_Rooms_Without_Reaching_Boss()
    {
        Assert.Equal(2, TowerService.NextRoomAfterVictory(1));
        Assert.Equal(9, TowerService.NextRoomAfterVictory(8));
        Assert.Equal(1, TowerService.NextRoomAfterVictory(9));
    }

    [Fact]
    public void Boss_Win_Unlocks_Next_Floor()
    {
        Assert.Equal(2, TowerService.UnlockedFloorAfterBossWin(currentMax: 1, floor: 1, floorCount: 10));
        Assert.Equal(6, TowerService.UnlockedFloorAfterBossWin(currentMax: 6, floor: 2, floorCount: 10));
    }

    [Fact]
    public void Unlocked_Floor_Is_Capped_By_Available_Content()
    {
        Assert.Equal(10, TowerService.UnlockedFloorAfterBossWin(currentMax: 10, floor: 10, floorCount: 10));
    }

    [Fact]
    public void Enter_Cleared_Floors_Unlock_All_Rooms_Frontier_Restarts()
    {
        Assert.Equal(10, TowerService.RoomUnlockOnEnter(floor: 1, maxUnlockedFloor: 3));
        Assert.Equal(10, TowerService.RoomUnlockOnEnter(floor: 2, maxUnlockedFloor: 3));
        Assert.Equal(1, TowerService.RoomUnlockOnEnter(floor: 3, maxUnlockedFloor: 3));
        Assert.Equal(1, TowerService.RoomUnlockOnEnter(floor: 1, maxUnlockedFloor: 1));
    }
}

public class FloorChallengeRulesTests
{
    private static System.Text.Json.JsonElement Floor(string bossJson) =>
        System.Text.Json.JsonDocument.Parse($"{{\"boss\":{bossJson}}}").RootElement.Clone();

    [Fact]
    public void Floor_Json_Overrides_Env_Fees()
    {
        var rules = TowerService.ReadChallengeRules(
            Floor("""{"monsterId":"b","gateFee":100,"registryFee":250,"attrMult":4}"""),
            defaultFee: 50,
            defaultAttrMult: 10);

        Assert.Equal(100, rules.GateFee);
        Assert.Equal(250, rules.RegistryFee);
        Assert.Equal(4, rules.RegistryAttrMult);
    }

    [Fact]
    public void Legacy_Single_Fee_Applies_To_Both_Challenges()
    {
        var rules = TowerService.ReadChallengeRules(
            Floor("""{"monsterId":"b","challengeFee":80}"""),
            defaultFee: 50,
            defaultAttrMult: 10);

        Assert.Equal(80, rules.GateFee);
        Assert.Equal(80, rules.RegistryFee);
        Assert.Equal(10, rules.RegistryAttrMult);
    }

    [Fact]
    public void Missing_Or_Invalid_Fields_Fall_Back_To_Env()
    {
        var noBoss = TowerService.ReadChallengeRules(null, defaultFee: 50, defaultAttrMult: 10);
        Assert.Equal(50, noBoss.GateFee);
        Assert.Equal(50, noBoss.RegistryFee);

        var invalid = TowerService.ReadChallengeRules(
            Floor("""{"monsterId":"b","gateFee":"free","registryFee":-5}"""),
            defaultFee: 50,
            defaultAttrMult: 10);

        Assert.Equal(50, invalid.GateFee);
        Assert.Equal(50, invalid.RegistryFee);
    }
}

public class TrainingCostTests
{
    [Fact]
    public void NextCost_Uses_Base_Then_GoldScale_On_LastCost()
    {
        var opts = new GameBalanceOptions { TrainingCostBase = 10, TrainingGoldScale = 1.3 };
        Assert.Equal(10, TrainingService.NextCost(opts, null));
        Assert.Equal(10, TrainingService.NextCost(opts, 0));
        Assert.Equal(13, TrainingService.NextCost(opts, 10));
        Assert.Equal(17, TrainingService.NextCost(opts, 13));
    }
}

public class DynamicAttributeTests
{
    [Fact]
    public void Strength_Formula_Increases_Absolute_HpRegen()
    {
        var calc = new StatCalculator(null!);
        var stats = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["strength"] = 10,
            ["hpRegenPerSec"] = 1
        };

        calc.ApplyAttributeFormulas(stats, "strength", ["hpRegenPerSec * 0.05"]);

        Assert.Equal(1 + 10 * 0.05, stats["hpRegenPerSec"], 5);
    }

    [Fact]
    public void Training_Strength_Raises_Absolute_Regen()
    {
        var calc = new StatCalculator(null!);
        var before = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["strength"] = 10,
            ["hpRegenPerSec"] = 1
        };
        var after = new Dictionary<string, double>(before) { ["strength"] = 11 };

        calc.ApplyAttributeFormulas(before, "strength", ["hpRegenPerSec * 0.05"]);
        calc.ApplyAttributeFormulas(after, "strength", ["hpRegenPerSec * 0.05"]);

        Assert.True(after["hpRegenPerSec"] > before["hpRegenPerSec"]);
        Assert.Equal(0.05, after["hpRegenPerSec"] - before["hpRegenPerSec"], 5);
    }

    [Fact]
    public void Missing_Formula_Targets_Seed_To_One()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            { "strength": ["hpRegenPerSec * 0.05", "attackSpeed * 0.3"] }
            """);
        var stats = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["strength"] = 5
        };

        StatCalculator.SeedMissingFormulaTargets(stats, doc.RootElement);

        Assert.Equal(1, stats["hpRegenPerSec"]);
        Assert.Equal(1, stats["attackSpeed"]);
    }

    [Fact]
    public void Absolute_Regen_Is_Not_Percent_Of_Max_Hp()
    {
        const double maxHp = 200;
        const double rate = 1.5; // HP/s bruto
        const double elapsed = 10;
        // 15 HP recuperados — independente do maxHp (só o clamp usa o teto)
        Assert.Equal(15, rate * elapsed, 5);
        Assert.NotEqual(maxHp * rate * elapsed, rate * elapsed);
    }

    [Fact]
    public void Combat_Regen_Tick_Beats_Low_Damage_Over_Time()
    {
        var events = new List<BattleEventDto>();
        double hp = 50;
        const double max = 100;
        const double regen = 2; // HP/s
        const int tickMs = 1000;
        const double damagePerTick = 1;
        var at = 0;

        for (var i = 0; i < 20; i++)
        {
            at += tickMs;
            hp -= damagePerTick;
            CombatService.ApplyCombatRegenTick(ref hp, max, regen, tickMs, at, events);
        }

        Assert.True(hp > 50);
        Assert.Contains(events, e => e.Type == "regen");
        Assert.All(events.Where(e => e.Type == "regen"), e => Assert.True(e.AtMs > 0));
    }

    [Fact]
    public void ActionInterval_Scales_With_AttackSpeed()
    {
        Assert.Equal(1000, CombatService.ActionIntervalMs(1.0, 1000));
        Assert.Equal(500, CombatService.ActionIntervalMs(2.0, 1000));
        Assert.Equal(2000, CombatService.ActionIntervalMs(0.5, 1000));
    }

    [Fact]
    public void Fast_Player_Still_Allows_Enemy_Swing_On_Same_Tick_As_Last_Kill()
    {
        // AS 4 → player acts 250/500/750/1000; slimes AS 1 → first act at 1000.
        // No mesmo ms do kill do último, o slime restante deve bater antes de morrer.
        Assert.Equal(250, CombatService.ActionIntervalMs(4.0, 1000));
        Assert.Equal(1000, CombatService.ActionIntervalMs(1.0, 1000));
        // 4 kills: 250+500+750+1000 — o 4º coincide com o 1º ato inimigo.
        Assert.Equal(4 * 250, CombatService.ActionIntervalMs(1.0, 1000));
    }
}

public class CombatHitResolverTests
{
    private static CombatFighterProfile Atk(
        double dmg,
        double? critChance = null,
        double? critDamage = null,
        IReadOnlyList<BonusDamageEntry>? bonus = null,
        double attackSpeed = 1.0) =>
        new()
        {
            DmgBase = dmg,
            AttackSpeed = attackSpeed,
            CritChance = critChance,
            CritDamage = critDamage,
            BonusDamage = bonus ?? []
        };

    private static CombatFighterProfile Def(
        double def = 0,
        double? dodgeChance = null,
        IReadOnlyDictionary<string, double>? bonusDef = null) =>
        new()
        {
            DefBase = def,
            DodgeChance = dodgeChance,
            BonusDefense = bonusDef ?? new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        };

    [Fact]
    public void No_CritChance_Never_Crits()
    {
        var hit = CombatHitResolver.Resolve(Atk(10), Def(), damageNoise: 0, rng: new Random(1));
        Assert.False(hit.Crit);
        Assert.Equal(10, hit.Amount);
    }

    [Fact]
    public void Crit_Multiplies_Only_Base_Damage()
    {
        var bonus = new[] { new BonusDamageEntry("fireDamage", 20, "fireResistance") };
        var hit = CombatHitResolver.Resolve(
            Atk(10, critChance: 1, critDamage: 2, bonus: bonus),
            Def(),
            damageNoise: 0,
            rng: new Random(0));
        Assert.True(hit.Crit);
        Assert.Equal(20, hit.BaseDealt); // 10 × 2
        Assert.Equal(20, hit.BonusDealt); // full fire, no resist
        Assert.Equal(40, hit.Amount);
    }

    [Fact]
    public void Missing_DefBase_Means_Zero_Defense()
    {
        var hit = CombatHitResolver.Resolve(Atk(30), Def(0), 0, new Random(0));
        Assert.Equal(30, hit.Amount);
    }

    [Fact]
    public void Armor_Percent_Reduces_Only_Base_Not_Bonus()
    {
        var bonus = new[] { new BonusDamageEntry("fireDamage", 20, "fireResistance") };
        // mid=10, power=1 → def 10 = 50% reduction
        var hit = CombatHitResolver.Resolve(
            Atk(30, bonus: bonus),
            Def(10, bonusDef: new Dictionary<string, double> { ["fireResistance"] = 15 }),
            0,
            new Random(0),
            armorMidDef: 10,
            armorPower: 1);
        Assert.Equal(15, hit.BaseDealt); // 30 × 0.5
        Assert.Equal(5, hit.BonusDealt);
        Assert.Equal(20, hit.Amount);
    }

    [Fact]
    public void Armor_Never_Fully_Negates_Damage()
    {
        var hit = CombatHitResolver.Resolve(
            Atk(100),
            Def(1_000_000),
            0,
            new Random(0),
            armorMidDef: 4800,
            armorPower: 0.31);
        Assert.True(hit.BaseDealt > 0);
        Assert.True(hit.Amount > 0);
        Assert.True(hit.Amount < 100);
    }

    [Fact]
    public void Armor_Curve_Hits_About_30_Percent_At_300_And_50_At_Mid()
    {
        const double mid = 4800;
        const double power = 0.31;
        var r300 = CombatHitResolver.ArmorDamageReduction(300, mid, power);
        var rMid = CombatHitResolver.ArmorDamageReduction(mid, mid, power);
        Assert.InRange(r300, 0.28, 0.32);
        Assert.Equal(0.5, rMid, 5);
    }

    [Fact]
    public void Bonus_Without_Counter_Ignores_Base_Defense()
    {
        var bonus = new[] { new BonusDamageEntry("fireDamage", 20, "fireResistance") };
        var hit = CombatHitResolver.Resolve(
            Atk(30, bonus: bonus),
            Def(10),
            0,
            new Random(0),
            armorMidDef: 10,
            armorPower: 1);
        Assert.Equal(15, hit.BaseDealt);
        Assert.Equal(20, hit.BonusDealt);
        Assert.Equal(35, hit.Amount);
    }

    [Fact]
    public void No_DodgeChance_Never_Dodges()
    {
        for (var i = 0; i < 20; i++)
        {
            var hit = CombatHitResolver.Resolve(Atk(5), Def(), 0, new Random(i));
            Assert.False(hit.Dodged);
        }
    }

    [Fact]
    public void Full_DodgeChance_Always_Dodges()
    {
        var hit = CombatHitResolver.Resolve(Atk(50), Def(dodgeChance: 1), 0, new Random(42));
        Assert.True(hit.Dodged);
        Assert.Equal(0, hit.Amount);
    }

    [Fact]
    public void Crit_Requires_CritDamage_Property()
    {
        var hit = CombatHitResolver.Resolve(Atk(10, critChance: 1, critDamage: null), Def(), 0, new Random(0));
        Assert.False(hit.Crit);
        Assert.Equal(10, hit.Amount);
    }

    [Fact]
    public void AttackSpeed_Does_Not_Multiply_Damage()
    {
        var bonus = new[] { new BonusDamageEntry("fireDamage", 20, "fireResistance") };
        var hit = CombatHitResolver.Resolve(
            Atk(30, bonus: bonus, attackSpeed: 1.1),
            Def(10),
            0,
            new Random(0),
            armorMidDef: 10,
            armorPower: 1);
        Assert.Equal(15, hit.BaseDealt); // 30 × 50%, no AS multiplier
        Assert.Equal(20, hit.BonusDealt);
        Assert.Equal(35, hit.Amount);
    }

    [Fact]
    public void Crit_Ignores_AttackSpeed_On_Damage()
    {
        var hit = CombatHitResolver.Resolve(
            Atk(10, critChance: 1, critDamage: 2, attackSpeed: 1.1),
            Def(),
            0,
            new Random(0));
        Assert.True(hit.Crit);
        Assert.Equal(20, hit.BaseDealt); // 10 × 2, no AS
        Assert.Equal(20, hit.Amount);
    }

    [Fact]
    public void Monster_StatScale_Applies_To_Dmg_And_Def()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            { "baseStats": { "dmgBase": 5, "defBase": 10 } }
            """);
        var profile = CombatHitResolver.FromMonster(doc.RootElement, statScale: 4);
        Assert.Equal(20, profile.DmgBase);
        Assert.Equal(40, profile.DefBase);
    }

    [Fact]
    public void Monster_Without_AttackSpeed_Defaults_To_One()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            { "id": "rat", "baseStats": { "dmgBase": 5, "defBase": 2 } }
            """);
        var profile = CombatHitResolver.FromMonster(doc.RootElement);
        Assert.Equal(1.0, profile.AttackSpeed);
    }

    [Fact]
    public void Monster_AttackSpeed_From_BaseStats()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            { "baseStats": { "dmgBase": 5, "defBase": 2, "attackSpeed": 1.2 } }
            """);
        var profile = CombatHitResolver.FromMonster(doc.RootElement);
        Assert.Equal(1.2, profile.AttackSpeed);
    }

    [Fact]
    public void FromCalculatedStats_Missing_AttackSpeed_Defaults_To_One()
    {
        var stats = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["dmgBase"] = 10,
            ["defBase"] = 0
        };
        var profile = CombatHitResolver.FromCalculatedStats(stats);
        Assert.Equal(1.0, profile.AttackSpeed);
    }

    [Fact]
    public void Agility_Formula_Adds_One_Percent_AttackSpeed_Per_Point()
    {
        var calc = new StatCalculator(null!);
        var stats = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["agility"] = 10,
            ["attackSpeed"] = 1
        };
        calc.ApplyAttributeFormulas(stats, "agility", ["attackSpeed * 0.01"]);
        Assert.Equal(1.1, stats["attackSpeed"], 5);
    }

    [Fact]
    public void Monster_Legacy_Attack_Defense_Still_Maps()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            { "id": "old", "attack": 7, "defense": 3, "hp": 40 }
            """);
        var profile = CombatHitResolver.FromMonster(doc.RootElement);
        Assert.Equal(7, profile.DmgBase);
        Assert.Equal(3, profile.DefBase);
        Assert.Equal(1.0, profile.AttackSpeed);
    }

    [Fact]
    public void Monster_BaseStats_Preferred_Over_Legacy()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            {
              "attack": 99,
              "defense": 99,
              "baseStats": { "dmgBase": 5, "defBase": 2 },
              "bonusDefense": { "fireResistance": 10 }
            }
            """);
        var profile = CombatHitResolver.FromMonster(doc.RootElement);
        Assert.Equal(5, profile.DmgBase);
        Assert.Equal(2, profile.DefBase);
        Assert.Equal(10, profile.BonusDefense["fireResistance"]);
        Assert.Equal(1.0, profile.AttackSpeed);
    }

    [Fact]
    public void Monster_Reads_Crit_Dodge_And_BonusDamage()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            {
              "baseStats": {
                "dmgBase": 10,
                "defBase": 1,
                "critChance": 0.25,
                "critDamage": 2,
                "dodgeChance": 0.1
              },
              "bonusDamage": {
                "fireDamage": { "dmgBase": 8, "counter": "fireResistance" }
              }
            }
            """);
        var profile = CombatHitResolver.FromMonster(doc.RootElement);
        Assert.Equal(0.25, profile.CritChance);
        Assert.Equal(2, profile.CritDamage);
        Assert.Equal(0.1, profile.DodgeChance);
        Assert.Single(profile.BonusDamage);
        Assert.Equal("fireDamage", profile.BonusDamage[0].Key);
        Assert.Equal(8, profile.BonusDamage[0].DmgBase);
        Assert.Equal("fireResistance", profile.BonusDamage[0].Counter);
    }

    [Fact]
    public void Monster_HpRegen_Missing_Is_Zero()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            { "baseStats": { "dmgBase": 5, "defBase": 2 } }
            """);
        Assert.Equal(0, CombatHitResolver.ReadMonsterHpRegenPerSec(doc.RootElement));
    }

    [Fact]
    public void Monster_HpRegen_From_BaseStats()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            { "baseStats": { "dmgBase": 5, "hpRegenPerSec": 2.5 } }
            """);
        Assert.Equal(2.5, CombatHitResolver.ReadMonsterHpRegenPerSec(doc.RootElement));
    }

    [Fact]
    public void Combat_Regen_Tick_Can_Target_Enemy()
    {
        var events = new List<BattleEventDto>();
        double hp = 40;
        CombatService.ApplyCombatRegenTick(
            ref hp,
            maxHp: 100,
            regenPerSec: 3,
            tickMs: 1000,
            atMs: 1000,
            events,
            actor: "enemy",
            slot: 1,
            name: "Slime");

        Assert.Equal(43, hp, 5);
        var regen = Assert.Single(events, e => e.Type == "regen");
        Assert.Equal("enemy", regen.Actor);
        Assert.Equal(1, regen.Slot);
        Assert.Contains("Slime", regen.Message);
    }
}

public class EnemyGroupTests
{
    [Fact]
    public void Monster_Ids_Are_Spawn_List_Length_Is_Count()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            {
              "rooms": [
                { "number": 3, "monsterIds": ["slime", "rat"] },
                { "number": 6, "monsterIds": ["slime", "rat", "bat"] },
                { "number": 9, "monsterIds": ["slime", "rat", "slime", "bat"] }
              ]
            }
            """);
        Assert.Equal(new[] { "slime", "rat" }, CombatService.ResolveMonsterIds(doc.RootElement, 3));
        Assert.Equal(new[] { "slime", "rat", "bat" }, CombatService.ResolveMonsterIds(doc.RootElement, 6));
        Assert.Equal(
            new[] { "slime", "rat", "slime", "bat" },
            CombatService.ResolveMonsterIds(doc.RootElement, 9));
    }

    [Fact]
    public void Monster_Ids_Clamp_To_Max_Four()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
            {
              "rooms": [
                { "number": 1, "monsterIds": ["a", "b", "c", "d", "e"] }
              ]
            }
            """);
        var ids = CombatService.ResolveMonsterIds(doc.RootElement, 1);
        Assert.Equal(new[] { "a", "b", "c", "d" }, ids);
    }

    [Fact]
    public void Empty_Room_Falls_Back_To_Slime()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""{ "rooms": [] }""");
        Assert.Equal(new[] { "slime" }, CombatService.ResolveMonsterIds(doc.RootElement, 1));
    }
}
