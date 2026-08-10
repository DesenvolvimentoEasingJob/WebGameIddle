# 27 — Mercado entre jogadores

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Mercado de venda direta, anúncio grátis, stack de iguais, itens que ocupam slot na bag.

## Pré-requisitos

- Todos 23 e 25 concluídos

## Passos

1. Tabelas/listings: seller, item ref/snapshot, preço, quantidade.
2. Anunciar remove/reserva item da bag.
3. Comprar: transferir SkyCoin + item; agrupar iguais na listagem.
4. Endpoints list/buy/cancel.
5. UI `/hub/market` básica.

## Critérios de aceite

- [x] Anunciar é gratuito
- [x] Compra atômica (sem duplicar item nem perder moeda)
- [x] Só backend move itens/moedas

## Notas

Game-base §8. Painel sob hub (todo 25b).
