using System.Text.Json;
using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

public class CharacterStorage(IConfiguration configuration, IWebHostEnvironment environment)
{
    private static readonly JsonSerializerOptions WriteOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
    };

    private readonly string _root = configuration["CharacterStorage:Root"]
        ?? Path.Combine(environment.ContentRootPath, "data", "characters");

    public async Task SaveAsync(Guid userId, Guid characterId, JsonObject document, CancellationToken ct)
    {
        var directory = Path.Combine(_root, userId.ToString());
        Directory.CreateDirectory(directory);

        var path = GetFilePath(userId, characterId);
        var json = document.ToJsonString(WriteOptions);
        await File.WriteAllTextAsync(path, json, ct);
    }

    public async Task<JsonObject?> LoadAsync(string jsonPath, CancellationToken ct)
    {
        if (!File.Exists(jsonPath))
            return null;

        return await ReadJsonFileAsync(jsonPath, ct);
    }

    public async Task<JsonObject?> LoadForCharacterAsync(
        Guid userId,
        Guid characterId,
        string storedJsonPath,
        CancellationToken ct)
    {
        var canonicalPath = GetFilePath(userId, characterId);

        if (File.Exists(canonicalPath))
            return await ReadJsonFileAsync(canonicalPath, ct);

        if (!string.IsNullOrWhiteSpace(storedJsonPath) &&
            !string.Equals(storedJsonPath, canonicalPath, StringComparison.OrdinalIgnoreCase) &&
            File.Exists(storedJsonPath))
        {
            return await ReadJsonFileAsync(storedJsonPath, ct);
        }

        return null;
    }

    private static async Task<JsonObject?> ReadJsonFileAsync(string path, CancellationToken ct)
    {
        var json = await File.ReadAllTextAsync(path, ct);
        return JsonNode.Parse(json)?.AsObject();
    }

    public string GetFilePath(Guid userId, Guid characterId) =>
        Path.Combine(_root, userId.ToString(), $"{characterId}.json");

    public string ComputeHash(JsonObject document)
    {
        var canonical = document.ToJsonString(new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false,
        });

        return Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }

    public Task DeleteAsync(string jsonPath)
    {
        if (File.Exists(jsonPath))
            File.Delete(jsonPath);

        return Task.CompletedTask;
    }
}
