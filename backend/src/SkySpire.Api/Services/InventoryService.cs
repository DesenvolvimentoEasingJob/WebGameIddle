using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;
using SkySpire.Api.Data;

namespace SkySpire.Api.Services;

public sealed class InventoryService(
    AppDbContext db,
    CharacterService characters,
    ItemRollService itemRoll,
    IOptions<AppSecretsOptions> secrets)
{
    public async Task<object> GetAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new InventoryException("User not found.");

        if (string.IsNullOrEmpty(user.BagJsonPath) || !File.Exists(user.BagJsonPath))
        {
            throw new InventoryException("No bag.");
        }

        var (_, bagNode) = await characters.LoadMutableBagAsync(userId, ct);
        using var bagDoc = JsonDocument.Parse(bagNode.ToJsonString());
        var character = await characters.GetRawCharacterAsync(userId, ct)
            ?? throw new InventoryException("No character.");

        var hasEquipment = character.TryGetProperty("equipment", out var equipment);
        var hasSlots = character.TryGetProperty("equipmentSlots", out var slots);

        return new
        {
            slotCount = bagDoc.RootElement.TryGetProperty("slotCount", out var sc) ? sc.GetInt32() : 40,
            items = bagDoc.RootElement.TryGetProperty("items", out var items)
                ? JsonSerializer.Deserialize<object>(items.GetRawText())
                : Array.Empty<object>(),
            equipment = hasEquipment ? JsonSerializer.Deserialize<object>(equipment.GetRawText()) : new { },
            equipmentSlots = hasSlots ? JsonSerializer.Deserialize<object>(slots.GetRawText()) : Array.Empty<object>()
        };
    }

    public async Task<object> EquipAsync(Guid userId, int bagIndex, string slotName, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new InventoryException("User not found.");

        if (string.IsNullOrEmpty(user.BagJsonPath) || string.IsNullOrEmpty(user.CharacterJsonPath))
        {
            throw new InventoryException("Missing bag/character.");
        }

        var (bagPath, bag) = await characters.LoadMutableBagAsync(userId, ct);
        var items = bag["items"] as JsonArray ?? new JsonArray();
        if (bagIndex < 0 || bagIndex >= items.Count || items[bagIndex] is null)
        {
            throw new InventoryException("Invalid bag index.");
        }

        var (path, character) = await characters.LoadMutableCharacterAsync(userId, ct);
        var slots = character["equipmentSlots"] as JsonArray
            ?? throw new InventoryException("No equipment slots.");

        JsonObject? slotDef = null;
        foreach (var s in slots)
        {
            if (s is JsonObject o && o["name"]?.GetValue<string>() == slotName)
            {
                slotDef = o;
                break;
            }
        }

        if (slotDef is null)
        {
            throw new InventoryException("Unknown slot.");
        }

        var itemNode = await itemRoll.ExpandLegacyOrPassthroughAsync(
            items[bagIndex]!.DeepClone() as JsonObject
            ?? throw new InventoryException("Invalid item."),
            ct);

        if (ItemRollService.IsStackable(itemNode))
        {
            throw new InventoryException("Materials cannot be equipped.");
        }

        var itemType = itemNode["type"]?.GetValue<string>() ?? "material";
        var templateId = ItemRollService.ResolveTemplateId(itemNode);
        if (string.IsNullOrEmpty(itemType) || itemType == "material")
        {
            if (!string.IsNullOrEmpty(templateId))
            {
                var itemPath = Path.Combine(secrets.Value.ContentPath, "items", $"{templateId}.json");
                if (File.Exists(itemPath))
                {
                    using var itemDoc = JsonDocument.Parse(await File.ReadAllTextAsync(itemPath, ct));
                    itemType = itemDoc.RootElement.TryGetProperty("type", out var t) ? t.GetString() : "material";
                }
            }
        }

        await EnsureGripFromTemplateAsync(itemNode, templateId, ct);

        var allowed = slotDef["itemType"] as JsonArray;
        var ok = allowed?.Any(a =>
            string.Equals(a?.GetValue<string>(), itemType, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(a?.GetValue<string>(), "*", StringComparison.OrdinalIgnoreCase)) ?? false;

        if (!ok)
        {
            throw new InventoryException($"Item type '{itemType}' not allowed in slot '{slotName}'.");
        }

        var equipment = character["equipment"] as JsonObject ?? new JsonObject();
        var handSlotsNeeded = EquipmentGripHelper.IsHandItemType(itemType)
            ? EquipmentGripHelper.ResolveHandSlotCount(itemNode)
            : 1;

        List<string> occupySlots;
        if (handSlotsNeeded > 1)
        {
            var handNames = EquipmentGripHelper.OrderedHandSlotNames(slots);
            occupySlots = EquipmentGripHelper.PickHandSlotsToOccupy(handNames, slotName, handSlotsNeeded);
        }
        else
        {
            occupySlots = [slotName];
        }

        // Remove da bag antes de devolver displaced — evita deslocar bagIndex.
        items.RemoveAt(bagIndex);

        var cleared = new HashSet<string>(StringComparer.Ordinal);
        foreach (var occupy in occupySlots)
        {
            if (cleared.Contains(occupy) || equipment[occupy] is null)
            {
                continue;
            }

            var group = EquipmentGripHelper.CollectGripGroupSlots(equipment, occupy);
            EquipmentGripHelper.UnequipGripGroup(equipment, items, occupy);
            foreach (var g in group)
            {
                cleared.Add(g);
            }
        }

        itemNode["qty"] = 1;
        if (string.IsNullOrEmpty(itemNode["instanceId"]?.GetValue<string>()))
        {
            itemNode["instanceId"] = Guid.NewGuid().ToString();
        }

        var instanceId = itemNode["instanceId"]!.GetValue<string>()!;
        equipment[slotName] = itemNode;

        for (var i = 1; i < occupySlots.Count; i++)
        {
            equipment[occupySlots[i]] = EquipmentGripHelper.BuildGhost(itemNode, instanceId, slotName);
        }

        bag["items"] = items;
        character["equipment"] = equipment;

        await characters.SaveBagNodeAsync(bagPath, bag, ct);
        await characters.SaveCharacterNodeAsync(path, character, ct);
        return await GetAsync(userId, ct);
    }

    public async Task<object> UnequipAsync(Guid userId, string slotName, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new InventoryException("User not found.");

        if (string.IsNullOrEmpty(user.BagJsonPath) || string.IsNullOrEmpty(user.CharacterJsonPath))
        {
            throw new InventoryException("Missing bag/character.");
        }

        var (bagPath, bag) = await characters.LoadMutableBagAsync(userId, ct);
        var items = bag["items"] as JsonArray ?? new JsonArray();
        var (path, character) = await characters.LoadMutableCharacterAsync(userId, ct);
        var equipment = character["equipment"] as JsonObject ?? new JsonObject();

        if (equipment[slotName] is null)
        {
            throw new InventoryException("Slot empty.");
        }

        EquipmentGripHelper.UnequipGripGroup(equipment, items, slotName);
        bag["items"] = items;
        character["equipment"] = equipment;

        await characters.SaveBagNodeAsync(bagPath, bag, ct);
        await characters.SaveCharacterNodeAsync(path, character, ct);
        return await GetAsync(userId, ct);
    }

    public async Task<object> DiscardAsync(Guid userId, IEnumerable<int> bagIndexes, CancellationToken ct)
    {
        var (bagPath, bag) = await characters.LoadMutableBagAsync(userId, ct);
        var items = bag["items"] as JsonArray ?? new JsonArray();

        var targets = bagIndexes.Distinct().OrderByDescending(i => i).ToList();
        if (targets.Count == 0)
        {
            throw new InventoryException("No items selected.");
        }

        if (targets.Any(index => index < 0 || index >= items.Count || items[index] is null))
        {
            throw new InventoryException("Invalid bag index.");
        }

        foreach (var index in targets)
        {
            items.RemoveAt(index);
        }

        bag["items"] = items;

        await characters.SaveBagNodeAsync(bagPath, bag, ct);
        return await GetAsync(userId, ct);
    }

    private async Task EnsureGripFromTemplateAsync(JsonObject itemNode, string? templateId, CancellationToken ct)
    {
        if (itemNode["grip"] is not null || itemNode["handSlots"] is not null)
        {
            return;
        }

        if (string.IsNullOrEmpty(templateId))
        {
            return;
        }

        var itemPath = Path.Combine(secrets.Value.ContentPath, "items", $"{templateId}.json");
        if (!File.Exists(itemPath))
        {
            return;
        }

        using var itemDoc = JsonDocument.Parse(await File.ReadAllTextAsync(itemPath, ct));
        if (itemDoc.RootElement.TryGetProperty("grip", out var grip) &&
            grip.ValueKind == JsonValueKind.String)
        {
            itemNode["grip"] = grip.GetString();
        }

        if (itemDoc.RootElement.TryGetProperty("handSlots", out var hs) &&
            hs.ValueKind == JsonValueKind.Number)
        {
            itemNode["handSlots"] = hs.GetInt32();
        }
    }
}

public sealed class InventoryException(string message) : Exception(message);
