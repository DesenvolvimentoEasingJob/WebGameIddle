namespace SkySpire.Api.Configuration;

/// <summary>
/// Secrets e paths — nunca expor em endpoints públicos.
/// </summary>
public sealed class AppSecretsOptions
{
    public string? JwtSecret { get; set; }
    public string? HmacSecret { get; set; }
    public string? PixellabApiKey { get; set; }
    public string? OpenAiApiKey { get; set; }
    /// <summary>Gemini Developer API key — attribute cards + floor backgrounds (not PixelLab icons).</summary>
    public string? GoogleGeminiApiKey { get; set; }
    public string? GoogleGeminiModel { get; set; }
    public string? GoogleProjectId { get; set; }
    public string ContentPath { get; set; } = "/app/content";
    public string DataPath { get; set; } = "/app/data";
}
