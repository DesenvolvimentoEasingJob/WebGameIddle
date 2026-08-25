# 33 — (Opcional) Drop de item único (OpenAI + PixelLab)

STATUS: concluido
CONCLUIDO_EM: 2026-08-11

## Objetivo

A cada monstro derrotado, chance global de dropar um **item único**: semente no loot normal do mob → flavor OpenAI → bake no server → ícone PixelLab → snapshot **só na bag** (não existe em `content/items/`).

Nome composto forçado: `"{TítuloTemático} de {NomePersonagem}"` (ex. **Espada de ossos de SukerBerg**).

Distinct do todo **53**/`54` (draft + ícone no **editor**). Este todo é **runtime de batalha**.

## Pré-requisitos

- Todos 46–49, 56 (snapshot bag, raridade, affixes) — concluídos
- Todo 22 (drops) — concluído
- Todo 50–52 (skyCoin / rarityLuck) — concluídos (loot normal inalterado quando único não dispara)
- `OPENAI_API_KEY` e chave PixelLab no `backend/.env`
- Serviços de referência: `ItemDraftService`, `ItemRollService`, `RarityService`, `PixelLabService`

## Config (`content/config/global.json` → balance)

| Campo | Default | Significado |
|-------|---------|-------------|
| `uniqueDropChance` | `0.005` | 0,5% por monstro morto |
| `uniqueDropEnabled` | `true` se chaves ok | Feature off → skip |
| `uniqueRarityChanceMult` | `7` | Multiplica a **chance** de cada raridade no pick do único (`min(1, chance × 7)`) — **não** fixa raridade id 7 |
| `uniqueStars` | `5` | Qualidade sempre máxima |
| timeouts OpenAI / PixelLab | (definir na implementação) | Não travar a batalha além do cap |

Override opcional via env. Documentar em `docs/balance.md`.

### Raridade do único (correção)

**Equivoco antigo:** fixar raridade id 7 (Heroico / multiplier 7).

**Regra correta:** no roll de raridade do item único, cada entrada do catálogo usa

```text
chanceEfetiva = min(1, chanceBase × uniqueRarityChanceMult)   // default mult = 7
```

e o pick top-down existente (`RarityService.PickFrom`) escolhe a **maior id** que passar — ou seja, bem mais chance de raridades altas, mas o resultado continua **aleatório** (Comum…99). O `multiplier` / `attributeCount` vêm da raridade **rolada**.

Qualidade (`stars`) continua fixa em **5** (máxima).

## Critérios de aceite

- [x] `uniqueDropChance` em global controla a chance (default 0,5%)
- [x] Único usa semente do loot normal (type / baseStats); não duplica essa semente como loot comum
- [x] Sem gear elegível na tabela → não cria único
- [x] Nome composto `… de {personagem}`; qualidade máxima (5★)
- [x] Raridade **rolada** com chances × `uniqueRarityChanceMult` (default 7) — **não** fixa id 7
- [x] Item só na bag; PNG em `assets/items/unique-*.png`; nada novo em `content/items/`
- [x] IA não define rarity/stars/multiplier/stats finais
- [x] Falha OpenAI/timeout: batalha e loot normal intactos
- [x] Chaves só no backend

## Implementação

- `UniqueItemDropService` + hook em `CombatService.ApplyLootAsync`
- `RarityService.PickFrom(..., chanceMult)`
- UI: badge Único no inventário/modal + `lore`
- Editor Config: campos unique*
- Testes: ComposeUniqueName + chanceMult

## Notas

Para testes locais: em `content/config/global.json` use `"uniqueDropChance": 1` (ou `0.2`) e recreie a API.
Requer `OPENAI_API_KEY` (e PixelLab opcional — senão placeholder).
