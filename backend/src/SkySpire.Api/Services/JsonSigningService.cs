using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

/// <summary>
/// HMAC-SHA256 signatures over canonical JSON (signature field excluded).
/// Key from HMAC_SECRET / JSON_SIGNING_KEY.
/// </summary>
public sealed class JsonSigningService(IOptions<AppSecretsOptions> secrets, ILogger<JsonSigningService> log)
{
    public string Sign(JsonObject node)
    {
        var payload = CanonicalWithoutSignature(node);
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(SigningKey()));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public void SignInPlace(JsonObject node) => node["signature"] = Sign(node);

    public bool Verify(JsonObject node)
    {
        var expected = node["signature"]?.GetValue<string>();
        if (string.IsNullOrEmpty(expected))
        {
            return false;
        }

        var actual = Sign(node);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(actual),
            Encoding.UTF8.GetBytes(expected.ToLowerInvariant()));
    }

    public void EnsureValidOrThrow(JsonObject node, string label)
    {
        // Allow unsigned legacy files once, then re-sign on save.
        var sig = node["signature"];
        if (sig is null || sig.GetValueKind() == JsonValueKind.Null)
        {
            log.LogWarning("Unsigned {Label} loaded — will re-sign on next save.", label);
            return;
        }

        if (!Verify(node))
        {
            log.LogError("Tampered {Label} rejected (invalid signature).", label);
            throw new JsonIntegrityException($"{label} failed integrity check.");
        }
    }

    private string SigningKey()
    {
        var key = secrets.Value.HmacSecret
            ?? throw new InvalidOperationException("HMAC_SECRET / JSON signing key is not configured.");
        return key;
    }

    private static string CanonicalWithoutSignature(JsonObject node)
    {
        var clone = (JsonObject)node.DeepClone()!;
        clone.Remove("signature");
        return clone.ToJsonString(new JsonSerializerOptions
        {
            WriteIndented = false,
            PropertyNamingPolicy = null
        });
    }
}

public sealed class JsonIntegrityException(string message) : Exception(message);
