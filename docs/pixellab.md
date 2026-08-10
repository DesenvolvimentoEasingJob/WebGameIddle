# PixelLab / assets

## Combate (atlas animado)

- Client: `PixelLabService.GenerateOrFallbackAsync` → `POST /api/assets/pixellab/generate`
- API PixelLab: `POST https://api.pixellab.ai/v2/animate-with-text-v2`
- Chave só em `PIXELLAB_API_KEY` (backend); alias `PIXEL_API_KEY`
- Se a API falhar ou a chave estiver vazia, grava atlas **fallback** em `data/assets/pixellab/*-atlas.json`
- Convenção de frames: strip horizontal 64×64, 4 frames (`idle`, `windup`, `strike`, `recover`)
- UI de combate (`CombatDock`) usa placeholders CSS até o atlas real estar ligado nos JSONs

## Ícones de inventário (editor)

- `PixelLabService.GenerateItemIconAsync` → `POST /v2/generate-image-v2` (Pro, job assíncrono)
- Poll: `GET /v2/background-jobs/{job_id}`
- Tamanho: 128×128, `no_background: true`
- Prompt: prefixo fixo SkySpire + nome/descrição do item
- Arquivo: `data/assets/items/{id}.png`
- Editor (Development): `POST /api/editor/items/{id}/icon`
- Serve: `GET /api/assets/items/{fileName}.png` (leitura anônima para preview)
- Fallback: PNG 1×1 transparente + `source: "fallback"`

## Sprites de monstro (editor)

- `PixelLabService.GenerateMonsterSpriteAsync` → mesmo `generate-image-v2` (128×128, `no_background`)
- Prompt: criatura pixel-art centrada, vista lateral/¾, sem UI
- Arquivo: `data/assets/monsters/{id}.png`
- Editor (Development): `POST /api/editor/monsters/{id}/sprite` + draft `POST /api/editor/monsters/draft`
- Serve: `GET /api/assets/monsters/{fileName}` (leitura anônima para preview)
- Fallback: PNG 1×1 transparente + `source: "fallback"`

## Idle animado de monstro (combat footer)

- Botão **Animar** no editor → `POST /api/editor/monsters/{id}/animate`
- `PixelLabService.GenerateMonsterIdleAnimationAsync` → `POST /v2/animate-with-text-v2`
- Usa o PNG estático como `reference_image`, `action: idle`, `direction: east`, `view: side`, frames 64×64
- Grava `data/assets/monsters/{id}-idle-{n}.png`
- JSON em `assets.animations.idle` (`frames`, `frameWidth`, `frameHeight`, `frameCount`, `fps`, `direction`)
- Encounter DTO expõe `idleAnimation`; `CombatDock` faz loop dos frames
- Requer sprite estático já gerado; sem chave → fallback = 1 frame (cópia do sprite)

Resolução de referência do Game-base: até 256×256; ícones/sprites MVP usam 128×128.

## Cards de atributo (Gemini — não PixelLab)

Arte de card de treino usa **Google Gemini**, serviço separado (`GeminiImageService`):

- Env: `GOOGLE_GEMINI_API_KEY`, `GOOGLE_GEMINI_MODEL=gemini-2.5-flash-image`, `GOOGLE_PROJECT_ID` (opcional)
- Editor (Development): `POST /api/editor/attributes/{id}/card`
- Aspecto: **4:3** (caixa de arte Magic ≈ 53×39 mm), não a carta 63×88 inteira
- Arquivo: `data/assets/attributes/{id}.png`
- Serve: `GET /api/assets/attributes/{fileName}` (anônimo)
- PixelLab **não** gera cards de atributo; Gemini **não** gera ícones de item.
