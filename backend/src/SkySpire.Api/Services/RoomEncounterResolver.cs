using System.Text.Json;

namespace SkySpire.Api.Services;

/// <summary>
/// Preview do encontro da sala atual — mesmos IDs/contagens que o combate usa.
/// </summary>
public static class RoomEncounterResolver
{
    public const int MaxEnemiesPerRoom = 4;

    /// <summary>
    /// Lista de spawn da sala: cada entrada em <c>rooms[].monsterIds</c> é um inimigo
    /// (quantidade = length; tipos podem repetir ou misturar). Chefe = 1 slot.
    /// </summary>
    public static IReadOnlyList<string> ResolveMonsterIds(JsonElement floor, int room)
    {
        var pool = new List<string>();

        if (room >= 10)
        {
            if (floor.TryGetProperty("boss", out var boss) &&
                boss.TryGetProperty("monsterId", out var bossId) &&
                !string.IsNullOrEmpty(bossId.GetString()))
            {
                pool.Add(bossId.GetString()!);
            }
        }
        else if (floor.TryGetProperty("rooms", out var rooms) && rooms.ValueKind == JsonValueKind.Array)
        {
            foreach (var r in rooms.EnumerateArray())
            {
                if (r.TryGetProperty("number", out var num) && num.GetInt32() == room &&
                    r.TryGetProperty("monsterIds", out var ids) &&
                    ids.ValueKind == JsonValueKind.Array)
                {
                    foreach (var id in ids.EnumerateArray())
                    {
                        var s = id.GetString();
                        if (!string.IsNullOrEmpty(s))
                        {
                            pool.Add(s);
                            if (pool.Count >= MaxEnemiesPerRoom)
                            {
                                break;
                            }
                        }
                    }

                    break;
                }
            }
        }

        if (pool.Count == 0)
        {
            pool.Add("slime");
        }

        return pool;
    }

    /// <summary>Compat: ignora <paramref name="count"/> e usa o tamanho da lista no JSON.</summary>
    public static IReadOnlyList<string> ResolveMonsterIds(JsonElement floor, int room, int count) =>
        ResolveMonsterIds(floor, room);

    public static string ResolveRoomType(JsonElement floor, int room)
    {
        if (room >= 10)
        {
            return "boss";
        }

        if (floor.TryGetProperty("rooms", out var rooms) && rooms.ValueKind == JsonValueKind.Array)
        {
            foreach (var r in rooms.EnumerateArray())
            {
                if (r.TryGetProperty("number", out var num) &&
                    num.GetInt32() == room &&
                    r.TryGetProperty("type", out var typeEl))
                {
                    var t = typeEl.GetString();
                    if (!string.IsNullOrEmpty(t))
                    {
                        return t;
                    }
                }
            }
        }

        return "wave";
    }

    public static async Task<RoomEncounterDto?> BuildAsync(
        ContentService content,
        JsonElement floor,
        int room,
        CancellationToken ct)
    {
        if (room < 1)
        {
            return null;
        }

        var difficultyScale = 1.0;
        if (floor.TryGetProperty("difficulty", out var diff) && diff.ValueKind == JsonValueKind.Number)
        {
            difficultyScale = Math.Sqrt(Math.Max(1, diff.GetDouble()));
        }

        var monsterIds = ResolveMonsterIds(floor, room);
        var monsters = new List<EncounterMonsterDto>(monsterIds.Count);

        for (var i = 0; i < monsterIds.Count; i++)
        {
            var monsterId = monsterIds[i];
            var monster = await content.GetByIdAsync("monsters", monsterId, ct);
            if (monster is null)
            {
                continue;
            }

            var m = monster.Value;
            var name = m.TryGetProperty("name", out var nEl) ? nEl.GetString() ?? monsterId : monsterId;
            var description = m.TryGetProperty("description", out var descEl) && descEl.ValueKind == JsonValueKind.String
                ? descEl.GetString()
                : null;
            if (string.IsNullOrWhiteSpace(description))
            {
                description = null;
            }

            var level = m.TryGetProperty("level", out var lvlEl) && lvlEl.ValueKind == JsonValueKind.Number
                ? lvlEl.GetInt32()
                : 1;
            var hp = HpService.RoundHp(ReadMonsterHp(m) * difficultyScale);
            var profile = CombatHitResolver.FromMonster(m, difficultyScale);
            var sprite = ReadSprite(m);
            var (displayWidth, displayHeight) = ReadDisplaySize(m);
            int? skyMin = null;
            int? skyMax = null;
            if (MonsterDropHelper.TryReadSkyCoinDrop(m, out var dropMin, out var dropMax))
            {
                skyMin = dropMin;
                skyMax = dropMax;
            }

            var rarityLuck = MonsterDropHelper.ReadRarityLuck(m);
            var idle = ReadIdleAnimation(m);

            monsters.Add(new EncounterMonsterDto(
                monsterId,
                name,
                description,
                level,
                hp,
                (int)Math.Round(profile.DmgBase),
                (int)Math.Round(profile.DefBase),
                sprite,
                displayWidth,
                displayHeight,
                skyMin,
                skyMax,
                rarityLuck,
                idle));
        }

        if (monsters.Count == 0)
        {
            return null;
        }

        return new RoomEncounterDto(room, ResolveRoomType(floor, room), monsters);
    }

