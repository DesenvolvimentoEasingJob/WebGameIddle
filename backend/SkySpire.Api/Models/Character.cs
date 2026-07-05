namespace SkySpire.Api.Models;

public enum CharacterStatus
{
    Draft,
    Complete,
}

public class Character
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int SlotIndex { get; set; }
    public string? RaceId { get; set; }
    public string? ClassId { get; set; }
    public required string JsonPath { get; set; }
    public CharacterStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
