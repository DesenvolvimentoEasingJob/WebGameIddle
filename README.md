# SkySpire End

Jogo de navegador — torre infinita em pixel art. Servidor resolve o jogo; o front anima os eventos.

## Continuar o desenvolvimento

1. Abra [`plano-desenvolvimento/PROXIMO.md`](plano-desenvolvimento/PROXIMO.md)
2. No Cursor: diga **continue o plano** ou **execute o todo N**
3. Índice completo: [`plano-desenvolvimento/00-INDEX.md`](plano-desenvolvimento/00-INDEX.md)

Guia da IA: [`AGENTS.md`](AGENTS.md) · Design: [`Game-base.txt`](Game-base.txt)

## Estrutura

```text
backend/                 # API .NET 10 (Docker)
frontend/                # React + TypeScript (Vite) — jogo, local
fronend-editor/          # Editor de conteúdo (dev only) → grava em content/
content/                 # JSONs de raças, classes, andares…
data/                    # Personagens/bags (runtime, gitignored)
docker/                  # Auxiliares do Compose
plano-desenvolvimento/   # Todos numerados
```

## Stack

| Camada | Tech | Onde |
|--------|------|------|
| Front (jogo) | React + TypeScript (Vite) | Host (`localhost:5173`) |
| Front (editor) | React + TypeScript (Vite) | Host (`localhost:5174`) — só dev |
| Back | .NET 10 Web API | Docker |
| DB | PostgreSQL | Docker |

## Setup

```bash
# API + DB
docker compose up --build

# Healthcheck
curl http://localhost:8080/health

# Front do jogo
cd frontend && npm install && npm run dev

# Editor de conteúdo (dev) — monstros / itens / andares → content/
cd fronend-editor && npm install && npm run dev
```

- API: http://localhost:8080  
- Jogo: Vite em `localhost:5173`  
- Editor: Vite em `localhost:5174` (não publicar; sem Docker)  
- Secrets: copie `backend/.env.example` → `backend/.env` (nunca commitar `.env`).

Balance: ver [`docs/balance.md`](docs/balance.md). Em Development: `GET /api/debug/config`.

Segurança: [`docs/security.md`](docs/security.md) · PixelLab: [`docs/pixellab.md`](docs/pixellab.md) · Smoke: [`docs/smoke-test.md`](docs/smoke-test.md)

## Fluxo do jogador (MVP)

Home → registro/login → raça → classe → hub (status / inventário / torre / mercado / treino / rankings).  
Combate e economia são 100% server-side; o front só anima eventos.

## Adiado

- Geração de andares por IA  
- Multiplayer  
- Todo 33 (itens narrativos OpenAI) — opcional  
