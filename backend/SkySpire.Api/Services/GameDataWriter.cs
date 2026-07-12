using System.Text.Json;
using System.Text.Json.Nodes;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class GameDataWriter(IWebHostEnvironment environment, GameDataLoader gameData)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
    };

    private readonly string _gameDataRoot = Path.Combine(environment.ContentRootPath, "GameData");
    private readonly Lock _writeLock = new();

    public bool TryPersistItem(ItemDefinition item)
    {
        lock (_writeLock)
        {
            if (gameData.GetItem(item.Id) is not null)
                return false;

            if (ItemStoragePaths.FindItemFile(_gameDataRoot, item.Id) is not null)
            {
                gameData.RegisterItem(NormalizeItemAssets(item));
                return false;
            }

            var normalized = NormalizeItemAssets(item);
            var path = ItemStoragePaths.GetItemFilePath(
                _gameDataRoot,
                normalized.Id,
                normalized.ItemKind,
                normalized.Type);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, SerializeItem(normalized));
            gameData.RegisterItem(normalized);
            return true;
        }
    }

    public void OrganizeItemStorage()
    {
        lock (_writeLock)
        {
            var itemsRoot = Path.Combine(_gameDataRoot, "items");
            if (!Directory.Exists(itemsRoot))
                return;

            foreach (var file in Directory.GetFiles(itemsRoot, "*.json", SearchOption.TopDirectoryOnly))
            {
                var json = File.ReadAllText(file);
                var node = JsonNode.Parse(json)?.AsObject();
                if (node is null)
                    continue;

                var id = node["id"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(id))
                    continue;

                var itemKind = node["itemKind"]?.GetValue<string>();
                var type = node["type"]?.GetValue<string>();
                var targetPath = ItemStoragePaths.GetItemFilePath(_gameDataRoot, id, itemKind, type);
                if (string.Equals(file, targetPath, StringComparison.OrdinalIgnoreCase))
                    continue;

                Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);
                if (!File.Exists(targetPath))
                    File.Move(file, targetPath);
                else
                    File.Delete(file);
            }
        }
    }

    public bool TryAddProceduralPrefix(string prefix)
    {
        if (string.IsNullOrWhiteSpace(prefix))
            return false;

        var normalized = prefix.Trim();
        if (gameData.ProceduralPrefixes.Contains(normalized, StringComparer.OrdinalIgnoreCase))
            return false;

        lock (_writeLock)
        {
            if (gameData.ProceduralPrefixes.Contains(normalized, StringComparer.OrdinalIgnoreCase))
                return false;

            var path = Path.Combine(_gameDataRoot, "loot", "procedural-names.json");
            if (!File.Exists(path))
                return false;

            var node = JsonNode.Parse(File.ReadAllText(path))?.AsObject();
            if (node is null)
                return false;

            var prefixes = node["prefixes"]?.AsArray() ?? new JsonArray();
            if (prefixes.Any(p => string.Equals(p?.GetValue<string>(), normalized, StringComparison.OrdinalIgnoreCase)))
                return false;

            prefixes.Add(normalized);
            node["prefixes"] = prefixes;
            File.WriteAllText(path, node.ToJsonString(JsonOptions));
            gameData.RegisterProceduralPrefix(normalized);
            return true;
        }
    }

    private static ItemDefinition NormalizeItemAssets(ItemDefinition item)
    {
        var icon = item.Assets?["icon"]?.GetValue<string>();
        if (!string.IsNullOrWhiteSpace(icon) && icon != "unknown.png")
            return item;

        var normalizedIcon = ItemStoragePaths.BuildIconPath(item.Id, item.ItemKind, item.Type);
        return new ItemDefinition
        {
            Id = item.Id,
            Name = item.Name,
            Description = item.Description,
            Type = item.Type,
            ItemKind = item.ItemKind,
            Slot = item.Slot,
            Rarity = item.Rarity,
            Level = item.Level,
            Classes = item.Classes,
            Stackable = item.Stackable,
            MaxStack = item.MaxStack,
            Categories = item.Categories,
            Assets = new JsonObject { ["icon"] = normalizedIcon },
        };
    }

    private static string SerializeItem(ItemDefinition item)
    {
        var node = new JsonObject
        {
            ["id"] = item.Id,
            ["name"] = item.Name,
            ["type"] = item.Type,
            ["rarity"] = item.Rarity,
            ["level"] = item.Level,
        };

        if (!string.IsNullOrWhiteSpace(item.Description))
            node["description"] = item.Description;
        if (!string.IsNullOrWhiteSpace(item.ItemKind))
            node["itemKind"] = item.ItemKind;
        if (!string.IsNullOrWhiteSpace(item.Slot))
            node["slot"] = item.Slot;
        if (item.Classes.Count > 0)
            node["classes"] = new JsonArray(item.Classes.Select(c => JsonValue.Create(c)).ToArray());
        if (item.Stackable)
        {
            node["stackable"] = true;
            if (item.MaxStack != 1)
                node["maxStack"] = item.MaxStack;
        }

        if (item.Categories.Count > 0)
            node["categories"] = item.Categories.DeepClone();
        if (item.Assets is not null)
            node["assets"] = item.Assets.DeepClone();

        return node.ToJsonString(JsonOptions);
    }
}
