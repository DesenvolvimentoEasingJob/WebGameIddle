# 20 — Animação de combate no front

STATUS: concluido
CONCLUIDO_EM: 2026-08-05
SUPERSEDED_BY: docs/migracao-combat-timeline.md

## Objetivo

Reproduzir a timeline de eventos com animações pixel (mesmo que placeholders).

## Pré-requisitos

- Todos 18 e 19 concluídos

## Passos

1. Player de eventos: consome a lista com delay configurável.
2. Mostrar floating damage, flashes de spell, morte/vitória.
3. Botão “Pular animação” (opcional, útil em dev).
4. Ao terminar: atualizar estado da torre (próxima sala / auto-climb).
5. Não recalcular combate no client — só apresentar.

## Critérios de aceite

- [x] Mesma batalha sempre “mostra” o que o server mandou
- [x] UI não trava se houver muitos eventos
- [x] Auto-climb inicia próxima luta após animação (se ligado)

## Notas

Assets PixelLab reais no todo 31; agora motion básico basta.

