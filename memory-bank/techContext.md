# Tech Context — SkySpire End

## Plataforma de desenvolvimento

- **OS:** Windows (PowerShell)
- **Path separator:** `\`
- **Repo:** `C:\GitHub\SkySpireEnd`

## Runtime / ferramentas

| Tool | Uso |
|------|-----|
| Docker Compose | `db` (Postgres 16) + `api` (.NET 10) |
| .NET 10 SDK | Build API (também no Dockerfile multi-stage) |
| Node.js LTS | Frontend Vite (a partir do todo 04) |
| Npgsql 10.0.0 | Única NuGet de dados hoje (sem EF Core ainda) |

## Portas

| Serviço | URL |
|---------|-----|
| API (Docker) | http://localhost:8080 |
| API (dotnet run local) | http://localhost:5080 (`launchSettings`) |
| Vite (planejado) | http://localhost:5173 |
| Postgres | localhost:5432 |

## Docker Compose

- **db:** `postgres:16-alpine`, DB/user/pass `skyspire`, volume `skyspire_pgdata`, healthcheck.
- **api:** build `./backend`, env connection → host `db`, `ContentPath=/app/content`, `DataPath=/app/data`.
- Volumes: `./content` → RO, `./data` → RW.
- **Frontend não entra no Compose.**

## Backend atual (`SkySpire.Api`)

- Minimal hosting em `Program.cs` (sem Controllers/Services/Entities ainda).
- Carrega `.env` via `AddDotEnvFile` (não sobrescreve env existente).
- Options: `GameBalanceOptions`, `AppSecretsOptions`.
- CORS policy `ViteDev` → `http://localhost:5173`.
- Endpoints: `GET /health`, `GET /api/debug/config` (Development only).

## Persistência (híbrida — planejada)

| Dado | Onde |
|------|------|
| Users / rankings / stats | PostgreSQL |
| Character JSON | `data/characters/` |
| Bag JSON | `data/bags/` |
| Conteúdo (raças, etc.) | `content/*/` |

**Hoje:** só conectividade Postgres no health — sem schema/migrations/EF.

## Frontend atual

- Placeholder: `frontend/README.md` + `frontend/ui-assets/`.
- Sem `package.json` / Vite / React ainda (todo 04).

## Config / secrets

- `backend/.env.example` → copiar para `backend/.env` (gitignored).
- Placeholders: `JWT_SECRET`, `HMAC_SECRET`, PixelLab/OpenAI keys.
- Balance documentado em `docs/balance.md`.

## Estrutura-alvo do front (todo 04)

```text
frontend/src/pages/
frontend/src/components/
frontend/src/api/
frontend/src/types/
frontend/src/styles/
```

`VITE_API_URL` → API Docker; client tipado; React Router; sem Redux até precisar.
