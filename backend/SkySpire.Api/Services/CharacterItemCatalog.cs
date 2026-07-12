using System.Text.Json.Nodes;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public static class CharacterItemCatalog
{
    public static ItemDefinition? Resolve(GameDataLoader gameData, JsonObject document, string itemId)
    {
        if (gameData.GetItem(itemId) is { } catalogItem)
            return catalogItem;

        return TryParseGenerated(document, itemId);
    }

    public static void RegisterGenerated(JsonObject document, ItemDefinition item)
    {
        var generated = document["generatedItems"]?.AsObject() ?? new JsonObject();
        document["generatedItems"] = generated;
        generated[item.Id] = ToJson(item);
    }

    public static IEnumerable<ItemDefinition> EnumerateGenerated(JsonObject document)
    {
        var generated = document["generatedItems"]?.AsObject();
        if (generated is null)
            yield break;

        foreach (var (_, value) in generated)
        {
            if (value is JsonObject node &&
                TryParseGeneratedNode(node) is { } item)
            {
                yield return item;
            }
        }
    }

    private static ItemDefinition? TryParseGenerated(JsonObject document, string itemId)
    {
        var node = document["generatedItems"]?[itemId]?.AsObject();
        return node is null ? null : TryParseGeneratedNode(node);
    }

    private static ItemDefinition? TryParseGeneratedNode(JsonObject node)
    {
        var id = node["id"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(id))
            return null;

        var classes = node["classes"]?.AsArray()
            ?.Select(c => c?.GetValue<string>() ?? "")
            .Where(c => c.Length > 0)
            .ToList() ?? [];

        return new ItemDefinition
        {
            Id = id,
            Name = node["name"]?.GetValue<string>() ?? id,
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

    private static JsonObject ToJson(ItemDefinition item) =>
        new()
        {
            ["id"] = item.Id,
            ["name"] = item.Name,
            ["description"] = item.Description,
            ["type"] = item.Type,
            ["itemKind"] = item.ItemKind,
            ["slot"] = item.Slot,
            ["rarity"] = item.Rarity,
            ["level"] = item.Level,
            ["classes"] = new JsonArray(item.Classes.Select(c => JsonValue.Create(c)).ToArray()),
            ["stackable"] = item.Stackable,
            ["maxStack"] = item.MaxStack,
            ["categories"] = item.Categories.DeepClone(),
            ["assets"] = item.Assets?.DeepClone(),
        };
}
