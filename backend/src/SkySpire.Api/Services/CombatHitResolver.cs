using System.Text.Json;
using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

/// <summary>
/// Perfil de combate lido do JSON (personagem calculado ou monstro).
/// Propriedade ausente = sem efeito (0 / lista vazia / sem crit / sem dodge).
/// </summary>
public sealed class CombatFighterProfile
{
    public double DmgBase { get; init; }
    public double DefBase { get; init; }
    /// <summary>Multiplicador do dano base por golpe (1.0 = neutro; 1.1 = +10%).</summary>
    public double AttackSpeed { get; init; } = 1.0;
    public double? CritChance { get; init; }
    public double? CritDamage { get; init; }
    public double? DodgeChance { get; init; }
    public IReadOnlyList<BonusDamageEntry> BonusDamage { get; init; } = [];
    public IReadOnlyDictionary<string, double> BonusDefense { get; init; } =
        new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);

    public bool CanCrit =>
        CritChance is > 0 && CritDamage is not null;

    public bool CanDodge =>
        DodgeChance is > 0;
}

public sealed record BonusDamageEntry(string Key, double DmgBase, string Counter);

public readonly record struct HitResolution(
    bool Dodged,
    bool Crit,
    int Amount,
    double BaseDealt,
    double BonusDealt,
    double Noise);

/// <summary>
/// Resolve um golpe a partir dos JSONs do atacante/defensor — sem hardcode de crit/dodge/def.
/// Crit e attackSpeed multiplicam **somente** o dano base. Bônus elementais usam <c>counter</c> em <c>bonusDefense</c>.
/// </summary>
public static class CombatHitResolver
{
    public static CombatFighterProfile FromCalculatedStats(
        IReadOnlyDictionary<string, double> stats,
        JsonElement? sourceRoot = null)
    {
        double? Opt(string key) =>
            stats.TryGetValue(key, out var v) ? v : null;

        var dmg = Opt("dmgBase") ?? 0;
        var def = Opt("defBase") ?? 0;
        var attackSpeed = Opt("attackSpeed") ?? 1.0;
        double? critChance = stats.ContainsKey("critChance") ? stats["critChance"] : null;
        double? critDamage = stats.ContainsKey("critDamage") ? stats["critDamage"] : null;
        double? dodge = stats.ContainsKey("dodgeChance") ? stats["dodgeChance"] : null;

        IReadOnlyList<BonusDamageEntry> bonusDmg = [];
        IReadOnlyDictionary<string, double> bonusDef =
            new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);

        if (sourceRoot is { } root)
        {
            bonusDmg = ReadBonusDamage(root);
            bonusDef = ReadBonusDefense(root);
        }

