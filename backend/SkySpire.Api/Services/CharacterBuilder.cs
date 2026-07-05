using System.Text.Json.Nodes;
using SkySpire.Api.Models;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class CharacterBuilder(GameDataLoader gameData, GameStateInitializer gameStateInitializer)
{
    public JsonObject BuildFromRace(Guid characterId, ArchetypeDefinition race)
    {
        var categories = CategoryMerger.Merge(
            gameData.BaseCategories.DeepClone()!.AsObject(),
            race.Categories);

        var document = new JsonObject
        {
            ["id"] = characterId.ToString(),
            ["raceId"] = race.Id,
            ["classId"] = null,
            ["status"] = "draft",
            ["assets"] = race.Assets?.DeepClone(),
            ["categories"] = categories,
            ["equipmentSlots"] = ToEquipmentSlotsArray(race.EquipmentSlots),
            ["createdAt"] = DateTime.UtcNow.ToString("O"),
            ["updatedAt"] = DateTime.UtcNow.ToString("O"),
        };

        return document;
    }

    public JsonObject ApplyClass(JsonObject document, ArchetypeDefinition classDef)
    {
        var currentCategories = document["categories"]?.AsObject()
            ?? throw new InvalidOperationException("Character document missing categories.");

        var merged = CategoryMerger.Merge(currentCategories, classDef.Categories);

        document["categories"] = merged;
        document["classId"] = classDef.Id;
        document["status"] = "complete";
        document["updatedAt"] = DateTime.UtcNow.ToString("O");

        var raceId = document["raceId"]?.GetValue<string>();
        var spriteSuffix = classDef.Assets?["spriteSuffix"]?.GetValue<string>();
        if (raceId is not null && spriteSuffix is not null)
        {
            var assets = document["assets"]?.AsObject() ?? new JsonObject();
            assets["sprite"] = $"classes/{raceId}-{spriteSuffix}.png";
            document["assets"] = assets;
        }

        return gameStateInitializer.EnsureGameState(document);
    }

    public JsonObject ReplaceRace(JsonObject document, ArchetypeDefinition race)
    {
        var categories = CategoryMerger.Merge(
            gameData.BaseCategories.DeepClone()!.AsObject(),
            race.Categories);

        document["raceId"] = race.Id;
        document["classId"] = null;
        document["status"] = "draft";
        document["assets"] = race.Assets?.DeepClone();
        document["categories"] = categories;
        document["equipmentSlots"] = ToEquipmentSlotsArray(race.EquipmentSlots);
        document["updatedAt"] = DateTime.UtcNow.ToString("O");

        gameStateInitializer.EnsureEquipmentSlots(document);

        return document;
    }

    public JsonObject? RebuildComplete(Guid characterId, string raceId, string classId)
    {
        var race = gameData.GetRace(raceId);
        var classDef = gameData.GetClass(classId);
        if (race is null || classDef is null)
            return null;

        var document = BuildFromRace(characterId, race);
        return ApplyClass(document, classDef);
    }

    private static JsonArray ToEquipmentSlotsArray(IEnumerable<string> slots)
    {
        var array = new JsonArray();
        foreach (var slot in slots)
            array.Add(slot);

        return array;
    }
}
