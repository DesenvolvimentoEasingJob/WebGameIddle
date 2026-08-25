using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

/// <summary>
/// Google Gemini image generation for attribute Magic-style cards and floor backgrounds.
/// Item icons / monster sprites remain on <see cref="PixelLabService"/>.
/// </summary>
public sealed class GeminiImageService(
    IHttpClientFactory httpFactory,
    IOptions<AppSecretsOptions> secrets,
    ILogger<GeminiImageService> log)
{
    private const string DefaultModel = "gemini-2.5-flash-image";

    // 1x1 transparent PNG
    private static readonly byte[] PlaceholderPng =
    [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
    ];

    public async Task<AttributeCardResult> GenerateAttributeCardAsync(
        string attributeId,
        string? name,
        string? description,
        string? prompt,
        CancellationToken ct)
    {
        var id = SanitizeId(attributeId);
        var dir = Path.Combine(secrets.Value.DataPath, "assets", "attributes");
        Directory.CreateDirectory(dir);
        var pngPath = Path.Combine(dir, $"{id}.png");
        var cardPath = $"/api/assets/attributes/{id}.png";
        var key = secrets.Value.GoogleGeminiApiKey;

        if (string.IsNullOrWhiteSpace(key))
        {
            await File.WriteAllBytesAsync(pngPath, PlaceholderPng, ct);
            return new AttributeCardResult(
                cardPath,
                "fallback",
                "no_api_key",
                "GOOGLE_GEMINI_API_KEY ausente ou vazia no backend/.env.");
        }

        var model = string.IsNullOrWhiteSpace(secrets.Value.GoogleGeminiModel)
            ? DefaultModel
            : secrets.Value.GoogleGeminiModel.Trim();

        var subject = string.IsNullOrWhiteSpace(name) ? id : name.Trim();
        var flavor = string.IsNullOrWhiteSpace(description) ? subject : description.Trim();
        var userPrompt = string.IsNullOrWhiteSpace(prompt)
            ? BuildDefaultPrompt(subject, flavor, id)
            : prompt.Trim();

        try
        {
            var client = httpFactory.CreateClient("gemini");
            var url =
                $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent?key={Uri.EscapeDataString(key)}";

            var body = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new[] { new { text = userPrompt } }
                    }
                },
                generationConfig = new
                {
                    responseModalities = new[] { "IMAGE" },
                    // Caixa de arte Magic ≈ 53×39 mm → ~4:3 paisagem (não a carta 63×88 inteira)
                    imageConfig = new { aspectRatio = "4:3" }
                }
            };

            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            using var res = await client.SendAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                var status = (int)res.StatusCode;
                var apiMessage = ExtractGeminiErrorMessage(raw);
                var detail =
                    $"Gemini HTTP {status} (model={model}). {apiMessage ?? Truncate(raw)}";
                log.LogWarning("Gemini card HTTP {Status}: {Body}", status, Truncate(raw));
                await File.WriteAllBytesAsync(pngPath, PlaceholderPng, ct);
                return new AttributeCardResult(cardPath, "fallback", $"http_{status}", detail);
            }

            var png = TryExtractImageBytes(raw);
            if (png is null)
            {
                var detail =
                    $"Resposta Gemini sem imagem inline (model={model}). " +
                    $"Trecho: {Truncate(raw)}";
                log.LogWarning("Gemini card response had no image: {Body}", Truncate(raw));
                await File.WriteAllBytesAsync(pngPath, PlaceholderPng, ct);
                return new AttributeCardResult(cardPath, "fallback", "no_image_in_response", detail);
            }

            await File.WriteAllBytesAsync(pngPath, png, ct);
            return new AttributeCardResult(cardPath, "gemini", null);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Gemini attribute card failed");
            await File.WriteAllBytesAsync(pngPath, PlaceholderPng, ct);
            return new AttributeCardResult(
                cardPath,
                "fallback",
                "exception",
                $"{ex.GetType().Name}: {ex.Message}");
        }
    }

    public async Task<FloorBackgroundResult> GenerateFloorBackgroundAsync(
        string floorId,
        string? name,
        string? description,
        string? theme,
        string? globalComplement,
        string? generativeComplement,
        CancellationToken ct)
    {
        var id = SanitizeId(floorId);
        var dir = Path.Combine(secrets.Value.DataPath, "assets", "floors");
        Directory.CreateDirectory(dir);
        var pngPath = Path.Combine(dir, $"{id}.png");
        var backgroundPath = $"/api/assets/floors/{id}.png";
        var key = secrets.Value.GoogleGeminiApiKey;

        if (string.IsNullOrWhiteSpace(key))
        {
            await File.WriteAllBytesAsync(pngPath, PlaceholderPng, ct);
            return new FloorBackgroundResult(
                backgroundPath,
                "fallback",
                "no_api_key",
                "GOOGLE_GEMINI_API_KEY ausente ou vazia no backend/.env.");
        }

        var model = string.IsNullOrWhiteSpace(secrets.Value.GoogleGeminiModel)
            ? DefaultModel
            : secrets.Value.GoogleGeminiModel.Trim();

        var subject = string.IsNullOrWhiteSpace(name) ? id : name.Trim();
        var flavor = string.IsNullOrWhiteSpace(description) ? subject : description.Trim();
        var themeTag = string.IsNullOrWhiteSpace(theme) ? "fantasy dungeon" : theme.Trim();
        var userPrompt = BuildFloorBackgroundPrompt(
            subject,
            flavor,
            themeTag,
            id,
            globalComplement,
            generativeComplement);

        try
        {
            var client = httpFactory.CreateClient("gemini");
            var url =
                $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent?key={Uri.EscapeDataString(key)}";

            // Explicit dictionary so Gemini receives camelCase keys (aspectRatio 21:9).
            var body = new Dictionary<string, object?>
            {
                ["contents"] = new object[]
                {
                    new Dictionary<string, object?>
                    {
                        ["role"] = "user",
                        ["parts"] = new object[]
                        {
                            new Dictionary<string, object?> { ["text"] = userPrompt }
                        }
                    }
                },
                ["generationConfig"] = new Dictionary<string, object?>
                {
                    ["responseModalities"] = new[] { "IMAGE" },
                    ["imageConfig"] = new Dictionary<string, object?>
                    {
                        ["aspectRatio"] = "21:9"
                    }
                }
            };

            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            var jsonOpts = new JsonSerializerOptions { PropertyNamingPolicy = null };
            req.Content = new StringContent(JsonSerializer.Serialize(body, jsonOpts), Encoding.UTF8, "application/json");

            using var res = await client.SendAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                var status = (int)res.StatusCode;
                var apiMessage = ExtractGeminiErrorMessage(raw);
                var detail =
                    $"Gemini HTTP {status} (model={model}). {apiMessage ?? Truncate(raw)}";
                log.LogWarning("Gemini floor background HTTP {Status}: {Body}", status, Truncate(raw));
                await File.WriteAllBytesAsync(pngPath, PlaceholderPng, ct);
                return new FloorBackgroundResult(backgroundPath, "fallback", $"http_{status}", detail);
            }

            var png = TryExtractImageBytes(raw);
            if (png is null)
            {
                var detail =
                    $"Resposta Gemini sem imagem inline (model={model}). " +
                    $"Trecho: {Truncate(raw)}";
                log.LogWarning("Gemini floor background had no image: {Body}", Truncate(raw));
                await File.WriteAllBytesAsync(pngPath, PlaceholderPng, ct);
                return new FloorBackgroundResult(backgroundPath, "fallback", "no_image_in_response", detail);
            }

            await File.WriteAllBytesAsync(pngPath, png, ct);
            return new FloorBackgroundResult(backgroundPath, "gemini", null);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Gemini floor background failed");
            await File.WriteAllBytesAsync(pngPath, PlaceholderPng, ct);
            return new FloorBackgroundResult(
                backgroundPath,
                "fallback",
                "exception",
                $"{ex.GetType().Name}: {ex.Message}");
        }
    }

    public string? GetAttributeCardFilePath(string fileName) =>
        ResolveAssetFilePath("attributes", fileName);

    public string? GetFloorBackgroundFilePath(string fileName) =>
        ResolveAssetFilePath("floors", fileName);

    public string? GetRacePortraitFilePath(string fileName) =>
        ResolveAssetFilePath("races", fileName);

    private string? ResolveAssetFilePath(string folder, string fileName)
    {
        var safe = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(safe) ||
            !safe.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
            safe.Contains("..", StringComparison.Ordinal))
        {
            return null;
        }

        var path = Path.Combine(secrets.Value.DataPath, "assets", folder, safe);
        return File.Exists(path) ? path : null;
    }

    private static string BuildDefaultPrompt(string name, string description, string id) =>
        "Create ONLY the inner art box illustration for a Magic: The Gathering style fantasy RPG attribute card. " +
        "Landscape orientation 4:3 (like a 53mm × 39mm art window), painterly, cinematic. " +
        "Do NOT draw the full card frame, borders, title bar, text box, mana symbols, or any UI chrome. " +
        "No text, no letters, no watermark. Fill the frame edge-to-edge with the scene. " +
        $"Attribute id: {id}. Title concept: {name}. Mood and scene: {description}. " +
        "Dramatic lighting, cohesive color story, legendary rarity feel.";

    private static string BuildFloorBackgroundPrompt(
        string name,
        string description,
        string theme,
        string id,
        string? globalComplement,
        string? generativeComplement)
    {
        var global = string.IsNullOrWhiteSpace(globalComplement)
            ? "pixel art, ultrawide 21:9 combat arena strip, side view, solid walkable ground along the bottom third"
            : globalComplement.Trim();
        var extra = string.IsNullOrWhiteSpace(generativeComplement)
            ? ""
            : " Per-floor complement: " + generativeComplement.Trim() + ".";

        return
            "REQUIRED OUTPUT FORMAT: single ultrawide IMAGE, aspect ratio exactly 21:9 (very wide, short). " +
            "Style / framing constraints (apply first): " + global + ". " +
            "Create a pixel-art fantasy RPG COMBAT ARENA backdrop for a browser game footer stage. " +
            "Composition rules (critical): " +
            "1) Side-view dungeon strip — NOT a floating room, NOT top-down, NOT square/portrait, NOT 16:9 cinema poster. " +
            "2) Solid walkable GROUND fills the bottom 35–45% (continuous edge-to-edge). " +
            "3) Architecture and depth behind that ground; vanishing point near horizontal center. " +
            "4) Lower center kept relatively clear for game sprites standing on the ground. " +
            "5) Fill the entire frame edge-to-edge; no letterboxing, borders, or empty margins. " +
            "No UI, HUD, text, watermark, characters, or monsters. " +
            $"Floor id: {id}. Name: {name}. Theme tag: {theme}. " +
            $"Visual brief: {description}.{extra}";
    }

    private static byte[]? TryExtractImageBytes(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        if (!doc.RootElement.TryGetProperty("candidates", out var candidates) ||
            candidates.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var candidate in candidates.EnumerateArray())
        {
            if (!candidate.TryGetProperty("content", out var content) ||
                !content.TryGetProperty("parts", out var parts) ||
                parts.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var part in parts.EnumerateArray())
            {
                if (!part.TryGetProperty("inlineData", out var inline) &&
                    !part.TryGetProperty("inline_data", out inline))
                {
                    continue;
                }

                if (!inline.TryGetProperty("data", out var dataEl) ||
                    dataEl.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var b64 = dataEl.GetString();
                if (string.IsNullOrWhiteSpace(b64))
                {
                    continue;
                }

                try
                {
                    var bytes = Convert.FromBase64String(b64);
                    if (bytes.Length > 8)
                    {
                        return bytes;
                    }
                }
                catch (FormatException)
                {
                    // try next part
                }
            }
        }

        return null;
    }

    private static string SanitizeId(string id)
    {
        var chars = id.Trim().ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) || c is '-' or '_' ? c : '-')
            .ToArray();
        var s = new string(chars).Trim('-');
        return string.IsNullOrEmpty(s) ? "attribute" : s;
    }

    private static string? ExtractGeminiErrorMessage(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (!doc.RootElement.TryGetProperty("error", out var error) ||
                error.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            var message = error.TryGetProperty("message", out var msgEl) &&
                          msgEl.ValueKind == JsonValueKind.String
                ? msgEl.GetString()
                : null;
            var status = error.TryGetProperty("status", out var stEl) &&
                         stEl.ValueKind == JsonValueKind.String
                ? stEl.GetString()
                : null;
            var code = error.TryGetProperty("code", out var codeEl) &&
                       codeEl.ValueKind == JsonValueKind.Number
                ? codeEl.GetInt32().ToString()
                : null;

            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(status))
            {
                parts.Add(status!);
            }

            if (!string.IsNullOrWhiteSpace(code))
            {
                parts.Add($"code={code}");
            }

            if (!string.IsNullOrWhiteSpace(message))
            {
                parts.Add(message!);
            }

            return parts.Count == 0 ? null : string.Join(" — ", parts);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string Truncate(string s) =>
        s.Length <= 1200 ? s : s[..1200] + "…";
}
