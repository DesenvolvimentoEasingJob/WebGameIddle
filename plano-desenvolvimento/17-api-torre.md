# 17 — API da torre

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Endpoints para entrar no andar, ver salas, avançar progresso e estado atual do jogador na torre.

## Pré-requisitos

- Todos 14 e 16 concluídos

## Passos

1. Modelar progresso: andar atual, sala atual (1–10), salas liberadas, auto-climb on/off.
2. Endpoints sugeridos:
   - `GET /api/tower/floors`
   - `GET /api/tower/floors/{n}`
   - `POST /api/tower/enter` `{ floor }`
   - `GET /api/tower/state`
   - `POST /api/tower/auto-climb` `{ enabled }`
   - `POST /api/tower/move` `{ room }` (só salas já liberadas)
3. Persistência do progresso (DB e/ou no JSON do personagem + tabela stats).

## Critérios de aceite

- [x] Entrar no andar 1 funciona
- [x] Não pula sala não liberada
- [x] Estado sobrevive a restart da API

## Notas

Combate em si é o todo 19; aqui só navegação/estado.

