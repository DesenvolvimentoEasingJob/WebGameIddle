# 03 — Variáveis de ambiente e balance

STATUS: concluido
CONCLUIDO_EM: 2026-08-03

## Objetivo

Centralizar multiplicadores e regras numéricas do jogo em variáveis de ambiente, conforme pedido no Game-base.

## Pré-requisitos

- Todo 02 concluído

## Passos

1. Criar `.env.example` (commitado) e `.env` (gitignore) com pelo menos:
   - `XP_BASE` (ex.: 100)
   - `XP_SCALE` (ex.: 1.2)
   - `XP_SCALE_STEP_EVERY` (ex.: 10)
   - `XP_SCALE_STEP` (ex.: 0.1)
   - `LEVEL_ATTR_FACTOR` (fórmula nível → multiplicador; documentar)
   - `FLOOR_DIFFICULTY_MULT` (ex.: 2.0 — dobra vs andar anterior)
   - `FLOOR_REWARD_MULT` (ex.: 1.5)
   - `BOSS_CHALLENGE_ATTR_MULT` (ex.: 10)
   - `BOSS_CHALLENGE_FEE` (ex.: 50)
   - `FLOOR_OWNER_FEE_SHARE` (ex.: 0.10)
   - `DEATH_XP_PENALTY` (ex.: 0.10)
   - `JWT_SECRET`, `DB_CONNECTION`, `PIXELLAB_API_KEY` (vazio por enquanto), `OPENAI_API_KEY` (opcional)
2. Carregar configs no .NET via `IOptions` / `IConfiguration`.
3. Documentar cada variável em `plano-desenvolvimento` ou README curto `docs/balance.md`.

## Critérios de aceite

- [x] `.env.example` completo e documentado
- [x] API lê os valores sem hardcode nos serviços de domínio
- [x] Alterar um valor no `.env` e reiniciar reflete na config (teste com log ou endpoint de debug só em Development)

## Notas

Números de equilíbrio mudam sem recompilar lógica de negócio.
Debug: `GET /api/debug/config` (Development only).
Docs: `docs/balance.md`.
