# SkySpire End — Agent Guide

Torre infinita pixel-art no browser. Autoridade total no backend; o front só anima eventos.

## Antes de qualquer feature

1. Ler `plano-desenvolvimento/PROXIMO.md`
2. Ler o todo indicado
3. Implementar **somente** aquele todo
4. Atualizar STATUS / INDEX / PROXIMO ao terminar

Frases do usuário: `continue o plano`, `próximo todo`, `execute o todo N`.

## Stack

| Peça | Tech | Runtime |
|------|------|---------|
| Front | React + TypeScript (Vite) | Host local (`npm run dev`) |
| Back | .NET 10 Web API | Docker |
| DB | PostgreSQL | Docker |
| Conteúdo | JSON em `content/` | Volume montado na API |
| Balance | `content/config/global.json` (env = override opcional) | Backend |

Design de produto: `Game-base.txt` (ignorar menções a PHP/JS; usar stack acima).

## Rules (`.cursor/rules/`)

| Rule | Quando |
|------|--------|
| `skyspire-plano.mdc` | Sempre — seguir todos |
| `skyspire-stack.mdc` | Sempre — stack/domínio |
| `backend-dotnet.mdc` | Arquivos em `backend/` |
| `frontend-react.mdc` | Arquivos em `frontend/` |
| `requests-orientados-a-evento.mdc` | Arquivos em `frontend/` — requests por evento, sem polling por tick |
| `content-json.mdc` | Arquivos em `content/` |

## Skills (`.cursor/skills/`)

- `continuar-plano` — retomar/avançar todos
- `conteudo-json-jogo` — criar/editar JSONs de raça, classe, monstro, andar, item

## Segurança (obrigatório)

- Servidor calcula combate, XP, loot, moedas, equip
- Front **nunca** envia dano/stats finais como verdade
- Personagem e bag: arquivos separados; bag fora do snapshot de ownership
- `.env` com secrets **nunca** no git (só `.env.example`)
- Chaves de API (PixelLab, OpenAI) só no backend via env

## Estrutura esperada

```text
backend/          # .NET 10
frontend/         # React + TS (jogo)
fronend-editor/   # Editor de conteúdo (dev) → content/
content/          # JSONs de conteúdo
plano-desenvolvimento/
Game-base.txt
docker-compose.yml
```
