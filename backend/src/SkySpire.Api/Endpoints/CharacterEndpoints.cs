using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

public static class CharacterEndpoints
{
    public static RouteGroupBuilder MapCharacterEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/characters").RequireAuthorization();

        group.MapPost("/", async (
            ClaimsPrincipal principal,
            [FromBody] CreateCharacterRequest body,
            CharacterService characters,
            CancellationToken ct) =>
        {
            if (!TryGetUserId(principal, out var userId))
            {
                return Results.Unauthorized();
            }

            try
            {
                var created = await characters.CreateAsync(userId, body.Name, body.RaceId, body.ClassId, ct);
                return Results.Ok(created);
            }
            catch (CharacterException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapGet("/me", async (
            ClaimsPrincipal principal,
            CharacterService characters,
            CancellationToken ct) =>
        {
            if (!TryGetUserId(principal, out var userId))
            {
                return Results.Unauthorized();
            }

            var me = await characters.GetMeAsync(userId, ct);
            return me is null ? Results.NotFound(new { error = "No character." }) : Results.Ok(me);
        });

        group.MapGet("/me/stats", async (
            ClaimsPrincipal principal,
            CharacterService characters,
            StatCalculator stats,
            CancellationToken ct) =>
        {
            if (!TryGetUserId(principal, out var userId))
            {
                return Results.Unauthorized();
            }

            var raw = await characters.GetRawCharacterAsync(userId, ct);
            if (raw is null)
            {
                return Results.NotFound(new { error = "No character." });
            }

            var calculated = await stats.CalculateFromCharacterAsync(raw.Value, ct);
            return Results.Ok(calculated);
        });

        return group;
    }

    private static bool TryGetUserId(ClaimsPrincipal principal, out Guid userId)
    {
        var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
        return Guid.TryParse(idValue, out userId);
    }
}

public sealed record CreateCharacterRequest(string Name, string RaceId, string ClassId);
