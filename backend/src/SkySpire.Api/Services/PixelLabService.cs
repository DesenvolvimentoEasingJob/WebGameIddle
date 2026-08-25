using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

/// <summary>
/// Minimal PixelLab client. Key never leaves the backend.
/// Falls back to a local placeholder atlas when API key is missing or the call fails.
/// Static/idle asset generation writes temporary drafts; commit copies the chosen files to final paths.
/// </summary>
public sealed class PixelLabService(
    IHttpClientFactory httpFactory,
    IOptions<AppSecretsOptions> secrets,
    ILogger<PixelLabService> log)
{
    private const string KindItemIcon = "item-icon";
    private const string KindMonsterSprite = "monster-sprite";
    private const string KindMonsterIdle = "monster-idle";

    public async Task<object> GenerateOrFallbackAsync(string description, string action, CancellationToken ct)
    {
        var dataRoot = Path.Combine(secrets.Value.DataPath, "assets", "pixellab");
        Directory.CreateDirectory(dataRoot);

        var slug = Sanitize(description) + "-" + Sanitize(action);
        var atlasPath = Path.Combine(dataRoot, $"{slug}-atlas.json");
        var key = secrets.Value.PixellabApiKey;

        if (string.IsNullOrWhiteSpace(key))
        {
            return await WriteFallbackAtlasAsync(atlasPath, description, action, "no_api_key", ct);
        }

        try
        {
            var client = httpFactory.CreateClient("pixellab");
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.pixellab.ai/v2/animate-with-text-v2");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
            var body = new
            {
                description,
                action,
                image_size = new { width = 64, height = 64 },
                n_frames = 4,
                direction = "east"
            };
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            using var res = await client.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync(ct);
                log.LogWarning("PixelLab HTTP {Status}: {Body}", (int)res.StatusCode, err);
                return await WriteFallbackAtlasAsync(atlasPath, description, action, $"http_{(int)res.StatusCode}", ct);
            }

            var json = await res.Content.ReadAsStringAsync(ct);
            var rawPath = Path.Combine(dataRoot, $"{slug}-raw.json");
            await File.WriteAllTextAsync(rawPath, json, ct);

            var atlas = new
            {
                id = slug,
                description,
                action,
                frameSize = 64,
                frames = 4,
                source = "pixellab",
                rawPath,
                convention = "horizontal strip, 64x64 frames left-to-right"
            };
            await File.WriteAllTextAsync(atlasPath, JsonSerializer.Serialize(atlas, ContentService.SerializerOptions), ct);
            return atlas;
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "PixelLab request failed");
            return await WriteFallbackAtlasAsync(atlasPath, description, action, "exception", ct);
        }
    }

    public async Task<object?> GetAtlasAsync(string id, CancellationToken ct)
    {
        var path = Path.Combine(secrets.Value.DataPath, "assets", "pixellab", $"{Sanitize(id)}-atlas.json");
        if (!File.Exists(path))
        {
            // try as full slug file name without suffix
            var dir = Path.Combine(secrets.Value.DataPath, "assets", "pixellab");
            if (!Directory.Exists(dir))
            {
                return null;
            }

            var match = Directory.GetFiles(dir, "*-atlas.json")
                .FirstOrDefault(f => Path.GetFileName(f).StartsWith(Sanitize(id), StringComparison.OrdinalIgnoreCase));
            if (match is null)
            {
                return null;
            }

            path = match;
        }

        var text = await File.ReadAllTextAsync(path, ct);
        return JsonSerializer.Deserialize<object>(text);
    }

    /// <summary>
    /// Generates static inventory icon variants into a draft folder (no final write until commit).
    /// </summary>
    public async Task<PixelLabCandidatesResult> GenerateItemIconCandidatesAsync(
        string itemId,
        string? name,
        string? description,
        string? type,
        string? quality,
        int? size,
        CancellationToken ct)
    {
        var id = SanitizeItemId(itemId);
        var q = NormalizeQuality(quality);
        var sz = NormalizeStaticSize(size);
        var model = StaticModelName(q);

        if (string.IsNullOrWhiteSpace(secrets.Value.PixellabApiKey))
        {
            return await WriteCandidatesDraftAsync(
                KindItemIcon, id, [PlaceholderPng], "fallback", "no_api_key", q, model, sz, ct);
        }

        var subject = string.IsNullOrWhiteSpace(name) ? id : name.Trim();
        var detail = string.IsNullOrWhiteSpace(description) ? subject : description.Trim();
        var kind = string.IsNullOrWhiteSpace(type) ? "item" : type.Trim().ToLowerInvariant();
        var kindHint = TypePromptHint(kind);
        var prompt =
            "SkySpire fantasy RPG pixel art inventory icon, centered single object, " +
            "clean silhouette, transparent background, game item, no text, no UI chrome. " +
            $"Slot type: {kind}. {kindHint} Item: {subject}. {detail}";

        try
        {
            var (pngs, source, reason) = await GenerateStaticPngsAsync(prompt, sz, sz, q, ct);
            if (pngs.Count == 0)
            {
                return await WriteCandidatesDraftAsync(
                    KindItemIcon, id, [PlaceholderPng], "fallback", reason ?? "generate_failed", q, model, sz, ct);
            }

            return await WriteCandidatesDraftAsync(KindItemIcon, id, pngs, source, reason, q, model, sz, ct);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "PixelLab item icon candidates failed");
            return await WriteCandidatesDraftAsync(
                KindItemIcon, id, [PlaceholderPng], "fallback", "exception", q, model, sz, ct);
        }
    }

    public async Task<ItemIconResult?> CommitItemIconAsync(
        string itemId,
        string draftId,
        int index,
        CancellationToken ct)
    {
        var id = SanitizeItemId(itemId);
        var meta = await ReadDraftMetaAsync(draftId, ct);
        if (meta is null ||
            !string.Equals(meta.Kind, KindItemIcon, StringComparison.Ordinal) ||
            !string.Equals(meta.EntityId, id, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var src = GetDraftFilePath(draftId, $"{index}.png");
        if (src is null)
        {
            return null;
        }

        var dir = Path.Combine(secrets.Value.DataPath, "assets", "items");
        Directory.CreateDirectory(dir);
        var dest = Path.Combine(dir, $"{id}.png");
        File.Copy(src, dest, overwrite: true);
        DiscardDraft(draftId);

        return new ItemIconResult(
            $"/api/assets/items/{id}.png",
            meta.Source,
            meta.Reason,
            meta.Quality,
            meta.Model);
    }

    /// <summary>
    /// Gera ícone e grava direto em <c>data/assets/items/{fileName}</c> (drop único in-game).
    /// Retorna path de conteúdo <c>/assets/items/...</c> ou null se falhou sem placeholder escrito.
    /// </summary>
    public async Task<string?> GenerateAndCommitUniqueItemIconAsync(
        string fileName,
        string itemName,
        string artPrompt,
        string? type,
        CancellationToken ct)
    {
        var safe = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(safe) ||
            !safe.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
            safe.Contains("..", StringComparison.Ordinal))
        {
            return null;
        }

        var id = Path.GetFileNameWithoutExtension(safe);
        var dir = Path.Combine(secrets.Value.DataPath, "assets", "items");
        Directory.CreateDirectory(dir);
        var dest = Path.Combine(dir, safe);

        byte[] png = PlaceholderPng;
        if (!string.IsNullOrWhiteSpace(secrets.Value.PixellabApiKey))
        {
            var kind = string.IsNullOrWhiteSpace(type) ? "item" : type.Trim().ToLowerInvariant();
            var kindHint = TypePromptHint(kind);
            var prompt =
                "SkySpire fantasy RPG pixel art inventory icon, centered single object, " +
                "clean silhouette, transparent background, game item, no text, no UI chrome. " +
                $"Slot type: {kind}. {kindHint} Unique item: {itemName}. {artPrompt}";
            try
            {
                var (pngs, _, _) = await GenerateStaticPngsAsync(prompt, 128, 128, "standard", ct);
                if (pngs.Count > 0)
                {
                    png = pngs[0];
                }
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Unique item icon generation failed for {File}", safe);
            }
        }

        await File.WriteAllBytesAsync(dest, png, ct);
        return $"/assets/items/{safe}";
    }

    public string? GetItemIconFilePath(string fileName)
    {
        var safe = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(safe) ||
            !safe.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
            safe.Contains("..", StringComparison.Ordinal))
        {
            return null;
        }

        var path = Path.Combine(secrets.Value.DataPath, "assets", "items", safe);
        return File.Exists(path) ? path : null;
    }

    /// <summary>
    /// Generates static monster sprite variants into a draft folder (no final write until commit).
    /// </summary>
    public async Task<PixelLabCandidatesResult> GenerateMonsterSpriteCandidatesAsync(
        string monsterId,
        string? name,
        string? description,
        string? behavior,
        string? globalComplement,
        string? monsterComplement,
        string? quality,
        int? size,
        CancellationToken ct)
    {
        var id = SanitizeItemId(monsterId);
        var q = NormalizeQuality(quality);
        var sz = NormalizeStaticSize(size);
        var model = StaticModelName(q);

        if (string.IsNullOrWhiteSpace(secrets.Value.PixellabApiKey))
        {
            return await WriteCandidatesDraftAsync(
                KindMonsterSprite, id, [PlaceholderPng], "fallback", "no_api_key", q, model, sz, ct);
        }

        var subject = string.IsNullOrWhiteSpace(name) ? id : name.Trim();
        var detail = string.IsNullOrWhiteSpace(description) ? subject : description.Trim();
        var temper = string.IsNullOrWhiteSpace(behavior) ? "aggressive" : behavior.Trim().ToLowerInvariant();
        var global = string.IsNullOrWhiteSpace(globalComplement) ? "" : globalComplement.Trim();
        var extra = string.IsNullOrWhiteSpace(monsterComplement) ? "" : monsterComplement.Trim();
        var prompt =
            "SkySpire fantasy RPG pixel art monster sprite, single creature centered, " +
            "clean silhouette, transparent background, game enemy unit, no text, no UI chrome, no ground platform. " +
            (string.IsNullOrEmpty(global) ? "" : global + " ") +
            $"Temperament: {temper}. Creature: {subject}. {detail}" +
            (string.IsNullOrEmpty(extra) ? "" : " " + extra);

        try
        {
            var (pngs, source, reason) = await GenerateStaticPngsAsync(prompt, sz, sz, q, ct);
            if (pngs.Count == 0)
            {
                return await WriteCandidatesDraftAsync(
                    KindMonsterSprite, id, [PlaceholderPng], "fallback", reason ?? "generate_failed", q, model, sz, ct);
            }

            return await WriteCandidatesDraftAsync(KindMonsterSprite, id, pngs, source, reason, q, model, sz, ct);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "PixelLab monster sprite candidates failed");
            return await WriteCandidatesDraftAsync(
                KindMonsterSprite, id, [PlaceholderPng], "fallback", "exception", q, model, sz, ct);
        }
    }

    public async Task<MonsterSpriteResult?> CommitMonsterSpriteAsync(
        string monsterId,
        string draftId,
        int index,
        CancellationToken ct)
    {
        var id = SanitizeItemId(monsterId);
        var meta = await ReadDraftMetaAsync(draftId, ct);
        if (meta is null ||
            !string.Equals(meta.Kind, KindMonsterSprite, StringComparison.Ordinal) ||
            !string.Equals(meta.EntityId, id, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var src = GetDraftFilePath(draftId, $"{index}.png");
        if (src is null)
        {
            return null;
        }

        var dir = Path.Combine(secrets.Value.DataPath, "assets", "monsters");
        Directory.CreateDirectory(dir);
        var dest = Path.Combine(dir, $"{id}.png");
        File.Copy(src, dest, overwrite: true);
        DiscardDraft(draftId);

        return new MonsterSpriteResult(
            $"/api/assets/monsters/{id}.png",
            meta.Source,
            meta.Reason,
            meta.Quality,
            meta.Model);
    }

    public string? GetMonsterSpriteFilePath(string fileName)
    {
        var safe = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(safe) ||
            !safe.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
            safe.Contains("..", StringComparison.Ordinal))
        {
            return null;
        }

        var path = Path.Combine(secrets.Value.DataPath, "assets", "monsters", safe);
        return File.Exists(path) ? path : null;
    }

    /// <summary>
    /// Animates an existing monster static sprite into an idle loop draft (east / right).
    /// Does not write final idle frames until <see cref="CommitMonsterIdleAsync"/>.
    /// Missing reference still returns a draft with reason <c>no_reference_sprite</c>.
    /// </summary>
    public async Task<PixelLabIdleDraftResult> GenerateMonsterIdleDraftAsync(
        string monsterId,
        string? name,
        string? description,
        string? quality,
        int? size,
        CancellationToken ct)
    {
        const double fps = 6;
        const string direction = "east";
        const string action = "idle breathing loop, subtle wing or body bob, standing ready";

        var id = SanitizeItemId(monsterId);
        var q = NormalizeQuality(quality);
        var outSize = NormalizeIdleSize(q, size);
        var model = IdleModelName(q);
        var monstersDir = Path.Combine(secrets.Value.DataPath, "assets", "monsters");
        Directory.CreateDirectory(monstersDir);
        var refPath = Path.Combine(monstersDir, $"{id}.png");
        var key = secrets.Value.PixellabApiKey;

        if (!File.Exists(refPath))
        {
            return await WriteIdleDraftAsync(
                id, [PlaceholderPng], outSize, fps, direction, "fallback", "no_reference_sprite", q, model, ct);
        }

        var refBytes = await File.ReadAllBytesAsync(refPath, ct);
        if (refBytes.Length < 24 || refBytes[0] != 0x89 || refBytes[1] != 0x50)
        {
            return await WriteIdleDraftAsync(
                id, [PlaceholderPng], outSize, fps, direction, "fallback", "invalid_reference_png", q, model, ct);
        }

        var (refW, refH) = ReadPngSize(refBytes);
        if (refW < 16 || refH < 16 || refW > 256 || refH > 256)
        {
            refW = 128;
            refH = 128;
        }

        if (string.IsNullOrWhiteSpace(key))
        {
            return await WriteIdleDraftAsync(
                id, [refBytes], outSize, fps, direction, "fallback", "no_api_key", q, model, ct);
        }

        var subject = string.IsNullOrWhiteSpace(name) ? id : name.Trim();
        var detail = string.IsNullOrWhiteSpace(description) ? subject : description.Trim();
        var charDescription = $"{subject}. {detail}";
        if (charDescription.Length > 500)
        {
            charDescription = charDescription[..500];
        }

        try
        {
            var client = httpFactory.CreateClient("pixellab");
            var b64 = Convert.ToBase64String(refBytes);
            var refImage = new { type = "base64", base64 = $"data:image/png;base64,{b64}", format = "png" };

            HttpRequestMessage req;
            if (q == "pro")
            {
                req = new HttpRequestMessage(HttpMethod.Post, "https://api.pixellab.ai/v2/animate-with-text-v2");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
                req.Content = new StringContent(JsonSerializer.Serialize(new
                {
                    reference_image = refImage,
                    reference_image_size = new { width = refW, height = refH },
                    action,
                    image_size = new { width = outSize, height = outSize },
                    no_background = true,
                    view = "side",
                    direction
                }), Encoding.UTF8, "application/json");
            }
            else
            {
                req = new HttpRequestMessage(HttpMethod.Post, "https://api.pixellab.ai/v2/animate-with-text");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
                req.Content = new StringContent(JsonSerializer.Serialize(new
                {
                    description = charDescription,
                    action,
                    reference_image = refImage,
                    image_size = new { width = outSize, height = outSize },
                    n_frames = 4,
                    view = "side",
                    direction
                }), Encoding.UTF8, "application/json");
            }

            using (req)
            {
                using var res = await client.SendAsync(req, ct);
                var raw = await res.Content.ReadAsStringAsync(ct);
                if (res.StatusCode != System.Net.HttpStatusCode.Accepted && !res.IsSuccessStatusCode)
                {
                    log.LogWarning("PixelLab idle anim HTTP {Status}: {Body}", (int)res.StatusCode, raw);
                    return await WriteIdleDraftAsync(
                        id, [refBytes], outSize, fps, direction, "fallback", $"http_{(int)res.StatusCode}", q, model, ct);
                }

                using var startDoc = JsonDocument.Parse(raw);
                if (!startDoc.RootElement.TryGetProperty("background_job_id", out var jobEl))
                {
                    var syncFrames = await TryExtractAllPngBytes(client, startDoc.RootElement, ct);
                    if (syncFrames.Count > 0)
                    {
                        return await WriteIdleDraftAsync(
                            id, syncFrames, outSize, fps, direction, "pixellab", null, q, model, ct);
                    }

                    return await WriteIdleDraftAsync(
                        id, [refBytes], outSize, fps, direction, "fallback", "no_job_id", q, model, ct);
                }

                var jobId = jobEl.GetString();
                if (string.IsNullOrWhiteSpace(jobId))
                {
                    return await WriteIdleDraftAsync(
                        id, [refBytes], outSize, fps, direction, "fallback", "empty_job_id", q, model, ct);
                }

                var frames = await PollJobForAllPngsAsync(client, key, jobId, ct);
                if (frames.Count == 0)
                {
                    return await WriteIdleDraftAsync(
                        id, [refBytes], outSize, fps, direction, "fallback", "job_failed_or_timeout", q, model, ct);
                }

                return await WriteIdleDraftAsync(
                    id, frames, outSize, fps, direction, "pixellab", null, q, model, ct);
            }
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "PixelLab monster idle draft failed");
            return await WriteIdleDraftAsync(
                id, [refBytes], outSize, fps, direction, "fallback", "exception", q, model, ct);
        }
    }

    public async Task<MonsterIdleAnimResult?> CommitMonsterIdleAsync(
        string monsterId,
        string draftId,
        CancellationToken ct)
    {
        var id = SanitizeItemId(monsterId);
        var meta = await ReadDraftMetaAsync(draftId, ct);
        if (meta is null ||
            !string.Equals(meta.Kind, KindMonsterIdle, StringComparison.Ordinal) ||
            !string.Equals(meta.EntityId, id, StringComparison.OrdinalIgnoreCase) ||
            meta.FrameCount < 1)
        {
            return null;
        }

        var draftDir = GetDraftDirectory(draftId);
        if (draftDir is null)
        {
            return null;
        }

        var dir = Path.Combine(secrets.Value.DataPath, "assets", "monsters");
        Directory.CreateDirectory(dir);

        var paths = new List<string>(meta.FrameCount);
        var firstBytes = (byte[]?)null;
        for (var i = 0; i < meta.FrameCount; i++)
        {
            var src = Path.Combine(draftDir, $"{i}.png");
            if (!File.Exists(src))
            {
                return null;
            }

            var file = $"{id}-idle-{i}.png";
            var dest = Path.Combine(dir, file);
            File.Copy(src, dest, overwrite: true);
            paths.Add($"/assets/monsters/{file}");
            firstBytes ??= await File.ReadAllBytesAsync(src, ct);
        }

        var size = meta.Size > 0 ? meta.Size : 64;
        var (fw, fh) = firstBytes is not null ? ReadPngSize(firstBytes) : (size, size);
        if (fw < 1) fw = size;
        if (fh < 1) fh = size;

        var fps = meta.Fps > 0 ? meta.Fps : 6;
        var direction = string.IsNullOrWhiteSpace(meta.Direction) ? "east" : meta.Direction;

        DiscardDraft(draftId);

        return new MonsterIdleAnimResult(
            paths,
            fw,
            fh,
            paths.Count,
            fps,
            direction,
            meta.Source,
            meta.Reason,
            meta.Quality,
            meta.Model);
    }

    public bool DiscardDraft(string draftId)
    {
        var dir = GetDraftDirectory(draftId);
        if (dir is null)
        {
            return false;
        }

        try
        {
            Directory.Delete(dir, recursive: true);
            return true;
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Failed to discard PixelLab draft {DraftId}", draftId);
            return false;
        }
    }

    public string? GetDraftFilePath(string draftId, string fileName)
    {
        var safeDraft = SanitizeDraftId(draftId);
        if (safeDraft is null)
        {
            return null;
        }

        var safe = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(safe) ||
            !safe.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
            safe.Contains("..", StringComparison.Ordinal))
        {
            return null;
        }

        var path = Path.Combine(secrets.Value.DataPath, "assets", "_drafts", safeDraft, safe);
        return File.Exists(path) ? path : null;
    }

    /// <summary>
    /// Shared static image generation: standard → pixflux (sync), pro → generate-image-v2 (async job).
    /// Returns all PNG variants via <see cref="TryExtractAllPngBytes"/>.
    /// </summary>
    private async Task<(IReadOnlyList<byte[]> Pngs, string Source, string? Reason)> GenerateStaticPngsAsync(
        string prompt,
        int width,
        int height,
        string quality,
        CancellationToken ct)
    {
        var key = secrets.Value.PixellabApiKey!;
        var client = httpFactory.CreateClient("pixellab");
        var description = prompt.Length > 2000 ? prompt[..2000] : prompt;
        var isPro = quality == "pro";
        var url = isPro
            ? "https://api.pixellab.ai/v2/generate-image-v2"
            : "https://api.pixellab.ai/v2/create-image-pixflux";

        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        req.Content = new StringContent(JsonSerializer.Serialize(new
        {
            description,
            image_size = new { width, height },
            no_background = true
        }), Encoding.UTF8, "application/json");

        using var res = await client.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (res.StatusCode != System.Net.HttpStatusCode.Accepted && !res.IsSuccessStatusCode)
        {
            log.LogWarning("PixelLab static HTTP {Status} ({Model}): {Body}",
                (int)res.StatusCode, StaticModelName(quality), raw);
            return ([], "fallback", $"http_{(int)res.StatusCode}");
        }

        using var startDoc = JsonDocument.Parse(raw);
        if (!startDoc.RootElement.TryGetProperty("background_job_id", out var jobEl))
        {
            var syncBytes = await TryExtractAllPngBytes(client, startDoc.RootElement, ct);
            if (syncBytes.Count > 0)
            {
                return (syncBytes, "pixellab", null);
            }

            return ([], "fallback", isPro ? "no_job_id" : "no_image_in_response");
        }

        var jobId = jobEl.GetString();
        if (string.IsNullOrWhiteSpace(jobId))
        {
            return ([], "fallback", "empty_job_id");
        }

        var pngs = await PollJobForAllPngsAsync(client, key, jobId, ct);
        return pngs.Count == 0
            ? ([], "fallback", "job_failed_or_timeout")
            : (pngs, "pixellab", null);
    }

    private async Task<PixelLabCandidatesResult> WriteCandidatesDraftAsync(
        string kind,
        string entityId,
        IReadOnlyList<byte[]> pngs,
        string source,
        string? reason,
        string quality,
        string model,
        int size,
        CancellationToken ct)
    {
        var draftId = Guid.NewGuid().ToString("N");
        var dir = Path.Combine(secrets.Value.DataPath, "assets", "_drafts", draftId);
        Directory.CreateDirectory(dir);

        var candidates = new List<PixelLabCandidate>(pngs.Count);
        for (var i = 0; i < pngs.Count; i++)
        {
            await File.WriteAllBytesAsync(Path.Combine(dir, $"{i}.png"), pngs[i], ct);
            candidates.Add(new PixelLabCandidate(i, $"/api/assets/drafts/{draftId}/{i}.png"));
        }

        var meta = new DraftMeta(
            kind,
            entityId,
            quality,
            model,
            size,
            source,
            reason,
            DateTimeOffset.UtcNow,
            candidates.Count,
            Fps: 0,
            Direction: null);
        await File.WriteAllTextAsync(
            Path.Combine(dir, "meta.json"),
            JsonSerializer.Serialize(meta, ContentService.SerializerOptions),
            ct);

        return new PixelLabCandidatesResult(draftId, candidates, source, reason, quality, model, size);
    }

    private async Task<PixelLabIdleDraftResult> WriteIdleDraftAsync(
        string entityId,
        IReadOnlyList<byte[]> frames,
        int size,
        double fps,
        string direction,
        string source,
        string? reason,
        string quality,
        string model,
        CancellationToken ct)
    {
        var draftId = Guid.NewGuid().ToString("N");
        var dir = Path.Combine(secrets.Value.DataPath, "assets", "_drafts", draftId);
        Directory.CreateDirectory(dir);

        var previewPaths = new List<string>(frames.Count);
        for (var i = 0; i < frames.Count; i++)
        {
            await File.WriteAllBytesAsync(Path.Combine(dir, $"{i}.png"), frames[i], ct);
            previewPaths.Add($"/api/assets/drafts/{draftId}/{i}.png");
        }

        var (fw, fh) = frames.Count > 0 ? ReadPngSize(frames[0]) : (size, size);
        if (fw < 1) fw = size;
        if (fh < 1) fh = size;

        var meta = new DraftMeta(
            KindMonsterIdle,
            entityId,
            quality,
            model,
            size,
            source,
            reason,
            DateTimeOffset.UtcNow,
            previewPaths.Count,
            fps,
            direction);
        await File.WriteAllTextAsync(
            Path.Combine(dir, "meta.json"),
            JsonSerializer.Serialize(meta, ContentService.SerializerOptions),
            ct);

        return new PixelLabIdleDraftResult(
            draftId,
            previewPaths,
            fw,
            fh,
            previewPaths.Count,
            fps,
            direction,
            source,
            reason,
            quality,
            model,
            size);
    }

    private async Task<DraftMeta?> ReadDraftMetaAsync(string draftId, CancellationToken ct)
    {
        var dir = GetDraftDirectory(draftId);
        if (dir is null)
        {
            return null;
        }

        var metaPath = Path.Combine(dir, "meta.json");
        if (!File.Exists(metaPath))
        {
            return null;
        }

        try
        {
            var text = await File.ReadAllTextAsync(metaPath, ct);
            return JsonSerializer.Deserialize<DraftMeta>(text, ContentService.SerializerOptions);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Invalid PixelLab draft meta for {DraftId}", draftId);
            return null;
        }
    }

    private string? GetDraftDirectory(string draftId)
    {
        var safe = SanitizeDraftId(draftId);
        if (safe is null)
        {
            return null;
        }

        var dir = Path.Combine(secrets.Value.DataPath, "assets", "_drafts", safe);
        return Directory.Exists(dir) ? dir : null;
    }

    private static string? SanitizeDraftId(string draftId)
    {
        if (string.IsNullOrWhiteSpace(draftId))
        {
            return null;
        }

        var trimmed = draftId.Trim();
        if (trimmed.Contains("..", StringComparison.Ordinal) ||
            trimmed.Contains('/') ||
            trimmed.Contains('\\') ||
            Path.GetFileName(trimmed) != trimmed)
        {
            return null;
        }

        return trimmed.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_')
            ? trimmed
            : null;
    }

    internal static string NormalizeQuality(string? quality) =>
        string.Equals(quality?.Trim(), "pro", StringComparison.OrdinalIgnoreCase) ? "pro" : "standard";

    internal static int NormalizeStaticSize(int? size) => size switch
    {
        64 => 64,
        256 => 256,
        _ => 128
    };

    /// <summary>
    /// Standard idle is always 64. Pro allows 64 or 128 (default 64).
    /// </summary>
    internal static int NormalizeIdleSize(string quality, int? size)
    {
        if (quality != "pro")
        {
            return 64;
        }

        return size == 128 ? 128 : 64;
    }

    private static string StaticModelName(string quality) =>
        quality == "pro" ? "generate-image-v2" : "create-image-pixflux";

    private static string IdleModelName(string quality) =>
        quality == "pro" ? "animate-with-text-v2" : "animate-with-text";

    private async Task<IReadOnlyList<byte[]>> PollJobForAllPngsAsync(
        HttpClient client,
        string key,
        string jobId,
        CancellationToken ct)
    {
        const int maxAttempts = 90;
        for (var i = 0; i < maxAttempts; i++)
        {
            await Task.Delay(TimeSpan.FromSeconds(2), ct);

            using var req = new HttpRequestMessage(
                HttpMethod.Get,
                $"https://api.pixellab.ai/v2/background-jobs/{Uri.EscapeDataString(jobId)}");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

            using var res = await client.SendAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                log.LogWarning("PixelLab idle job poll HTTP {Status}: {Body}", (int)res.StatusCode, raw);
                continue;
            }

            using var doc = JsonDocument.Parse(raw);
            var status = doc.RootElement.TryGetProperty("status", out var st)
                ? st.GetString()
                : null;

            if (string.Equals(status, "failed", StringComparison.OrdinalIgnoreCase))
            {
                log.LogWarning("PixelLab idle job failed: {Body}", raw);
                return [];
            }

            if (!string.Equals(status, "completed", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!doc.RootElement.TryGetProperty("last_response", out var last) ||
                last.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            {
                return [];
            }

            return await TryExtractAllPngBytes(client, last, ct);
        }

        return [];
    }

    private static async Task<IReadOnlyList<byte[]>> TryExtractAllPngBytes(
        HttpClient client,
        JsonElement root,
        CancellationToken ct)
    {
        // Prefer explicit images/frames arrays to avoid duplicate nested base64 hits.
        JsonElement source = root;
        if (root.ValueKind == JsonValueKind.Object)
        {
            if (root.TryGetProperty("images", out var images) && images.ValueKind == JsonValueKind.Array)
            {
                source = images;
            }
            else if (root.TryGetProperty("frames", out var frames) && frames.ValueKind == JsonValueKind.Array)
            {
                source = frames;
            }
        }

        var list = new List<byte[]>();
        var seen = new HashSet<int>();
        foreach (var candidate in EnumerateImageCandidates(source))
        {
            var bytes = await DecodeImagePayloadAsync(client, candidate, ct);
            if (bytes is not { Length: > 8 } || bytes[0] != 0x89 || bytes[1] != 0x50)
            {
                continue;
            }

            // Cheap dedupe: length + a few mid bytes.
            var fingerprint = HashCode.Combine(
                bytes.Length,
                bytes[16],
                bytes[20],
                bytes[bytes.Length / 2]);
            if (!seen.Add(fingerprint))
            {
                continue;
            }

            list.Add(bytes);
        }

        return list;
    }

    private static (int Width, int Height) ReadPngSize(byte[] png)
    {
        if (png.Length < 24)
        {
            return (128, 128);
        }

        var w = (png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19];
        var h = (png[20] << 24) | (png[21] << 16) | (png[22] << 8) | png[23];
        return (w, h);
    }

    private async Task<byte[]?> PollJobForPngAsync(
        HttpClient client,
        string key,
        string jobId,
        CancellationToken ct)
    {
        const int maxAttempts = 45;
        for (var i = 0; i < maxAttempts; i++)
        {
            await Task.Delay(TimeSpan.FromSeconds(2), ct);

            using var req = new HttpRequestMessage(
                HttpMethod.Get,
                $"https://api.pixellab.ai/v2/background-jobs/{Uri.EscapeDataString(jobId)}");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

            using var res = await client.SendAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                log.LogWarning("PixelLab job poll HTTP {Status}: {Body}", (int)res.StatusCode, raw);
                continue;
            }

            using var doc = JsonDocument.Parse(raw);
            var status = doc.RootElement.TryGetProperty("status", out var st)
                ? st.GetString()
                : null;

            if (string.Equals(status, "failed", StringComparison.OrdinalIgnoreCase))
            {
                log.LogWarning("PixelLab job failed: {Body}", raw);
                return null;
            }

            if (!string.Equals(status, "completed", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!doc.RootElement.TryGetProperty("last_response", out var last) ||
                last.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            {
                return null;
            }

            return await TryExtractPngBytes(client, last, ct);
        }

        return null;
    }

    private static async Task<byte[]?> TryExtractPngBytes(HttpClient client, JsonElement root, CancellationToken ct)
    {
        foreach (var candidate in EnumerateImageCandidates(root))
        {
            var bytes = await DecodeImagePayloadAsync(client, candidate, ct);
            if (bytes is { Length: > 8 } && bytes[0] == 0x89 && bytes[1] == 0x50)
            {
                return bytes;
            }
        }

        return null;
    }

    private static IEnumerable<string> EnumerateImageCandidates(JsonElement el)
    {
        switch (el.ValueKind)
        {
            case JsonValueKind.String:
                var s = el.GetString();
                if (!string.IsNullOrWhiteSpace(s))
                {
                    yield return s;
                }

                yield break;
            case JsonValueKind.Object:
                foreach (var prop in el.EnumerateObject())
                {
                    var name = prop.Name;
                    if (name.Contains("base64", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("image", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("data", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("url", StringComparison.OrdinalIgnoreCase) ||
                        name.Contains("image", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("images", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("frames", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("results", StringComparison.OrdinalIgnoreCase))
                    {
                        foreach (var c in EnumerateImageCandidates(prop.Value))
                        {
                            yield return c;
                        }
                    }
                }

                yield break;
            case JsonValueKind.Array:
                foreach (var item in el.EnumerateArray())
                {
                    foreach (var c in EnumerateImageCandidates(item))
                    {
                        yield return c;
                    }
                }

                yield break;
        }
    }

    private static async Task<byte[]?> DecodeImagePayloadAsync(HttpClient client, string value, CancellationToken ct)
    {
        var s = value.Trim();
        if (s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                return await client.GetByteArrayAsync(s, ct);
            }
            catch
            {
                return null;
            }
        }

        var comma = s.IndexOf(',');
        if (s.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && comma >= 0)
        {
            s = s[(comma + 1)..];
        }

        try
        {
            return Convert.FromBase64String(s);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Minimal 1×1 transparent PNG.</summary>
    private static readonly byte[] PlaceholderPng =
    [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
    ];

    private static string SanitizeItemId(string s)
    {
        var chars = s.ToLowerInvariant().Where(c => char.IsAsciiLetterOrDigit(c) || c == '-').Take(64).ToArray();
        return chars.Length == 0 ? "item" : new string(chars);
    }

    private static string TypePromptHint(string type) => type switch
    {
        "weapon" => "Depict a handheld weapon (sword, dagger, axe, bow, or staff).",
        "helmet" => "Depict a wearable helmet or head armor only.",
        "armor" => "Depict a chest plate, vest, or torso armor piece.",
        "ring" => "Depict a finger ring, small jewelry, top-down or angled.",
        "amulet" => "Depict a pendant or amulet on a cord/chain.",
        "focus" => "Depict a magical focus (orb, wand tip, crystal, totem).",
        "shield" => "Depict a defensive shield, front-facing.",
        "material" => "Depict a crafting material, scrap, ore, or reagent pile.",
        _ => "Depict a single recognizable inventory object."
    };

    private static async Task<object> WriteFallbackAtlasAsync(
        string atlasPath,
        string description,
        string action,
        string reason,
        CancellationToken ct)
    {
        var atlas = new
        {
            id = Sanitize(description) + "-" + Sanitize(action),
            description,
            action,
            frameSize = 64,
            frames = 4,
            source = "fallback",
            reason,
            convention = "CSS placeholder sprites (CombatDock) until PixelLab succeeds",
            framesMeta = new[]
            {
                new { index = 0, label = "idle" },
                new { index = 1, label = "windup" },
                new { index = 2, label = "strike" },
                new { index = 3, label = "recover" }
            }
        };
        await File.WriteAllTextAsync(atlasPath, JsonSerializer.Serialize(atlas, ContentService.SerializerOptions), ct);
        return atlas;
    }

    private static string Sanitize(string s)
    {
        var chars = s.ToLowerInvariant().Where(c => char.IsAsciiLetterOrDigit(c) || c == '-').Take(40).ToArray();
        return chars.Length == 0 ? "asset" : new string(chars);
    }

    private sealed record DraftMeta(
        string Kind,
        string EntityId,
        string Quality,
        string? Model,
        int Size,
        string Source,
        string? Reason,
        DateTimeOffset CreatedAt,
        int FrameCount,
        double Fps,
        string? Direction);
}
