# 18 — Página da torre

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

UI da torre: fundo do andar, personagem à esquerda, inimigo à direita, salas e auto-subida.

## Pré-requisitos

- Todo 17 concluído

## Passos

1. Rota `/tower`.
2. Layout combate/exploração: player left, enemy right (placeholders 256).
3. Indicador de sala (1–9 + chefe).
4. Toggle auto-climb.
5. Botão “Enfrentar” / “Próxima sala” quando aplicável.
6. Voltar ao hub.

## Critérios de aceite

- [x] Estado da API reflete na UI
- [x] Navegação entre salas liberadas
- [x] Layout alinhado ao Game-base §2

## Notas

Animações de hit/spell no todo 20.

**Atualização (todo 25b):** rota efetiva é `/hub/tower` (painel). Palco e log ficam no `CombatDock` do shell, não nesta página. Ver `25b-layout-shell-persistente.md`.

