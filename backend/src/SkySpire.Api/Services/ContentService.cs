using System.Text.Json;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

public sealed class ContentService(IOptions<AppSecretsOptions> secrets)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private string ContentRoot => secrets.Value.ContentPath;

    public async Task<IReadOnlyList<JsonElement>> ListAsync(string folder, CancellationToken ct)
    {
        var dir = Path.Combine(ContentRoot, folder);
        if (!Directory.Exists(dir))
        {
            return [];
        }

        var items = new List<JsonElement>();
        foreach (var file in Directory.EnumerateFiles(dir, "*.json").OrderBy(f => f, StringComparer.OrdinalIgnoreCase))
        {
            await using var stream = File.OpenRead(file);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            items.Add(doc.RootElement.Clone());
        }

        return items;
    }

    public async Task<JsonElement?> GetByIdAsync(string folder, string id, CancellationToken ct)
    {
        var path = Path.Combine(ContentRoot, folder, $"{id}.json");
        if (!File.Exists(path))
        {
            // also try scanning
            foreach (var file in Directory.Exists(Path.Combine(ContentRoot, folder))
                         ? Directory.EnumerateFiles(Path.Combine(ContentRoot, folder), "*.json")
                         : [])
            {
                await using var stream = File.OpenRead(file);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                if (doc.RootElement.TryGetProperty("id", out var idProp) &&
                    string.Equals(idProp.GetString(), id, StringComparison.OrdinalIgnoreCase))
                {
                    return doc.RootElement.Clone();
                }
            }

            return null;
        }

        await using var fs = File.OpenRead(path);
        using var document = await JsonDocument.ParseAsync(fs, cancellationToken: ct);
        return document.RootElement.Clone();
    }

    public static JsonSerializerOptions SerializerOptions => JsonOptions;
}
