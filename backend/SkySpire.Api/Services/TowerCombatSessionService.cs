using System.Text.Json.Nodes;
using SkySpire.Api.DTOs;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public static class TowerCombatSessionService
{
    public static string? ValidateNotLocked(JsonObject tower)
    {
        var session = tower["combatSession"]?.AsObject();
        if (session is null)
            return null;

        if (!TryReadEndsAt(session, out var endsAt))
        {
            tower.Remove("combatSession");
            return null;
        }

        var remainingMs = (int)Math.Ceiling((endsAt - DateTime.UtcNow).TotalMilliseconds);
        if (remainingMs <= 0)
        {
            tower.Remove("combatSession");
            return null;
        }

        var seconds = Math.Max(1, (int)Math.Ceiling(remainingMs / 1000.0));
        var enemyName = session["enemyName"]?.GetValue<string>();
        var floor = session["floor"]?.GetValue<int>();
        var floorHint = floor is > 0 ? $" (andar {floor})" : "";
        return string.IsNullOrWhiteSpace(enemyName)
            ? $"Combate em andamento. Aguarde {seconds}s."
            : $"Combate contra {enemyName}{floorHint} em andamento. Aguarde {seconds}s.";
    }

    public static void ClearExpired(JsonObject tower) => ValidateNotLocked(tower);

    public static void ClearSession(JsonObject tower) => tower.Remove("combatSession");

    public static TowerCombatSessionDto BeginSession(
        JsonObject tower,
        string mode,
        int fightsResolved,
        int durationMs,
        MobDefinition enemy,
        bool isBoss,
        int floor,
        int mobIndex,
        int enemyMaxHp)
    {
        var now = DateTime.UtcNow;
        var endsAt = now.AddMilliseconds(durationMs);
        var sessionId = Guid.NewGuid().ToString();

        tower["combatSession"] = new JsonObject
        {
            ["sessionId"] = sessionId,
            ["startedAt"] = now.ToString("O"),
            ["endsAt"] = endsAt.ToString("O"),
            ["durationMs"] = durationMs,
            ["mode"] = mode,
            ["fightsResolved"] = fightsResolved,
            ["floor"] = floor,
            ["mobIndex"] = mobIndex,
            ["enemyId"] = enemy.Id,
            ["enemyName"] = enemy.Name,
            ["isBoss"] = isBoss,
            ["enemyMaxHp"] = enemyMaxHp,
        };

        return ToDto(tower["combatSession"]!.AsObject());
    }

    public static TowerCombatSessionDto? ReadActive(JsonObject tower)
    {
        var session = tower["combatSession"]?.AsObject();
        if (session is null)
            return null;

        if (!TryReadEndsAt(session, out var endsAt))
        {
            tower.Remove("combatSession");
            return null;
        }

        var remainingMs = (int)Math.Ceiling((endsAt - DateTime.UtcNow).TotalMilliseconds);
        if (remainingMs <= 0)
        {
            tower.Remove("combatSession");
            return null;
        }

        return ToDto(session, remainingMs);
    }

    private static TowerCombatSessionDto ToDto(JsonObject session, int? remainingMs = null)
    {
        var durationMs = session["durationMs"]?.GetValue<int>() ?? 0;
        var resolvedRemaining = remainingMs ?? durationMs;

        return new TowerCombatSessionDto(
            session["sessionId"]?.GetValue<string>() ?? "",
            session["startedAt"]?.GetValue<string>() ?? "",
            session["endsAt"]?.GetValue<string>() ?? "",
            durationMs,
            Math.Max(0, resolvedRemaining),
            session["mode"]?.GetValue<string>() ?? "single",
            session["fightsResolved"]?.GetValue<int>() ?? 1,
            session["floor"]?.GetValue<int>() ?? 1,
            session["mobIndex"]?.GetValue<int>() ?? 0,
            session["enemyId"]?.GetValue<string>() ?? "",
            session["enemyName"]?.GetValue<string>() ?? "",
            session["isBoss"]?.GetValue<bool>() ?? false,
            session["enemyMaxHp"]?.GetValue<int>() ?? 0);
    }

    private static bool TryReadEndsAt(JsonObject session, out DateTime endsAt)
    {
        endsAt = default;
        var endsAtRaw = session["endsAt"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(endsAtRaw))
            return false;

        return DateTime.TryParse(
            endsAtRaw,
            null,
            System.Globalization.DateTimeStyles.RoundtripKind,
            out endsAt);
    }
}
