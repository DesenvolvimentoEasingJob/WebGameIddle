# Templates de schema (MVP)

Campos podem evoluir; manter `id` estável.

## Config global (`content/config/global.json`)

Um arquivo. Editável no fronend-editor → Config. Secrets ficam no `.env`.

```json
{
  "id": "global",
  "generative": {
    "monsterImageComplement": "pixel art, transparent background, side view, monster facing left (west)"
  },
  "balance": {
    "xpBase": 100,
    "xpScale": 1.2,
    "xpScaleStepEvery": 10,
    "xpScaleStep": 0.1,
    "floorDifficultyMult": 2.0,
    "floorRewardMult": 1.5,
    "bossChallengeAttrMult": 10,
    "bossChallengeFee": 50,
    "floorOwnerFeeShare": 0.1,
    "deathXpPenalty": 0.1,
    "trainingCostBase": 10,
    "trainingGoldScale": 1.3,
    "battleCoinRewardBase": 2,
    "hpRegenGlobalMult": 1.0,
    "hpDefeatRevivePct": 0.5,
    "combatBaseActionMs": 1000,
    "combatMaxDurationMs": 60000,
    "combatRegenTickMs": 1000,
    "combatDamageNoise": 0,
    "combatArmorMidDef": 4800,
    "combatArmorPower": 0.31,
    "uniqueDropChance": 0.005,
    "uniqueDropEnabled": true,
    "uniqueRarityChanceMult": 7,
    "uniqueStars": 5,
    "uniqueOpenAiTimeoutMs": 8000,
    "uniquePixelLabTimeoutMs": 45000
  }
}
```

Prompt sprite PixelLab: prefixo fixo + `generative.monsterImageComplement` + monstro.`description` + monstro.`generativeComplement` (se houver).

## Raça (`content/races/{id}.json`)

```json
{
  "id": "human",
  "name": "Humano",
  "description": "",
  "baseStats": {
    "strength": 10,
    "intelligence": 10,
    "agility": 10,
    "hpBase": 100,
    "mpBase": 50,
    "dmgBase": 10,
    "capBase": 40,
    "hpRegenPerSec": 1
  },
  "levelGain": { "strength": 1, "intelligence": 1, "agility": 1, "hpBase": 3 },
  "equipmentSlots": [
    { "name": "head", "itemType": ["helmet"], "boxSize": 1, "row": 1, "order": 2 },
    { "name": "mainHand", "itemType": ["weapon", "shield"], "boxSize": 1, "row": 2, "order": 3 },
    { "name": "ring1", "itemType": ["ring"], "boxSize": 10, "row": 1, "order": 1 }
  ],
  "blessings": [],
  "limitations": [],
  "assets": { "portrait": "/assets/races/human.png" }
}
```

`boxSize` controla o tamanho visual do slot no inventário em escala `1…10`: `1` = tamanho cheio, `10` = menor (mesmo tamanho que o antigo `4`, ou seja ~1/4 do base). Valores intermediários interpolam em passos iguais. Copiado para o JSON do personagem na create.

`row` e `order` controlam o paper doll em `/hub/status`: `row` = linha do corpo (1 = cabeça, 2 = tronco/mãos, …); `order` = posição esquerda→direita na linha. O inventário ainda ignora esses campos.

`baseStats.hpRegenPerSec` é HP **bruto** por segundo (como `dmgBase`), não fração do máximo.
O valor efetivo = semente + fórmulas do `attributes/core.json`.
Inclua `defBase` na raça se quiser defesa inicial; ausente no personagem ⇒ defesa 0 em combate.

## Atributos (`content/attributes/core.json`)

Um único arquivo. Cada key treinável é um objeto (array legado de fórmulas ainda é aceito pelo motor):

```json
{
  "id": "core",
  "strength": {
    "name": "Força",
    "description": "Flavor do card de treino.",
    "formulas": ["hpBase * 0.2", "dmgBase * 0.4"],
    "assets": { "card": "/api/assets/attributes/strength.png" }
  }
}
```

- `formulas`: strings do motor (`target * fator` ou `target - n`)
- `assets.card`: arte do card (gerada no editor via **Google Gemini**, não PixelLab)
- Campo opcional de editor: `artPrompt` (não afeta o jogo)

## Classe (`content/classes/{id}.json`)

```json
{
  "id": "warrior",
  "name": "Guerreiro",
  "description": "",
  "allowedRaces": ["*"],
  "statFocus": ["strength"],
  "levelGain": { "strength": 1 },
  "startingSkills": [],
  "hpRegenBonus": 1,
  "assets": { "icon": "/assets/classes/warrior.png" }
}
```

`hpRegenBonus`: HP/s bruto somado à semente na create do personagem.

## Andar (`content/floors/floor-01.json`)

