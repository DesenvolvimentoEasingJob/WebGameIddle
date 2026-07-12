using System.Text.Json.Nodes;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class ProceduralItemGenerator(
    GameDataLoader gameData,
    ItemNamingService namingService,
    GameDataWriter gameDataWriter,
    Microsoft.Extensions.Options.IOptions<LootOptions> lootOptions)
{
    private static readonly Lock GenerationLock = new();

    public ItemDefinition? TryPickExisting(string itemKind, string? classId, Random rng)
    {
        var candidates = gameData.FindItemsByKind(itemKind, classId)
            .Where(item => !GameDataItemEnsurer.IsStarterItem(item.Id))
            .ToList();

        if (candidates.Count == 0)
            return null;

        return candidates[rng.Next(candidates.Count)];
    }

    public async Task<ItemDefinition> GenerateAsync(
        string itemKind,
        string rarityId,
        RarityDefinition rarity,
        int floorLevel,
        string? classId,
        CancellationToken ct,
        string? targetItemId = null)
    {
        lock (GenerationLock)
        {
            if (targetItemId is null)
            {
                var existing = TryPickExisting(itemKind, classId, Random.Shared);
                if (existing is not null)
                    return existing;
            }
            else if (gameData.GetItem(targetItemId) is { } catalogItem)
            {
                return catalogItem;
            }
        }

        if (!gameData.ItemTypes.TryGetValue(itemKind, out var typeDef))
            throw new InvalidOperationException($"Tipo de item desconhecido: {itemKind}");

        var rarityLabel = gameData.Rarities.TryGetValue(rarityId, out var rarityDef)
            ? rarityDef.Label
            : rarityId;
        var useAiNaming = rarity.Order >= lootOptions.Value.AiNamingMinRarityOrder;
        var name = useAiNaming
            ? await namingService.GenerateItemNameAsync(itemKind, rarityLabel, classId, ct)
            : namingService.BuildFallbackName(itemKind, rarityLabel);
        var id = targetItemId ?? ItemSlugBuilder.Build(name, itemKind, id => gameData.GetItem(id) is not null);
        var level = Math.Max(1, floorLevel);
        var slot = typeDef.Slot;
        var itemType = slot switch
        {
            "weapon" => "weapon",
            "armor" => "armor",
            _ => "misc",
        };

        var classes = typeDef.Classes.Count > 0
            ? typeDef.Classes
            : classId is not null ? [classId] : Array.Empty<string>();

        var item = new ItemDefinition
        {
            Id = id,
            Name = name,
            Description = "Item gerado nas sombras da torre.",
            Type = itemType,
            ItemKind = itemKind,
            Slot = slot,
            Rarity = "common",
            Level = level,
            Classes = classes.ToList(),
            Stackable = false,
            MaxStack = 1,
            Categories = typeDef.BaseCategories.DeepClone()!.AsObject(),
            Assets = new JsonObject
            {
                ["icon"] = ItemStoragePaths.BuildIconPath(id, itemKind, itemType),
            },
        };

        lock (GenerationLock)
        {
            if (gameData.GetItem(item.Id) is { } alreadyRegistered)
                return alreadyRegistered;

            gameDataWriter.TryPersistItem(item);
        }

        return item;
    }
}
