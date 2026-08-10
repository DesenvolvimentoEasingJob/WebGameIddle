# 28 — Campo de treinamento

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Treinar atributos **base** do personagem (ignorando bônus de itens).

## Pré-requisitos

- Todos 15 e 25 concluídos (custo em SkyCoin ou outro recurso — definir e documentar)

## Passos

1. Endpoint `POST /api/training/train` `{ attribute }`.
2. Calcular custo crescente (via env).
3. Aplicar só no atributo intrinsic do JSON.
4. UI `/hub/training` no hub.

## Critérios de aceite

- [x] Itens equipados não contam como base treinável
- [x] Custo sobe conforme progresso
- [x] Stats recalculam após treino

## Notas

Custo: 1º treino = `TRAINING_COST_BASE`; depois `lastCost * TRAINING_GOLD_SCALE` por atributo (`trainingStats`).