```json
{
  "id": "floor-01",
  "number": 1,
  "name": "",
  "description": "",
  "theme": "",
  "difficulty": 1,
  "itemLevel": 1,
  "rooms": [
    { "number": 1, "type": "wave", "monsterIds": ["slime"] },
    { "number": 3, "type": "wave", "monsterIds": ["slime", "rat"] },
    { "number": 6, "type": "wave", "monsterIds": ["slime", "rat", "bat"] },
    { "number": 9, "type": "wave", "monsterIds": ["slime", "slime", "rat", "bat"] }
  ],
  "boss": { "monsterId": "", "gateFee": 50, "registryFee": 50, "attrMult": 10 },
  "ownerPlayerId": null,
  "ownerSnapshotPath": null,
  "assets": { "background": "/assets/floors/01.png" }
}
```

`rooms[].monsterIds` = lista de **spawn**: cada entrada é um inimigo (1–4). Repita o id para
vários do mesmo tipo, ou misture tipos. Sem hardcode de quantidade no servidor.

## Monstro

```json
{
  "id": "slime",
  "name": "Slime",
  "description": "Gosma verde translúcida de caverna, olhos negros e corpo gelatinoso que balança ao se mover.",
  "generativeComplement": "extra slime drip, soft edges",
  "level": 1,
  "hp": 30,
  "baseStats": {
    "dmgBase": 5,
    "defBase": 1,
    "attackSpeed": 1.0,
    "critChance": 0,
    "critDamage": 1.5,
    "dodgeChance": 0,
    "hpRegenPerSec": 0
  },
  "bonusDamage": {},
  "bonusDefense": {
    "fireResistance": 0
  },
  "skills": [],
  "behavior": "aggressive",
  "skyCoinDrop": [1, 2],
  "rarityLuck": 0,
  "loot": [{ "itemId": "slime-gel", "chance": 0.5, "qty": [1, 2] }],
  "assets": {
    "sprite": "/assets/monsters/slime.png",
    "width": 56,
    "height": 56,
    "animations": {
      "idle": {
        "frames": [
          "/assets/monsters/slime-idle-0.png",
          "/assets/monsters/slime-idle-1.png"
        ],
        "frameWidth": 64,
        "frameHeight": 64,
        "frameCount": 2,
        "fps": 6,
        "direction": "east"
      }
    }
  }
}
```

| Campo | Significado |
|-------|-------------|
| `description` | Flavor + aparência (PT); obrigatório no editor — enriquece Gerar sprite / Animar |
| `generativeComplement` | Opcional; **acrescenta** a `config/global.json` → `generative.monsterImageComplement` |
| `baseStats.attackSpeed` | Cadência (1.0 = uma ação por `combatBaseActionMs`); **não** multiplica dano. Default 1 |
| `baseStats.critChance` / `critDamage` | Crítico só se **ambos** existirem; multiplica só o dano base |
| `baseStats.dodgeChance` | Chance de anular golpe recebido |
| `baseStats.hpRegenPerSec` | HP bruto/s em combate (ticks como o player). Ausente ⇒ 0 |
| `bonusDamage` | Mapa `{ tipo: { dmgBase, counter } }` — elemental vs `bonusDefense[counter]` |
| `skyCoinDrop` | Range inclusivo de SkyCoin ao matar; ausente → fallback de andar no server |
| `rarityLuck` | Enviesa raridade do gear: `effectiveChance = 1 − (1 − chance)^(1 + luck)` |
| `assets.width` / `assets.height` | Tamanho de apresentação no combat footer (px). Default server/front: 56. Chefes de andar: tipicamente 112 (2×) |
| `assets.animations.idle` | Loop do combat footer (PixelLab Pro); opcional — sem isso usa `sprite` estático |

Legado `attack`/`defense`/`weaknesses` ainda é lido no server como fallback; conteúdo MVP usa `baseStats` + `bonusDamage`/`bonusDefense`.

Monstro **não** passa por `StatCalculator`/`core.json` — scalars de combate são autorados direto no JSON.

### Combate data-driven (personagem e monstro)

```json
{
  "baseStats": {
    "dmgBase": 30,
    "defBase": 10,
    "attackSpeed": 1.2,
    "critChance": 0.1,
    "critDamage": 1.5,
    "dodgeChance": 0.05,
    "hpRegenPerSec": 1.5
  },
  "bonusDamage": {
    "fireDamage": {
      "dmgBase": 20,
      "counter": "fireResistance"
    }
  },
  "bonusDefense": {
    "fireResistance": 15
  }
}
```

| Campo ausente | Efeito |
|---------------|--------|
| `defBase` | defesa 0 |
| `attackSpeed` | cadência 1.0 |
| `critChance` / `critDamage` | sem crítico |
| `dodgeChance` | sem esquiva |
| `hpRegenPerSec` | sem regen em combate (monstro) |
| counter em `bonusDefense` | bônus elemental integral (ignora armadura %) |

