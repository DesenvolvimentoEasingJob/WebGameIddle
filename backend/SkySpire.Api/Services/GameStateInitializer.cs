using System.Text.Json.Nodes;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class GameStateInitializer(GameDataLoader gameData)
{
    public JsonObject EnsureGameState(JsonObject document)
    {
        if (document["progression"] is not null)
            return document;

        var classId = document["classId"]?.GetValue<string>() ?? "";

        document["progression"] = new JsonObject
        {
            ["level"] = 1,
            ["xp"] = 0,
            ["gold"] = 100,
        };

        document["tower"] = new JsonObject
        {
            ["currentFloor"] = 1,
            ["unlockedFloor"] = 1,
            ["autoAscend"] = false,
            ["continuousAttack"] = false,
            ["mobsKilledThisFloor"] = 0,
            ["bossDefeated"] = false,
            ["totalMobsKilled"] = 0,
            ["totalBossesKilled"] = 0,
        };

        document["inventory"] = new JsonObject
        {
            ["capacity"] = 40,
            ["items"] = new JsonArray(),
        };

        SyncEquipmentSlots(document);
        document["equipment"] = BuildEmptyEquipment(document);

        var items = document["inventory"]!["items"]!.AsArray();
        AddStarterItems(items, classId);

        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        return document;
    }

    public bool EnsureEquipmentSlots(JsonObject document)
    {
        var slots = ResolveEquipmentSlots(document);
        var changed = false;

        var currentSlots = document["equipmentSlots"]?.AsArray()
            ?.Select(s => s?.GetValue<string>())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s!)
            .ToList();

        if (currentSlots is null || !currentSlots.SequenceEqual(slots))
        {
            document["equipmentSlots"] = ToJsonArray(slots);
            changed = true;
        }

        var equipment = document["equipment"]?.AsObject() ?? new JsonObject();
        var synced = new JsonObject();
        foreach (var slot in slots)
            synced[slot] = equipment[slot]?.DeepClone() ?? null;

        if (!JsonNodesEqual(equipment, synced))
        {
            document["equipment"] = synced;
            changed = true;
        }

        return changed;
    }

    public bool EnsureTowerFields(JsonObject document)
    {
        var tower = document["tower"]?.AsObject();
        if (tower is null)
            return false;

        var changed = false;
        if (tower["continuousAttack"] is null)
        {
            tower["continuousAttack"] = false;
            changed = true;
        }

        if (tower["totalMobsKilled"] is null)
        {
            tower["totalMobsKilled"] = 0;
            changed = true;
        }

        if (tower["totalBossesKilled"] is null)
        {
            tower["totalBossesKilled"] = 0;
            changed = true;
        }

        return changed;
    }

    public void ApplyEquipmentSlots(JsonObject document, ArchetypeDefinition race)
    {
        document["equipmentSlots"] = ToJsonArray(race.EquipmentSlots);
    }

    private void SyncEquipmentSlots(JsonObject document)
    {
        document["equipmentSlots"] = ToJsonArray(ResolveEquipmentSlots(document));
    }

    public static IReadOnlyList<string> ReadEquipmentSlots(JsonObject document) =>
        document["equipmentSlots"]?.AsArray()
            ?.Select(s => s?.GetValue<string>())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s!)
            .ToList()
        ?? EquipmentSlotDefaults.Standard.ToList();

    private IReadOnlyList<string> ResolveEquipmentSlots(JsonObject document)
    {
        var raceId = document["raceId"]?.GetValue<string>();
        if (raceId is not null && gameData.GetRace(raceId) is { } race)
            return race.EquipmentSlots;

        return EquipmentSlotDefaults.Standard;
    }

    private static JsonObject BuildEmptyEquipment(JsonObject document)
    {
        var equipment = new JsonObject();
        foreach (var slot in ReadEquipmentSlots(document))
            equipment[slot] = null;

        return equipment;
    }

    private static JsonArray ToJsonArray(IEnumerable<string> slots)
    {
        var array = new JsonArray();
        foreach (var slot in slots)
            array.Add(slot);

        return array;
    }

    private static bool JsonNodesEqual(JsonNode? left, JsonNode? right) =>
        JsonNode.DeepEquals(left, right);

    private void AddStarterItems(JsonArray items, string classId)
    {
        var starterWeapon = classId switch
        {
            "mage" => "wooden-staff",
            "warrior" or "rogue" => "iron-sword",
            _ => "iron-sword",
        };

        items.Add(CreateInventoryEntry(starterWeapon));
        items.Add(CreateInventoryEntry("leather-armor"));
        items.Add(CreateInventoryEntry("health-potion", 3));
    }

    private static JsonObject CreateInventoryEntry(string itemId, int quantity = 1) =>
        new()
        {
            ["instanceId"] = Guid.NewGuid().ToString(),
            ["itemId"] = itemId,
            ["quantity"] = quantity,
        };
}
