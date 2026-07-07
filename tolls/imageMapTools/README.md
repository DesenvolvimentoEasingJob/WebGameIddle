# SkySpire Dev Tools

Ferramentas de edição de assets do projeto, unificadas em um único app com menu lateral.

## Rodar

```bash
cd tolls/imageMapTools
npm install
cp .env.example .env   # configure OPENAI_API_KEY
npm run dev
```

Abre em **http://localhost:5199**

## Ferramentas

| Menu | Edita | Salva em |
|------|-------|----------|
| **UI Atlas** | Frames da interface (`atlas.json`) | `front/src/ui/atlas.json` |
| **Animações** | Sprite sheets de mobs/jogador (`.anim.json`) | `front/src/animation/maps/` |
| **Gerador IA** | Sprite sheets via OpenAI (6×3 grid) | `front/assets/`, anim maps, mob JSON |

## Gerador IA

1. Copie `.env.example` → `.env` e coloque sua `OPENAI_API_KEY`
2. No menu **Gerador IA**, preencha ID, tipo (mob/player) e descrição do personagem
3. Clique **Gerar com OpenAI** — o prompt já inclui o enquadramento 1776×888 (idle/attack/critical)
4. Preview animado no painel; ajuste se necessário no menu **Animações**
5. **Salvar** grava PNG, `.anim.json`, mob JSON (opcional) e atualiza `sprite-registry.ts`

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `OPENAI_API_KEY` | — | Token OpenAI (obrigatório) |
| `OPENAI_IMAGE_MODEL` | `gpt-image-1` | Modelo de imagem |
| `OPENAI_IMAGE_SIZE` | `1536x1024` | Tamanho gerado (normalizado para 1776×888 no browser) |
| `OPENAI_IMAGE_QUALITY` | `high` / `hd` | Qualidade (`high` para gpt-image, `hd` para dall-e-3) |

## Estrutura

```
tolls/imageMapTools/
  .env.example
  src/
    main.ts           # shell + menu lateral
    ui-atlas/         # editor de UI
    anim-map/         # editor de animações
    ai-sprite/        # gerador IA de sprite sheets
    api.ts            # read/write de arquivos do repo
```

O runtime do jogo (`front/`) não inclui mais editores — apenas consome os JSON gerados aqui.
