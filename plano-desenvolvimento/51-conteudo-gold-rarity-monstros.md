# 51 — Conteúdo: gold e rarityLuck nos monstros

STATUS: concluido
CONCLUIDO_EM: 2026-08-07

## Objetivo

Preencher `skyCoinDrop` e `rarityLuck` em todos os `content/monsters/*.json` com valores coerentes (farm baixo, boss/especial alto).

## Pré-requisitos

- Todo 50 concluído (schema + motor)

## Diretrizes de balance (ponto de partida — ajustar no playtest)

| Tipo | Exemplos | `skyCoinDrop` | `rarityLuck` |
|------|----------|---------------|--------------|
| Lixo / early farm | rat, bat, slime | `[1, 2]` | `0` |
| Mid farm | wolf, skeleton, bandit | `[2, 5]` | `0` – `0.25` |
| Elite / tema | mist-stalker, throne-guard | `[6, 12]` | `0.5` – `1` |
| Floor boss 1–5 | floor-boss-N | `[15, 30]` | `1.5` – `2.5` |
| Floor boss 6–10 | floor-boss-N | `[25, 50]` | `2.5` – `4` |

Escalar levemente com `level` do monstro se fizer sentido; não usar env aqui — o autor edita o JSON.

## Passos

1. Atualizar stubs/templates no editor (`fronend-editor`) se o form de monstro já lista campos — senão deixar para o 52.
2. Patch em massa nos JSON de monstros (MVP ~22 arquivos).
3. Validar JSON parse.
4. Smoke: matar rat vs floor-boss-1 e comparar coins + raridade média (seed/log).
5. Atualizar `docs/balance.md` com a nota: gold principal = monstro; env = fallback.

## Critérios de aceite

- [x] Todo monstro em `content/monsters/` tem `skyCoinDrop` e `rarityLuck`
- [x] Bosses têm luck e gold claramente acima do farm do mesmo andar
- [x] Batalha sem fallback de andar na maioria dos casos (campos presentes)
- [x] `content/README.md` / schemas alinhados aos valores de exemplo

## Notas

Após este todo, o fallback `BattleRewardForFloor` quase não dispara — manter só para monstro legado/quebrado.
