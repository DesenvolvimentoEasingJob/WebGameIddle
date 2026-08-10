namespace SkySpire.Api.Services;

public sealed record MonsterSpriteResult(
    string SpritePath,
    string Source,
    string? Reason,
    string Quality = "standard",
    string? Model = null);
