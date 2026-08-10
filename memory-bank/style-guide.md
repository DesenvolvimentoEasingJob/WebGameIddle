# Style Guide — SkySpire End

## Idioma

- Docs de produto/plano: português.
- Código: inglês para identificadores; mensagens de UI podem ser PT.

## Backend (.NET)

- Minimal APIs preferidos enquanto o projeto for enxuto.
- Options pattern para config; sem hardcode de multiplicadores.
- Ler conteúdo de disco (`ContentPath`), não embutir tabelas de raça/classe.
- Erros de health: `ok` / `degraded` com status HTTP adequado.

## Frontend (React/TS)

- TypeScript strict (ou próximo).
- Páginas finas; regras de jogo no servidor.
- Client tipado em `src/api/`.
- Evitar estado global pesado até o plano exigir.
- UI simples no scaffold; vibe pixel-art depois.

## Content JSON

- Um arquivo por entidade; `id` estável.
- Validar JSON; seguir schemas em `.cursor/skills/conteudo-json-jogo/`.
- Assets referenciados por URL/path no JSON.

## Git / secrets

- Nunca commitir `.env`, credentials, API keys.
- Só `.env.example` versionado.

## Plano

- Um todo por vez; marcar STATUS e datas ao concluir.
- Não pular números sem pedido explícito do usuário.
