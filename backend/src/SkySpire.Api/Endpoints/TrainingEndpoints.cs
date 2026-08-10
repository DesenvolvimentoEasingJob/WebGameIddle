using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

public static class TrainingEndpoints
{
    public static RouteGroupBuilder MapTrainingEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/training").RequireAuthorization();

        group.MapPost("/train", async (
            ClaimsPrincipal p,
            [FromBody] TrainRequest body,
            TrainingService training,
            CancellationToken ct) =>
        {
            if (!TryUser(p, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await training.TrainAsync(id, body.Attribute, ct));
            }
            catch (TrainingException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (EconomyException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapGet("/costs", async (
            ClaimsPrincipal p,
            TrainingService training,
            CancellationToken ct) =>
        {
            if (!TryUser(p, out var id)) return Results.Unauthorized();
            try
            {
                return Results.Ok(await training.CostsAsync(id, ct));
            }
            catch (TrainingException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapGet("/preview", async (
            string attribute,
            long? lastCost,
            TrainingService training,
            CancellationToken ct) =>
        {
            try
            {
                return Results.Ok(await training.PreviewAsync(attribute, lastCost, ct));
            }
            catch (TrainingException ex)
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

public sealed record TrainRequest(string Attribute);
