# Conteúdo do jogo (JSON)

Dados estáticos de gameplay. Um arquivo por entidade.

| Pasta | Conteúdo | Status MVP |
|-------|----------|------------|
| `config/` | Global: generative + balance (`global.json`) | MVP |
| `races/` | Raças | 3 arquivos (human, elf, ork) |
| `classes/` | Classes | 3 arquivos (warrior, mage, ranger) |
| `attributes/` | Treino (`core.json`) + affixes de item (`item-attributes.json`) | MVP |
| `monsters/` | Monstros (`skyCoinDrop`, `rarityLuck`, loot) | MVP |
| `floors/` | Andares | todo 16 |
| `items/` | Templates de item (blueprint de drop) | MVP |
| `spells/` | Magias | esqueleto |
| `rarities/` | 99 raridades (`rarities.json` + `attributeCount`) | MVP |
| `qualities/` | Qualidade/estrelas 1–5 + cores RGB | MVP |
| `item-types/` | Tipos | esqueleto |

### Config global (`config/global.json`)

Editável no fronend-editor → **Config**. Ver `docs/balance.md`.

- `generative.monsterImageComplement` — default do prompt de sprite (PixelLab)
- `balance.*` — XP, torre, treino, HP, combate (env opcional ainda sobrescreve)

Personagens e bags: `data/` (runtime). A bag guarda o **snapshot completo** de cada item único (não só `itemId`).

### Monstros — gold e rarity luck

Campos opcionais no JSON do monstro:

| Campo | Tipo | Default | Efeito |
|-------|------|---------|--------|
| `description` | string | — | Flavor + aparência; entra no prompt de sprite |
| `generativeComplement` | string | ausente | Acrescenta ao `generative.monsterImageComplement` global |
| `assets.width` / `assets.height` | number (px) | `56` | Tamanho de apresentação no combat footer; chefes tipicamente `112` |
| `skyCoinDrop` | `[min, max]` | ausente → fallback `balance.battleCoinRewardBase` | SkyCoin rolado ao matar |
| `rarityLuck` | number ≥ 0 | `0` | Eleva chances de raridade: `1 − (1 − chance)^(1 + luck)` |

`loot[]` continua controlando **se** o item dropa; `rarityLuck` só enviesa a raridade do gear.

### Raridades (`rarities/rarities.json`)

Array `rarities[]` com `id` (1–99), `name`, `chance` (0–1, independente), `multiplier` e `attributeCount`.
No drop o servidor rola cada raridade com `chance > 0` de forma independente e fica com a **maior id que passou**; se nenhuma passar → **Comum** (id 1, `chance: 0`, só fallback). A soma das chances pode passar de 100% — balance só editando este JSON.
Depois: `leveled = base × (1 + itemLevel/10)` (`itemLevel` = andar), então `finalStat = leveled × (stars + multiplier)` com `stars` ∈ 1…5.
`attributeCount` define quantos affixes únicos rolam (Comum 0; Lendário id 11 = 3; id 99 = 20). Valor do affix = `minValue × stars` (catálogo `attributes/item-attributes.json`, elegível via `type` do item × `compatibility`).
Campo legado `rarity` string em templates de item **não** governa o roll.

### Atributos de item (`attributes/item-attributes.json`)

Catálogo de affixes + mapa `typeRoles` (`weapon`→offense, `armor`→defense, …). Sem pools separados e sem tags no item — ao criar um atributo novo, só declare `compatibility`.
Snapshot de drop inclui `itemAttributes: [{ id, value }]` e espelha o valor em `stats`. Bags antigas sem o campo continuam válidas (sem migração).

### Qualidades (`qualities/qualities.json`)

Array `qualities[]` com `stars` (1–5), `name`, `colorStart` e `colorEnd` (`{ r, g, b }` 0–255).
Paleta clássica de RPG: cinza → verde → azul → roxo → laranja/ouro.
O par start/end permite gradiente estático ou efeitos futuros (arco-íris, pulse, etc.) no front.
No drop, `qualityName`, `colorStart` e `colorEnd` vão bakeados no snapshot junto com `stars`.

### Item na bag / equip (runtime)

Snapshot típico de equipamento:

- `instanceId`, `templateId`, `name`, `type`, `grip` (`oneHand`/`twoHand` em armas/escudos/focos), `itemLevel`, `stackable`, `qty`
- `rarityId`, `rarityName`, `stars`, `qualityName`, `colorStart`, `colorEnd`
- `baseStats` (cópia do template) e `stats` (já bakeados)
- `itemAttributes` (affixes rolados; ausente em drops legados)
- `assets`
- Ghost de duas mãos: `ghost: true`, `occupiedBy` (instanceId), `anchorSlot` — só visual; não soma stats

Materiais stackáveis (`scrap`) não rolam raridade/estrelas.

Campos de regen / atributos dinâmicos:

- Raças: `baseStats.hpRegenPerSec` = HP/s **bruto** (elf/human 1, ork 2)
- Classes: `hpRegenBonus` = HP/s bruto somado na create
- `attributes/core.json`: cada atributo tem `name`, `description`, `formulas[]`, `assets.card`
  - ex. fórmula `hpRegenPerSec * 0.05` → +0.05 HP/s por ponto de força
  - arte do card: Gemini no editor (`POST /api/editor/attributes/{id}/card`); ícones de item continuam PixelLab
- Alvos ausentes: semente `1`

Schemas: `.cursor/skills/conteudo-json-jogo/schemas.md`
