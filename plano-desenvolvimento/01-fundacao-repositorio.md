# 01 — Fundação do repositório

STATUS: concluido
CONCLUIDO_EM: 2026-08-03

## Objetivo

Criar a estrutura base do monorepo SkySpire End, com pastas claras para backend, frontend, conteúdo JSON e Docker.

## Pré-requisitos

- Repositório `SkySpireEnd` disponível
- Git instalado

## Passos

1. Criar pastas:
   - `backend/` — API .NET 10
   - `frontend/` — React + TypeScript (Vite)
   - `content/` — JSONs de jogo (raças, classes, monstros, andares, itens, magias, raridades, atributos, bags)
   - `docker/` — compose e configs auxiliares (se necessário)
2. Criar `.gitignore` cobrindo: `bin/`, `obj/`, `node_modules/`, `.env`, `dist/`, IDE, bags de jogadores se sensíveis.
3. Criar `README.md` na raiz com: o que é o jogo, stack, como subir API (Docker) e front (npm), link para `plano-desenvolvimento/00-INDEX.md`.
4. Copiar/referenciar `Game-base.txt` como fonte de design (não reescrever agora).

## Critérios de aceite

- [x] Pastas existem e fazem sentido
- [x] `.gitignore` impede commit de secrets e build artifacts
- [x] README explica como continuar pelo plano de todos
- [x] Nada de código de jogo ainda (só esqueleto)

## Notas

Não implementar features neste todo. Apenas organização.
