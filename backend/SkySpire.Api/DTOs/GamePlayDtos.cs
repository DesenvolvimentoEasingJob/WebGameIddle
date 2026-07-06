namespace SkySpire.Api.DTOs;

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
    object EffectiveCategories);

public record EquipItemRequest
{
    public required string InstanceId { get; init; }
}

public record UnequipItemRequest
{
    public required string EquipSlot { get; init; }
}

public record UpdateTowerSettingsRequest
{
    public bool AutoAscend { get; init; }
}

public record TowerCombatTurnDto(
    string Actor,
    string Kind,
    int Damage,
    int PlayerHpRemaining,
    int EnemyHpRemaining);

public record TowerCombatRewardsDto(int Xp, int Gold);

public record TowerCombatResultDto(
    string Outcome,
    string EnemyId,
    string EnemyName,
    bool IsBoss,
    int PlayerMaxHp,
    int EnemyMaxHp,
    IReadOnlyList<TowerCombatTurnDto> Turns,
    TowerCombatRewardsDto? Rewards);

public record StartTowerCombatResponse(
    TowerCombatResultDto Combat,
    GameStateResponse GameState);
