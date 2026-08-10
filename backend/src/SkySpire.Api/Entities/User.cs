namespace SkySpire.Api.Entities;

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? CharacterJsonPath { get; set; }
    public string? BagJsonPath { get; set; }
    public string? FirebaseUid { get; set; }
    public string? AuthProvider { get; set; }
    public long SkyCoin { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
