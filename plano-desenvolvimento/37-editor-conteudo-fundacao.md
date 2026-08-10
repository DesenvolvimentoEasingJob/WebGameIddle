# 37 — Editor de conteúdo: fundação (Vite + API local de arquivos)

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Criar em `fronend-editor/` um **segundo frontend só para desenvolvedores**, separado do jogo (`frontend/`), para listar/criar/editar JSONs em `content/` sem editar arquivo à mão.

Escopo desta fase (todos 37–40): **monstros, itens e andares**. Raças, classes, atributos, upload de assets e animações ficam para depois.

## Pré-requisitos

- MVP fase 1 + correções 34–36 concluídos
- Pasta `content/` com schemas estáveis (`monsters/`, `items/`, `floors/`)
- Pasta `fronend-editor/` vazia (nome atual do diretório — manter)

## Decisões

| Tema | Decisão |
|------|----------|
| Stack | React + TypeScript + Vite (igual ao jogo, projeto **novo e isolado**) |
| Onde roda | Só no host local (`npm run dev`). **Fora do Docker.** Nunca no compose de produção |
| Como grava JSON | Middleware/plugin Vite (ou mini server Node no mesmo projeto) que lê/escreve `../content/` no disco |
| Por que não via API .NET | Editor é ferramenta de autor; não precisa JWT/player. Disco local é a verdade do monorepo |
| Porta | `5174` (jogo fica em `5173`) |
| Auth | Nenhuma no MVP do editor — assume localhost. Documentar: não publicar |
| Assets | Só campos de path (`assets.sprite`, `assets.icon`, `assets.background`). Upload/anim = fase 2 |

## Passos

1. Em `fronend-editor/`, scaffold Vite: React + TypeScript.
2. Estrutura mínima:
   - `src/pages/` — home + rotas dos editores
   - `src/editors/` — formulários (monstro/item/andar — stubs neste todo)
   - `src/api/contentFs.ts` — client tipado para o middleware local
   - `src/types/content.ts` — tipos alinhados a `content/` / `schemas.md`
   - `src/styles/`
   - `server/` ou `vite.config` plugin — endpoints locais de FS
3. Implementar API local (só Development):
   - `GET /api/content/:folder` — lista `*.json`
   - `GET /api/content/:folder/:id` — um arquivo
   - `PUT /api/content/:folder/:id` — cria/atualiza (body = JSON da entidade)
   - `DELETE /api/content/:folder/:id` — remove arquivo
   - `folder` allowlist: `monsters` \| `items` \| `floors` (expandir depois)
   - Resolver path absoluto para `../content` relativo ao monorepo; rejeitar `..` no `id`
4. Shell do editor: navegação Monstros | Itens | Andares + placeholder “selecione uma entidade”.
5. README em `fronend-editor/README.md`: como subir, aviso “somente dev”, porta 5174.
6. Atualizar README raiz e `.gitignore` se necessário (`dist/` do editor).
7. **Não** montar no `docker-compose.yml`.

## Critérios de aceite

- [x] `cd fronend-editor && npm install && npm run dev` sobe sem erro
- [x] Middleware consegue listar JSONs reais de `content/monsters` (e pastas allowlist)
- [x] PUT grava arquivo válido em `content/.../{id}.json` e GET o relê
- [x] DELETE remove o arquivo
- [x] Path traversal bloqueado (`id` com `/` ou `..` rejeitado)
- [x] App **não** está no Docker Compose
- [x] UI mínima com 3 entradas de menu (editores ainda podem ser stub)

## Notas

- Conteúdo é verdade: a API do jogo (`ContentService`) lê do disco a cada request — após salvar no editor, basta refrescar o jogo (sem rebuild da API).
- Manter o nome da pasta `fronend-editor` como está (já criada). Se quiser renomear para `frontend-editor` depois, é só um rename + docs.
- Não misturar código com `frontend/` do jogador.