        return new CombatFighterProfile
        {
            DmgBase = dmg,
            DefBase = def,
            AttackSpeed = attackSpeed,
            CritChance = critChance,
            CritDamage = critDamage,
            DodgeChance = dodge,
            BonusDamage = bonusDmg,
            BonusDefense = bonusDef
        };
    }

    public static CombatFighterProfile FromCalculatedStats(
        IReadOnlyDictionary<string, double> stats,
        JsonObject? sourceRoot)
    {
        if (sourceRoot is null)
        {
            return FromCalculatedStats(stats, (JsonElement?)null);
        }

        using var doc = JsonDocument.Parse(sourceRoot.ToJsonString());
        return FromCalculatedStats(stats, doc.RootElement);
    }

    /// <summary>
    /// Monstro: <c>baseStats.dmgBase</c>/<c>defBase</c> ou legado <c>attack</c>/<c>defense</c>.
    /// </summary>
    public static CombatFighterProfile FromMonster(JsonElement monster, double dmgScale = 1.0)
    {
        var dmg = ReadMonsterStat(monster, "dmgBase", "attack", 0) * dmgScale;
        var def = ReadMonsterStat(monster, "defBase", "defense", 0);
        var attackSpeed = TryReadNestedStat(monster, "attackSpeed") ?? 1.0;
        double? critChance = TryReadNestedStat(monster, "critChance");
        double? critDamage = TryReadNestedStat(monster, "critDamage");
        double? dodge = TryReadNestedStat(monster, "dodgeChance");

        return new CombatFighterProfile
        {
            DmgBase = dmg,
            DefBase = def,
            AttackSpeed = attackSpeed,
            CritChance = critChance,
            CritDamage = critDamage,
            DodgeChance = dodge,
            BonusDamage = ReadBonusDamage(monster),
            BonusDefense = ReadBonusDefense(monster)
        };
    }

    public static HitResolution Resolve(
        CombatFighterProfile attacker,
        CombatFighterProfile defender,
        double damageNoise,
        Random rng)
    {
        if (defender.CanDodge && rng.NextDouble() < defender.DodgeChance!.Value)
        {
            return new HitResolution(true, false, 0, 0, 0, 0);
        }

        var baseDealt = Math.Max(0, attacker.DmgBase - defender.DefBase);
        baseDealt *= Math.Max(0, attacker.AttackSpeed);
        var crit = false;
        if (attacker.CanCrit && rng.NextDouble() < attacker.CritChance!.Value)
        {
            crit = true;
            baseDealt *= attacker.CritDamage!.Value;
        }

        var bonusDealt = 0.0;
        foreach (var entry in attacker.BonusDamage)
        {
            if (entry.DmgBase <= 0 || string.IsNullOrWhiteSpace(entry.Counter))
            {
                continue;
            }

            if (defender.BonusDefense.TryGetValue(entry.Counter, out var resist))
            {
                bonusDealt += Math.Max(0, entry.DmgBase - resist);
            }
            else
            {
                bonusDealt += entry.DmgBase;
            }
        }

        var noiseAmp = Math.Max(0, damageNoise);
        var noise = noiseAmp > 0 ? rng.NextDouble() * noiseAmp : 0;
        var total = baseDealt + bonusDealt + noise;
        var amount = (int)Math.Round(Math.Max(0, total));

        return new HitResolution(false, crit, amount, baseDealt, bonusDealt, noise);
    }

    public static IReadOnlyList<BonusDamageEntry> ReadBonusDamage(JsonElement root)
    {
        if (!root.TryGetProperty("bonusDamage", out var obj) || obj.ValueKind != JsonValueKind.Object)
        {
            return [];
        }

        var list = new List<BonusDamageEntry>();
        foreach (var prop in obj.EnumerateObject())
        {
            if (prop.Value.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var dmg = prop.Value.TryGetProperty("dmgBase", out var d) && d.ValueKind == JsonValueKind.Number
                ? d.GetDouble()
                : 0;
            var counter = prop.Value.TryGetProperty("counter", out var c) ? c.GetString() ?? "" : "";
            if (dmg <= 0 || string.IsNullOrWhiteSpace(counter))
            {
                continue;
            }

            list.Add(new BonusDamageEntry(prop.Name, dmg, counter));
        }

        return list;
    }

    public static IReadOnlyDictionary<string, double> ReadBonusDefense(JsonElement root)
    {
        var map = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        if (!root.TryGetProperty("bonusDefense", out var obj) || obj.ValueKind != JsonValueKind.Object)
        {
            return map;
        }

        foreach (var prop in obj.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.Number)
            {
                map[prop.Name] = prop.Value.GetDouble();
            }
        }

        return map;
    }

    private static double ReadMonsterStat(JsonElement monster, string baseKey, string legacyKey, double fallback)
    {
        if (monster.TryGetProperty("baseStats", out var bs) &&
            bs.ValueKind == JsonValueKind.Object &&
            bs.TryGetProperty(baseKey, out var nested) &&
            nested.ValueKind == JsonValueKind.Number)
        {
            return nested.GetDouble();
        }

        if (monster.TryGetProperty(baseKey, out var top) && top.ValueKind == JsonValueKind.Number)
        {
            return top.GetDouble();
        }

        if (monster.TryGetProperty(legacyKey, out var legacy) && legacy.ValueKind == JsonValueKind.Number)
        {
            return legacy.GetDouble();
        }

        return fallback;
    }

    private static double? TryReadNestedStat(JsonElement monster, string key)
    {
        if (monster.TryGetProperty("baseStats", out var bs) &&
            bs.ValueKind == JsonValueKind.Object &&
            bs.TryGetProperty(key, out var nested) &&
            nested.ValueKind == JsonValueKind.Number)
        {
            return nested.GetDouble();
        }

        if (monster.TryGetProperty(key, out var top) && top.ValueKind == JsonValueKind.Number)
        {
            return top.GetDouble();
        }

        return null;
    }
}
