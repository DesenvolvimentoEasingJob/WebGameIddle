# 59 — Conteúdo: archetypes de métricas nos monstros

STATUS: concluido
CONCLUIDO_EM: 2026-08-11

## Objetivo

Cada monstro em `content/monsters/` com perfil jogável distinto via métricas já suportadas (sem rebalance cego total).

## Pré-requisitos

- Todo 57 + 58

## Diretrizes

| Archetype | Exemplos | Campos |
|-----------|----------|--------|
| Swarmer | bat, rat | `attackSpeed` > 1, `dmgBase` menor |
| Bruiser/boss | moss-crypt-lord, bosses | AS ≤ 1, mais HP/def |
| Elemental | ember-imp | `bonusDamage.fireDamage` + `counter: fireResistance` |
| Elusivo | wraith, echo-wraith | `dodgeChance` |
| Critter/assassin | mist-stalker, bandit | `critChance` + `critDamage` |
| Regen | slime, golem-scrap | `hpRegenPerSec` > 0 onde fizer flavor |

## Fora de escopo

- Magias / `behavior` como AI
- UI do jogo mostrando AS/crit (opcional depois)

## Critérios de aceite

- [x] JSONs válidos
- [x] Pelo menos um exemplo claro de cada archetype
- [x] Combate com AS/elemental/regen observável (teste ou manual)

## Exemplos aplicados

| Archetype | Exemplos |
|-----------|----------|
| Swarmer | bat AS 1.4, rat 1.35, ash-bat 1.5 |
| Bruiser/boss | moss-crypt-lord AS 0.7 + regen, iron-colossus |
| Elemental | ember-imp / mage-apprentice / slag-forgemaster `fireDamage` |
| Elusivo | wraith / echo-wraith dodge |
| Critter | bandit / mist-stalker crit |
| Regen | slime 1.5 HP/s, golem-scrap 2 |
