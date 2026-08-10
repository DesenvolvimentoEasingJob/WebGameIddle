# 21 — XP e level up

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Aplicar fórmulas de experiência e level usando variáveis de ambiente.

## Pré-requisitos

- Todos 03, 15 e 19 concluídos

## Passos

1. Serviço de XP:
   - base level 1 → `XP_BASE` para up
   - escala `XP_SCALE`, a cada `XP_SCALE_STEP_EVERY` níveis soma `XP_SCALE_STEP`
2. Ao ganhar XP: level ups em cadeia se passar de vários limiares.
3. Multiplicador de atributos por nível conforme env / Game-base.
4. Persistir no JSON do personagem + espelhar stats na tabela se existir.
5. Evento `level_up` na resposta de batalha para o front celebrar.

## Critérios de aceite

- [x] Tabela/amostra de XP levels 1–30 batendo com a fórmula
- [x] Mudar env altera curva sem mudar código
- [x] Front mostra level/XP atualizados após luta

## Notas

Documentar exemplos numéricos no `docs/balance.md`.

