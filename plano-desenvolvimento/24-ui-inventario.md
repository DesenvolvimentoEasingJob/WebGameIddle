# 24 — UI de inventário e equipamentos

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Tela para ver bag, equipar e entender slots da raça.

## Pré-requisitos

- Todos 14 e 23 concluídos

## Passos

1. Rota `/inventory` a partir do hub.
2. Grid de slots (40).
3. Painel de equipamento com nomes dos slots do JSON.
4. Drag-and-drop simples ou click-to-equip.
5. Mostrar stats antes/depois (resumo).

## Critérios de aceite

- [x] Equip/unequip reflete API
- [x] Erros de slot incompatível visíveis
- [x] Mobile usável (click ok se drag for difícil)

## Notas

Sem cards excessivos; foco em grid de itens estilo RPG clássico.

**Atualização (todo 25b):** inventário é painel em `/hub/inventory` dentro do shell (combate continua visível embaixo). Ver `25b-layout-shell-persistente.md`.

