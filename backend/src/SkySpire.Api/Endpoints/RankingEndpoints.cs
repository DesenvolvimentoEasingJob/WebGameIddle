using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

public static class RankingEndpoints
{
    public static RouteGroupBuilder MapRankingEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/rankings");

        group.MapGet("/", async (string? by, StatsService stats, CancellationToken ct) =>
        {
            var key = string.IsNullOrWhiteSpace(by) ? "floor" : by;
            return Results.Ok(await stats.RankingsAsync(key, ct));
        });

        return group;
    }
}
