using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

public static class TowerEndpoints
{
    public static RouteGroupBuilder MapTowerEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/tower").RequireAuthorization();

        group.MapGet("/floors", async (TowerService tower, CancellationToken ct) =>
            Results.Ok(await tower.ListFloorsAsync(ct)));

        group.MapGet("/floors/{n:int}", async (int n, TowerService tower, CancellationToken ct) =>
        {
            var floor = await tower.GetFloorAsync(n, ct);
            return floor is null ? Results.NotFound() : Results.Ok(floor);
        });

        group.MapGet("/state", async (ClaimsPrincipal principal, TowerService tower, CancellationToken ct) =>
        {
            if (!TryUser(principal, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await tower.GetStateAsync(id, ct));
            }
            catch (TowerException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/enter", async (
            ClaimsPrincipal principal,
            [FromBody] EnterTowerRequest body,
            TowerService tower,
            CancellationToken ct) =>
        {
            if (!TryUser(principal, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await tower.EnterAsync(id, body.Floor, ct));
            }
            catch (TowerException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/auto-climb", async (
            ClaimsPrincipal principal,
            [FromBody] AutoClimbRequest body,
            TowerService tower,
            CancellationToken ct) =>
        {
            if (!TryUser(principal, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await tower.SetAutoClimbAsync(id, body.Enabled, ct));
            }
            catch (TowerException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/move", async (
            ClaimsPrincipal principal,
            [FromBody] MoveRoomRequest body,
            TowerService tower,
            CancellationToken ct) =>
        {
            if (!TryUser(principal, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await tower.MoveAsync(id, body.Room, ct));
            }
            catch (TowerException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/battle/start", async (
            ClaimsPrincipal principal,
            TowerService tower,
            CancellationToken ct) =>
        {
            if (!TryUser(principal, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await tower.StartBattleAsync(id, ct));
            }
            catch (TowerException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (CharacterException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (EconomyException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (JsonIntegrityException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPost("/challenge/boss", async (
            ClaimsPrincipal principal,
            TowerService tower,
            CancellationToken ct) =>
        {
            if (!TryUser(principal, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await tower.ChallengeBossAsync(id, ct));
            }
            catch (TowerException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (EconomyException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (JsonIntegrityException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPost("/challenge/registry", async (
            ClaimsPrincipal principal,
            TowerService tower,
            CancellationToken ct) =>
        {
            if (!TryUser(principal, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await tower.ChallengeRegistryAsync(id, ct));
            }
            catch (TowerException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (EconomyException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (JsonIntegrityException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapGet("/ownership/{floor:int}", async (int floor, TowerService tower, CancellationToken ct) =>
            Results.Ok(await tower.GetOwnershipAsync(floor, ct)));

        return group;
    }

    private static bool TryUser(ClaimsPrincipal principal, out Guid id)
    {
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
        return Guid.TryParse(value, out id);
    }
}

public sealed record EnterTowerRequest(int Floor);
public sealed record AutoClimbRequest(bool Enabled);
public sealed record MoveRoomRequest(int Room);
