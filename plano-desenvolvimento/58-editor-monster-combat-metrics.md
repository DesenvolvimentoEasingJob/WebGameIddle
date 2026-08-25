# 58 — Editor: bonusDamage + métricas de combate do monstro

STATUS: concluido
CONCLUIDO_EM: 2026-08-11

## Objetivo

Autorar no `fronend-editor` tudo que o `CombatHitResolver` consome no monstro: `bonusDamage` + hints de `baseStats` (`attackSpeed`, crit, dodge, `hpRegenPerSec`).

## Pré-requisitos

- Todo 57 (contrato backend)
- Todo 38 (editor de monstros)

## Escopo

1. `monsterModel.ts`: `bonusDamage` como `{ key: { dmgBase, counter } }`; parse/serialize/validação; `hpRegenPerSec` em `BASE_STAT_SUGGESTIONS`.
2. `MonsterFormEditor.tsx`: seção `bonusDamage` (espelhar `bonusDefense`); hints curtos.
3. `templates.ts`: `bonusDamage: {}`.

## Fora de escopo

- Editor de spells/skills
- Preenchimento em massa dos JSONs (todo 59)

## Critérios de aceite

- [x] Round-trip JSON com `bonusDamage`
- [x] Validação impede chave vazia / `dmgBase` inválido
- [x] Sem editor de magias
