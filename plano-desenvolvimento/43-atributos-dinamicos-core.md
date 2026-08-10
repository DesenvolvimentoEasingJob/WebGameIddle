# 43 — Atributos dinâmicos via `core.json` + `hpRegenPerSec` em baseStats

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Semente em `baseStats`; fórmulas do `core.json` empurram qualquer alvo; treino/level usam o mesmo motor; taxa de regen = valor **calculado**.

## O que foi entregue

- `hpRegenPerSec` nas raças em `baseStats`; fator core calibrado `* 0.0005`
- `StatCalculator`: seed `1` para alvos do core ausentes
- `HpService`: taxa = stats calculados; remove top-level legado; migração
- Create: semente da raça + `class.hpRegenBonus`
- Front: painel de treino mostra `hpRegenPerSec` calculado; refresh após treino
- Testes de fórmula strength → regen e seed de alvos

## Critérios de aceite

- [x] Treinar força aumenta `hpRegenPerSec` calculado
- [x] Semente em `baseStats`; runtime não depende do campo solto da raça
- [x] Alvo só no core → semente `1`
- [x] Level-up e treino no mesmo motor
- [x] Front usa taxa calculada (revalida no treino)
- [x] `dotnet test` verde
