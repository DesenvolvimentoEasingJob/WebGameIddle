# 35 — Correção: navegar entre andares já liberados

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Contexto / bug

Game-base §2: o jogador pode voltar a salas já completadas. Por analogia de progressão, andares **já liberados** (vencidos via desafio pago do todo 34) devem ser revisitáveis para farm, ownership challenge em andares inferiores, ou exploração.

Hoje:

- Sidebar só mostra texto “Andar X · Sala Y” sem seletor.
- UI Torre só oferece “Entrar no Andar 1”.
- Não há lista de andares `1…maxUnlockedFloor` para trocar de destino.

## Objetivo

Permitir, pelo menu lateral (e reforço no painel Torre), escolher qualquer andar ≤ `maxUnlockedFloor` e entrar nele sem perder o shell/combate persistente.

## Pré-requisitos

- Todo **34** concluído (`maxUnlockedFloor` + `enter` validado)

## Passos

1. Expor `maxUnlockedFloor` no state (já no 34) e lista leve de andares liberados (ids/nomes via `GET /api/tower/floors` filtrado no front, ou endpoint resumido).
2. **Sidebar** (`CharacterSidebar`): bloco “Andares” com botões/lista `1 … maxUnlockedFloor`; ao clicar, chama `enter(floor)` (parar auto-climb ou confirmar se combate em andamento).
3. **TowerPanel**: substituir “só Andar 1” por seletor/lista dos andares liberados + destaque do andar atual; salas 1–9 + botão de desafio no portão (como no 34).
4. `GameSessionContext.enter(floor?: number)`: passar floor escolhido; refresh ownership do novo andar.
5. Regras UX:
   - Troca de andar enquanto `playing`/`busy`: desabilitar ou pedir confirmação.
   - Auto-subida permanece no andar atual após o enter (não liga sozinha).
   - Andares > `maxUnlockedFloor` aparecem bloqueados (cadeado / disabled), nunca clicáveis.
6. Smoke: liberar andar 2 via desafio → sidebar mostra 1 e 2 → entrar no 1 → farm → voltar ao 2.

## Critérios de aceite

- [x] Sidebar lista andares `1…maxUnlockedFloor` e permite entrar
- [x] Andar bloqueado não é entrável pela UI nem pela API (API já no 34)
- [x] Troca de andar atualiza nome/fundo/ownership sem desmontar o `GameSessionProvider`
- [x] Painel Torre e sidebar ficam consistentes com o mesmo state

## O que foi entregue

- `api/tower.ts`: `fetchFloors()` tipado (`number` + `name`) a partir de `GET /api/tower/floors`.
- `GameSessionContext`: lista `floors` carregada uma vez; `enter(floor?)` aceita o andar escolhido,
  interrompe o loop de auto-subida e recarrega o ownership do novo andar.
- `CharacterSidebar`: bloco “Andares liberados” com os andares `1…maxUnlockedFloor`; o atual fica
  destacado e desabilitado, e a troca é bloqueada durante combate/animação.
- `TowerPanel`: seleção de andar tanto fora quanto dentro da torre, salas renomeadas para “farm (1–9)”.
- `global.css`: estilos `tower__floors` e `game-sidebar__floor*`.

## Notas

- Menus continuam sob `/hub/...` (todo 25b).
- Não implementar mapa infinito nem geração IA aqui.
