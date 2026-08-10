using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

public static class InventoryEndpoints
{
    public static RouteGroupBuilder MapInventoryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/inventory").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal p, InventoryService inv, CancellationToken ct) =>
        {
            if (!TryUser(p, out var id)) return Results.Unauthorized();
            try { return Results.Ok(await inv.GetAsync(id, ct)); }
            catch (InventoryException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        group.MapPost("/equip", async (
            ClaimsPrincipal p,
            [FromBody] EquipRequest body,
            InventoryService inv,
            CancellationToken ct) =>
        {
            if (!TryUser(p, out var id)) return Results.Unauthorized();
            try { return Results.Ok(await inv.EquipAsync(id, body.BagIndex, body.SlotName, ct)); }
            catch (InventoryException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        group.MapPost("/unequip", async (
            ClaimsPrincipal p,
            [FromBody] UnequipRequest body,
            InventoryService inv,
            CancellationToken ct) =>
        {
            if (!TryUser(p, out var id)) return Results.Unauthorized();
            try { return Results.Ok(await inv.UnequipAsync(id, body.SlotName, ct)); }
            catch (InventoryException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        group.MapPost("/discard", async (
            ClaimsPrincipal p,
            [FromBody] DiscardRequest body,
            InventoryService inv,
            CancellationToken ct) =>
        {
            if (!TryUser(p, out var id)) return Results.Unauthorized();
            try { return Results.Ok(await inv.DiscardAsync(id, body.BagIndexes ?? [], ct)); }
            catch (InventoryException ex) { return Results.BadRequest(new { error = ex.Message }); }
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

public sealed record EquipRequest(int BagIndex, string SlotName);
public sealed record UnequipRequest(string SlotName);
public sealed record DiscardRequest(int[]? BagIndexes);
