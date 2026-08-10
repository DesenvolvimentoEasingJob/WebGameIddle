# 13 — Criação de personagem + bag JSON

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Persistir personagem e inventário separados (JSON), e ligar path na tabela de usuários.

## Pré-requisitos

- Todos 06, 09 e 12 concluídos

## Passos

1. `POST /api/characters` com `{ raceId, classId, name }`.
2. Gerar:
   - JSON do personagem (raça, classe, level 1, XP 0, atributos base, equipment slots da raça, assinatura depois)
   - JSON da bag em `content/bags/` ou `data/bags/` (40 slots)
3. Salvar `character_json_path` (e path da bag) no user.
4. Impedir segundo personagem no MVP (1 char por conta) ou documentar regra.
5. Front: confirmação → chama API → vai ao hub.

## Critérios de aceite

- [x] Arquivos JSON criados no volume
- [x] User aponta para o path
- [x] Bag separada do personagem (regra do Game-base para clones de andar)
- [x] Front chega no hub com personagem carregado

## Notas

Assinatura digital fica no todo 30; deixar campo `signature` null por enquanto.
