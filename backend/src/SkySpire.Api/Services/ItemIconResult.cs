namespace SkySpire.Api.Services;

public sealed record ItemIconResult(
    string IconPath,
    string Source,
    string? Reason,
    string Quality = "standard",
    string? Model = null);
