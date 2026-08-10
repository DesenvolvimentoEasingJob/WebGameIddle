# 36 — Correção: taxas de desafio separadas e lidas do JSON do andar

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Contexto / bug

O JSON do andar tem `boss.challengeFee` e `boss.attrMult` desde o todo 16, mas **o backend nunca leu esses campos**. De todo o bloco `boss` só se usa `monsterId` (`CombatService.ResolveMonsterId`). A taxa cobrada em `TowerService.RunChallengeAsync` vinha sempre de `BOSS_CHALLENGE_FEE` (env, default 50), e o mesmo valor voltava no state como `bossChallengeFee`.

Resultado prático: editar `challengeFee` para 100 em `content/floors/floor-02.json` não mudava nada — o front continuava mostrando e o backend continuava cobrando 50.

Segundo problema: os dois desafios do portão da sala 10 são mecânicas diferentes e compartilhavam **uma única taxa**:

- **Portão de progressão** (`/challenge/boss`): chefe com atributos normais; vitória libera o próximo andar.
- **Registro de nome** (`/challenge/registry`): chefe ×`attrMult` ou clone do dono; vitória grava seu nome no andar.

## Objetivo

O JSON é a verdade sobre o andar: as taxas dos dois desafios são campos separados em `boss`, e o backend respeita o que está no arquivo. As variáveis de ambiente ficam só como default de quem omitir o campo (andares antigos/gerados).

## Regras

| Campo do JSON | Usado por | Fallback |
|---------------|-----------|----------|
| `boss.gateFee` | desafio de progressão (libera o próximo andar) | `boss.challengeFee` → `BOSS_CHALLENGE_FEE` |
| `boss.registryFee` | desafio de registro de nome / dono | `boss.challengeFee` → `BOSS_CHALLENGE_FEE` |
| `boss.attrMult` | multiplicador do chefe **só** no registro | `BOSS_CHALLENGE_ATTR_MULT` |

- `boss.challengeFee` continua aceito como taxa única legada (compatibilidade), mas os andares do repo passam a declarar os dois campos.
- Fee sempre ≥ 0; valor inválido cai no fallback.
- `FLOOR_OWNER_FEE_SHARE` e `DEATH_XP_PENALTY` seguem valendo para os dois desafios.

## Passos

1. **Conteúdo:** nos 10 `content/floors/*.json`, trocar `challengeFee` por `gateFee` + `registryFee` (migração: o valor antigo vale para os dois).
2. **Backend `TowerService`:** ler as regras do JSON do andar (`ResolveRules`), cobrar `gateFee` ou `registryFee` conforme o `ChallengeKind`, e usar `attrMult` do andar no registro.
3. **Ledger:** separar o motivo do débito — `boss_gate_fee` e `floor_registry_fee`.
4. **`TowerStateDto`:** trocar `BossChallengeFee`/`BossChallengeAttrMult` por `BossGateFee`, `FloorRegistryFee` e `RegistryAttrMult`, resolvidos **do andar atual**.
5. **Front:** `TowerState` tipado com os três campos; `TowerPanel` mostra a taxa certa em cada botão/confirmação.
6. **Docs:** `docs/balance.md`, `docs/smoke-test.md` e o schema da skill de conteúdo.

## Critérios de aceite

- [x] Mudar `gateFee` no JSON muda o custo cobrado e o exibido no botão "Enfrentar chefe"
- [x] Mudar `registryFee` no JSON muda o custo do desafio de registro, sem afetar o portão
- [x] Andar sem os campos novos continua funcionando com `challengeFee` ou com a env
- [x] Extrato de SkyCoin distingue `boss_gate_fee` de `floor_registry_fee`
- [x] `dotnet test` verde (15 testes)

## O que foi entregue

- `content/floors/*.json`: `challengeFee` virou `gateFee` + `registryFee` nos 10 andares
  (valor antigo replicado nos dois; andar 2 fica com 100/100).
- `TowerService.ReadChallengeRules(floorJson, defaultFee, defaultAttrMult)`: estático e testável;
  ordem de precedência campo específico → `challengeFee` → env, ignorando valores negativos ou
  não numéricos.
- `RunChallengeAsync`: cobra `gateFee` ou `registryFee` conforme o `ChallengeKind`, usa
  `boss.attrMult` do andar no registro, débito com motivo próprio e evento de taxa rotulado.
  Fee `0` não gera débito nem evento.
- `ToDtoAsync`: state resolve as taxas do andar atual (reaproveita o `floorJson` de quem já leu);
  `TowerStateDto` agora tem `BossGateFee`, `FloorRegistryFee` e `RegistryAttrMult`.
- Front: `TowerState` tipado com os três campos; `TowerPanel` mostra a taxa correta em cada botão,
  título e confirmação, e o botão de registro passa a exibir o próprio custo.
- Testes `FloorChallengeRulesTests`: override do JSON, taxa legada única e fallback de campo inválido.
- Docs: `docs/balance.md` (nova seção), `docs/smoke-test.md` (passo 7c) e o schema de andar da skill
  `conteudo-json-jogo`.

## Notas

- Não é rebalanceamento: a migração preserva os valores atuais de cada andar.
- Multiplicador de dificuldade por andar (`FLOOR_DIFFICULTY_MULT`) continua no env; só as taxas viraram conteúdo.
