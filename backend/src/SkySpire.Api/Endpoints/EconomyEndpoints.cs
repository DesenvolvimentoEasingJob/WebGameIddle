using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Data;
using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

public static class EconomyEndpoints
{
    public static RouteGroupBuilder MapEconomyEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/economy").RequireAuthorization();

        group.MapGet("/balance", async (ClaimsPrincipal principal, EconomyService economy, CancellationToken ct) =>
        {
            if (!TryUser(principal, out var id))
            {
                return Results.Unauthorized();
            }

            try
            {
                var skyCoin = await economy.GetBalanceAsync(id, ct);
                return Results.Ok(new { skyCoin });
            }
            catch (EconomyException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });

        group.MapGet("/ledger", async (
            ClaimsPrincipal principal,
            AppDbContext db,
            int? take,
            CancellationToken ct) =>
        {
            if (!TryUser(principal, out var id))
            {
                return Results.Unauthorized();
            }

            var limit = Math.Clamp(take ?? 50, 1, 200);
            var rows = await db.Ledger.AsNoTracking()
                .Where(x => x.UserId == id)
                .OrderByDescending(x => x.CreatedAt)
                .Take(limit)
                .Select(x => new
                {
                    x.Id,
                    x.Amount,
                    x.BalanceAfter,
                    x.Reason,
                    x.Reference,
                    x.CreatedAt
                })
                .ToListAsync(ct);

            return Results.Ok(rows);
        });

        return group;
    }

    private static bool TryUser(ClaimsPrincipal principal, out Guid id)
    {
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
        return Guid.TryParse(value, out id);
    }
}