    private static double ReadMonsterHp(JsonElement monster)
    {
        if (monster.TryGetProperty("hp", out var hpEl) && hpEl.ValueKind == JsonValueKind.Number)
        {
            return hpEl.GetDouble();
        }

        if (monster.TryGetProperty("baseStats", out var bs) &&
            bs.ValueKind == JsonValueKind.Object &&
            bs.TryGetProperty("hpBase", out var nested) &&
            nested.ValueKind == JsonValueKind.Number)
        {
            return nested.GetDouble();
        }

        return 30;
    }

    private const int DefaultDisplayWidth = 56;
    private const int DefaultDisplayHeight = 56;

    private static string? ReadSprite(JsonElement monster)
    {
        if (!monster.TryGetProperty("assets", out var assets) || assets.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (assets.TryGetProperty("sprite", out var sprite) && sprite.ValueKind == JsonValueKind.String)
        {
            var path = sprite.GetString();
            return string.IsNullOrWhiteSpace(path) ? null : path;
        }

        return null;
    }

    /// <summary>
    /// Presentation size in the combat footer (<c>assets.width</c> / <c>assets.height</c>).
    /// </summary>
    private static (int Width, int Height) ReadDisplaySize(JsonElement monster)
    {
        if (!monster.TryGetProperty("assets", out var assets) || assets.ValueKind != JsonValueKind.Object)
        {
            return (DefaultDisplayWidth, DefaultDisplayHeight);
        }

        var width = assets.TryGetProperty("width", out var wEl) && wEl.TryGetInt32(out var w) && w > 0
            ? w
            : DefaultDisplayWidth;
        var height = assets.TryGetProperty("height", out var hEl) && hEl.TryGetInt32(out var h) && h > 0
            ? h
            : DefaultDisplayHeight;
        return (width, height);
    }

    private static MonsterIdleAnimationDto? ReadIdleAnimation(JsonElement monster)
    {
        if (!monster.TryGetProperty("assets", out var assets) || assets.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!assets.TryGetProperty("animations", out var animations) ||
            animations.ValueKind != JsonValueKind.Object ||
            !animations.TryGetProperty("idle", out var idle) ||
            idle.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var frames = new List<string>();
        if (idle.TryGetProperty("frames", out var framesEl) && framesEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var f in framesEl.EnumerateArray())
            {
                if (f.ValueKind == JsonValueKind.String)
                {
                    var path = f.GetString();
                    if (!string.IsNullOrWhiteSpace(path))
                    {
                        frames.Add(path);
                    }
                }
            }
        }

        // Legacy single sheet path → treat as one frame.
        if (frames.Count == 0 &&
            idle.TryGetProperty("sheet", out var sheet) &&
            sheet.ValueKind == JsonValueKind.String)
        {
            var path = sheet.GetString();
            if (!string.IsNullOrWhiteSpace(path))
            {
                frames.Add(path);
            }
        }

        if (frames.Count == 0)
        {
            return null;
        }

        var frameWidth = idle.TryGetProperty("frameWidth", out var fw) && fw.TryGetInt32(out var fwi) ? fwi : 64;
        var frameHeight = idle.TryGetProperty("frameHeight", out var fh) && fh.TryGetInt32(out var fhi) ? fhi : 64;
        var frameCount = idle.TryGetProperty("frameCount", out var fc) && fc.TryGetInt32(out var fci)
            ? fci
            : frames.Count;
        var fps = idle.TryGetProperty("fps", out var fpsEl) && fpsEl.TryGetDouble(out var fpsv) ? fpsv : 6;
        var direction = idle.TryGetProperty("direction", out var dirEl) && dirEl.ValueKind == JsonValueKind.String
            ? dirEl.GetString() ?? "east"
            : "east";

        return new MonsterIdleAnimationDto(frames, frameWidth, frameHeight, frameCount, fps, direction);
    }
}

public sealed record MonsterIdleAnimationDto(
    IReadOnlyList<string> Frames,
    int FrameWidth,
    int FrameHeight,
    int FrameCount,
    double Fps,
    string Direction);

public sealed record EncounterMonsterDto(
    string Id,
    string Name,
    string? Description,
    int Level,
    int Hp,
    int DmgBase,
    int DefBase,
    string? Sprite,
    int Width,
    int Height,
    int? SkyCoinDropMin = null,
    int? SkyCoinDropMax = null,
    double RarityLuck = 0,
    MonsterIdleAnimationDto? IdleAnimation = null);

public sealed record RoomEncounterDto(
    int Room,
    string Type,
    IReadOnlyList<EncounterMonsterDto> Monsters);
