# 41 — Correção: barras de HP no combate + HP corrente + regen por raça/classe

STATUS: concluido
CONCLUIDO_EM: 2026-08-05
SUPERSEDED_BY: docs/migracao-combat-timeline.md

## Contexto / bugs

1. Footer de combate sem barra do monstro / player.
2. Sidebar: `value={hp} max={hp}` → sempre cheia.
3. Sem HP corrente nem regeneração; combate sempre inicia no máximo.

## O que foi entregue

- Conteúdo: `hpRegenPerSec` nas raças (ork 0.04, human 0.025, elf 0.012) e `hpRegenBonus` nas classes (warrior +0.01, ranger +0.005, mage 0).
- Env: `HP_REGEN_GLOBAL_MULT`, `HP_DEFEAT_REVIVE_PCT`.
- `HpService`: regen por tempo, migração lazy, revive na morte.
- `CombatService`: eventos `vitals` / `hpAfter` / `maxHp`; persiste `currentHp`.
- `TowerState` + `/characters/me`: `currentHp`, `maxHp`, `hpRegenPerSec`.
- Startup: `MigrateExistingCharactersHpAsync` corrige players existentes (HP cheio + assinatura).
- Front: barras no `CombatDock`; sidebar usa corrente/máximo; `playEvents` atualiza HP.

## Critérios de aceite

- [x] Barras no footer (player + monstro) acompanham hits
- [x] Sidebar mostra corrente/máximo
- [x] Regen usa raça+classe; ork > human > elf
- [x] Personagens antigos migram com HP cheio na 1ª carga / startup
- [x] Front não envia HP como verdade
- [x] `dotnet test` verde (22 testes)
