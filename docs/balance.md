# Balance do SkySpire End

Fonte de verdade dos multiplicadores jogáveis: [`content/config/global.json`](../content/config/global.json)
(campo `balance`), editável no **fronend-editor → Config**. A API lê via `GameConfigService`.

Secrets e infra continuam no `backend/.env` (`JWT_*`, `HMAC_*`, API keys, `DB_CONNECTION`, paths).

**Override opcional:** se uma variável de ambiente de balance existir no processo, ela **ainda sobrescreve**
o JSON (compat deploy). Defaults do código só entram se o campo faltar no JSON.

Em Development: `GET http://localhost:8080/api/debug/config` mostra os valores efetivos (sem secrets)
e o complemento generativo de monstro.

## Campos em `global.json` → `balance`

| Campo JSON | Env override (opcional) | Default | Significado |
|------------|-------------------------|---------|-------------|
| `xpBase` | `XP_BASE` | `100` | XP necessária do nível 1 → 2 |
| `xpScale` | `XP_SCALE` | `1.2` | Escala base da curva de XP |
| `xpScaleStepEvery` | `XP_SCALE_STEP_EVERY` | `10` | A cada N níveis, a escala sobe |
| `xpScaleStep` | `XP_SCALE_STEP` | `0.1` | Quanto a escala sobe (ex.: 1.2 → 1.3 no Nv11) |
| `floorDifficultyMult` | `FLOOR_DIFFICULTY_MULT` | `2.0` | Dificuldade vs andar anterior (dobra) |
| `floorRewardMult` | `FLOOR_REWARD_MULT` | `1.5` | Escala o fallback de SkyCoin: `battleCoinRewardBase × mult^(andar-1)` |
| `bossChallengeAttrMult` | `BOSS_CHALLENGE_ATTR_MULT` | `10` | Atributos do chefe no registro — **fallback** de `boss.attrMult` |
| `bossChallengeFee` | `BOSS_CHALLENGE_FEE` | `50` | Taxa dos desafios — **fallback** de `boss.gateFee`/`boss.registryFee` |
| `floorOwnerFeeShare` | `FLOOR_OWNER_FEE_SHARE` | `0.10` | % da taxa que vai para o dono do andar |
| `deathXpPenalty` | `DEATH_XP_PENALTY` | `0.10` | % do XP do nível atual perdida na morte (desafio) |
| `trainingCostBase` | `TRAINING_COST_BASE` | `10` | Custo do 1º treino de um atributo (sem `lastCost`) |
| `trainingGoldScale` | `TRAINING_GOLD_SCALE` | `1.3` | Próximo custo = `lastCost × trainingGoldScale` por atributo |
| `battleCoinRewardBase` | `BATTLE_COIN_REWARD_BASE` | `2` | **Fallback** de SkyCoin por vitória se nenhum monstro da luta tiver `skyCoinDrop` |
| `hpRegenGlobalMult` | `HP_REGEN_GLOBAL_MULT` | `1.0` | Escala a regen de HP (raça + classe em `content/`) |
| `hpDefeatRevivePct` | `HP_DEFEAT_REVIVE_PCT` | `0.5` | Fração do HP máx. ao reviver após morte |
| `combatTurnSeconds` | `COMBAT_TURN_SECONDS` | `1.0` | Segundos simulados por turno para regen em batalha |
| `combatDamageNoise` | `COMBAT_DAMAGE_NOISE` | `0` | Amplitude do ruído RNG no dano (`rng × noise`). Crit/dodge/def/bônus = JSON |

Obsoleto (crescimento agora é `levelGain` no conteúdo): `LEVEL_ATTR_MULT_AT_1`, `LEVEL_ATTR_FACTOR`, `LEVEL_ATTR_CAP`.

## Generative (`global.json` → `generative`)

| Campo | Uso |
|-------|-----|
| `monsterImageComplement` | Acrescentado ao prompt PixelLab de sprite (junto com `description` do monstro) |

