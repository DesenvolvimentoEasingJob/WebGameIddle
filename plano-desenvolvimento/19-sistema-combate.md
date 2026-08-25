# 19 — Sistema de combate (server-side)

STATUS: concluido
CONCLUIDO_EM: 2026-08-05
SUPERSEDED_BY: docs/migracao-combat-timeline.md

## Objetivo

Combate baseado em eventos: servidor resolve a luta e devolve a timeline; jogador não escolhe ações.

## Pré-requisitos

- Todos 15, 17 e 18 concluídos

## Passos

1. `POST /api/tower/battle/start` (sala atual).
2. Simular turnos com stats, skills, resistências/fraquezas.
3. Resposta: lista ordenada de eventos (`hit`, `crit`, `spell`, `dodge`, `death`, `victory`…) com números de dano/cura.
4. Em vitória: liberar próxima sala, aplicar drops/XP (XP detalhado no 21; stub ok).
5. Em derrota em sala normal: sem penalidade de XP (só chefe desafiado pune — todo 25).
6. Jogador **não** usa itens/consumíveis no combate.

## Critérios de aceite

- [x] Resultado determinado só no servidor
- [x] Front recebe eventos suficientes para animar depois
- [x] Não há endpoint que aceite “eu causei 9999 de dano”
- [x] Teste unitário: player forte vs mob fraco → vitória previsível

## Notas

Game-base §1 e §13 — autoridade total no backend.

