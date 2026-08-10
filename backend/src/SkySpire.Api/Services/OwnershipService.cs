using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;
using SkySpire.Api.Data;
using SkySpire.Api.Entities;

namespace SkySpire.Api.Services;

public sealed class OwnershipService(
    AppDbContext db,
    IOptions<AppSecretsOptions> secrets)
{
    public async Task<FloorOwnership?> GetAsync(int floor, CancellationToken ct) =>
        await db.FloorOwnerships.AsNoTracking().FirstOrDefaultAsync(x => x.FloorNumber == floor, ct);

    public async Task<object?> GetPublicAsync(int floor, CancellationToken ct)
    {
        var row = await GetAsync(floor, ct);
        if (row is null)
        {
            return new { floor, owned = false, ownerUsername = (string?)null, claimedAt = (DateTimeOffset?)null };
        }

        return new
        {
            floor = row.FloorNumber,
            owned = true,
            ownerUsername = row.OwnerUsername,
            ownerUserId = row.OwnerUserId,
            claimedAt = row.ClaimedAt
        };
    }

    public async Task<string> WriteSnapshotAsync(Guid ownerUserId, string username, JsonObject character, int floor, CancellationToken ct)
    {
        var dir = Path.Combine(secrets.Value.DataPath, "snapshots");
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, $"floor-{floor:D2}.json");

        // Clone without bag / skyCoin / tower progress — combat snapshot only
        var clone = new JsonObject
        {
            ["id"] = character["id"]?.DeepClone(),
            ["name"] = character["name"]?.DeepClone(),
            ["raceId"] = character["raceId"]?.DeepClone(),
            ["classId"] = character["classId"]?.DeepClone(),
            ["level"] = character["level"]?.DeepClone(),
            ["xp"] = character["xp"]?.DeepClone(),
            ["baseStats"] = character["baseStats"]?.DeepClone(),
            ["equipmentSlots"] = character["equipmentSlots"]?.DeepClone(),
            ["equipment"] = character["equipment"]?.DeepClone(),
            ["ownerUsername"] = username,
            ["floor"] = floor,
            ["createdAt"] = DateTimeOffset.UtcNow.ToString("O")
        };

        await File.WriteAllTextAsync(path, clone.ToJsonString(ContentService.SerializerOptions), ct);

        var existing = await db.FloorOwnerships.FirstOrDefaultAsync(x => x.FloorNumber == floor, ct);
        if (existing is null)
        {
            db.FloorOwnerships.Add(new FloorOwnership
            {
                FloorNumber = floor,
                OwnerUserId = ownerUserId,
                OwnerUsername = username,
                SnapshotPath = path,
                ClaimedAt = DateTimeOffset.UtcNow
            });
        }
        else
        {
            existing.OwnerUserId = ownerUserId;
            existing.OwnerUsername = username;
            existing.SnapshotPath = path;
            existing.ClaimedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return path;
    }

    public async Task<JsonObject?> LoadSnapshotAsync(int floor, CancellationToken ct)
    {
        var row = await GetAsync(floor, ct);
        if (row is null || !File.Exists(row.SnapshotPath))
        {
            return null;
        }

        var text = await File.ReadAllTextAsync(row.SnapshotPath, ct);
        return JsonNode.Parse(text) as JsonObject;
    }
}
