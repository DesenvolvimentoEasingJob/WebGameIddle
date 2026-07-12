using System.Text.Json.Nodes;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public static class ItemAffixRoller
{
    public static JsonArray RollAffixes(
        GameDataLoader gameData,
        ItemDefinition itemDef,
        int count,
        RarityDefinition rarity,
        int floorLevel,
        Random rng)
    {
        var affixes = new JsonArray();
        if (count <= 0)
            return affixes;

        var itemKind = itemDef.ItemKind ?? itemDef.Type;
        if (!gameData.ItemTypes.TryGetValue(itemKind, out var typeDef) || typeDef.AffixPool.Count == 0)
            return affixes;

        var pool = typeDef.AffixPool.ToList();
        var usedAffixes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < count && pool.Count > 0; i++)
        {
            var entry = PickWeighted(pool, rng);
            if (entry is null)
                break;

            pool.Remove(entry);
            if (!usedAffixes.Add(entry.AffixId))
            {
                i--;
                continue;
            }

            if (!gameData.Affixes.TryGetValue(entry.AffixId, out var affix))
                continue;

            var value = EvaluateAffix(affix, rarity, floorLevel, rng);
            affixes.Add(new JsonObject
            {
                ["affixId"] = affix.Id,
                ["label"] = affix.Label,
                ["value"] = value,
                ["suffix"] = affix.Suffix,
                ["categoryPath"] = affix.CategoryPath,
            });
        }

        return affixes;
    }

    public static JsonObject MergeAffixesIntoCategories(
        JsonObject baseCategories,
        JsonArray? rolledAffixes)
    {
        if (rolledAffixes is null || rolledAffixes.Count == 0)
            return baseCategories;

        var merged = baseCategories;
        foreach (var node in rolledAffixes)
        {
            if (node is not JsonObject affixRoll)
                continue;

            merged = CategoryMerger.Merge(merged, AffixRollToCategories(affixRoll));
        }

        return merged;
    }

    public static JsonObject AffixRollToCategories(JsonObject affixRoll)
    {
        var path = affixRoll["categoryPath"]?.GetValue<string>();
        var value = affixRoll["value"]?.GetValue<int>() ?? 0;
        if (string.IsNullOrWhiteSpace(path))
            return new JsonObject();

        var segments = path.Split('.', StringSplitOptions.RemoveEmptyEntries);
        JsonNode current = JsonValue.Create(value);
        for (var i = segments.Length - 1; i >= 0; i--)
            current = new JsonObject { [segments[i]] = current };

        return current.AsObject();
    }

    public static int EvaluateAffix(
        AffixDefinition affix,
        RarityDefinition rarity,
        int floorLevel,
        Random rng)
    {
        var min = affix.RangeMin;
        var max = affix.RangeMax + (rarity.Order * affix.RarityRangeStep);
        max += Math.Max(0, (floorLevel - 1) / 3);

        if (max < min)
            max = min;

        return rng.Next(min, max + 1);
    }

    private static AffixPoolEntry? PickWeighted(IReadOnlyList<AffixPoolEntry> entries, Random rng)
    {
        var total = entries.Sum(e => e.Weight);
        if (total <= 0)
            return null;

        var roll = rng.NextDouble() * total;
        foreach (var entry in entries)
        {
            roll -= entry.Weight;
            if (roll <= 0)
                return entry;
        }

        return entries[^1];
    }
}
