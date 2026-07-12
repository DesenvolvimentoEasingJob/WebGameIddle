using System.Text.Json.Nodes;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class ItemDropService(
    GameDataLoader gameData,
    ProceduralItemGenerator proceduralItemGenerator)
{
    public async Task<ItemDropResult?> TryRollDropAsync(
        JsonObject document,
        MobDefinition mob,
        TowerFloorDefinition floor,
        string? classId,
        CancellationToken ct,
        Random? rng = null)
    {
        rng ??= Random.Shared;
        var loot = mob.Loot ?? gameData.DefaultMobLoot;
        if (rng.NextDouble() > loot.DropChance)
            return null;

        var rarityId = RollWeighted(loot.RarityWeights, rng);
        if (rarityId is null || !gameData.Rarities.TryGetValue(rarityId, out var rarity))
            return null;

        var poolId = floor.LootPool ?? gameData.DefaultLootPoolId;
        if (!gameData.LootPools.TryGetValue(poolId, out var pool))
            return null;

        var poolEntry = PickPoolEntry(pool, classId, rng);
        if (poolEntry is null)
            return null;

        var itemDef = await ResolveItemDefinitionAsync(
            poolEntry,
            floor.Floor,
            rarityId,
            rarity,
            classId,
            rng,
            ct);

        if (itemDef is null)
            return null;

        var instance = BuildDropInstance(itemDef, rarity, floor.Floor, rng);
        return new ItemDropResult(instance, itemDef, rarityId);
    }

    public InventoryAddResult TryAddToInventory(JsonObject document, ItemDropResult drop)
    {
        var inventory = document["inventory"]?.AsObject()
            ?? throw new InvalidOperationException("Inventário inválido.");
        var items = inventory["items"]?.AsArray() ?? new JsonArray();
        var capacity = inventory["capacity"]?.GetValue<int>() ?? 40;

        if (drop.ItemDef.Stackable)
        {
            var existing = items
                .OfType<JsonObject>()
                .FirstOrDefault(i =>
                    string.Equals(i["itemId"]?.GetValue<string>(), drop.ItemDef.Id, StringComparison.OrdinalIgnoreCase) &&
                    i["rolledCategories"] is null);

            if (existing is not null)
            {
                var qty = existing["quantity"]?.GetValue<int>() ?? 1;
                existing["quantity"] = qty + 1;
                return InventoryAddResult.Added;
            }
        }

        if (items.Count >= capacity)
            return InventoryAddResult.InventoryFull;

        items.Add(drop.Instance.DeepClone());
        return InventoryAddResult.Added;
    }

    private async Task<ItemDefinition?> ResolveItemDefinitionAsync(
        LootPoolEntry poolEntry,
        int floorLevel,
        string rarityId,
        RarityDefinition rarity,
        string? classId,
        Random rng,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(poolEntry.ItemKind))
        {
            if (proceduralItemGenerator.TryPickExisting(poolEntry.ItemKind, classId, rng) is { } existing)
                return existing;

            return await proceduralItemGenerator.GenerateAsync(
                poolEntry.ItemKind,
                rarityId,
                rarity,
                floorLevel,
                classId,
                ct);
        }

        if (string.IsNullOrWhiteSpace(poolEntry.ItemId))
            return null;

        if (gameData.GetItem(poolEntry.ItemId) is { } catalogItem)
            return catalogItem;

        if (!poolEntry.GenerateIfMissing)
            return null;

        var itemKind = ItemKindInference.FromItemId(poolEntry.ItemId);
        if (itemKind is null)
            return null;

        return await proceduralItemGenerator.GenerateAsync(
            itemKind,
            rarityId,
            rarity,
            floorLevel,
            classId,
            ct,
            targetItemId: poolEntry.ItemId);
    }

    private JsonObject BuildDropInstance(
        ItemDefinition itemDef,
        RarityDefinition rarity,
        int floorLevel,
        Random rng)
    {
        var instance = new JsonObject
        {
            ["instanceId"] = Guid.NewGuid().ToString(),
            ["itemId"] = itemDef.Id,
            ["quantity"] = 1,
        };

        if (itemDef.Stackable)
            return instance;

        instance["rarity"] = ResolveRarityId(rarity);
        instance["rolledCategories"] = ScaleCategories(itemDef.Categories, rarity.BaseStatMultiplier);

        var affixCount = RollAffixCount(rarity, rng);
        var rolledAffixes = ItemAffixRoller.RollAffixes(gameData, itemDef, affixCount, rarity, floorLevel, rng);
        if (rolledAffixes.Count > 0)
            instance["rolledAffixes"] = rolledAffixes;

        return instance;
    }

    private string ResolveRarityId(RarityDefinition rarity)
    {
        foreach (var (id, def) in gameData.Rarities)
        {
            if (def.Order == rarity.Order)
                return id;
        }

        return "common";
    }

    private static int RollAffixCount(RarityDefinition rarity, Random rng)
    {
        if (rarity.AffixRollMax <= 0)
            return 0;

        return rng.Next(rarity.AffixRollMin, rarity.AffixRollMax + 1);
    }

    private static JsonObject ScaleCategories(JsonObject categories, double multiplier)
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

    private LootPoolEntry? PickPoolEntry(LootPoolDefinition pool, string? classId, Random rng)
    {
        var eligible = pool.Entries
            .Where(entry => IsPoolEntryEligible(entry, classId))
            .ToList();

        if (eligible.Count == 0)
            eligible = pool.Entries.ToList();

        return PickWeighted(eligible, rng);
    }

    private bool IsPoolEntryEligible(LootPoolEntry entry, string? classId)
    {
        if (!string.IsNullOrWhiteSpace(entry.ItemKind))
        {
            if (!gameData.ItemTypes.TryGetValue(entry.ItemKind, out var typeDef))
                return false;

            if (typeDef.Classes.Count == 0 || classId is null)
                return true;

            return typeDef.Classes.Contains(classId, StringComparer.OrdinalIgnoreCase);
        }

        if (string.IsNullOrWhiteSpace(entry.ItemId))
            return false;

        var item = gameData.GetItem(entry.ItemId);
        if (item is null)
            return entry.GenerateIfMissing;

        if (item.Classes.Count == 0 || classId is null)
            return true;

        return item.Classes.Contains(classId, StringComparer.OrdinalIgnoreCase);
    }

    private static LootPoolEntry? PickWeighted(IReadOnlyList<LootPoolEntry> entries, Random rng)
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

    private static string? RollWeighted(IReadOnlyDictionary<string, double> weights, Random rng)
    {
        var total = weights.Values.Sum();
        if (total <= 0)
            return null;

        var roll = rng.NextDouble() * total;
        foreach (var (key, weight) in weights)
        {
            roll -= weight;
            if (roll <= 0)
                return key;
        }

        return weights.Keys.Last();
    }
}

public enum InventoryAddResult
{
    Added,
    InventoryFull,
}

public record ItemDropResult(JsonObject Instance, ItemDefinition ItemDef, string RarityId);
