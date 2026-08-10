# 04 — Frontend React + TypeScript (Vite)

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Criar o app web fora do Docker, simples de manter, pronto para consumir a API.

## Pré-requisitos

- Todo 02 concluído (API no ar ajuda, mas não é obrigatório para scaffold)
- Node.js LTS instalado

## Passos

1. Em `frontend/`, criar projeto Vite: React + TypeScript.
2. Estrutura mínima:
   - `src/pages/`
   - `src/components/`
   - `src/api/` (client fetch/axios tipado)
   - `src/types/`
   - `src/styles/`
3. Configurar React Router.
4. Variável `VITE_API_URL` apontando para a API Docker.
5. Página placeholder + rota `/`.
6. Scripts no README: `npm install`, `npm run dev`.

## Critérios de aceite

- [x] `npm run dev` abre a app sem erros
- [x] TypeScript strict (ou próximo) habilitado
- [x] Client de API tipado consegue chamar `/health`
- [x] Front **não** está no docker-compose

## Notas

Manter UI simples: pixel-art vibe depois; agora foque em estrutura limpa.
Evitar over-engineering (sem Redux/etc. até precisar).
Build `npm run build` ok; home placeholder mostra status do `/health`.
