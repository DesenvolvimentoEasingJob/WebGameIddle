# 49 — ItemLevel do andar no bake

STATUS: concluido
CONCLUIDO_EM: 2026-08-07

## Objetivo

Drop usa `floor.itemLevel`: escala a base com `base × (1 + lv/10)` antes de raridade/estrelas.

## Critérios de aceite

- [x] Templates globais; `itemLevel` do snapshot = andar
- [x] Fórmula: leveled depois × (stars + rarity)
- [x] Loot timeline / UI mostram nível
- [x] Testes unitários de ApplyFloorLevel / BakeStat
