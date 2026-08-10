# 16 — Andares JSON manuais (10)

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Criar os 10 primeiros andares manuais com salas, monstros refs, chefe e metadados.

## Pré-requisitos

- Todo 09 (estrutura content)

## Passos

1. Pasta `content/floors/` com `floor-01.json` … `floor-10.json`.
2. Cada andar: nome, descrição, tema visual, dificuldade, nível de itens, 9 levas + chefe, eventos/recursos/recompensas (mesmo que simples), regras especiais.
3. Dificuldade: documentar relação com `FLOOR_DIFFICULTY_MULT` / recompensas `FLOOR_REWARD_MULT`.
4. Campos para ownership futuro: `ownerPlayerId`, `ownerSnapshotPath`, `challengeFee`.

## Critérios de aceite

- [x] 10 arquivos válidos
- [x] Schema uniforme
- [x] Referências a monstros existem (criar stubs de monstros se preciso)

## Notas

Geração IA de andares novos = fora do MVP (Game-base §9).

