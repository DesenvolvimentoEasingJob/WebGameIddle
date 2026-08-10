# 23 — Inventário e equipamentos (API)

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Regras de bag (40+ bônus) e slots dinâmicos por raça; equipar/desequipar no servidor.

## Pré-requisitos

- Todos 13 e 22 concluídos

## Passos

1. Endpoints:
   - `GET /api/inventory`
   - `POST /api/inventory/equip`
   - `POST /api/inventory/unequip`
   - `POST /api/inventory/move` (opcional)
2. Validar `itemType` vs slot (`itemType` array + `boxSize`).
3. Recalcular stats ao equipar (motor do todo 15).
4. CAP e limite de slots.

## Critérios de aceite

- [x] Não equipa item em slot incompatível
- [x] Stats mudam após equip
- [x] Bag e personagem permanecem arquivos separados

## Notas

Mercado no 27 reutiliza os mesmos itens de inventário.

