using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class GameDataItemRenamer(
    IConfiguration configuration,
    IWebHostEnvironment environment,
    GameDataLoader gameData,
    ILogger<GameDataItemRenamer> logger)
{
    private static readonly Dictionary<string, string> LegacyIdMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["gen-staff-9722f08430"] = "crepusculo-staff",
        ["gen-armor-3f10c1bc55"] = "arcanista-armor",
        ["gen-armor-3cbd2ab133"] = "arcana-tunic",
        ["gen-staff-seed"] = "mystic-staff",
        ["gen-sword-seed"] = "ancient-sword",
        ["gen-armor-seed"] = "shadow-armor",
    };

    private readonly string _gameDataRoot = Path.Combine(environment.ContentRootPath, "GameData");
    private readonly string _characterRoot = configuration["CharacterStorage:Root"]
        ?? Path.Combine(environment.ContentRootPath, "data", "characters");

    public void RenameLegacyItems()
    {
        var renamed = 0;
        foreach (var (oldId, newId) in LegacyIdMap)
        {
            if (gameData.GetItem(newId) is not null)
                continue;

            if (ItemStoragePaths.FindItemFile(_gameDataRoot, oldId) is not { } oldPath)
                continue;

            renamed += RenameItemFile(oldPath, oldId, newId);
        }

        if (renamed > 0)
            logger.LogInformation("GameData: {Count} item(ns) renomeado(s) para IDs legíveis.", renamed);

        MigrateCharacterItemIds();
    }

    private int RenameItemFile(string oldPath, string oldId, string newId)
    {
        try
        {
            var node = JsonNode.Parse(File.ReadAllText(oldPath))?.AsObject();
            if (node is null)
                return 0;

            var itemKind = node["itemKind"]?.GetValue<string>();
            var type = node["type"]?.GetValue<string>();
            node["id"] = newId;

            if (node["assets"]?.AsObject() is { } assets)
                assets["icon"] = ItemStoragePaths.BuildIconPath(newId, itemKind, type);

            var newPath = ItemStoragePaths.GetItemFilePath(_gameDataRoot, newId, itemKind, type);
            Directory.CreateDirectory(Path.GetDirectoryName(newPath)!);
            File.WriteAllText(newPath, node.ToJsonString(new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true,
            }));

            if (!string.Equals(oldPath, newPath, StringComparison.OrdinalIgnoreCase))
                File.Delete(oldPath);

            gameData.RegisterItem(ParseItem(node));
            return 1;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao renomear item {OldId} -> {NewId}", oldId, newId);
            return 0;
        }
    }

    private void MigrateCharacterItemIds()
    {
        if (!Directory.Exists(_characterRoot))
            return;

        var migrated = 0;
        foreach (var userDir in Directory.GetDirectories(_characterRoot))
        {
            foreach (var file in Directory.GetFiles(userDir, "*.json"))
            {
                if (MigrateCharacterFile(file))
                    migrated++;
            }
        }

        if (migrated > 0)
            logger.LogInformation("GameData: {Count} save(s) de personagem atualizado(s) com novos IDs.", migrated);
    }

    private bool MigrateCharacterFile(string file)
    {
        try
        {
            var document = JsonNode.Parse(File.ReadAllText(file))?.AsObject();
            if (document is null)
                return false;

            var changed = false;
            changed |= ReplaceItemIds(document["inventory"]?["items"]?.AsArray());
            changed |= ReplaceItemIdsInEquipment(document["equipment"]?.AsObject());
            changed |= RenameGeneratedItems(document);

            if (!changed)
                return false;

            File.WriteAllText(file, document.ToJsonString(new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true,
            }));
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao migrar IDs em {File}", file);
            return false;
        }
    }

    private bool RenameGeneratedItems(JsonObject document)
    {
        var generated = document["generatedItems"]?.AsObject();
        if (generated is null)
            return false;

        var changed = false;
        foreach (var (oldId, newId) in LegacyIdMap)
        {
            if (generated[oldId] is not JsonNode entry)
                continue;

            if (generated[newId] is null)
                generated[newId] = entry.DeepClone();

            generated.Remove(oldId);
            changed = true;
        }

        if (generated.Count == 0)
            document.Remove("generatedItems");

        return changed;
    }

    private static bool ReplaceItemIdsInEquipment(JsonObject? equipment)
    {
        if (equipment is null)
            return false;

        var changed = false;
        foreach (var (_, value) in equipment)
        {
            if (value is not JsonObject entry)
                continue;

            if (ReplaceItemId(entry))
                changed = true;
        }

        return changed;
    }

    private static bool ReplaceItemIds(JsonArray? items)
    {
        if (items is null)
            return false;

        var changed = false;
        foreach (var entry in items.OfType<JsonObject>())
        {
            if (ReplaceItemId(entry))
                changed = true;
        }

        return changed;
    }

    private static bool ReplaceItemId(JsonObject entry)
    {
        var itemId = entry["itemId"]?.GetValue<string>();
        if (itemId is null || !LegacyIdMap.TryGetValue(itemId, out var newId))
            return false;

        entry["itemId"] = newId;
        return true;
    }

    private static ItemDefinition ParseItem(JsonObject node)
    {
        var classes = node["classes"]?.AsArray()
            ?.Select(c => c?.GetValue<string>() ?? "")
            .Where(c => c.Length > 0)
            .ToList() ?? [];

        return new ItemDefinition
        {
            Id = node["id"]?.GetValue<string>() ?? "",
            Name = node["name"]?.GetValue<string>() ?? "",
            Description = node["description"]?.GetValue<string>(),
            Type = node["type"]?.GetValue<string>() ?? "misc",
            ItemKind = node["itemKind"]?.GetValue<string>(),
            Slot = node["slot"]?.GetValue<string>(),
            Rarity = node["rarity"]?.GetValue<string>() ?? "common",
            Level = node["level"]?.GetValue<int>() ?? 1,
            Classes = classes,
            Stackable = node["stackable"]?.GetValue<bool>() ?? false,
            MaxStack = node["maxStack"]?.GetValue<int>() ?? 1,
            Categories = node["categories"]?.AsObject() ?? new JsonObject(),
            Assets = node["assets"]?.AsObject(),
        };
    }
}
