# 44 — Combate data-driven (sem hardcode de ação)

STATUS: concluido
CONCLUIDO_EM: 2026-08-06

## Objetivo

Remover do `CombatService` chances, multiplicadores e fórmulas inventadas.
**Regra de ouro:** propriedade ausente = efeito inexistente. Crit só no **dano base**.

## O que foi entregue

- `CombatHitResolver` + `CombatFighterProfile`: dmg/defBase, crit, dodge, bonusDamage/bonusDefense
- Crit: só com `critChance` + `critDamage`; multiplica **apenas** o base
- Dodge: só com `dodgeChance` no defensor
- Bônus: `counter` → `bonusDefense`; sem counter = dano elemental integral (ignora defBase)
- `COMBAT_DAMAGE_NOISE` no env (default 0)
- Monstros MVP migrados para `baseStats` + `bonusDefense` (legado attack/defense ainda lido)
- Raças: `defBase` semeado; ember-imp com `fireResistance: 10`
- Docs: `balance.md`, skill `schemas.md`
- Testes do resolver (crit/def/bonus/dodge/legado)

## Critérios de aceite

- [x] Nenhum crit/dodge/def fantasma no CombatService
- [x] Ausência de propriedade = sem efeito
- [x] bonusDamage + bonusDefense + counter
- [x] Ruído só via COMBAT_DAMAGE_NOISE
- [x] Loops sala e desafio usam o mesmo resolver
- [x] Monstros migrados + legado mapeado
- [x] Docs atualizados
- [x] `dotnet test` verde (44 testes)
