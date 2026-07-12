namespace SkySpire.Api.DTOs;

public record ItemDropMetaDto(
    int Floor,
    string MobId,
    string Seed,
    int RollIndex,
    string? RolledAt);

public record ItemIntegrityDto(
    string Hash,
    string Signature);

public record ItemSummaryDto(
    string Id,
    string Name,
    string? Description,
    string Type,
    string? Slot,
    string Rarity,
    int Level,
    IReadOnlyList<string> Classes,
    bool Stackable,
    int MaxStack,
    object? Categories,
    object? Assets);

public record GameStateResponse(
    object CharacterJson,
    IReadOnlyDictionary<string, ItemSummaryDto> ItemCatalog,
    object? CurrentFloor,
    object EffectiveCategories,
    GameLootConfigDto LootConfig);

public record EquipItemRequest
{
    public required string InstanceId { get; init; }
}

public record UnequipItemRequest
{
    public required string EquipSlot { get; init; }
}

public record DiscardItemRequest
{
    public required string InstanceId { get; init; }
}

public record UpdateTowerSettingsRequest
{
    public bool AutoAscend { get; init; }
    public bool ContinuousAttack { get; init; }
}

public record NavigateTowerFloorRequest
{
    public required string Direction { get; init; }
}

public record TowerCombatTurnDto(
    string Actor,
    string Kind,
    int Damage,
    int PlayerHpRemaining,
    int EnemyHpRemaining,
    int Heal = 0);

public record DroppedItemDto(
    string InstanceId,
    string ItemId,
    string Name,
    string Rarity,
    int Level,
    int Quantity,
    object? RolledCategories,
    object? RolledAffixes,
    object? Assets,
    ItemDropMetaDto? DropMeta = null,
    ItemIntegrityDto? Integrity = null);

public record TowerCombatRewardsDto(
    int Xp,
    int Gold,
    IReadOnlyList<DroppedItemDto> Items,
    IReadOnlyList<DroppedItemDto> LostItems);

public record TowerCombatResultDto(
    string Outcome,
    string EnemyId,
    string EnemyName,
    bool IsBoss,
    int PlayerMaxHp,
    int EnemyMaxHp,
    IReadOnlyList<TowerCombatTurnDto> Turns,
    TowerCombatRewardsDto? Rewards);

/// <summary>Incremental state after a mutation — omits static catalog, loot config, and unchanged floor.</summary>
public record GamePatchResponse(
    object CharacterJson,
    IReadOnlyDictionary<string, ItemSummaryDto>? NewCatalogEntries = null,
    object? CurrentFloor = null,
    object? EffectiveCategories = null);

public record StartTowerCombatResponse(
    TowerCombatResultDto Combat,
    GamePatchResponse Patch);

public record TowerCombatBatchRequest
{
    public int KillCount { get; init; } = 1;
}

public record TowerCombatBatchResultDto(
    int KillCount,
    int Wins,
    int Defeats,
    int TotalXp,
    int TotalGold,
    IReadOnlyList<DroppedItemDto> Items,
    IReadOnlyList<DroppedItemDto> LostItems,
    string BatchSeed,
    IReadOnlyList<TowerCombatResultDto> Combats);

public record StartTowerCombatBatchResponse(
    TowerCombatBatchResultDto Batch,
    GamePatchResponse Patch);

public record TradeItemRequest
{
    public required int TargetSlotIndex { get; init; }
    public required string InstanceId { get; init; }
}

public record ApplyGemRequest
{
    public required string ItemInstanceId { get; init; }
    public required string GemInstanceId { get; init; }
}
