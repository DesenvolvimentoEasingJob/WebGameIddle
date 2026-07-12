using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public static class RarityRoller
{
    public static string Roll(
        IReadOnlyDictionary<string, RarityDefinition> rarities,
        Random rng,
        int bonusTiers = 0)
    {
        var weighted = rarities
            .Where(pair => pair.Value.DropWeight > 0)
            .OrderBy(pair => pair.Value.Order)
            .ToList();

        if (weighted.Count == 0)
            return "common";

        var total = weighted.Sum(pair => pair.Value.DropWeight);
        var roll = rng.NextDouble() * total;

        string selected = weighted[0].Key;
        foreach (var (id, def) in weighted)
        {
            roll -= def.DropWeight;
            selected = id;
            if (roll <= 0)
                break;
        }

        if (bonusTiers <= 0)
            return selected;

        var ordered = weighted.Select(pair => pair.Key).ToList();
        var index = ordered.FindIndex(id => id.Equals(selected, StringComparison.OrdinalIgnoreCase));
        if (index < 0)
            index = 0;

        index = Math.Min(index + bonusTiers, ordered.Count - 1);
        return ordered[index];
    }
}
