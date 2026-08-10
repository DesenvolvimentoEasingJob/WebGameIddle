# 42 — Grupos de monstros nas salas 3/6/9 + UI multi-inimigo

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Salas **3 / 6 / 9** enfrentam 2 / 3 / 4 monstros; demais salas 1–9 são 1v1. Cada monstro ataca no próprio turno. Footer: até 4 sprites menores + até 4 barras de HP à direita.

## O que foi entregue

- `CombatService.EnemyCountForRoom` — só 3→2, 6→3, 9→4
- `ResolveMonsterIds` — cicla `monsterIds` da sala até a contagem
- Combate multi-alvo: player ataca o **primeiro vivo**; cada inimigo vivo gera `hit` com `slot`
- XP/loot somados por monstro; chefe/desafios continuam 1v1
- `BattleEventDto.Slot` + front `enemies[]` / `flashSlot`
- CombatDock: sprites menores em grupo + N barras à direita
- Docs em `docs/balance.md`; testes de contagem e ciclo de ids

## Critérios de aceite

- [x] Só salas 3/6/9 têm grupo (2/3/4); demais 1v1
- [x] Cada monstro vivo gera hit próprio
- [x] Footer: N sprites + N barras (máx. 4)
- [x] Chefe/desafios 1v1
- [x] Front só reproduz eventos
- [x] `dotnet test` verde (33 testes)
