# Próximo todo

STATUS: plano_mvp_completo

**Arquivo atual:** — (sem pendente numerado)

## Concluído recentemente

- `33` — drop de item único (semente loot + OpenAI + PixelLab; chances raridade ×7; stars 5)
- `52` — UI painel + editor: gold range e rarityLuck
- `59` / `58` / `57` — métricas de combate monstro
- `55` — draft IA de andar

## Fila

Backlog sem número:

- Magias/skills mid-fight (player + monstro)
- Editor de raças / classes / atributos

## Testar único

Em [`content/config/global.json`](../content/config/global.json):

```json
"uniqueDropChance": 1
```

(recriar API). Precisa `OPENAI_API_KEY` no `backend/.env`.