Por monstro, opcional: `generativeComplement` em `content/monsters/{id}.json` — **acrescenta** ao global (não substitui).

## Combate data-driven (todo 44)

Golpe = dano base + bônus elementais + ruído. **Sem** crit/dodge/def inventados no C#.

```text
baseDealt = max(0, atk.dmgBase − def.defBase)   # sem defBase → 0
se critChance+critDamage no atacante e roll: baseDealt × critDamage   # só o base
cada bonusDamage[tipo]: max(0, dmg − bonusDefense[counter]) ou integral se sem counter
total = baseDealt + Σ bônus + (rng × combatDamageNoise)
```

Dodge só se o **defensor** tiver `dodgeChance` no JSON.

## Crescimento por nível (`levelGain`)

No level-up, o server **soma** `race.levelGain` + `class.levelGain` em `baseStats` do JSON do personagem
(persistido — sem multiplicador global de nível no `StatCalculator`).

| Raça | Por nível |
|------|-----------|
| human | strength+1, intelligence+1, agility+1, hpBase+3 |
| elf | intelligence+1, agility+1, hpBase+2, mpBase+2 |
| ork | strength+1, hpBase+5, dmgBase+1 |

| Classe | Por nível |
|--------|-----------|
| warrior | strength+1 |
| mage | intelligence+1 |
| ranger | agility+1 |

## Regen de HP (raça + classe)

`hpRegenPerSec` é HP **bruto** por segundo (como `dmgBase`), não % do máximo.

```text
semente = race.baseStats.hpRegenPerSec + class.hpRegenBonus
efetiva = semente + Σ fórmulas do core.json   (× hpRegenGlobalMult na semente)
regen   = efetiva × segundos desde lastHpAt   (clamp no maxHp)
```

Base atual:

| Raça | `hpRegenPerSec` | Classe | `hpRegenBonus` |
|------|-----------------|--------|----------------|
| ork | 2 | warrior | +1 |
| human | 1 | ranger | +0.5 |
| elf | 1 | mage | +0 |

Ex.: elfo mago inicia em ~1 HP/s (+ força via core).

**Em combate:** ao fim de cada turno o server aplica `hpRegenPerSec × combatTurnSeconds`
(default `1.0`) e emite evento `regen`. Assim 2 HP/s vs 1 de dano por turno vence lutas longas.
Fora de combate: regenera pelo tempo real desde `lastHpAt` (front anima fluido).

## SkyCoin de monstro (todos 50–51)

Fonte principal: `skyCoinDrop: [min, max]` no JSON do monstro (soma dos mortos na vitória).
`rarityLuck` eleva as chances de raridade no gear (`1 − (1 − chance)^(1 + luck)`).
`battleCoinRewardBase` / `floorRewardMult` só entram se **nenhum** monstro da luta tiver `skyCoinDrop`.

## Portão de progressão (todo 34)

Subir de andar depende **só** do desafio pago do chefe. Progressão e registro de nome são
lutas **separadas** (Game-base §2: a taxa é para desafiar o chefe; o ×10 é para registrar o nome):

| Modo | Endpoint | Custo | Inimigo | Efeito |
|------|----------|-------|---------|--------|
| Farm / auto-subida | `POST /api/tower/battle/start` (salas 1–9) | — | monstro da sala | XP, loot, SkyCoin; auto cicla 9 → 1 no mesmo andar |
| Chefe do andar | `POST /api/tower/challenge/boss` | `boss.gateFee` do andar | chefe com atributos normais | libera o próximo andar |
| Registro de nome | `POST /api/tower/challenge/registry` | `boss.registryFee` do andar | chefe ×`boss.attrMult` ou clone do dono | grava seu nome no andar + share de taxas |

Ambos os desafios exigem as salas 1–9 vencidas, aplicam `deathXpPenalty` na derrota e pagam
`floorOwnerFeeShare` ao dono do andar.

