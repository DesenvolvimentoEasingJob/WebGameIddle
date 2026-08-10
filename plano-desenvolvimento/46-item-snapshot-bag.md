# 46 — Bag com snapshot de item

STATUS: concluido
CONCLUIDO_EM: 2026-08-07

## Objetivo

Bag/equip guardam o item completo; StatCalculator lê stats bakeados; migração de legado `{ itemId, qty }`.

## Critérios de aceite

- [x] Snapshot com instanceId, rarity, stars, stats
- [x] StatCalculator preferência por stats da instância
- [x] Expand legado na load da bag/character
