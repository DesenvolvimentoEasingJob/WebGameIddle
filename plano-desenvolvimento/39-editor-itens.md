# 39 — Editor de itens

STATUS: concluido
CONCLUIDO_EM: 2026-08-07

## Objetivo

UI completa para criar e editar itens em `content/items/{id}.json`.

## Pré-requisitos

- Todo 37 concluído
- Todo 38 recomendado (loot de monstro aponta para itens)

## Entrega

Formulário dedicado (`ItemsEditor` + `ItemFormEditor`) em `/items`:

| Campo | Notas |
|-------|--------|
| `id` | kebab-case; imutável após criar |
| `name`, `description` | |
| `type` | select: weapon, helmet, armor, ring, amulet, focus, material, shield |
| `itemLevel` | number ≥ 1 |
| `stackable` | boolean |
| `stats` | lista adicionar atributo (sugestões dmgBase/defBase/…) |
| `assets.icon` | path + preview |

- Validação: `name`, `type`, `itemLevel` obrigatórios
- Aviso se `stackable` + stats
- Escape hatch: JSON bruto
- Sem campo `rarity` no form (raridade é rolada no drop)

Draft IA e ícone PixelLab: todos 53 e 54.

## Critérios de aceite

- [x] Criar/editar/excluir item reflete em `content/items/`
- [x] JSON válido e `id` = nome do arquivo
- [x] Item novo aparece como opção de loot no editor de monstros (lista via FS)

## Fora de escopo

- Crafting / receitas
- Drops narrativos in-game (todo 33)
