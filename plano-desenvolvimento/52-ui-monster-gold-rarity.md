# 52 — UI + editor: gold e rarityLuck do monstro

STATUS: concluido
CONCLUIDO_EM: 2026-08-11

## Objetivo

Mostrar no painel do monstro enfrentado (informativo) o gold range e o luck de raridade; permitir editar esses campos no `fronend-editor`.

## Pré-requisitos

- Todo 50 (DTO no `roomEncounter`)
- Todo 51 desejável (valores reais); UI pode mostrar `—` se ausente

## Front do jogo

Em `MonsterEncounterPanel` (monstro em foco), além de HP / Dano / Defesa:

| Label | Fonte |
|-------|--------|
| Gold | `skyCoinDropMin`–`skyCoinDropMax` (ex.: `2–5 SC`) |
| Raridade | `rarityLuck` (ex.: `Luck 2.5` ou “normal” se 0) |

Sem vivo/morto; sem multiplicar cards. Só o alvo atual.

Tipagem: estender `EncounterMonster` em `frontend/src/types/api.ts`.

## Editor (`fronend-editor`)

1. Campos no form de monstro: `skyCoinDrop` (min/max) e `rarityLuck` (number).
2. Validação: min ≤ max, ≥ 0; luck ≥ 0.
3. Schema/help text apontando para o todo 50.

## Critérios de aceite

- [x] Painel do alvo mostra gold range + luck quando vierem no encounter
- [x] Editor grava/lê os campos no JSON
- [x] Ausência de campos não quebra a UI

## Notas

Não precisa gráfico de curva de raridade no MVP — um número de luck basta para o autor e para o jogador entender “este mob dropa melhor”.
