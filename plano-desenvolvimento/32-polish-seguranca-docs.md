# 32 — Polish, segurança e docs finais do MVP

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Fechar o MVP do Game-base: hardening, limpeza e documentação de operação.

## Pré-requisitos

- Todos 01–31 relevantes concluídos (33 é opcional)

## Passos

1. Revisar: CORS, rate limit básico em auth, validação de inputs.
2. Garantir que nenhum endpoint confia em stats/dano do client.
3. README: setup Docker + front, env, fluxo do jogador, link dos todos.
4. Atualizar `00-INDEX.md` marcando status finais.
5. Checklist de smoke test completo (home → login → raça → classe → torre → luta → inventário → mercado → treino).

## Critérios de aceite

- [x] Smoke test documentado e executado
- [x] Secrets só em env
- [x] Plano reflete o que foi entregue vs adiado (IA andares, multiplayer)

## Notas

Smoke: `docs/smoke-test.md`. Adiados: IA andares, multiplayer, todo 33.