## Taxas por andar são conteúdo, não env (todo 36)

O JSON do andar é a verdade sobre o custo dos seus desafios:

```json
"boss": { "monsterId": "floor-boss-2", "gateFee": 100, "registryFee": 100, "attrMult": 10 }
```

| Campo | Cobrado em | Fallback |
|-------|-----------|----------|
| `gateFee` | desafio do chefe (subir de andar) | `challengeFee` → `bossChallengeFee` |
| `registryFee` | desafio de registro de nome | `challengeFee` → `bossChallengeFee` |
| `attrMult` | chefe do registro (não afeta o portão) | `bossChallengeAttrMult` |

`GET /api/tower/state` devolve `bossGateFee`, `floorRegistryFee` e `registryAttrMult` já resolvidos
para o andar atual — o front nunca calcula taxa. No extrato, `boss_gate_fee` e `floor_registry_fee`
são motivos distintos.

`tower.maxUnlockedFloor` no JSON do personagem guarda o andar máximo liberado; `POST /api/tower/enter`
recusa andares acima dele. Personagens antigos são retroalimentados pelos andares que já possuem.

## Grupos de monstros (por sala)

A quantidade e os tipos vêm do conteúdo: `rooms[].monsterIds` é a **lista de spawn**.
Cada entrada = um inimigo na luta (pode repetir o mesmo id ou misturar tipos). Máximo 4
por sala; lista vazia cai no fallback `slime`. O chefe continua 1v1 via `boss.monsterId`.

Convenção dos andares 1–10 (não é regra de código): salas 3/6/9 costumam ter 2/3/4 slots.

Cada monstro vivo ataca no próprio turno (eventos `hit` com `slot` 0–3). XP/loot somam por
monstro derrotado. O front só anima o que o server envia.

## Regen de HP no personagem

`hpRegenPerSec` é valor **bruto** (HP por segundo), como `dmgBase` — **não** é % do HP máximo.

```text
baseStats.hpRegenPerSec   → semente (elf/human 1, ork 2; + class.hpRegenBonus na create)
+ fórmulas do core.json   → ex. strength * 0.05 HP/s por ponto
= taxa efetiva (HP/s)

regen no tempo (fora de combate) = taxa × segundos
regen por turno (em combate)     = taxa × combatTurnSeconds
```

Sementes típicas: elfo/humano `1`, ork `2`. Guerreiro `+1`, ranger `+0.5`.
Alvos novos só no `core` e ausentes em `baseStats` nascem com semente `1`.
Em batalha o server regenera ao fim de cada turno (evento `regen`) — decisivo em lutas longas.

## Amostra XP (defaults)

XP necessária para subir **a partir** do nível N:

| Nível | XP para o próximo (approx) |
|-------|----------------------------|
| 1 | 100 |
| 2 | 120 |
| 3 | 144 |
| 10 | ~516 |
| 11 | ~670 (scale passa a 1.3) |

## Secrets (não são balance — ficam no `.env`)

| Variável | Uso |
|----------|-----|
| `DB_CONNECTION` | Postgres (Compose também define `ConnectionStrings__Default`) |
| `JWT_SECRET` | Auth JWT |
| `HMAC_SECRET` | Assinatura de JSONs (todo 30) |
| `PIXELLAB_API_KEY` / `PIXEL_API_KEY` | PixelLab (fallback aceita o nome antigo) |
| `OPENAI_API_KEY` | Itens narrativos (todo 33, opcional) |
| `GOOGLE_GEMINI_API_KEY` | Cards de atributo (editor) |

## Como testar

1. Altere `balance.xpBase` em `content/config/global.json` (ou no editor Config)
2. `docker compose up -d --force-recreate api` (se a API já monta `content/`, basta reiniciar ou aguardar reload)
3. `curl http://localhost:8080/api/debug/config` → `xpBase` deve refletir o JSON
4. (Opcional) Defina `XP_BASE=200` no `.env` e recree a API — env **vence** o JSON
