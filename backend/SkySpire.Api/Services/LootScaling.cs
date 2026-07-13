namespace SkySpire.Api.Services;

public static class LootScaling
{
    public const double StatMultiplierCap = 50.0;
    public const int AffixCountCap = 12;

    public static double LevelMultiplier(int level) =>
        Math.Max(0, level) / 2.0;

    public static double RarityStatMultiplier(int order)
    {
        if (order <= 0)
            return 1.0;

        var mult = 1 + order * 0.02
            + Math.Floor(order / 10.0) * 0.05
            + Math.Floor(order / 25.0) * 0.10;

        return Math.Min(mult, StatMultiplierCap);
    }

    public static double RarityDropWeight(int order) =>
        Math.Floor(1_000_000 * Math.Pow(0.55, order));

    public static (int Min, int Max) AffixRollRange(int order)
    {
        if (order <= 0)
            return (0, 0);

        var min = Math.Max(1, (int)Math.Floor((order + 1) / 2.0) - 1);
        var max = Math.Min(AffixCountCap, Math.Max(min, (int)Math.Floor((order + 1) / 2.0)));
        return (min, max);
    }

    public static int AffixFloorBonus(int level) =>
        (int)Math.Floor(Math.Max(0, level - 1) * 0.5);

    public static double CombinedStatMultiplier(int rarityOrder, int level) =>
        RarityStatMultiplier(rarityOrder) * LevelMultiplier(level);
}
