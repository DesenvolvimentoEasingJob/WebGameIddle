# Migração: combate por turnos → timeline com `atMs`

SSOT desta migração. Todos antigos de combate (`19`, `20`, `41`, `44`) descrevem o modelo por turnos; a execução segue este doc.

## Modelo

Servidor simula um **clock em ms** e devolve uma lista flat de eventos com `atMs`. Front: **um** `PlaybackClock` aplica estado + FX na ordem do array (sem N timers por personagem).

```text
0 ms     start / vitals
1000 ms  hit/crit  −35 no inimigo
1000 ms  hit       −35 no player
2000 ms  regen     +5 HP
```

API continua one-shot (`POST /api/tower/battle/start` etc.). Jogador não age mid-fight.

## Contrato `BattleEvent`

Campos existentes + **`atMs: number`** (obrigatório, ≥ 0). Empates no mesmo ms: ordem estável de emissão.

Sem campo `turn`. Sem `eventsByCharacter` como fonte de verdade.

## Clock (backend)

- Cada lutador vivo: `nextActAtMs`.
- `interval = combatBaseActionMs / max(attackSpeed, ε)`.
- `attackSpeed` = **cadência** (não multiplica dano).
- Regen: ticks a cada `combatRegenTickMs` com acumulador fracionário de `hpRegenPerSec`.
- Cap: `combatMaxDurationMs` (substitui 60 turnos).
- Pós-luta (`xp`, `loot`, `coins`, …): `atMs` monotônico ≥ instante do fim.

## Balance (`content/config/global.json` → `balance`)

| Campo | Significado |
|-------|-------------|
| `combatBaseActionMs` | Intervalo base de ação com `attackSpeed = 1.0` |
| `combatMaxDurationMs` | Duração máxima da simulação |
| `combatRegenTickMs` | Período dos ticks de regen em combate |
| `combatDamageNoise` | Ruído RNG no dano (inalterado) |

**Removido / obsoleto:** `combatTurnSeconds` (só fazia sentido com turno).

## Front

- Ordenar por `atMs`; um núcleo aplica `apply` + motion + floater no mesmo tick.
- Durante `playing`: sem regen cosmético rAF na barra de combate.
- Fora de combate: regen idle via `HpService` / UI ok.
- Sem `groupBattleEvents` turn-based (player → retaliações).

## Kill-list

- [x] Loop de turnos / `ApplyCombatTurnRegen` por turno
- [x] `attackSpeed` no dano (`CombatHitResolver`)
- [x] `combatTurnSeconds` como verdade
- [x] `groupBattleEvents` / rounds player→enemy
- [x] Regen rAF aplicando HP durante playback
- [x] Testes “player always first each turn” / AS no dano

## Fases

| Fase | Conteúdo |
|------|----------|
| 0 | Este doc + supersessão nos todos 19/20/41/44 |
| 1 | `atMs` no DTO / types |
| 2 | Clock backend + balance keys |
| 3 | Playback front por `atMs` |
| 4 | Limpeza kill-list + `docs/balance.md` |
| 5+ | Buff / cura / curse (fora da 1ª leva) |

## Fora da 1ª leva

Buff, cura por skill, curse, magias/skills mid-fight.
