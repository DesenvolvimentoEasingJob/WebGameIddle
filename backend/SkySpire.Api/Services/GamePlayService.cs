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
    GameStateInitializer gameStateInitializer,
    ItemDropService itemDropService,
    GameDataItemEnsurer gameDataItemEnsurer)
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

    public async Task<(GamePatchResponse? Result, string? Error)> EquipItemAsync(
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
        if (itemId is null || CharacterItemCatalog.Resolve(gameData, document, itemId) is not { } itemDef)
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

            inventoryItems.Add(CopyInstanceEntry(previous, 1));
        }

        equipment[equipSlot] = CopyInstanceEntry(entry);

        inventoryItems.Remove(entry);
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildCharacterPatch(document, includeEffectiveCategories: true), null);
    }

    public async Task<(GamePatchResponse? Result, string? Error)> UnequipItemAsync(
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

        inventoryItems.Add(CopyInstanceEntry(equipped, equipped["quantity"]?.GetValue<int>() ?? 1));

        equipment[equipSlot] = null;
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildCharacterPatch(document, includeEffectiveCategories: true), null);
    }

    public async Task<(GamePatchResponse? Result, string? Error)> DiscardItemAsync(
        Guid userId,
        int slotIndex,
        string instanceId,
        CancellationToken ct)
    {
        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        var equipment = document!["equipment"]?.AsObject();
        if (equipment is not null)
        {
            foreach (var (_, value) in equipment)
            {
                if (value is JsonObject equipped
                    && equipped["instanceId"]?.GetValue<string>() == instanceId)
                    return (null, "Desequipe o item antes de descartá-lo.");
            }
        }

        var inventoryItems = document["inventory"]?["items"]?.AsArray()
            ?? throw new InvalidOperationException("Inventário inválido.");

        var entry = inventoryItems
            .OfType<JsonObject>()
            .FirstOrDefault(i => i["instanceId"]?.GetValue<string>() == instanceId);

        if (entry is null)
            return (null, "Item não encontrado no inventário.");

        inventoryItems.Remove(entry);
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildCharacterPatch(document), null);
    }

    public async Task<(GamePatchResponse? Result, string? Error)> UpdateTowerSettingsAsync(
        Guid userId,
        int slotIndex,
        bool autoAscend,
        bool continuousAttack,
        CancellationToken ct)
    {
        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        var tower = document!["tower"]?.AsObject()
            ?? throw new InvalidOperationException("Dados da torre inválidos.");

        tower["autoAscend"] = autoAscend;
        tower["continuousAttack"] = continuousAttack;
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildCharacterPatch(document), null);
    }

    public async Task<(GamePatchResponse? Result, string? Error)> RepeatTowerFloorAsync(
        Guid userId,
        int slotIndex,
        CancellationToken ct)
    {
        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        var tower = document!["tower"]?.AsObject()
            ?? throw new InvalidOperationException("Dados da torre inválidos.");

        var bossDefeated = tower["bossDefeated"]?.GetValue<bool>() ?? false;
        if (!bossDefeated)
            return (null, "Conclua o andar derrotando o chefe antes de repetir.");

        ResetTowerFloorProgress(tower);
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildCharacterPatch(document), null);
    }

    public async Task<(GamePatchResponse? Result, string? Error)> AdvanceTowerFloorAsync(
        Guid userId,
        int slotIndex,
        CancellationToken ct) =>
        await NavigateTowerFloorAsync(userId, slotIndex, "up", ct);

    public async Task<(GamePatchResponse? Result, string? Error)> NavigateTowerFloorAsync(
        Guid userId,
        int slotIndex,
        string direction,
        CancellationToken ct)
    {
        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        var tower = document!["tower"]?.AsObject()
            ?? throw new InvalidOperationException("Dados da torre inválidos.");

        var currentFloor = tower["currentFloor"].GetInt32Value(1);
        var unlockedFloor = tower["unlockedFloor"].GetInt32Value(1);
        var normalized = direction.Trim().ToLowerInvariant();

        int targetFloor;
        if (normalized is "up")
        {
            if (currentFloor >= unlockedFloor)
                return (null, "Nenhum andar superior desbloqueado.");
            targetFloor = currentFloor + 1;
        }
        else if (normalized is "down")
        {
            if (currentFloor <= 1)
                return (null, "Você já está no primeiro andar.");
            targetFloor = currentFloor - 1;
        }
        else
        {
            return (null, "Direção inválida. Use up ou down.");
        }

        if (gameData.GetTowerFloor(targetFloor) is null)
            return (null, "Andar não encontrado.");

        tower["currentFloor"] = targetFloor;
        ResetTowerFloorProgress(tower);
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildCharacterPatch(document, includeFloor: true), null);
    }

    public async Task<(StartTowerCombatResponse? Result, string? Error)> StartTowerCombatAsync(
        Guid userId,
        int slotIndex,
        CancellationToken ct)
    {
        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        var tower = document!["tower"]?.AsObject()
            ?? throw new InvalidOperationException("Dados da torre inválidos.");

        var currentFloor = tower["currentFloor"].GetInt32Value(1);
        var floorDef = gameData.GetTowerFloor(currentFloor);
        if (floorDef is null)
            return (null, "Andar não encontrado.");

        var floorBefore = tower["currentFloor"].GetInt32Value(1);
        var (enemy, isBoss, encounterError) = ResolveCurrentEncounter(tower, floorDef);
        if (encounterError is not null)
            return (null, encounterError);

        var effectiveCategories = ComputeEffectiveCategories(document);
        var playerStats = CombatStatsCalculator.FromCharacter(document, effectiveCategories);
        var combat = TowerCombatSimulator.Simulate(playerStats, enemy!, isBoss);

        var newItemIds = new List<string>();
        if (combat.Outcome == "player_win" && combat.Rewards is { } rewards)
        {
            var (items, lostItems) = await ApplyCombatVictoryAsync(
                document, tower, floorDef, enemy!, isBoss, rewards, ct);
            document["updatedAt"] = DateTime.UtcNow.ToString("O");
            await storage.SaveAsync(userId, character!.Id, document, ct);

            if (items.Count > 0 || lostItems.Count > 0)
            {
                combat = combat with
                {
                    Rewards = rewards with { Items = items, LostItems = lostItems },
                };
            }

            foreach (var item in items)
                newItemIds.Add(item.ItemId);
            foreach (var item in lostItems)
                newItemIds.Add(item.ItemId);
        }

        var floorAfter = tower["currentFloor"].GetInt32Value(1);
        var patch = BuildCharacterPatch(
            document,
            includeFloor: floorAfter != floorBefore,
            newCatalogEntries: BuildNewCatalogEntries(document, newItemIds));

        return (new StartTowerCombatResponse(combat, patch), null);
    }

    private static (MobDefinition? Enemy, bool IsBoss, string? Error) ResolveCurrentEncounter(
        JsonObject tower,
        TowerFloorDefinition floorDef)
    {
        var mobCount = floorDef.MobCount;
        var killed = tower["mobsKilledThisFloor"].GetInt32Value();
        var bossDefeated = tower["bossDefeated"]?.GetValue<bool>() ?? false;

        if (bossDefeated)
            return (null, false, "Este andar já foi concluído.");

        if (killed >= mobCount)
            return (floorDef.Boss, true, null);

        if (floorDef.MobPool.Count == 0)
            return (null, false, "Nenhum inimigo disponível neste andar.");

        var index = killed % floorDef.MobPool.Count;
        return (floorDef.MobPool[index], false, null);
    }

    private static void ResetTowerFloorProgress(JsonObject tower)
    {
        tower["mobsKilledThisFloor"] = 0;
        tower["bossDefeated"] = false;
    }

    private async Task<(IReadOnlyList<DroppedItemDto> Items, IReadOnlyList<DroppedItemDto> LostItems)> ApplyCombatVictoryAsync(
        JsonObject document,
        JsonObject tower,
        TowerFloorDefinition floorDef,
        MobDefinition enemy,
        bool isBoss,
        TowerCombatRewardsDto rewards,
        CancellationToken ct)
    {
        var progression = document["progression"]?.AsObject()
            ?? throw new InvalidOperationException("Progressão inválida.");

        var gold = progression["gold"].GetInt32Value();
        var xp = progression["xp"].GetInt32Value();
        var level = progression["level"].GetInt32Value(1);

        progression["gold"] = gold + rewards.Gold;
        xp += rewards.Xp;

        while (xp >= level * 100)
        {
            xp -= level * 100;
            level++;
        }

        progression["xp"] = xp;
        progression["level"] = level;

        if (isBoss)
        {
            var autoAscend = tower["autoAscend"]?.GetValue<bool>() ?? false;
            var continuousAttack = tower["continuousAttack"]?.GetValue<bool>() ?? false;
            var currentFloor = tower["currentFloor"].GetInt32Value(1);
            var unlockedFloor = tower["unlockedFloor"].GetInt32Value(1);

            unlockedFloor = Math.Max(unlockedFloor, currentFloor + 1);
            tower["unlockedFloor"] = unlockedFloor;

            if (autoAscend)
            {
                tower["currentFloor"] = currentFloor + 1;
                ResetTowerFloorProgress(tower);
            }
            else if (continuousAttack)
            {
                ResetTowerFloorProgress(tower);
            }
            else
            {
                tower["bossDefeated"] = true;
            }
        }
        else
        {
            var killed = tower["mobsKilledThisFloor"].GetInt32Value();
            tower["mobsKilledThisFloor"] = killed + 1;
        }

        var classId = document["classId"]?.GetValue<string>();
        var drop = await itemDropService.TryRollDropAsync(document, enemy, floorDef, classId, ct);
        if (drop is null)
            return ([], []);

        var dto = ToDroppedItemDto(drop);
        var addResult = itemDropService.TryAddToInventory(document, drop);
        return addResult switch
        {
            InventoryAddResult.Added => ([dto], []),
            InventoryAddResult.InventoryFull => ([], [dto]),
            _ => ([], []),
        };
    }

    private static DroppedItemDto ToDroppedItemDto(ItemDropResult drop) =>
        new(
            drop.Instance["instanceId"]!.GetValue<string>(),
            drop.ItemDef.Id,
            drop.ItemDef.Name,
            drop.RarityId,
            drop.Instance["quantity"]?.GetValue<int>() ?? 1,
            drop.Instance["rolledCategories"],
            drop.Instance["rolledAffixes"],
            drop.ItemDef.Assets);

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
        else if (gameStateInitializer.EnsureTowerFields(document))
        {
            document["updatedAt"] = DateTime.UtcNow.ToString("O");
            await storage.SaveAsync(userId, character.Id, document, ct);
        }

        if (gameDataItemEnsurer.EnsureDocumentItems(document))
        {
            document["updatedAt"] = DateTime.UtcNow.ToString("O");
            await storage.SaveAsync(userId, character.Id, document, ct);
        }

        return (character, document, null);
    }

    private static IReadOnlyList<string> ReadEquipmentSlots(JsonObject document) =>
        GameStateInitializer.ReadEquipmentSlots(document);

    private GamePatchResponse BuildCharacterPatch(
        JsonObject document,
        bool includeFloor = false,
        bool includeEffectiveCategories = false,
        IReadOnlyDictionary<string, ItemSummaryDto>? newCatalogEntries = null)
    {
        object? currentFloor = null;
        if (includeFloor)
        {
            var floorNum = document["tower"]?["currentFloor"]?.GetValue<int>() ?? 1;
            currentFloor = gameData.GetTowerFloor(floorNum);
        }

        object? effectiveCategories = includeEffectiveCategories
            ? ComputeEffectiveCategories(document)
            : null;

        return new GamePatchResponse(document, newCatalogEntries, currentFloor, effectiveCategories);
    }

    private Dictionary<string, ItemSummaryDto>? BuildNewCatalogEntries(
        JsonObject document,
        IReadOnlyList<string> itemIds)
    {
        if (itemIds.Count == 0)
            return null;

        var result = new Dictionary<string, ItemSummaryDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var id in itemIds.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (CharacterItemCatalog.Resolve(gameData, document, id) is { } item)
                result[item.Id] = ToItemDto(item);
        }

        return result.Count > 0 ? result : null;
    }

    private GameStateResponse BuildGameStateResponse(JsonObject document)
    {
        var catalog = new Dictionary<string, ItemSummaryDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in gameData.Items.Values)
            catalog[item.Id] = ToItemDto(item);

        // Itens gerados legados (ainda não migrados para o GameData) não podem
        // sobrescrever o catálogo global.
        foreach (var item in CharacterItemCatalog.EnumerateGenerated(document))
            catalog.TryAdd(item.Id, ToItemDto(item));

        var currentFloor = document["tower"]?["currentFloor"]?.GetValue<int>() ?? 1;
        var floorDef = gameData.GetTowerFloor(currentFloor);
        var effectiveCategories = ComputeEffectiveCategories(document);

        return new GameStateResponse(
            document,
            catalog,
            floorDef,
            effectiveCategories,
            LootConfigBuilder.Build(gameData));
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
            var equipped = equipment[slot]?.AsObject();
            var itemId = equipped?["itemId"]?.GetValue<string>();
            if (itemId is null || CharacterItemCatalog.Resolve(gameData, document, itemId) is not { } itemDef)
                continue;

            var itemCategories = ResolveInstanceCategories(equipped, itemDef);
            baseCategories = CategoryMerger.Merge(baseCategories, itemCategories);
        }

        return baseCategories;
    }

    private static JsonObject ResolveInstanceCategories(JsonObject? instance, ItemDefinition itemDef)
    {
        JsonObject baseCategories;
        if (instance?["rolledCategories"] is JsonObject rolled)
            baseCategories = rolled;
        else
            baseCategories = itemDef.Categories;

        if (instance?["rolledAffixes"] is JsonArray affixes)
            return ItemAffixRoller.MergeAffixesIntoCategories(baseCategories, affixes);

        return baseCategories;
    }

    private static JsonObject CopyInstanceEntry(JsonObject source, int? quantityOverride = null)
    {
        var copy = new JsonObject
        {
            ["instanceId"] = source["instanceId"]!.DeepClone(),
            ["itemId"] = source["itemId"]!.DeepClone(),
            ["quantity"] = quantityOverride ?? source["quantity"]?.GetValue<int>() ?? 1,
        };

        if (source["rarity"] is not null)
            copy["rarity"] = source["rarity"].DeepClone();

        if (source["rolledCategories"] is not null)
            copy["rolledCategories"] = source["rolledCategories"].DeepClone();

        if (source["rolledAffixes"] is not null)
            copy["rolledAffixes"] = source["rolledAffixes"].DeepClone();

        return copy;
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
