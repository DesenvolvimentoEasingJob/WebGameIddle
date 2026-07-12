using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

public class ItemIntegrityService(IConfiguration configuration)
{
    private static readonly JsonSerializerOptions CanonicalOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public JsonObject SignInstance(JsonObject instance)
    {
        var payload = BuildCanonicalPayload(instance);
        var hash = ComputeHash(payload);
        var signature = ComputeSignature(hash);

        instance["integrity"] = new JsonObject
        {
            ["hash"] = hash,
            ["signature"] = signature,
        };

        return instance;
    }

    public bool TryVerify(JsonObject instance)
    {
        if (instance["integrity"] is not JsonObject integrity)
            return false;

        var storedHash = integrity["hash"]?.GetValue<string>();
        var storedSignature = integrity["signature"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(storedHash) || string.IsNullOrWhiteSpace(storedSignature))
            return false;

        var payload = BuildCanonicalPayload(instance);
        var hash = ComputeHash(payload);
        var signature = ComputeSignature(hash);

        return hash == storedHash && signature == storedSignature;
    }

    public JsonObject EnsureIntegrity(JsonObject instance)
    {
        if (instance["integrity"] is JsonObject integrity
            && !string.IsNullOrWhiteSpace(integrity["hash"]?.GetValue<string>())
            && TryVerify(instance))
            return instance;

        return SignInstance(instance);
    }

    private string BuildCanonicalPayload(JsonObject instance)
    {
        var clone = instance.DeepClone()!.AsObject();
        clone.Remove("integrity");

        return clone.ToJsonString(CanonicalOptions);
    }

    private static string ComputeHash(string canonical) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();

    private string ComputeSignature(string hash)
    {
        var secret = configuration["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
        var key = Encoding.UTF8.GetBytes(secret);
        return Convert.ToHexString(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(hash))).ToLowerInvariant();
    }
}
