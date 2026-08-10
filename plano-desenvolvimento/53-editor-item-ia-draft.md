# 53 — Editor: draft de item via OpenAI

STATUS: concluido
CONCLUIDO_EM: 2026-08-07

## Objetivo

No `fronend-editor`, criar rascunho de item a partir de descrição em português (OpenAI), sem gravar arquivo até o usuário salvar.

## Pré-requisitos

- Todo 39 (formulário de itens)
- `OPENAI_API_KEY` no `backend/.env`

## Entrega

- `ItemDraftService` + `POST /api/editor/items/draft` (Development, AllowAnonymous)
- Modelo `gpt-4o-mini`, `response_format: json_object`
- CORS: `http://localhost:5174`
- Modal **Criar com IA** no `ItemsEditor` → preenche form → Salvar no FS

## Critérios de aceite

- [x] Sem chave / falha → 502 com mensagem; não grava JSON
- [x] Chave só no backend
- [x] Usuário revisa antes de salvar

## Notas

Distinct do todo 33 (narrativa em drop in-game).
