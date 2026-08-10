# 25 — Economia SkyCoin

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Moeda oficial controlada 100% pelo backend.

## Pré-requisitos

- Todo 13 concluído

## Passos

1. Campo `skyCoin` no personagem (ou wallet na DB — preferir DB para ranking/mercado).
2. Ganhos: recompensas de sala/andar, share de ownership.
3. Gastos: taxa de desafio de chefe, compras no mercado.
4. Endpoints de saldo; nenhum endpoint “set balance” público.
5. Logs/auditoria simples de transações (tabela `ledger`).

## Critérios de aceite

- [x] Front só exibe; nunca define saldo
- [x] Ledger permite rastrear fee de chefe
- [x] Saldo insuficiente bloqueia desafio/compra

## Notas

Feche saldo+ledger antes do chefe (26) e do mercado (27).

Implementado: `User.SkyCoin` + tabela `ledger`; `EconomyService` (credit/debit/transfer/`EnsureCanAfford`); vitória de sala credita `battle_reward`; `GET /api/economy/balance` e `/ledger`; hub/torre só leem saldo.
