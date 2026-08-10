using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Data;
using SkySpire.Api.Entities;

namespace SkySpire.Api.Services;

public sealed class StatsService(AppDbContext db)
{
    public async Task RecordProgressAsync(Guid userId, JsonObject character, int killsDelta, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return;
        }

        var tower = character["tower"] as JsonObject;
        var row = await db.CharacterStats.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (row is null)
        {
            row = new CharacterStats
            {
                UserId = userId,
                Username = user.Username,
                CharacterName = character["name"]?.GetValue<string>() ?? "Hero"
            };
            db.CharacterStats.Add(row);
        }

        row.Username = user.Username;
        row.CharacterName = character["name"]?.GetValue<string>() ?? row.CharacterName;
        row.Level = character["level"]?.GetValue<int>() ?? 1;
        var floor = tower?["floor"]?.GetValue<int>() ?? 0;
        var room = tower?["room"]?.GetValue<int>() ?? 0;
        if (floor > row.LastFloor || (floor == row.LastFloor && room > row.LastRoom))
        {
            row.LastFloor = floor;
            row.LastRoom = room;
        }

        var live = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        row.SkyCoin = live.SkyCoin;
        row.Kills += Math.Max(0, killsDelta);
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task RefreshFloorsOwnedAsync(Guid userId, CancellationToken ct)
    {
        var count = await db.FloorOwnerships.CountAsync(x => x.OwnerUserId == userId, ct);
        var row = await db.CharacterStats.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (row is null)
        {
            return;
        }

        row.FloorsOwned = count;
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<object>> RankingsAsync(string by, CancellationToken ct)
    {
        var q = db.CharacterStats.AsNoTracking();
        IQueryable<CharacterStats> ordered = by.ToLowerInvariant() switch
        {
            "level" => q.OrderByDescending(x => x.Level).ThenByDescending(x => x.Kills),
            "wealth" => q.OrderByDescending(x => x.SkyCoin).ThenByDescending(x => x.Level),
            _ => q.OrderByDescending(x => x.LastFloor).ThenByDescending(x => x.LastRoom).ThenByDescending(x => x.Level)
        };

        var rows = await ordered.Take(50).ToListAsync(ct);
        return rows.Select(x => (object)new
        {
            x.Username,
            x.CharacterName,
            x.Level,
            x.LastFloor,
            x.LastRoom,
            x.Kills,
            x.FloorsOwned,
            x.SkyCoin
        }).ToList();
    }
}
