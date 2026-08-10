# 30 — Assinatura digital dos JSONs

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Assinar personagem e bag para detectar adulteração em disco/volume.

## Pré-requisitos

- Todos 13 e 23 concluídos

## Passos

1. Chave HMAC/JWT secret ou key assimétrica via env (`JSON_SIGNING_KEY`).
2. Ao salvar personagem/bag: calcular signature sobre canonical JSON.
3. Ao carregar: verificar; se inválida → rejeitar e logar.
4. Nunca confiar em JSON enviado pelo front como fonte de verdade.

## Critérios de aceite

- [x] Edição manual do arquivo quebra a signature
- [x] Fluxos normais da API reassinam corretamente
- [x] Documentado no README de segurança

## Notas

Ver `docs/security.md`. Chave: `HMAC_SECRET` (alias `JSON_SIGNING_KEY`).
