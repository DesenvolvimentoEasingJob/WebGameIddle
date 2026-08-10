# 36b — Correção: barra de XP sempre cheia

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Contexto / bug

A sidebar mostrava `1.047/1.047` com a barra 100% cheia em qualquer nível, dando a impressão de que a progressão parou.

Causa: nenhuma API dizia ao front quanta XP falta para o próximo nível, então a barra usava o próprio XP como máximo:

```tsx
<StatBar label="XP" value={xp} max={Math.max(xp, 100)} tone="xp" />
```

Com `xp > 100` o máximo é sempre igual ao valor → 100%, e os dois números exibidos são o mesmo dado.

A curva do backend está **correta**: `XpService.XpRequiredForLevel` acumula `XP_SCALE` (+`XP_SCALE_STEP` a cada `XP_SCALE_STEP_EVERY` níveis), e `ApplyXp` só sobe de nível quando `xp >= need`. O personagem de teste (`DarklSuker`, Nv14, 1047 XP) precisa de 1361 XP — ou seja, estava em ~77%, não cheio.

## Objetivo

O requisito de XP do nível atual é calculado no servidor (é regra de balance) e exposto ao front, que só desenha a proporção.

## Passos

1. `XpService.XpRequiredForLevel` já existe — expor o valor, sem duplicar fórmula no front.
2. `TowerStateDto`: novo campo `XpToNextLevel`, resolvido pelo nível do personagem.
3. `GET /api/characters/me`: incluir `xpToNextLevel` (a sidebar usa esse fallback antes de entrar na torre).
4. Front: `TowerState`/`CharacterSummary` tipados; sidebar usa `xpToNextLevel` como máximo da barra.
5. `StatusPanel`: mostrar `XP: atual / necessário` para ficar coerente com a barra.

## Critérios de aceite

- [x] Barra de XP mostra `xp / xpToNextLevel` e enche proporcionalmente
- [x] O valor necessário cresce a cada nível (curva do env, sem fórmula no front)
- [x] Level up reseta a barra para perto de zero com um máximo maior
- [x] `dotnet test` verde (16 testes)

## O que foi entregue

- `TowerStateDto.XpToNextLevel`: `TowerService` injeta o `XpService` e resolve o requisito pelo
  nível do personagem em todo state devolvido.
- `GET /api/characters/me`: campo `xpToNextLevel` (fallback usado pela sidebar fora da torre).
- `CharacterSidebar`: barra de XP usa `xpToNextLevel` como máximo; `StatBar` com máximo
  desconhecido passa a renderizar vazia em vez de cheia.
- `StatusPanel` e cabeçalho do `TowerPanel`: exibem `XP atual / necessário`.
- Teste `Xp_Never_Sits_At_Or_Above_The_Level_Requirement`: garante a invariante que a barra reflete.

## Verificado

`GET /api/debug/config` com os defaults dá 805 / 1046 / 1360 / 1768 XP para os níveis 12–15.
O personagem `DarklSuker` (Nv14, 1047 XP) aparece em ~77%, não mais cheio.

## Notas

- Barras de HP/Mana continuam cheias de propósito: fora do combate não existe HP corrente persistido; elas mostram o máximo calculado.
- Sem mudança de balance: só exposição de um valor já calculado.
