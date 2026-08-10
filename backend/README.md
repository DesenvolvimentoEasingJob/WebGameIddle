# Backend

API .NET 10 Web API (`src/SkySpire.Api`), containerizada via Docker Compose na raiz.

## Local (sem Docker da API)

```bash
dotnet run --project backend/src/SkySpire.Api
```

Requer Postgres em `localhost:5432` (ou `docker compose up db`).

## Docker

Na raiz do repo:

```bash
docker compose up --build
```

- API: http://localhost:8080/health
- Postgres: `localhost:5432` (user/pass/db: `skyspire`)

Volumes: `content/` (ro) e `data/` (rw) montados em `/app/content` e `/app/data`.

Secrets: `.env` (local) — use `.env.example` como modelo.
