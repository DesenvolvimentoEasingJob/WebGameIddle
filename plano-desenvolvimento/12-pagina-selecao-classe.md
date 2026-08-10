# 12 — Página de seleção de classe

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Após a raça, o jogador escolhe a classe.

## Pré-requisitos

- Todo 11 concluído

## Passos

1. Rota `/create/class` (exige raça já escolhida).
2. Listar classes (filtrar se raça restringir).
3. Mostrar atributos/foco da classe.
4. Continuar → tela de confirmação/criação (todo 13).
5. Voltar para raça mantém ou limpa classe conforme UX simples.

## Critérios de aceite

- [x] Não acessa classe sem raça selecionada
- [x] Dados da API
- [x] Fluxo linear raça → classe funciona

## Notas

Testar manualmente o fluxo completo de UI antes da API de criar personagem.
