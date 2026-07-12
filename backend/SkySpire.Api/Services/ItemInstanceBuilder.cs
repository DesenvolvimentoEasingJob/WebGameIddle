using System.Text.Json.Nodes;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class ItemInstanceBuilder(ItemIntegrityService integrityService, ItemAffixRoller affixRoller)
{
    public JsonObject Build(
        ItemDefinition itemDef,
        RarityDefinition rarity,
        string rarityId,
        int floorLevel,
        Random rng,
        DropContext? context = null)
    {
        var instance = new JsonObject
        {
            ["instanceId"] = Guid.NewGuid().ToString(),
            ["itemId"] = itemDef.Id,
            ["quantity"] = 1,
        };

        if (itemDef.Stackable)
            return integrityService.SignInstance(instance);

        var level = Math.Max(1, floorLevel);
        var totalMultiplier = LootScaling.CombinedStatMultiplier(rarity.Order, level);

        instance["level"] = level;
        instance["rarity"] = rarityId;
        instance["rolledCategories"] = ScaleCategories(itemDef.Categories, totalMultiplier);

        var affixCount = RollAffixCount(rarity, rng);
        var rolledAffixes = affixRoller.RollAffixes(
            itemDef,
            affixCount,
            rarity,
            level,
            rng);

        if (rolledAffixes.Count > 0)
            instance["rolledAffixes"] = rolledAffixes;

        if (context is not null)
        {
            instance["dropMeta"] = new JsonObject
            {
                ["floor"] = context.Floor,
                ["mobId"] = context.MobId,
                ["seed"] = context.Seed,
                ["rollIndex"] = context.RollIndex,
                ["rolledAt"] = DateTime.UtcNow.ToString("O"),
            };
        }

        return integrityService.SignInstance(instance);
    }

    private static int RollAffixCount(RarityDefinition rarity, Random rng)
    {
        if (rarity.AffixRollMax <= 0)
            return 0;

        return rng.Next(rarity.AffixRollMin, rarity.AffixRollMax + 1);
    }

    public static JsonObject ScaleCategories(JsonObject categories, double multiplier)
    {
        var result = new JsonObject();
        foreach (var (key, value) in categories)
        {
            if (value is JsonObject child)
            {
                result[key] = ScaleCategories(child, multiplier);
                continue;
            }

            if (value is JsonValue jsonValue && jsonValue.TryGetValue(out double number))
            {
                var scaled = number * multiplier;
                result[key] = Math.Abs(scaled % 1) < double.Epsilon
                    ? JsonValue.Create((long)Math.Round(scaled))
                    : JsonValue.Create(Math.Round(scaled, 2));
                continue;
            }

            result[key] = value?.DeepClone();
        }

        return result;
    }
}

public record DropContext(int Floor, string MobId, string Seed, int RollIndex);
