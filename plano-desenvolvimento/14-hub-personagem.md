# 14 — Hub do personagem

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Tela central pós-login/criação: ver status, entrar na torre, atalhos futuros (inventário, mercado, treino).

## Pré-requisitos

- Todo 13 concluído

## Passos

1. `GET /api/characters/me` retorna personagem + resumo (nível, andar, moedas).
2. Página `/hub` com:
   - Nome, raça, classe, level
   - CTA principal: Entrar na Torre
   - Links desabilitados ou placeholders: Inventário, Mercado, Treino, Ranking
3. Se não tem personagem → fluxo de criação.
4. Se tem → nunca forçar raça/classe de novo.

## Critérios de aceite

- [x] Login com personagem cai no hub
- [x] Login sem personagem cai na criação
- [x] Dados exibidos vêm do backend

## Notas

Hub é o “menu” do idle/tower — manter simples.

**Atualização (todo 25b):** o hub virou shell persistente (`GameShell`): sidebar full-height + painéis em `/hub/status|inventory|tower` + dock de combate. Ver `25b-layout-shell-persistente.md`.
