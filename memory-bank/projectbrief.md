# Project Brief — SkySpire End

## Produto

Torre infinita em pixel art no browser. O jogador escolhe raça → classe → sobe andares, combate monstros, ganha XP/itens, usa mercado, treina atributos e pode reivindicar ownership de andar ao vencer um chefe ×10.

## Modelo de autoridade

- **Servidor resolve o jogo; o front anima eventos.**
- Combate por timeline de eventos (jogador não escolhe ações no combate).
- SkyCoin e itens só mudam no backend.
- Front nunca envia dano/stats finais como verdade.

## Escopo MVP

Incluído: home → login → raça/classe → personagem → 10 andares → combate por eventos → XP → inventário/equip → chefe/ownership → mercado → treinamento → rankings → assinatura JSON → balance via env.

Fora do MVP: andares infinitos por IA, multiplayer/guildas, itens narrativos OpenAI (todo opcional 33).

## Stack (decisão firme)

| Camada | Tech | Runtime |
|--------|------|---------|
| Front | React + TypeScript (Vite) | Host local — fora do Docker |
| Back | .NET 10 Web API | Docker |
| DB | PostgreSQL 16 | Docker |
| Conteúdo | JSON em `content/` | Volume RO na API |
| Dados jogador | JSON em `data/` | Volume RW |
| Balance | Env → `GameBalanceOptions` | Backend |

Design de produto: `Game-base.txt` (ignorar PHP/JS; usar stack acima). Plano: `plano-desenvolvimento/`.

## Invariantes de domínio

1. 1 conta → 1 personagem (MVP).
2. Personagem JSON ≠ bag JSON (clone de ownership sem inventário).
3. Conteúdo jogável em arquivos JSON, não hardcoded no C#.
4. Multiplicadores de balance só via env — sem hardcode no domínio.
5. Secrets (`.env`, API keys) nunca no frontend nem no git.

## Fontes canônicas

- `Game-base.txt` — design
- `AGENTS.md` — guia de agentes
- `plano-desenvolvimento/PROXIMO.md` — próximo todo
- `.cursor/rules/` — convenções de stack/código
