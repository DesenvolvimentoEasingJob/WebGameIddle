using SkySpire.Api.DTOs;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public static class TowerCombatSimulator
{
    public static TowerCombatResultDto Simulate(
        CombatStats player,
        TowerMobDefinition enemy,
        bool isBoss)
    {
        var turns = new List<TowerCombatTurnDto>();
        var playerHp = player.Hp;
        var enemyHp = enemy.Hp;
        var playerTurn = true;
        var playerAttackCount = 0;
        var enemyAttackCount = 0;

        while (playerHp > 0 && enemyHp > 0)
        {
            if (playerTurn)
            {
                var critical = playerAttackCount > 0 && playerAttackCount % 4 == 0;
                var kind = critical ? "critical" : "attack";
                var damage = CalcDamage(player.Attack, enemy.Defense, critical);
                enemyHp = Math.Max(0, enemyHp - damage);
                turns.Add(new TowerCombatTurnDto(
                    "player",
                    kind,
                    damage,
                    playerHp,
                    enemyHp));
                playerAttackCount++;
            }
            else
            {
                var critical = enemyAttackCount > 0 && enemyAttackCount % 5 == 0;
                var kind = critical ? "critical" : "attack";
                var damage = CalcDamage(enemy.Attack, player.Defense, critical);
                playerHp = Math.Max(0, playerHp - damage);
                turns.Add(new TowerCombatTurnDto(
                    "enemy",
                    kind,
                    damage,
                    playerHp,
                    enemyHp));
                enemyAttackCount++;
            }

            if (playerHp <= 0 || enemyHp <= 0)
                break;

            playerTurn = !playerTurn;
        }

        var playerWon = enemyHp <= 0 && playerHp > 0;
        TowerCombatRewardsDto? rewards = null;
        if (playerWon)
        {
            rewards = new TowerCombatRewardsDto(enemy.Xp, enemy.Gold);
        }

        return new TowerCombatResultDto(
            playerWon ? "player_win" : "player_defeat",
            enemy.Id,
            enemy.Name,
            isBoss,
            player.Hp,
            enemy.Hp,
            turns,
            rewards);
    }

    private static int CalcDamage(int attack, int defense, bool critical)
    {
        var baseDamage = Math.Max(1, attack - defense / 2);
        return critical ? baseDamage * 2 : baseDamage;
    }
}
