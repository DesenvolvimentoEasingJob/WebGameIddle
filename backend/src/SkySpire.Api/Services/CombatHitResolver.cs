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
    /// <summary>Cadência relativa (1.0 = uma ação por <c>combatBaseActionMs</c>). Não multiplica dano.</summary>
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
/// Resolve um golpe a partir dos JSONs do atacante/defensor — sem hardcode de crit/dodge.
/// Crit multiplica **somente** o dano base. <c>attackSpeed</c> é cadência (fora desta fórmula).
/// Defesa física: <c>reduction = def^p / (def^p + mid^p)</c>; bônus elementais usam <c>counter</c>.
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
    /// <paramref name="statScale"/> multiplica dmg e def (ex.: √difficulty do andar).
    /// </summary>
    public static CombatFighterProfile FromMonster(JsonElement monster, double statScale = 1.0)
    {
        var scale = Math.Max(0, statScale);
        var dmg = ReadMonsterStat(monster, "dmgBase", "attack", 0) * scale;
        var def = ReadMonsterStat(monster, "defBase", "defense", 0) * scale;
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

    /// <summary>
    /// Redução física 0..&lt;1: <c>def^p / (def^p + mid^p)</c>. Nunca chega a 100%.
    /// </summary>
    public static double ArmorDamageReduction(double def, double midDef, double power)
    {
        var d = Math.Max(0, def);
        if (d <= 0)
        {
            return 0;
        }

        var mid = Math.Max(1e-9, midDef);
        var p = Math.Max(1e-9, power);
        var dp = Math.Pow(d, p);
        var mp = Math.Pow(mid, p);
        return dp / (dp + mp);
    }

    public static HitResolution Resolve(
        CombatFighterProfile attacker,
        CombatFighterProfile defender,
        double damageNoise,
        Random rng,
        double armorMidDef = 4800,
        double armorPower = 0.31)
    {
        if (defender.CanDodge && rng.NextDouble() < defender.DodgeChance!.Value)
        {
            return new HitResolution(true, false, 0, 0, 0, 0);
        }

        var reduction = ArmorDamageReduction(defender.DefBase, armorMidDef, armorPower);
        var baseDealt = Math.Max(0, attacker.DmgBase * (1.0 - reduction));
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

    /// <summary>
    /// HP/s bruto do monstro em combate (<c>baseStats.hpRegenPerSec</c> ou root). Ausente ⇒ 0.
    /// </summary>
    public static double ReadMonsterHpRegenPerSec(JsonElement monster) =>
        Math.Max(0, TryReadNestedStat(monster, "hpRegenPerSec") ?? 0);

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
