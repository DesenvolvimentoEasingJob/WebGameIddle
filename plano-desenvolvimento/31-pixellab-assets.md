# 31 — PixelLab e assets

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Integrar Animate With Text Pro (PixelLab) e padronizar atlas/image maps na UI.

## Pré-requisitos

- Todos 18 e 20 concluídos
- Conta/API PixelLab; chave em env `PIXELLAB_API_KEY`

## Passos

1. Client backend para PixelLab (docs oficiais).
2. Pipeline mínimo: gerar animação → salvar asset → URL no JSON do monstro/item.
3. Front: carregar sprites via atlas quando possível.
4. Fallbacks se API falhar.

## Critérios de aceite

- [x] Chave só em env, nunca no front
- [x] Pelo menos 1 fluxo gera/armazena asset usável
- [x] UI usa atlas ou documenta convenção de frames

## Notas

`POST /api/assets/pixellab/generate` + fallback atlas. Docs: `docs/pixellab.md`.
