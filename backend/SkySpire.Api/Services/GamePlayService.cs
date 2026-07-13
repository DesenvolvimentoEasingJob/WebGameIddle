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
    GameDataItemEnsurer gameDataItemEnsurer,
    ItemIntegrityService integrityService,
    TradeService tradeService,
    IConfiguration configuration,
    Microsoft.Extensions.Options.IOptions<LootOptions> lootOptions)
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

        if (entry["integrity"] is not null && !integrityService.TryVerify(entry))
            return (null, "Integridade do item inválida.");

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

        TowerCombatSessionService.ClearSession(tower);

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

        TowerCombatSessionService.ClearSession(tower);

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

        if (TowerCombatSessionService.ValidateNotLocked(tower) is { } lockError)
            return (null, lockError);

        var currentFloor = tower["currentFloor"].GetInt32Value(1);
        var floorDef = gameData.GetTowerFloor(currentFloor);
        if (floorDef is null)
            return (null, "Andar não encontrado.");

        var floorBefore = tower["currentFloor"].GetInt32Value(1);
        var (enemy, isBoss, encounterError) = ResolveCurrentEncounter(tower, floorDef);
        if (encounterError is not null)
            return (null, encounterError);

        var mobIndexAtFight = isBoss ? floorDef.MobCount : tower["mobsKilledThisFloor"].GetInt32Value();

        var effectiveCategories = ComputeEffectiveCategories(document);
        var playerStats = CombatStatsCalculator.FromCharacter(document, effectiveCategories);
        var combat = TowerCombatSimulator.Simulate(playerStats, enemy!, isBoss);

        var victoryChanges = new CombatVictoryChanges();
        if (combat.Outcome == "player_win" && combat.Rewards is { } rewards)
        {
            victoryChanges = await ApplyCombatVictoryAsync(
                document, tower, floorDef, enemy!, isBoss, rewards, ct,
                null,
                new DropContext(floorDef.Floor, enemy!.Id, "single", 0));

            if (victoryChanges.Items.Count > 0 || victoryChanges.LostItems.Count > 0)
            {
                combat = combat with
                {
                    Rewards = rewards with
                    {
                        Items = victoryChanges.Items,
                        LostItems = victoryChanges.LostItems,
                    },
                };
            }
        }

        var durationMs = TowerCombatDuration.EstimateMs(combat);
        var session = TowerCombatSessionService.BeginSession(
            tower,
            "single",
            1,
            durationMs,
            enemy!,
            isBoss,
            floorBefore,
            mobIndexAtFight,
            combat.EnemyMaxHp);
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        var floorAfter = tower["currentFloor"].GetInt32Value(1);
        var patch = BuildTowerCombatPatch(
            document,
            includeFloor: floorAfter != floorBefore,
            victoryChanges,
            includeProgression: combat.Outcome == "player_win");

        return (new StartTowerCombatResponse(combat, patch, session), null);
    }

    public async Task<(StartTowerCombatBatchResponse? Result, string? Error)> StartTowerCombatBatchAsync(
        Guid userId,
        int slotIndex,
        int killCount,
        CancellationToken ct)
    {
        killCount = Math.Clamp(killCount, 1, lootOptions.Value.MaxCombatBatchSize);

        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        var tower = document!["tower"]?.AsObject()
            ?? throw new InvalidOperationException("Dados da torre inválidos.");

        if (TowerCombatSessionService.ValidateNotLocked(tower) is { } lockError)
            return (null, lockError);

        var continuousAttack = tower["continuousAttack"]?.GetValue<bool>() ?? false;
        if (!continuousAttack)
            return (null, "Ataque contínuo desativado.");

        var floorBefore = tower["currentFloor"].GetInt32Value(1);
        var mobsKilledAtStart = tower["mobsKilledThisFloor"].GetInt32Value();
        var serverSecret = configuration["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret is not configured.");

        var batchSeed = LootSeedService.BuildBatchSeed(
            userId,
            character!.Id,
            floorBefore,
            mobsKilledAtStart,
            0,
            serverSecret);

        var combats = new List<TowerCombatResultDto>();
        var batchChanges = new CombatVictoryChanges();
        var allItems = new List<CombatRewardItemDto>();
        var allLost = new List<CombatRewardItemDto>();
        var totalXp = 0;
        var totalGold = 0;
        var wins = 0;
        var defeats = 0;
        MobDefinition? sessionEnemy = null;
        var sessionIsBoss = false;
        var sessionFloor = floorBefore;
        var sessionMobIndex = 0;
        var sessionEnemyMaxHp = 0;

        for (var i = 0; i < killCount; i++)
        {
            var currentFloor = tower["currentFloor"].GetInt32Value(1);
            var floorDef = gameData.GetTowerFloor(currentFloor);
            if (floorDef is null)
                break;

            var (enemy, isBoss, encounterError) = ResolveCurrentEncounter(tower, floorDef);
            if (encounterError is not null)
                break;

            var mobIndexAtFight = isBoss ? floorDef.MobCount : tower["mobsKilledThisFloor"].GetInt32Value();

            var effectiveCategories = ComputeEffectiveCategories(document);
            var playerStats = CombatStatsCalculator.FromCharacter(document, effectiveCategories);
            var combat = TowerCombatSimulator.Simulate(playerStats, enemy!, isBoss);
            combats.Add(combat);
            sessionEnemy = enemy;
            sessionIsBoss = isBoss;
            sessionFloor = currentFloor;
            sessionMobIndex = mobIndexAtFight;
            sessionEnemyMaxHp = combat.EnemyMaxHp;

            if (combat.Outcome == "player_win" && combat.Rewards is { } rewards)
            {
                wins++;
                totalXp += rewards.Xp;
                totalGold += rewards.Gold;

                var rollRng = LootSeedService.CreateRng(batchSeed, i);
                var changes = await ApplyCombatVictoryAsync(
                    document,
                    tower,
                    floorDef,
                    enemy!,
                    isBoss,
                    rewards,
                    ct,
                    rollRng,
                    new DropContext(floorDef.Floor, enemy!.Id, batchSeed, i));

                batchChanges.Merge(changes);
                allItems.AddRange(changes.Items);
                allLost.AddRange(changes.LostItems);
            }
            else
            {
                defeats++;
                break;
            }

            if (tower["bossDefeated"]?.GetValue<bool>() == true)
                break;
        }

        if (combats.Count == 0)
            return (null, "Nenhum combate resolvido.");

        var durationMs = TowerCombatDuration.EstimateMs(combats);
        var session = TowerCombatSessionService.BeginSession(
            tower,
            "batch",
            combats.Count,
            durationMs,
            sessionEnemy!,
            sessionIsBoss,
            sessionFloor,
            sessionMobIndex,
            sessionEnemyMaxHp);

        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character.Id, document, ct);

        var floorAfter = tower["currentFloor"].GetInt32Value(1);
        var patch = BuildTowerCombatPatch(
            document,
            includeFloor: floorAfter != floorBefore,
            batchChanges,
            includeProgression: wins > 0);

        var batch = new TowerCombatBatchResultDto(
            combats.Count,
            wins,
            defeats,
            totalXp,
            totalGold,
            allItems,
            allLost,
            batchSeed,
            combats);

        return (new StartTowerCombatBatchResponse(batch, patch, session), null);
    }

    public async Task<(GamePatchResponse? Result, string? Error)> TradeItemAsync(
        Guid userId,
        int slotIndex,
        int targetSlotIndex,
        string instanceId,
        CancellationToken ct)
    {
        var (sourcePatch, _, error) = await tradeService.TransferItemAsync(
            userId,
            slotIndex,
            targetSlotIndex,
            instanceId,
            doc => BuildCharacterPatch(doc),
            ct);

        if (error is not null)
            return (null, error);

        return (sourcePatch, null);
    }

    public async Task<(GamePatchResponse? Result, string? Error)> ApplyGemAsync(
        Guid userId,
        int slotIndex,
        string itemInstanceId,
        string gemInstanceId,
        CancellationToken ct)
    {
        var (character, document, error) = await LoadCompleteCharacterAsync(userId, slotIndex, ct);
        if (error is not null)
            return (null, error);

        var inventoryItems = document!["inventory"]?["items"]?.AsArray()
            ?? throw new InvalidOperationException("Inventário inválido.");

        var itemEntry = inventoryItems
            .OfType<JsonObject>()
            .FirstOrDefault(i => i["instanceId"]?.GetValue<string>() == itemInstanceId);

        var gemEntry = inventoryItems
            .OfType<JsonObject>()
            .FirstOrDefault(i => i["instanceId"]?.GetValue<string>() == gemInstanceId);

        if (itemEntry is null)
            return (null, "Item alvo não encontrado.");
        if (gemEntry is null)
            return (null, "Joia não encontrada.");

        var gemItemId = gemEntry["itemId"]?.GetValue<string>();
        if (gemItemId is null || gameData.GetItem(gemItemId) is not { } gemDef)
            return (null, "Definição da joia não encontrada.");

        if (!string.Equals(gemDef.ItemKind, "gem", StringComparison.OrdinalIgnoreCase))
            return (null, "Este item não é uma joia de aprimoramento.");

        var gemCategories = gemDef.Categories["gem"]?.AsObject();
        var affixId = gemCategories?["targetAffixId"]?.GetValue<string>();
        var bonusValue = gemCategories?["bonusValue"]?.GetValue<int>() ?? 0;
        if (string.IsNullOrWhiteSpace(affixId) || bonusValue <= 0)
            return (null, "Joia inválida.");

        if (!gameData.Affixes.TryGetValue(affixId, out var affixDef))
            return (null, "Atributo da joia não encontrado.");

        var affixes = itemEntry["rolledAffixes"] as JsonArray ?? new JsonArray();
        affixes.Add(new JsonObject
        {
            ["affixId"] = affixId,
            ["label"] = affixDef.Label,
            ["value"] = bonusValue,
            ["suffix"] = affixDef.Suffix,
            ["categoryPath"] = affixDef.CategoryPath,
            ["source"] = "gem",
        });
        itemEntry["rolledAffixes"] = affixes;

        var gemQty = gemEntry["quantity"]?.GetValue<int>() ?? 1;
        if (gemQty <= 1)
            inventoryItems.Remove(gemEntry);
        else
            gemEntry["quantity"] = gemQty - 1;

        integrityService.SignInstance(itemEntry);
        document["updatedAt"] = DateTime.UtcNow.ToString("O");
        await storage.SaveAsync(userId, character!.Id, document, ct);

        return (BuildCharacterPatch(document, includeEffectiveCategories: true), null);
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

    private async Task<CombatVictoryChanges> ApplyCombatVictoryAsync(
        JsonObject document,
        JsonObject tower,
        TowerFloorDefinition floorDef,
        MobDefinition enemy,
        bool isBoss,
        TowerCombatRewardsDto rewards,
        CancellationToken ct,
        Random? rng = null,
        DropContext? dropContext = null)
    {
        var changes = new CombatVictoryChanges();
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
            var totalBosses = tower["totalBossesKilled"].GetInt32Value();
            tower["totalBossesKilled"] = totalBosses + 1;

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

            var totalMobs = tower["totalMobsKilled"].GetInt32Value();
            tower["totalMobsKilled"] = totalMobs + 1;
        }

        var classId = document["classId"]?.GetValue<string>();
        var drop = await itemDropService.TryRollDropAsync(
            document, enemy, floorDef, classId, ct, rng, dropContext);
        if (drop is null)
            return changes;

        var rewardItem = ToCombatRewardItemDto(drop);
        var addOutcome = itemDropService.TryAddToInventory(document, drop);
        switch (addOutcome.Result)
        {
            case InventoryAddResult.Added:
                changes.Items.Add(rewardItem);
                changes.TrackCatalogItem(drop.ItemDef.Id);
                if (addOutcome.AddedEntry is not null)
                    changes.NewInventoryItems.Add(addOutcome.AddedEntry);
                else if (addOutcome.UpdatedInstanceId is not null && addOutcome.UpdatedQuantity is not null)
                {
                    changes.InventoryUpdates.Add(new InventoryQuantityPatchDto(
                        addOutcome.UpdatedInstanceId,
                        addOutcome.UpdatedQuantity.Value));
                }
                break;
            case InventoryAddResult.InventoryFull:
                changes.LostItems.Add(rewardItem);
                changes.TrackCatalogItem(drop.ItemDef.Id);
                break;
        }

        return changes;
    }

    private static CombatRewardItemDto ToCombatRewardItemDto(ItemDropResult drop) =>
        new(
            drop.Instance["instanceId"]!.GetValue<string>(),
            drop.ItemDef.Id,
            drop.ItemDef.Name,
            drop.RarityId,
            drop.Instance["level"]?.GetValue<int>() ?? drop.ItemDef.Level,
            drop.Instance["quantity"]?.GetValue<int>() ?? 1);

    private TowerCombatPatchDto BuildTowerCombatPatch(
        JsonObject document,
        bool includeFloor,
        CombatVictoryChanges? changes = null,
        bool includeProgression = true)
    {
        object? currentFloor = null;
        if (includeFloor)
        {
            var floorNum = document["tower"]?["currentFloor"]?.GetValue<int>() ?? 1;
            currentFloor = gameData.GetTowerFloor(floorNum);
        }

        JsonArray? newItems = null;
        if (changes?.NewInventoryItems.Count > 0)
        {
            newItems = new JsonArray();
            foreach (var item in changes.NewInventoryItems)
                newItems.Add(item.DeepClone());
        }

        IReadOnlyList<InventoryQuantityPatchDto>? quantityUpdates =
            changes?.InventoryUpdates.Count > 0 ? changes.InventoryUpdates : null;

        var catalog = changes is null
            ? null
            : BuildNewCatalogEntries(document, changes.CatalogItemIds);

        return new TowerCombatPatchDto(
            includeProgression ? document["progression"]?.DeepClone() : null,
            document["tower"]?.DeepClone(),
            newItems,
            quantityUpdates,
            catalog,
            currentFloor,
            document["updatedAt"]?.GetValue<string>());
    }

    private sealed class CombatVictoryChanges
    {
        public List<CombatRewardItemDto> Items { get; } = [];
        public List<CombatRewardItemDto> LostItems { get; } = [];
        public List<JsonObject> NewInventoryItems { get; } = [];
        public List<InventoryQuantityPatchDto> InventoryUpdates { get; } = [];
        public List<string> CatalogItemIds { get; } = [];

        public void TrackCatalogItem(string itemId)
        {
            if (!CatalogItemIds.Contains(itemId, StringComparer.OrdinalIgnoreCase))
                CatalogItemIds.Add(itemId);
        }

        public void Merge(CombatVictoryChanges other)
        {
            Items.AddRange(other.Items);
            LostItems.AddRange(other.LostItems);
            NewInventoryItems.AddRange(other.NewInventoryItems);
            InventoryUpdates.AddRange(other.InventoryUpdates);
            foreach (var itemId in other.CatalogItemIds)
                TrackCatalogItem(itemId);
        }
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

        var needsSave = false;

        if (document["progression"] is null)
        {
            document = gameStateInitializer.EnsureGameState(document);
            needsSave = true;
        }

        if (gameStateInitializer.EnsureEquipmentSlots(document))
            needsSave = true;

        if (gameStateInitializer.EnsureTowerFields(document))
            needsSave = true;

        if (EnsureCombatSessionCleared(document))
            needsSave = true;

        if (gameDataItemEnsurer.EnsureDocumentItems(document))
            needsSave = true;

        if (needsSave)
        {
            document["updatedAt"] = DateTime.UtcNow.ToString("O");
            await storage.SaveAsync(userId, character.Id, document, ct);
        }

        EnsureDocumentItemIntegrity(document);

        return (character, document, null);
    }

    private void EnsureDocumentItemIntegrity(JsonObject document)
    {
        var inventoryItems = document["inventory"]?["items"]?.AsArray();
        if (inventoryItems is not null)
        {
            foreach (var node in inventoryItems.OfType<JsonObject>())
                integrityService.EnsureIntegrity(node);
        }

        var equipment = document["equipment"]?.AsObject();
        if (equipment is null)
            return;

        foreach (var (_, value) in equipment)
        {
            if (value is JsonObject equipped)
                integrityService.EnsureIntegrity(equipped);
        }
    }

    private static IReadOnlyList<string> ReadEquipmentSlots(JsonObject document) =>
        GameStateInitializer.ReadEquipmentSlots(document);

    private static bool EnsureCombatSessionCleared(JsonObject document)
    {
        var tower = document["tower"]?.AsObject();
        if (tower is null)
            return false;

        var before = tower["combatSession"]?.DeepClone();
        TowerCombatSessionService.ClearExpired(tower);
        return !JsonNode.DeepEquals(before, tower["combatSession"]);
    }

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

        if (source["level"] is not null)
            copy["level"] = source["level"].DeepClone();

        if (source["rolledCategories"] is not null)
            copy["rolledCategories"] = source["rolledCategories"].DeepClone();

        if (source["rolledAffixes"] is not null)
            copy["rolledAffixes"] = source["rolledAffixes"].DeepClone();

        if (source["dropMeta"] is not null)
            copy["dropMeta"] = source["dropMeta"].DeepClone();

        if (source["integrity"] is not null)
            copy["integrity"] = source["integrity"].DeepClone();

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
