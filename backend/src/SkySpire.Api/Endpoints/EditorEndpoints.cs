using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

/// <summary>
/// Dev-only content editor helpers (OpenAI draft, PixelLab assets, Gemini attribute cards).
/// Mapped only when the host environment is Development.
/// </summary>
public static class EditorEndpoints
{
    public static RouteGroupBuilder MapEditorEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/editor").AllowAnonymous();

        group.MapPost("/items/draft", async (
            [FromBody] ItemDraftRequest body,
            ItemDraftService drafts,
            CancellationToken ct) =>
        {
            var result = await drafts.DraftAsync(body.Description ?? "", ct);
            if (!result.Success || result.Draft is null)
            {
                return Results.Json(new { error = result.Error ?? "draft_failed" },
                    statusCode: StatusCodes.Status502BadGateway);
            }

            return Results.Ok(result.Draft);
        });

        group.MapPost("/items/{id}/icon", async (
            string id,
            [FromBody] ItemIconRequest? body,
            PixelLabService pixellab,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return Results.BadRequest(new { error = "id é obrigatório." });
            }

            var result = await pixellab.GenerateItemIconCandidatesAsync(
                id,
                body?.Name,
                body?.Description,
                body?.Type,
                body?.Quality,
                body?.Size,
                ct);

            return Results.Ok(CandidatesResponse(result));
        });

        group.MapPost("/items/{id}/icon/commit", async (
            string id,
            [FromBody] PixelLabCommitRequest? body,
            PixelLabService pixellab,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(body?.DraftId))
            {
                return Results.BadRequest(new { error = "id e draftId são obrigatórios." });
            }

            var result = await pixellab.CommitItemIconAsync(id, body.DraftId, body.Index ?? 0, ct);
            if (result is null)
            {
                return Results.BadRequest(new { error = "Draft inválido ou índice inexistente." });
            }

            return Results.Ok(new
            {
                iconPath = result.IconPath,
                source = result.Source,
                reason = result.Reason,
                quality = result.Quality,
                model = result.Model
            });
        });

        group.MapPost("/monsters/draft", async (
            [FromBody] MonsterDraftRequest body,
            MonsterDraftService drafts,
            CancellationToken ct) =>
        {
            var result = await drafts.DraftAsync(body.Description ?? "", ct);
            if (!result.Success || result.Draft is null)
            {
                return Results.Json(new { error = result.Error ?? "draft_failed" },
                    statusCode: StatusCodes.Status502BadGateway);
            }

            return Results.Ok(result.Draft);
        });

        group.MapPost("/floors/draft", async (
            [FromBody] FloorDraftRequest body,
            FloorDraftService drafts,
            CancellationToken ct) =>
        {
            var result = await drafts.DraftAsync(
                body.Description ?? "",
                body.FloorNumber,
                body.ItemLevel,
                ct);
            if (!result.Success || result.Package is null)
            {
                return Results.Json(new { error = result.Error ?? "draft_failed" },
                    statusCode: StatusCodes.Status502BadGateway);
            }

            return Results.Ok(result.Package);
        });

        group.MapPost("/monsters/{id}/sprite", async (
            string id,
            [FromBody] MonsterSpriteRequest? body,
            PixelLabService pixellab,
            GameConfigService gameConfig,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return Results.BadRequest(new { error = "id é obrigatório." });
            }

            var result = await pixellab.GenerateMonsterSpriteCandidatesAsync(
                id,
                body?.Name,
                body?.Description,
                body?.Behavior,
                gameConfig.GetMonsterImageComplement(),
                body?.GenerativeComplement,
                body?.Quality,
                body?.Size,
                ct);

            return Results.Ok(CandidatesResponse(result));
        });

        group.MapPost("/monsters/{id}/sprite/commit", async (
            string id,
            [FromBody] PixelLabCommitRequest? body,
            PixelLabService pixellab,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(body?.DraftId))
            {
                return Results.BadRequest(new { error = "id e draftId são obrigatórios." });
            }

            var result = await pixellab.CommitMonsterSpriteAsync(id, body.DraftId, body.Index ?? 0, ct);
            if (result is null)
            {
                return Results.BadRequest(new { error = "Draft inválido ou índice inexistente." });
            }

            return Results.Ok(new
            {
                spritePath = result.SpritePath,
                source = result.Source,
                reason = result.Reason,
                quality = result.Quality,
                model = result.Model
            });
        });

        group.MapPost("/monsters/{id}/animate", async (
            string id,
            [FromBody] MonsterAnimateRequest? body,
            PixelLabService pixellab,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return Results.BadRequest(new { error = "id é obrigatório." });
            }

            var result = await pixellab.GenerateMonsterIdleDraftAsync(
                id,
                body?.Name,
                body?.Description,
                body?.Quality,
                body?.Size,
                ct);
            if (result.Source == "fallback" && result.Reason == "no_reference_sprite")
            {
                pixellab.DiscardDraft(result.DraftId);
                return Results.BadRequest(new
                {
                    error = "Gere o sprite estático antes de animar (falta data/assets/monsters/{id}.png)."
                });
            }

            return Results.Ok(new
            {
                draftId = result.DraftId,
                frames = result.Frames,
                frameWidth = result.FrameWidth,
                frameHeight = result.FrameHeight,
                frameCount = result.FrameCount,
                fps = result.Fps,
                direction = result.Direction,
                source = result.Source,
                reason = result.Reason,
                quality = result.Quality,
                model = result.Model,
                size = result.Size
            });
        });

        group.MapPost("/monsters/{id}/animate/commit", async (
            string id,
            [FromBody] PixelLabCommitRequest? body,
            PixelLabService pixellab,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(body?.DraftId))
            {
                return Results.BadRequest(new { error = "id e draftId são obrigatórios." });
            }

            var result = await pixellab.CommitMonsterIdleAsync(id, body.DraftId, ct);
            if (result is null)
            {
                return Results.BadRequest(new { error = "Draft inválido." });
            }

            return Results.Ok(new
            {
                idle = new
                {
                    frames = result.Frames,
                    frameWidth = result.FrameWidth,
                    frameHeight = result.FrameHeight,
                    frameCount = result.FrameCount,
                    fps = result.Fps,
                    direction = result.Direction
                },
                source = result.Source,
                reason = result.Reason,
                quality = result.Quality,
                model = result.Model
            });
        });

        group.MapPost("/pixellab/discard", (
            [FromBody] PixelLabDiscardRequest? body,
            PixelLabService pixellab) =>
        {
            if (string.IsNullOrWhiteSpace(body?.DraftId))
            {
                return Results.BadRequest(new { error = "draftId é obrigatório." });
            }

            var ok = pixellab.DiscardDraft(body.DraftId);
            return Results.Ok(new { discarded = ok });
        });

        // Attribute card art — Google Gemini only (not PixelLab).
        group.MapPost("/attributes/{id}/card", async (
            string id,
            [FromBody] AttributeCardRequest? body,
            GeminiImageService gemini,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return Results.BadRequest(new { error = "id é obrigatório." });
            }

            var result = await gemini.GenerateAttributeCardAsync(
                id,
                body?.Name,
                body?.Description,
                body?.Prompt,
                ct);

            return Results.Ok(new
            {
                cardPath = result.CardPath,
                source = result.Source,
                reason = result.Reason,
                detail = result.Detail
            });
        });

        // Floor background art — Google Gemini (ultrawide 21:9 combat arena).
        group.MapPost("/floors/{id}/background", async (
            string id,
            [FromBody] FloorBackgroundRequest? body,
            GeminiImageService gemini,
            GameConfigService gameConfig,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return Results.BadRequest(new { error = "id é obrigatório." });
            }

            var result = await gemini.GenerateFloorBackgroundAsync(
                id,
                body?.Name,
                body?.Description,
                body?.Theme,
                gameConfig.GetFloorImageComplement(),
                body?.GenerativeComplement,
                ct);

            return Results.Ok(new
            {
                backgroundPath = result.BackgroundPath,
                source = result.Source,
                reason = result.Reason,
                detail = result.Detail
            });
        });

        return group;
    }

    private static object CandidatesResponse(PixelLabCandidatesResult result) => new
    {
        draftId = result.DraftId,
        candidates = result.Candidates.Select(c => new { index = c.Index, previewPath = c.PreviewPath }),
        source = result.Source,
        reason = result.Reason,
        quality = result.Quality,
        model = result.Model,
        size = result.Size
    };
}

public sealed record ItemDraftRequest(string? Description);
public sealed record ItemIconRequest(string? Name, string? Description, string? Type, string? Quality, int? Size);
public sealed record MonsterDraftRequest(string? Description);
public sealed record FloorDraftRequest(string? Description, int? FloorNumber, int? ItemLevel);
public sealed record MonsterSpriteRequest(
    string? Name,
    string? Description,
    string? Behavior,
    string? GenerativeComplement,
    string? Quality,
    int? Size);
public sealed record MonsterAnimateRequest(string? Name, string? Description, string? Quality, int? Size);
public sealed record PixelLabCommitRequest(string? DraftId, int? Index);
public sealed record PixelLabDiscardRequest(string? DraftId);
public sealed record AttributeCardRequest(string? Name, string? Description, string? Prompt);
public sealed record FloorBackgroundRequest(
    string? Name,
    string? Description,
    string? Theme,
    string? GenerativeComplement);
