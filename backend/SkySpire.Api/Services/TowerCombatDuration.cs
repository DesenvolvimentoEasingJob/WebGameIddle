using SkySpire.Api.DTOs;

namespace SkySpire.Api.Services;

public static class TowerCombatDuration
{
    public const int AttackSwingMs = 520;
    public const int CriticalSwingMs = 650;
    public const int TurnGapMs = 320;

    public static int EstimateMs(IReadOnlyList<TowerCombatTurnDto> turns)
    {
        var total = 0;
        foreach (var turn in turns)
        {
            total += turn.Kind == "critical" ? CriticalSwingMs : AttackSwingMs;
            total += TurnGapMs;
        }

        return total;
    }

    public static int EstimateMs(TowerCombatResultDto combat) =>
        EstimateMs(combat.Turns);

    public static int EstimateMs(IEnumerable<TowerCombatResultDto> combats) =>
        combats.Sum(EstimateMs);
}
