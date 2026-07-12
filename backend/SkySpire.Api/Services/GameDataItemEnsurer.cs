using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class GameDataItemEnsurer(
    IConfiguration configuration,
    IWebHostEnvironment environment,
    GameDataLoader gameData,
    GameDataWriter gameDataWriter,
    ItemNamingService namingService,
    ILogger<GameDataItemEnsurer> logger)
{
    private static readonly string[] StarterItemIds =
    [
        "wooden-staff",
        "iron-sword",
        "leather-armor",
        "health-potion",
    ];

    public static bool IsStarterItem(string itemId) =>
        StarterItemIds.Contains(itemId, StringComparer.OrdinalIgnoreCase);

    private readonly string _characterRoot = configuration["CharacterStorage:Root"]
        ?? Path.Combine(environment.ContentRootPath, "data", "characters");

    public void EnsureReferencedItems()
    {
        var created = 0;

        foreach (var itemId in CollectReferencedItemIds())
        {
            if (gameData.GetItem(itemId) is not null)
                continue;

            if (TryCreateAndPersist(itemId) is not null)
                created++;
        }

        foreach (var itemKind in CollectReferencedItemKinds())
        {
            if (gameData.FindItemsByKind(itemKind).Any(item => !IsStarterItem(item.Id)))
                continue;

            var seedId = ItemSlugBuilder.Build(
                namingService.BuildFallbackName(itemKind, "Comum"),
                itemKind,
                id => gameData.GetItem(id) is not null);
            if (gameData.GetItem(seedId) is not null)
                continue;

            if (TryCreateFromKind(seedId, itemKind) is not null)
                created++;
        }

        if (created > 0)
            logger.LogInformation("GameData: {Count} item(ns) criado(s) automaticamente.", created);
    }

    public void MigrateCharacterGeneratedItems()
    {
        if (!Directory.Exists(_characterRoot))
            return;

        var migrated = 0;
        foreach (var userDir in Directory.GetDirectories(_characterRoot))
        {
            foreach (var file in Directory.GetFiles(userDir, "*.json"))
                migrated += MigrateGeneratedItemsFromFile(file);
        }

        if (migrated > 0)
            logger.LogInformation("GameData: {Count} item(ns) migrado(s) de personagens.", migrated);
    }

    /// <summary>
    /// Garante que todo item do documento exista no catálogo global e remove
    /// do save entradas de generatedItems já migradas (evita duplicidade).
    /// Retorna true quando o documento foi alterado.
    /// </summary>
    public bool EnsureDocumentItems(JsonObject document)
    {
        foreach (var itemId in CollectItemIdsFromDocument(document))
        {
            if (gameData.GetItem(itemId) is not null)
                continue;

            if (CharacterItemCatalog.Resolve(gameData, document, itemId) is { } generated)
            {
                gameDataWriter.TryPersistItem(generated);
                continue;
            }

            TryCreateAndPersist(itemId);
        }

        return RemoveMigratedGeneratedItems(document);
    }

    private bool RemoveMigratedGeneratedItems(JsonObject document)
    {
        var generated = document["generatedItems"]?.AsObject();
        if (generated is null || generated.Count == 0)
            return false;

        var migratedIds = generated
            .Select(pair => pair.Key)
            .Where(itemId => gameData.GetItem(itemId) is not null)
            .ToList();

        foreach (var itemId in migratedIds)
            generated.Remove(itemId);

        if (generated.Count == 0)
            document.Remove("generatedItems");

        return migratedIds.Count > 0;
    }

    private int MigrateGeneratedItemsFromFile(string file)
    {
        try
        {
            var document = JsonNode.Parse(File.ReadAllText(file))?.AsObject();
            if (document is null)
                return 0;

            var migrated = 0;
            foreach (var item in CharacterItemCatalog.EnumerateGenerated(document))
            {
                if (gameDataWriter.TryPersistItem(item))
                    migrated++;
            }

            return migrated;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao migrar itens gerados de {File}", file);
            return 0;
        }
    }

    private ItemDefinition? TryCreateAndPersist(string itemId)
    {
        var itemKind = ItemKindInference.FromItemId(itemId);
        if (itemKind is null)
        {
            logger.LogWarning("Item '{ItemId}' referenciado mas sem itemKind inferível.", itemId);
            return null;
        }

        return TryCreateFromKind(itemId, itemKind);
    }

    private ItemDefinition? TryCreateFromKind(string itemId, string itemKind)
    {
        if (gameData.GetItem(itemId) is not null)
            return gameData.GetItem(itemId);

        if (!gameData.ItemTypes.TryGetValue(itemKind, out var typeDef))
        {
            logger.LogWarning("Item '{ItemId}' referenciado mas tipo '{ItemKind}' não existe.", itemId, itemKind);
            return null;
        }

        var item = BuildFromType(itemId, itemKind, typeDef);
        return gameDataWriter.TryPersistItem(item) ? item : gameData.GetItem(itemId);
    }

    private ItemDefinition BuildFromType(string itemId, string itemKind, ItemTypeDefinition typeDef)
    {
        var slot = typeDef.Slot;
        var itemType = itemKind switch
        {
            "potion" => "consumable",
            "staff" or "sword" => "weapon",
            "armor" => "armor",
            _ => slot switch
            {
                "weapon" => "weapon",
                "armor" => "armor",
                _ => "misc",
            },
        };

        var stackable = itemKind == "potion";
        var name = namingService.BuildFallbackName(itemKind, "Comum");

        return new ItemDefinition
        {
            Id = itemId,
            Name = name,
            Description = "Item registrado automaticamente no catálogo.",
            Type = itemType,
            ItemKind = itemKind,
            Slot = slot,
            Rarity = "common",
            Level = 1,
            Classes = typeDef.Classes.ToList(),
            Stackable = stackable,
            MaxStack = stackable ? 99 : 1,
            Categories = typeDef.BaseCategories.DeepClone()!.AsObject(),
            Assets = new JsonObject
            {
                ["icon"] = ItemStoragePaths.BuildIconPath(itemId, itemKind, itemType),
            },
        };
    }

    private HashSet<string> CollectReferencedItemIds()
    {
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var starterId in StarterItemIds)
            ids.Add(starterId);

        foreach (var pool in gameData.LootPools.Values)
        {
            foreach (var entry in pool.Entries)
            {
                if (!string.IsNullOrWhiteSpace(entry.ItemId))
                    ids.Add(entry.ItemId);
            }
        }

        return ids;
    }

    private HashSet<string> CollectReferencedItemKinds()
    {
        var kinds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var pool in gameData.LootPools.Values)
        {
            foreach (var entry in pool.Entries)
            {
                if (!string.IsNullOrWhiteSpace(entry.ItemKind))
                    kinds.Add(entry.ItemKind);
            }
        }

        return kinds;
    }

    private static HashSet<string> CollectItemIdsFromDocument(JsonObject document)
    {
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var inventoryItems = document["inventory"]?["items"]?.AsArray();
        if (inventoryItems is not null)
        {
            foreach (var entry in inventoryItems.OfType<JsonObject>())
            {
                var itemId = entry["itemId"]?.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(itemId))
                    ids.Add(itemId);
            }
        }

        var equipment = document["equipment"]?.AsObject();
        if (equipment is not null)
        {
            foreach (var (_, value) in equipment)
            {
                if (value is not JsonObject equipped)
                    continue;

                var itemId = equipped["itemId"]?.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(itemId))
                    ids.Add(itemId);
            }
        }

        var generated = document["generatedItems"]?.AsObject();
        if (generated is not null)
        {
            foreach (var (itemId, _) in generated)
                ids.Add(itemId);
        }

        return ids;
    }
}
