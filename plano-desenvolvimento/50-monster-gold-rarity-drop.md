# 50 — Gold range e rarity luck no monstro (schema + backend)

STATUS: concluido
CONCLUIDO_EM: 2026-08-07

## Objetivo

Cada monstro declara no próprio JSON quanto SkyCoin pode dropar e um bônus de raridade no roll de gear. Bosses/especiais têm `rarityLuck` maior → chance real de raridades altas. Preview no `roomEncounter` para o painel informativo.

## Por que agora

Hoje:

- SkyCoin de vitória = `BATTLE_COIN_REWARD_BASE × FLOOR_REWARD_MULT^(andar-1)` (por **batalha**, não por monstro).
- Raridade de gear = pesos globais de `rarities.json` iguais para rato e boss.

Bosses não têm vantagem de loot além da tabela `loot[]` (chance de item), e o gold não é autorável por mob.

## Schema (monstro)

Campos novos opcionais (ausente = comportamento legado seguro):

```json
{
  "id": "rat",
  "skyCoinDrop": [1, 3],
  "rarityLuck": 0,
  "loot": [ ... ]
}
```

```json
{
  "id": "floor-boss-1",
  "skyCoinDrop": [15, 30],
  "rarityLuck": 2.5,
  "loot": [ ... ]
}
```

| Campo | Tipo | Default | Significado |
|-------|------|---------|-------------|
| `skyCoinDrop` | `[min, max]` ints ≥ 0 | ausente → 0 deste monstro (fallback de batalha no 50) | Range inclusivo de SkyCoin ao matar |
| `rarityLuck` | number ≥ 0 | `0` | Enviesa o pick de raridade para IDs mais altos |

`loot[]` continua igual (chance/qty/itemId). Luck **só** afeta o roll de raridade do gear (não materiais stackáveis).

## Fórmula `rarityLuck`

Em `RarityService.PickAsync(rng, luck)`:

```text
effectiveWeight(id) = baseWeight(id) × (1 + luck)^(id - 1)
```

- `luck = 0` → pesos iguais aos de hoje.
- `luck > 0` → raridades altas ganham peso relativo (boss).
- Sem hardcode de tabelas por monstro; autor só ajusta um número.

Alternativa rejeitada no MVP: overrides por `rarityId` no JSON (verboso demais com 99 raridades).

## Gold na vitória

1. Por inimigo morto: `roll = rng.Next(min, max+1)` de `skyCoinDrop`.
2. `coinsGained = Σ rolls` dos mortos.
3. Se **nenhum** monstro da luta tiver `skyCoinDrop`, fallback legado: `BattleRewardForFloor(floor)` (não quebrar economia atual até o todo 51 preencher conteúdo).
4. Creditar via `EconomyService.CreditAsync` (já existe no `TowerService` pós-batalha).
5. Evento `coins` na timeline com o total.

Desafio de chefe / registro: somar o drop do boss (e clone, se aplicável) da mesma forma.

## Backend — passos

1. Documentar schema em `content/README.md` + `schemas.md` (skill).
2. `RarityService.PickAsync(Random rng, double luck = 0, ...)`.
3. `ItemRollService.CreateFromTemplateAsync(..., double rarityLuck = 0)` passa luck ao pick.
4. `CombatService.ApplyLootAsync` lê `rarityLuck` do monstro e passa no roll de gear.
5. `CombatService` (ou helper) `RollSkyCoinDrop(monster)` → int.
6. `TowerService` / resultado de batalha: somar gold por inimigo; fallback se soma=0 e nenhum campo presente.
7. Estender `EncounterMonsterDto` + `EncounterMonster` (front) com:
   - `skyCoinDropMin`, `skyCoinDropMax` (ou array)
   - `rarityLuck`
8. `RoomEncounterResolver.BuildAsync` preenche esses campos.
9. Testes unitários:
   - `luck=0` → distribuição compatível com pesos base (seed fixa).
   - `luck` alto → P(raridade alta) sobe vs `luck=0`.
   - `skyCoinDrop [5,5]` → sempre 5; ausente → 0 no helper.

## Critérios de aceite

- [x] Schema documentado; campos opcionais não quebram monstros atuais
- [x] Gear drop usa `rarityLuck` do monstro no pick
- [x] Vitória credita Σ `skyCoinDrop` dos mortos (ou fallback de andar)
- [x] Preview `roomEncounter` inclui gold range + luck
- [x] Testes cobrindo luck e gold range

## Notas

- Sistema de raridade atual usa `chance` (top-down), não `weight`. Luck: `1 − (1 − chance)^(1 + luck)`.
- Multiplicadores de economia (`BATTLE_COIN_REWARD_BASE`) são **fallback** até o 51; depois permanecem como safety net.
- Não misturar luck com chance de dropar o item (`loot[].chance`) — são eixos separados.
