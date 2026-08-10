# 29 — Rankings e estatísticas

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Tabelas/consultas para último andar, progresso e rankings públicos.

## Pré-requisitos

- Todos 17 e 21 concluídos

## Passos

1. Tabela `character_stats`: last_floor, last_room, level, kills, floors_owned, etc.
2. Atualizar em eventos (vitória, level up, ownership).
3. `GET /api/rankings?by=floor|level|wealth`
4. UI `/hub/rankings` simples.

## Critérios de aceite

- [x] Ranking reflete progresso real
- [x] Não expõe paths de JSON internos
- [x] Preparado para leaderboards futuros

## Notas

Game-base §11.
