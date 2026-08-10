namespace SkySpire.Api.Services;

/// <summary>
/// Result of PixelLab idle animation generation for a monster.
/// Paths use content convention <c>/assets/monsters/...</c>.
/// </summary>
public sealed record MonsterIdleAnimResult(
    IReadOnlyList<string> Frames,
    int FrameWidth,
    int FrameHeight,
    int FrameCount,
    double Fps,
    string Direction,
    string Source,
    string? Reason,
    string Quality = "standard",
    string? Model = null);
