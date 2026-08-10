# 22 — Monstros e drops

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Monstros ricos em JSON + tabela de drops com probabilidades; combate usa esses dados.

## Pré-requisitos

- Todos 16 e 19 concluídos

## Passos

1. Completar `content/monsters/` com props: espécie, nível, HP, atk, def, resistências, fraquezas, skills, comportamento, aparência, loot table.
2. `content/items/` stubs para drops comuns.
3. Serviço de loot no fim da batalha; itens vão para a bag (respeitar CAP/slots).
4. API/conteúdo para o front exibir loot na timeline.

## Critérios de aceite

- [x] Drop respeita probabilidades (teste com seed fixa ajuda)
- [x] Bag atualiza no servidor
- [x] Monstro sem resistência a fogo sofre bônus conforme Game-base

## Notas

Itens “lendários narrativos” via OpenAI = todo 33 opcional.

