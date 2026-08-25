# 57 — Monstro: métricas de combate no backend (regen + contrato)

STATUS: concluido
CONCLUIDO_EM: 2026-08-11

## Objetivo

Monstro com `baseStats.hpRegenPerSec` regenera em combate como o player; métricas já lidas por `CombatHitResolver.FromMonster` (`attackSpeed`, crit/dodge, `bonusDamage`/`bonusDefense`) ficam documentadas e cobertas por testes.

## Pré-requisitos

- Todo 44 (combate data-driven / `CombatFighterProfile`)
- Timeline `atMs` (`docs/migracao-combat-timeline.md`)

## Escopo

1. `EnemyFighter` / loops room + challenge: ler `hpRegenPerSec` do monstro (`baseStats` ou root); default 0 = sem regen.
2. Ticks de regen por inimigo vivo (reusar `ApplyCombatRegenTick` / eventos `regen` com `actor: enemy` + `slot`).
3. Front mínimo: aplicar `regen` de inimigo nas barras HP (senão o evento não aparece).
4. Testes: AS, crit/dodge/`bonusDamage` vs `bonusDefense`, regen monstro; ausência = sem efeito.
5. Atualizar `schemas.md` + `docs/balance.md`.

## Fora de escopo

- Magias / skills mid-fight
- Editor (todo 58) e preenchimento de conteúdo (todo 59)

## Critérios de aceite

- [x] Monstro com `hpRegenPerSec` > 0 emite `regen` em combate
- [x] Ausência de campos = comportamento atual
- [x] Testes unitários cobrem métricas + regen
- [x] Schema/balance documentam o contrato
