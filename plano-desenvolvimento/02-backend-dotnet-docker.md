# 02 — Backend .NET 10 + Docker

STATUS: concluido
CONCLUIDO_EM: 2026-08-03

## Objetivo

Subir uma Web API .NET 10 containerizada com PostgreSQL via Docker Compose, respondendo healthcheck.

## Pré-requisitos

- Todo 01 concluído
- Docker Desktop instalado
- SDK .NET 10 (opcional no host; build pode ser só no container)

## Passos

1. Criar solução/projeto em `backend/` (ASP.NET Core Web API, .NET 10).
2. Endpoint `GET /health` retornando `{ "status": "ok" }`.
3. Criar `Dockerfile` multi-stage para a API.
4. Criar `docker-compose.yml` na raiz (ou `docker/`) com serviços:
   - `api` (.NET 10)
   - `db` (PostgreSQL)
5. Mapear volumes para `content/` (leitura) e pasta de characters/bags (leitura/escrita).
6. Expor porta da API (ex.: 8080).
7. Documentar `docker compose up --build` no README.

## Critérios de aceite

- [x] `docker compose up --build` sobe API + Postgres sem erro
- [x] `GET /health` responde 200
- [x] Postgres acessível pela API (connection string via env)
- [x] Front ainda não precisa estar no Docker

## Notas

CORS: já liberar origem do Vite (`http://localhost:5173`) para os próximos todos.
Health também verifica o Postgres (`database: up`).
