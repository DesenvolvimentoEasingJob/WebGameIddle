using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

public static class ContentEndpoints
{
    public static RouteGroupBuilder MapContentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/content");

        group.MapGet("/races", async (ContentService content, CancellationToken ct) =>
            Results.Ok(await content.ListAsync("races", ct)));

        group.MapGet("/races/{id}", async (string id, ContentService content, CancellationToken ct) =>
        {
            var race = await content.GetByIdAsync("races", id, ct);
            return race is null ? Results.NotFound() : Results.Ok(race);
        });

        group.MapGet("/classes", async (ContentService content, CancellationToken ct) =>
            Results.Ok(await content.ListAsync("classes", ct)));

        group.MapGet("/classes/{id}", async (string id, ContentService content, CancellationToken ct) =>
        {
            var cls = await content.GetByIdAsync("classes", id, ct);
            return cls is null ? Results.NotFound() : Results.Ok(cls);
        });

        group.MapGet("/items", async (ContentService content, CancellationToken ct) =>
            Results.Ok(await content.ListAsync("items", ct)));

        group.MapGet("/items/{id}", async (string id, ContentService content, CancellationToken ct) =>
        {
            var item = await content.GetByIdAsync("items", id, ct);
            return item is null ? Results.NotFound() : Results.Ok(item);
        });

        return group;
    }
}
