# 55 — Editor de andares: draft IA (pacote)

STATUS: concluido
CONCLUIDO_EM: 2026-08-09

## Objetivo

Permitir criar um andar a partir de um **prompt do criador**: a IA aprimora tema/nome/descrição e devolve rascunhos JSON de monstros e itens temáticos. Nada grava disco até o usuário revisar e **Aplicar pacote**.

## Pré-requisitos

- Todo 40 (formulário UX de andares)
- `OPENAI_API_KEY` no `backend/.env` (Development)

## API

`POST /api/editor/floors/draft` (só Development)

Body:

```json
{ "description": "...", "floorNumber": 11, "itemLevel": 11 }
```

Response:

```json
{
  "floor": { "...": "..." },
  "monsters": [ { "...": "..." } ],
  "items": [ { "...": "..." } ]
}
```

Serviço: `FloorDraftService` — lê ids existentes de `content/items` e `content/monsters` para reuso em loot; normaliza ids, 9 salas, boss, paths de assets.

## Frontend

- Modal **Criar com IA** no `FloorsEditor` (prompt + número do andar)
- Painel de revisão do pacote (itens / monstros)
- **Aplicar pacote**: `putContent` items → monsters → floor (com aviso de colisão de ids)
- Endpoint de draft **nunca** escreve disco

## Critérios de aceite

- [x] Prompt → draft JSON revisável sem escrever disco
- [x] Aplicar pacote cria arquivos coerentes (loot → itens; salas → novos mobs)
- [x] Mensagem clara se `OPENAI_API_KEY` ausente

## Fora de escopo

- Background PixelLab do andar
- Auto-sprite/ícone em massa dos mobs/itens do pacote
- Andares infinitos in-game