Defesa física: `reduction = def^p / (def^p + mid^p)` (`combatArmorMidDef` / `combatArmorPower` em `global.json`). Crit multiplica **somente** o dano base. Ruído RNG: `combatDamageNoise`.
Magias/skills mid-fight: backlog (fora do todo 57–59).

## Atributos de item (`attributes/item-attributes.json`)

Affixes rolados no drop (separados do treino em `core.json`).

```json
{
  "id": "item-attributes",
  "typeRoles": {
    "weapon": ["offense"],
    "armor": ["defense"],
    "ring": ["utility", "offense"]
  },
  "lifeSteal": {
    "name": "Roubo de Vida",
    "category": "heal",
    "compatibility": ["offense"],
    "minValue": 1,
    "requires": ["dmgTotal", "hpBase"],
    "formulas": ["hpBase = hpBase + (dmgTotal / 100) * lifeSteal"]
  }
}
```

| Campo | Papel |
|-------|--------|
| `typeRoles` | `item.type` → papéis (`offense` / `defense` / `utility`) |
| `compatibility` | Em quais papéis o atributo pode rolar |
| `minValue` | Base; no drop `value = minValue × stars` |
| `category` | Ordem no hit: `defense` / `damage` / `heal` / `chance` |
| `requires` | Se faltar no contexto → atributo inerte |
| `formulas` | Assignments `alvo = expressão` (motor allowlist) |

## Item template (`content/items/{id}.json`)

```json
{
  "id": "wooden-sword",
  "name": "Espada de Madeira",
  "description": "",
  "type": "weapon",
  "grip": "oneHand",
  "itemLevel": 1,
  "stackable": false,
  "stats": { "dmgBase": 3 },
  "assets": { "icon": "/assets/items/wooden-sword.png" }
}
```

`stats` = base bruta. Raridade/qualidade/affixes são rolados no drop e bakeados na bag.
Campo legado `rarity` (string) é ignorado pelo motor de roll.
Elegibilidade de affix usa só `type` + `typeRoles` / `compatibility` (sem tags no item).

### Grip (mãos)

Para `weapon` / `shield` / `focus`:

| `grip` | Slots de mão |
|--------|--------------|
| `oneHand` | 1 |
| `twoHand` | 2 |

Opcional: `handSlots` (número) sobrescreve a contagem (ex.: arma especial).
Slots de mão = qualquer `equipmentSlots` da raça cujo `itemType` aceite weapon/shield/focus.
Ao equipar `twoHand`, o item real fica no slot âncora e os demais recebem um **ghost** (`ghost: true`, `occupiedBy`, `anchorSlot`) — cópia visual sem stats. Uma raça com 4 braços (4 slots de mão) pode usar 2× `twoHand`.

## Raridades (`content/rarities/rarities.json`)

Roll por sucesso máximo: cada `chance` é independente; vence a maior `id` que passar; se nenhuma → Comum (`chance: 0`). Balance só neste JSON (sem hardcode no backend).

```json
{
  "rarities": [
    { "id": 1, "name": "Comum", "chance": 0, "multiplier": 1, "attributeCount": 0 },
    { "id": 2, "name": "Incomum", "chance": 0.2, "multiplier": 2, "attributeCount": 1 },
    { "id": 11, "name": "Lendário", "chance": 0.0008, "multiplier": 11, "attributeCount": 3 },
    { "id": 99, "name": "O Um Acima de Tudo", "chance": 1e-9, "multiplier": 99, "attributeCount": 20 }
  ]
}
```

`attributeCount`: quantos affixes únicos rolar (Lendário ≥ 3; id 99 = 20).
Bake dos stats do template: `leveled = base × (1 + itemLevel/10)`; `final = leveled × (stars + multiplier)` com stars 1–5.
Affixes: `value = minValue × stars` (não usam o multiplier de raridade).

## Qualidades (`content/qualities/qualities.json`)

Cores clássicas de RPG por qualidade (estrelas). `colorStart`/`colorEnd` em RGB 0–255 para gradientes e efeitos.

```json
{
  "qualities": [
    {
      "stars": 1,
      "name": "Simples",
      "colorStart": { "r": 157, "g": 157, "b": 157 },
      "colorEnd": { "r": 220, "g": 220, "b": 220 }
    },
    {
      "stars": 5,
      "name": "Lendário",
      "colorStart": { "r": 255, "g": 128, "b": 0 },
      "colorEnd": { "r": 255, "g": 215, "b": 60 }
    }
  ]
}
```

| Stars | Nome | Cor típica |
|-------|------|------------|
| 1 | Simples | Cinza/branco |
| 2 | Refinado | Verde |
| 3 | Raro | Azul |
| 4 | Épico | Roxo |
| 5 | Lendário | Laranja/ouro |

## Snapshot na bag (runtime `data/bags/`)

Equipamento único guarda o objeto completo (`instanceId`, `rarityId`, `stars`, `qualityName`, `colorStart`, `colorEnd`, `stats` bakeados, etc.).
Materiais stackáveis mantêm `qty` e não rolam raridade.
