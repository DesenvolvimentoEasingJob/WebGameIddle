# SkySpire — Content Editor (dev only)

Ferramenta local para criar e editar JSONs em `../content/` (monstros, itens, atributos, andares).

**Não é o frontend do jogo.** Não publique. Sem auth — assume localhost.

## Setup

```bash
cd fronend-editor
cp .env.example .env   # opcional; default API = http://localhost:8080
npm install
npm run dev
```

Abre em http://localhost:5174

A API do jogo precisa estar no ar (`docker compose up`) para **Criar com IA**, **Gerar ícone/sprite** (PixelLab) e **Gerar card** (Gemini).

## API local (Vite middleware)

Só no `npm run dev`. Lê/grava o disco em `content/`.

| Método | Rota | Efeito |
|--------|------|--------|
| GET | `/api/content/:folder` | Lista `*.json` |
| GET | `/api/content/:folder/:id` | Um arquivo |
| PUT | `/api/content/:folder/:id` | Cria/atualiza |
| DELETE | `/api/content/:folder/:id` | Remove |

`folder` allowlist: `monsters` \| `items` \| `floors` \| `attributes` \| `config`

## Config global

Em `/config` edita só `content/config/global.json`:

- **Generative** — `monsterImageComplement` (PixelLab sprites) + `floorImageComplement` (Gemini 21:9 arena)
- **Balance** — XP, torre, treino, HP, combate (fonte de verdade; secrets ficam no `.env` da API)

A API lê o arquivo via `GameConfigService` (sem rebuild). Env de balance, se setada, ainda sobrescreve.

## Monstros (formulário UX)

Em `/monsters` o editor é dedicado (`MonstersEditor`):

- Campos: id, nome, descrição, complementar generativo (opcional), level, hp, baseStats, bonusDefense, skills, behavior, skyCoinDrop, rarityLuck, loot, assets.sprite
- `description` salva no JSON e alimenta Gerar sprite / Animar (PixelLab)
- `generativeComplement` (opcional) **acrescenta** ao complemento global de Config
- **Criar com IA** → `POST /api/editor/monsters/draft` (OpenAI; só Development)
- **Gerar sprite** → `POST /api/editor/monsters/{id}/sprite` (**PixelLab** `generate-image-v2`) — prompt = prefixo + global + description + complement
- **Animar** → `POST /api/editor/monsters/{id}/animate` (**PixelLab** `animate-with-text-v2`, idle east) → `assets.animations.idle`
- Preview via `GET /api/assets/monsters/{id}.png` (e frames `{id}-idle-N.png`)
- Escape hatch: **JSON bruto**

## Itens (formulário UX)

Em `/items` o editor é dedicado (`ItemsEditor`):

- Campos: id, nome, descrição, tipo, itemLevel, stackable, stats (+ atributo), assets.icon
- **Criar com IA** → `POST http://localhost:8080/api/editor/items/draft` (OpenAI; só Development)
- **Gerar ícone** → `POST /api/editor/items/{id}/icon` (**PixelLab** `generate-image-v2`)
- Preview do ícone via `GET /api/assets/items/{id}.png`
- Escape hatch: **JSON bruto** (mesmo `JsonNodeEditor` dos outros)

## Atributos (cards Magic)

Em `/attributes` edita `content/attributes/core.json` (um arquivo, várias keys):

- Campos: key, nome, descrição, fórmulas, prompt de arte, `assets.card`
- **Gerar card (Gemini)** → `POST /api/editor/attributes/{id}/card` (**Google Gemini**, não PixelLab)
- Preview via `GET /api/assets/attributes/{id}.png`
- Salvar reescreve o `core.json` inteiro

Chaves no `backend/.env`: `OPENAI_API_KEY`, `PIXELLAB_API_KEY` (itens/monstros), `GOOGLE_GEMINI_API_KEY` + `GOOGLE_GEMINI_MODEL=gemini-2.5-flash-image` (atributos).

## Andares

Em `/floors` o editor é dedicado (`FloorsEditor`):

- Meta: id (`floor-NN`), number, name, description, theme, difficulty, itemLevel, background
- Salas: tabs **1–9** + **Boss** — cada slot em `monsterIds` = 1 inimigo (qtd + tipos); fees do chefe
- Validação: 1–4 monstros/sala existentes, number único, exatamente 9 salas `wave`
- **Criar com IA** → `POST /api/editor/floors/draft` (OpenAI) devolve pacote `{ floor, monsters, items }`
- **Aplicar pacote** grava items → monsters → floor via middleware Vite (review antes)
- **Gerar background (Gemini)** → `POST /api/editor/floors/{id}/background` (21:9 arena; usa description/theme)
- Preview via `GET /api/assets/floors/{id}.png`
- Escape hatch: **JSON bruto**

## Relação com o jogo

A API .NET (`ContentService`) lê os mesmos JSON em `content/`. Ícones de item em `data/assets/items/`; sprites de monstro em `data/assets/monsters/`; cards de atributo em `data/assets/attributes/` (volume Docker).
