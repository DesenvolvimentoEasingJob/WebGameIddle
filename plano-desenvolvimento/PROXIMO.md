# Próximo todo

STATUS: editor_conteudo_em_andamento

**Arquivo atual:** `52-ui-monster-gold-rarity.md` (pendente)

## Concluído recentemente

- `55` — draft IA de andar (pacote floor + monsters + items)
- `40` — editor UX de andares (salas 1–9 + boss, validação cruzada)
- `54` — ícone de item via PixelLab `generate-image-v2` no editor
- `53` — draft de item via OpenAI (`POST /api/editor/items/draft`)
- `39` — formulário UX dedicado de itens (stats, validação, JSON bruto)

## Fase: editor de conteúdo (dev)

1. `37` — scaffold — **concluído**
2. `38` — editor + monstros — **concluído**
3. `39` — itens: formulário UX — **concluído**
4. `40` — andares: formulário por sala — **concluído**
5. `53` / `54` — IA draft + ícone PixelLab (itens) — **concluídos**
6. `55` — IA draft de andar (pacote) — **concluído**

**Editor:** `cd fronend-editor && npm run dev` → http://localhost:5174  
(Andares: salas + Criar com IA + Aplicar pacote; API em `:8080` com `OPENAI_API_KEY` no `backend/.env`)

**API:** recrear o container após pull deste código:
`docker compose up -d --force-recreate --build api`

## Fila

- `52` — UI do alvo + campos no editor (`skyCoinDrop` / `rarityLuck`)
- `33` — (opcional) itens narrativos OpenAI in-game

Pedido: *"execute o todo 52"* ou *"continue o plano"*.
