using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Data;
using SkySpire.Api.DTOs;
using SkySpire.Api.Models;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class GamePlayService(
    AppDbContext db,
    GameDataLoader gameData,
    CharacterStorage storage,
    CharacterBuilder builder,
    GameStateInitializer gameStateInitializer)
{
    public async Task<(GameStateResponse? Result, string? Error)> GetGameStateAsync(
        Guid userId,
        int slotIndex,
        CancellationToken ct)
    {
        var (_, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        return (BuildGameStateResponse(document!), null);
    }

    public async Task<(GameStateResponse? Result, string? Error)> EquipItemAsync(
        Guid userId,
        int slotIndex,
        string instanceId,
        CancellationToken ct)
    {
        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        var inventoryItems = document!["inventory"]?["items"]?.AsArray()
            ?? throw new InvalidOperationException("Inventário inválido.");

        var entry = inventoryItems
            .OfType<JsonObject>()
            .FirstOrDefault(i => i["instanceId"]?.GetValue<string>() == instanceId);

        if (entry is null)
            return (null, "Item não encontrado no inventário.");

        var itemId = entry["itemId"]?.GetValue<string>();
        if (itemId is null || gameData.GetItem(itemId) is not { } itemDef)
            return (null, "Definição do item não encontrada.");

        if (itemDef.Slot is null)
            return (null, "Este item não pode ser equipado.");

        var classId = document["classId"]?.GetValue<string>() ?? "";
        if (itemDef.Classes.Count > 0 && !itemDef.Classes.Contains(classId, StringComparer.OrdinalIgnoreCase))
            return (null, "Sua classe não pode usar este item.");

        var equipment = document["equipment"]?.AsObject()
            ?? throw new InvalidOperationException("Equipamento inválido.");

        var equipSlot = itemDef.Slot;
        if (!ReadEquipmentSlots(document).Contains(equipSlot, StringComparer.OrdinalIgnoreCase))
            return (null, "Sua raça não possui este slot de equipamento.");

        var previous = equipment[equipSlot]?.AsObject();

        if (previous is not null)
        {
            var capacity = document["inventory"]?["capacity"]?.GetValue<int>() ?? 40;
            if (inventoryItems.Count >= capacity)
                return (null, "Inventário cheio. Desequipe um item antes.");

            inventoryItems.Add(new JsonObject
            {
                ["instanceId"] = previous["instanceId"]!.DeepClone(),
                ["itemId"] = previous["itemId"]!.DeepClone(),
                ["quantity"] = 1,
            });
        }

        equipment[equipSlot] = new JsonObject
        {
            ["instanceId"] = instanceId,
            ["itemId"] = itemId,
        };

        inventoryItems.Remove(entry);
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildGameStateResponse(document), null);
    }

    public async Task<(GameStateResponse? Result, string? Error)> UnequipItemAsync(
        Guid userId,
        int slotIndex,
        string equipSlot,
        CancellationToken ct)
    {
        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        if (!ReadEquipmentSlots(document!).Contains(equipSlot, StringComparer.OrdinalIgnoreCase))
            return (null, "Slot de equipamento inválido.");

        var equipment = document["equipment"]?.AsObject()
            ?? throw new InvalidOperationException("Equipamento inválido.");

        var equipped = equipment[equipSlot]?.AsObject();
        if (equipped is null)
            return (null, "Nenhum item equipado neste slot.");

        var inventory = document["inventory"]?.AsObject()
            ?? throw new InvalidOperationException("Inventário inválido.");

        var capacity = inventory["capacity"]?.GetValue<int>() ?? 40;
        var inventoryItems = inventory["items"]?.AsArray() ?? new JsonArray();

        if (inventoryItems.Count >= capacity)
            return (null, "Inventário cheio.");

        inventoryItems.Add(new JsonObject
        {
            ["instanceId"] = equipped["instanceId"]!.DeepClone(),
            ["itemId"] = equipped["itemId"]!.DeepClone(),
            ["quantity"] = 1,
        });

        equipment[equipSlot] = null;
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildGameStateResponse(document), null);
    }

    public async Task<(GameStateResponse? Result, string? Error)> UpdateTowerSettingsAsync(
        Guid userId,
        int slotIndex,
        bool autoAscend,
        CancellationToken ct)
    {
        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        var tower = document!["tower"]?.AsObject()
            ?? throw new InvalidOperationException("Dados da torre inválidos.");

        tower["autoAscend"] = autoAscend;
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildGameStateResponse(document), null);
    }

    private async Task<(Character? Character, JsonObject? Document, string? Error)> LoadCompleteCharacterAsync(
        Guid userId,
        int slotIndex,
        CancellationToken ct)
    {
        if (slotIndex < 0 || slotIndex >= CharacterService.MaxSlots)
            return (null, null, "Slot inválido.");

        var character = await db.Characters
            .FirstOrDefaultAsync(c => c.UserId == userId && c.SlotIndex == slotIndex, ct);

        if (character is null)
            return (null, null, "Este slot está vazio.");

        if (character.Status != CharacterStatus.Complete)
            return (null, null, "Personagem ainda não está completo.");

        var document = await storage.LoadForCharacterAsync(
            userId, character.Id, character.JsonPath, ct);

        if (document is null &&
            !string.IsNullOrEmpty(character.RaceId) &&
            !string.IsNullOrEmpty(character.ClassId))
        {
            document = builder.RebuildComplete(
                character.Id, character.RaceId, character.ClassId);

            if (document is not null)
            {
                character.JsonPath = storage.GetFilePath(userId, character.Id);
                character.UpdatedAt = DateTime.UtcNow;
                await storage.SaveAsync(userId, character.Id, document, ct);
                await db.SaveChangesAsync(ct);
            }
        }

        if (document is null)
            return (null, null, "Dados do personagem não encontrados.");

        if (document["progression"] is null)
        {
            document = gameStateInitializer.EnsureGameState(document);
            await storage.SaveAsync(userId, character.Id, document, ct);
        }
        else if (gameStateInitializer.EnsureEquipmentSlots(document))
        {
            document["updatedAt"] = DateTime.UtcNow.ToString("O");
            await storage.SaveAsync(userId, character.Id, document, ct);
        }

        return (character, document, null);
    }

    private static IReadOnlyList<string> ReadEquipmentSlots(JsonObject document) =>
        GameStateInitializer.ReadEquipmentSlots(document);

    private GameStateResponse BuildGameStateResponse(JsonObject document)
    {
        var catalog = gameData.Items.Values
            .ToDictionary(
                i => i.Id,
                i => ToItemDto(i),
                StringComparer.OrdinalIgnoreCase);

        var currentFloor = document["tower"]?["currentFloor"]?.GetValue<int>() ?? 1;
        var floorDef = gameData.GetTowerFloor(currentFloor);
        var effectiveCategories = ComputeEffectiveCategories(document);

        return new GameStateResponse(
            document,
            catalog,
            floorDef,
            effectiveCategories);
    }

    private JsonObject ComputeEffectiveCategories(JsonObject document)
    {
        var baseCategories = document["categories"]?.AsObject()?.DeepClone()?.AsObject()
            ?? new JsonObject();

        var equipment = document["equipment"]?.AsObject();
        if (equipment is null)
            return baseCategories;

        foreach (var slot in ReadEquipmentSlots(document))
        {
            var itemId = equipment[slot]?.AsObject()?["itemId"]?.GetValue<string>();
            if (itemId is null || gameData.GetItem(itemId) is not { } itemDef)
                continue;

            baseCategories = CategoryMerger.Merge(baseCategories, itemDef.Categories);
        }

        return baseCategories;
    }

    private static ItemSummaryDto ToItemDto(ItemDefinition item) =>
        new(
            item.Id,
            item.Name,
            item.Description,
            item.Type,
            item.Slot,
            item.Rarity,
            item.Level,
            item.Classes,
            item.Stackable,
            item.MaxStack,
            item.Categories,
            item.Assets);
}
