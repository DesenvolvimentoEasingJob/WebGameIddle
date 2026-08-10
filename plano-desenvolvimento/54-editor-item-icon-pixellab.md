# 54 — Editor: ícone de item via PixelLab

STATUS: concluido
CONCLUIDO_EM: 2026-08-07

## Objetivo

Gerar ícone estático de inventário com PixelLab Pro e ligar a `assets.icon` no form de itens.

## Pré-requisitos

- Todo 39
- `PIXELLAB_API_KEY` no backend

## Entrega

- `PixelLabService.GenerateItemIconAsync` → `POST /v2/generate-image-v2` (128×128, `no_background`)
- Poll `GET /v2/background-jobs/{id}` até completed
- PNG em `{DataPath}/assets/items/{id}.png`
- `POST /api/editor/items/{id}/icon` + `GET /api/assets/items/{file}` (anon read)
- Botão **Gerar ícone** no `ItemFormEditor`
- Fallback PNG 1×1 se chave ausente / falha

## Critérios de aceite

- [x] Chave só no env
- [x] Path atualizado no form; usuário salva o JSON
- [x] Animações fora de escopo (animate-with-text permanece para combate)

## Docs

Ver `docs/pixellab.md`.
