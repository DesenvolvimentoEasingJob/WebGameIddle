using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

public static class MarketEndpoints
{
    public static RouteGroupBuilder MapMarketEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/market").RequireAuthorization();

        group.MapGet("/", async (MarketService market, CancellationToken ct) =>
            Results.Ok(await market.ListAsync(ct)));

        group.MapPost("/list", async (
            ClaimsPrincipal p,
            [FromBody] MarketListRequest body,
            MarketService market,
            CancellationToken ct) =>
        {
            if (!TryUser(p, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await market.ListFromBagAsync(id, body.BagIndex, body.Quantity, body.PriceEach, ct));
            }
            catch (MarketException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (EconomyException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/buy", async (
            ClaimsPrincipal p,
            [FromBody] MarketBuyRequest body,
            MarketService market,
            CancellationToken ct) =>
        {
            if (!TryUser(p, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await market.BuyAsync(id, body.ListingId, body.Quantity, ct));
            }
            catch (MarketException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (EconomyException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/cancel", async (
            ClaimsPrincipal p,
            [FromBody] MarketCancelRequest body,
            MarketService market,
            CancellationToken ct) =>
        {
            if (!TryUser(p, out var id)) return Results.Unauthorized();
            try
            {
                await market.CancelAsync(id, body.ListingId, ct);
                return Results.Ok(new { ok = true });
            }
            catch (MarketException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
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

public sealed record MarketListRequest(int BagIndex, int Quantity, long PriceEach);
public sealed record MarketBuyRequest(Guid ListingId, int Quantity);
public sealed record MarketCancelRequest(Guid ListingId);
