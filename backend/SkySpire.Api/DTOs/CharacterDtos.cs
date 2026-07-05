using System.ComponentModel.DataAnnotations;

namespace SkySpire.Api.DTOs;

public record RaceSummaryDto(string Id, string Name, string? Description, object? Assets, object? Categories);

public record ClassSummaryDto(string Id, string Name, string? Description, object? Assets, object? Categories);

public record CharacterSlotDto(
    int SlotIndex,
    bool Occupied,
    Guid? CharacterId,
    string? RaceId,
    string? ClassId,
    string? Status,
    string? CharacterToken,
    DateTime? TokenExpiresAt,
    object? CharacterJson);

public record SelectRaceRequest
{
    [Required(ErrorMessage = "Informe a raça.")]
    [MaxLength(32)]
    public required string RaceId { get; init; }
}

public record SelectClassRequest
{
    [Required(ErrorMessage = "Informe a classe.")]
    [MaxLength(32)]
    public required string ClassId { get; init; }
}

public record CharacterActionResponse(
    CharacterSlotDto Slot,
    object CharacterJson);
