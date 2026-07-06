using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

public readonly record struct CombatStats(int Attack, int Defense, int Hp, int Mp);

public static class CombatStatsCalculator
{
    public static CombatStats FromCharacter(JsonObject document, JsonObject effectiveCategories)
    {
        var attrs = effectiveCategories["attributes"]?.AsObject();
        var str = ReadAttr(attrs, "strength");
        var agi = ReadAttr(attrs, "agility");
        var intel = ReadAttr(attrs, "intelligence");
        var level = document["progression"]?["level"].GetInt32Value(1) ?? 1;

        return new CombatStats(
            Attack: str * 12 + agi * 4 + intel * 2 + level * 10,
            Defense: str * 3 + agi * 6 + intel * 2 + level * 8,
            Hp: str * 8 + agi * 4 + intel * 3 + level * 50,
            Mp: intel * 12 + level * 30);
    }

    private static int ReadAttr(JsonObject? attrs, string key)
    {
        if (attrs is null)
            return 0;

        return attrs[key]?["base"].GetInt32Value() ?? 0;
    }
}
