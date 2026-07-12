# Loot System Roadmap — SkySpire

> Arquivo de referência para implementação sequencial. Atualizar checkboxes ao concluir cada item.

**Última atualização:** 2026-07-12 — Sprints 1–6 implementados  
**Baseline:** MVP com 5 raridades → **99 raridades**, drop server-side com seed, integridade e economia básica

---

## Arquitetura alvo

```
Mob morre / batch → LootSeedService → ItemDropService
  → RarityRoller (cascade/weights)
  → LootPool → ItemResolver
  → ItemInstanceBuilder (level + rarity mult + affixes)
  → ItemIntegrityService (hash + assinatura)
  → Inventário
```

---

## Sprint 1 — Core fixes ✅

- [x] `LootScaling.cs` — fórmulas de level/rarity multiplier
- [x] `ItemInstanceBuilder.cs` — extrai lógica de `BuildDropInstance`
- [x] Level na instância + `levelMultiplier = 1 + level * 0.01`
- [x] `common.affixRolls = [0, 0]`
- [x] `DroppedItemDto` + tipos TS com `level`, `dropMeta`, `integrity`
- [x] `CopyInstanceEntry` propaga novos campos
- [x] Testes unitários (`SkySpire.Api.Tests`)

---

## Sprint 2 — Raridades escaláveis ✅

- [x] `rarity-tiers.json` — lista completa (99 tiers)
- [x] `tools/generate-rarities.mjs` — gera `rarities.json`
- [x] `RarityRoller.cs` — roll por pesos gerados
- [x] `RarityDefinition.DropWeight` + affixes via fórmula
- [x] Remover `rarityWeights` de mobs
- [x] `LootConfigBuilder` — expõe `dropWeight`
- [x] UI: cor por `order` (`loot-config.ts`)

---

## Sprint 3 — Seed determinística + batch ✅

- [x] `LootSeedService.cs`
- [x] `dropMeta` em instâncias
- [x] `POST tower/combat-batch`
- [x] `drop-simulator.ts`
- [x] `tower-combat-loop.ts` usa batch no farm contínuo

---

## Sprint 4 — Pool de atributos ✅

- [x] `additional-stats.json` expandido (19 affixes T1/T2)
- [x] Pools por categoria em `item-types.json`
- [x] Peso mínimo 1% no `ItemAffixRoller`

---

## Sprint 5 — Integridade + IA + pools por andar ✅

- [x] `ItemIntegrityService.cs`
- [x] `Loot` em `appsettings.json`
- [x] IA só para `rarityOrder >= 20`
- [x] Pools `floor-1-10`, `floor-1-20`

---

## Sprint 6 — Economia ✅

- [x] `TradeService` + `POST game/trade`
- [x] `attack-gem` + `POST game/apply-gem`
- [x] Level visível no inventário

---

## Comandos úteis

```bash
node tools/generate-rarities.mjs
node tools/simulate-drops.mjs 1000000
dotnet test backend/SkySpire.Api.Tests
```

---

## Próximos passos

- [ ] Trade P2P entre usuários
- [ ] UI para trade e apply-gem
- [ ] Affixes T3–T6
- [ ] Fila de arte IA
