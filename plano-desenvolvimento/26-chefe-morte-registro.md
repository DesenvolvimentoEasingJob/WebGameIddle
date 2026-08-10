# 26 — Chefe, morte, registro de andar

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Implementar desafio de chefe (×10 attrs), taxa em SkyCoin, penalidade de morte, ownership e clone do dono.

## Pré-requisitos

- Todos 17, 19, 21 e 25 (SkyCoin) concluídos

## Passos

1. Desafiar chefe final do andar: attrs × `BOSS_CHALLENGE_ATTR_MULT`, custo `BOSS_CHALLENGE_FEE`.
2. Morte nesse desafio: perde `DEATH_XP_PENALTY` do XP do nível atual.
3. Vitória sem dono: gravar nome do jogador no andar + snapshot JSON do personagem (sem bag).
4. Com dono: desafiar clone do snapshot; se vencer, novo snapshot.
5. Dono recebe `FLOOR_OWNER_FEE_SHARE` das taxas pagas por desafiantes.
6. UI: botões Desafiar chefe / Registrar andar com confirmações claras.

## Critérios de aceite

- [x] Fee debitada antes da luta
- [x] Penalidade de XP só nesse modo
- [x] Snapshot sem bag
- [x] Share do dono creditado

## Notas

Regra crítica do Game-base §2 — testar com duas contas se possível.

**Lacuna descoberta pós-entrega:** vitória no desafio registrava ownership mas **não liberava o próximo andar**; combate normal na sala 10 + auto-subida permitiam farm infinito sem portão pago. Correção em `34-correcao-portao-chefe-andar.md` + navegação em `35-correcao-navegacao-andares.md`.
