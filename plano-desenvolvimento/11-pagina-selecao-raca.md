# 11 — Página de seleção de raça

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Jogador autenticado escolhe a raça; escolha fica em estado de criação até confirmar personagem.

## Pré-requisitos

- Todos 08 e 10 concluídos

## Passos

1. Rota protegida `/create/race`.
2. Listar raças da API com nome, descrição, traits e preview de asset (placeholder ok).
3. Selecionar uma raça → destacar visualmente → botão Continuar.
4. Guardar escolha em state (context/store leve) ou query até a criação final.
5. Se usuário já tem personagem, redirecionar ao hub (tratar no todo 13/14; por agora bloquear recriação ou avisar).

## Critérios de aceite

- [x] Sem login → redirect login
- [x] Lista vem da API, não hardcode
- [x] Seleção persiste ao ir para a próxima tela
- [x] UI clara: uma decisão por tela

## Notas

Uma job por seção: só escolher raça.
