# Todo 56 — Atributos de item no drop

STATUS: concluido
CONCLUIDO_EM: 2026-08-09

## Objetivo

Rolagem de affixes no drop: `attributeCount` por raridade, catálogo `item-attributes.json`, elegibilidade por `item.type` × `compatibility`.

## Passos

1. `content/attributes/item-attributes.json` com `typeRoles` + affixes starter.
2. `attributeCount` em todas as raridades (Lendário ≥ 3; id 99 = 20).
3. `ItemAttributeRoll` + integração em `ItemRollService`.
4. Docs schema/README; testes unitários.
5. Sem migrar bags antigas.

## Critérios de aceite

- [x] Comum → 0 affixes; Lendário → 3; id 99 → 20
- [x] Weapon só offense; armor só defense
- [x] `value = minValue × stars` no snapshot `itemAttributes`
- [ ] Fatias seguintes: motor de fórmulas assignment + combate data-driven + UI (todos 57+)

## Notas

Plano detalhado: Cursor plan `item_attributes_dinamicos`. Próximo: fórmula `lhs = rhs` + `requires` inerte.
