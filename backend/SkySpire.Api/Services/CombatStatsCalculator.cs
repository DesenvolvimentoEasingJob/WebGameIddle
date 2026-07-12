using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

public readonly record struct CombatStats(
    int Attack,
    int Defense,
    int Hp,
    int Mp,
    int CritChancePercent,
    int LifeStealPercent,
    int PhysicalBonusPercent,
    int MagicalBonusPercent);

public static class CombatStatsCalculator
{
    public static CombatStats FromCharacter(JsonObject document, JsonObject effectiveCategories)
    {
        var attrs = effectiveCategories["attributes"]?.AsObject();
        var damage = effectiveCategories["damage"]?.AsObject();
        var combat = effectiveCategories["combat"]?.AsObject();
        var str = ReadAttr(attrs, "strength");
        var agi = ReadAttr(attrs, "agility");
        var intel = ReadAttr(attrs, "intelligence");
        var dex = ReadAttr(attrs, "dexterity");
        var con = ReadAttr(attrs, "constitution");
        var vit = ReadAttr(attrs, "vitality");
        var level = document["progression"]?["level"].GetInt32Value(1) ?? 1;
        var hpBonus = ReadNestedInt(combat, "hpBonus");

        var physicalBonus = ReadNestedInt(damage?["physical"]?.AsObject(), "bonusPercent");
        var magicalBonus = ReadNestedInt(damage?["magical"]?.AsObject(), "bonusPercent");
        var critChance = ReadNestedInt(combat, "critChancePercent");
        var lifeSteal = ReadNestedInt(combat, "lifeStealPercent");

        var attack = str * 12 + agi * 4 + intel * 2 + dex * 3 + level * 10;
        var bonusPercent = Math.Max(physicalBonus, magicalBonus);
        if (bonusPercent > 0)
            attack = (int)Math.Round(attack * (1 + bonusPercent / 100.0));

        return new CombatStats(
            Attack: attack,
            Defense: str * 3 + agi * 6 + intel * 2 + con * 4 + level * 8 + ReadNestedInt(combat, "defenseBonus"),
            Hp: ApplyPercentBonus(
                str * 8 + agi * 4 + intel * 3 + vit * 6 + con * 5 + level * 50 + hpBonus,
                ReadNestedInt(combat, "hpPercentBonus")),
            Mp: ApplyPercentBonus(
                intel * 12 + level * 30 + ReadNestedInt(combat, "mpBonus"),
                ReadNestedInt(combat, "mpPercentBonus")),
            CritChancePercent: critChance,
            LifeStealPercent: lifeSteal,
            PhysicalBonusPercent: physicalBonus,
            MagicalBonusPercent: magicalBonus);
    }

    private static int ApplyPercentBonus(int baseValue, int percentBonus)
    {
        if (percentBonus <= 0)
            return baseValue;

        return (int)Math.Round(baseValue * (1 + percentBonus / 100.0));
    }

    private static int ReadAttr(JsonObject? attrs, string key)
    {
        if (attrs is null)
            return 0;

        var node = attrs[key]?.AsObject();
        var baseVal = node?["base"].GetInt32Value() ?? 0;
        var bonus = node?["bonus"].GetInt32Value() ?? 0;
        return baseVal + bonus;
    }

    private static int ReadNestedInt(JsonObject? node, string key) =>
        node?[key].GetInt32Value() ?? 0;
}
