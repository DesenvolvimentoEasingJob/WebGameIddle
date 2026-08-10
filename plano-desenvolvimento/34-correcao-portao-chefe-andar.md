# 34 — Correção: portão do chefe (taxa → libera próximo andar)

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Contexto / bug

O todo `26` entregou desafio de chefe com taxa + ×10 + ownership, mas **não amarra a progressão de andares** a essa luta. Na prática:

1. Auto-subida / `Enfrentar` percorre salas 1–10 do andar atual em modo normal (sem taxa).
2. Na sala 10 dá para farmar o chefe “fraco” de graça; a auto-subida para ali, mas o jogador pode voltar e repetir salas do mesmo andar sem fim.
3. `POST /api/tower/challenge/boss` debita `BOSS_CHALLENGE_FEE` e registra ownership, porém **não libera o próximo andar**.
4. `POST /api/tower/enter` aceita qualquer floor 1–10 sem checar progresso — e a UI só oferece “Entrar no Andar 1”.

Isso diverge do Game-base §2 e do desenho pretendido: salas do andar atual são farm (XP/loot/moedas); **só o desafio pago do chefe** abre o próximo andar.

## Objetivo

Separar claramente:

| Modo | Salas | Custo | Efeito |
|------|-------|-------|--------|
| Exploração / auto-subida | 1–9 do andar atual | nenhum | XP, loot, SkyCoin; **fica no andar** |
| Desafio de chefe (portão) | sala 10 / ação explícita | `BOSS_CHALLENGE_FEE` | chefe com **atributos normais**; vitória → **libera próximo andar** |
| Registro de nome | sala 10 / ação explícita | `BOSS_CHALLENGE_FEE` | chefe ×`BOSS_CHALLENGE_ATTR_MULT` ou clone do dono; vitória → ownership (regra do 26) |

## Pré-requisitos

- Todos 17, 19, 25, 26 concluídos (código já existe; este todo corrige o fluxo)

## Decisões (fixadas neste todo)

1. **Salas 1–9:** combate normal (`StartBattleAsync`). Auto-climb avança 1→2→…→9; ao vencer a 9 com auto ligado, **volta para a sala 1 do mesmo andar** (loop de farm). Nunca debita taxa. Nunca muda de andar.
2. **Sala 10:** não é combate normal gratuito. `StartBattleAsync` na sala 10 deve falhar com mensagem clara (“use o desafio de chefe”). Liberar sala 10 = ter vencido a sala 9 (`maxUnlockedRoom >= 10` só como “pode desafiar”, não como farm).
3. **Desafios (`ChallengeBossAsync` / `ChallengeRegistryAsync`):** exigem estar no andar, ter liberado o portão (sala 9 vencida / `maxUnlockedRoom >= 10`), saldo ≥ fee. Ambos pagam fee, dão share ao dono e aplicam `DEATH_XP_PENALTY` na derrota. **Só o de registro usa ×`BOSS_CHALLENGE_ATTR_MULT`/clone** — juntar os dois numa luta só torna a progressão impossível nos níveis baixos (ver "Correção de rota").
4. **Vitória no desafio:** gravar `maxUnlockedFloor = max(maxUnlockedFloor, floor + 1)` (cap no último andar de conteúdo, hoje 10). Não teleportar o jogador; só liberar. O registro (26) grava ownership.
5. **`EnterAsync(floor)`:** só permite `1 ≤ floor ≤ maxUnlockedFloor` (inicial: `maxUnlockedFloor = 1`). Ao entrar, reset de salas do andar visitado (`room = 1`, `maxUnlockedRoom = 1`) **exceto** se quisermos preservar progresso por andar — para MVP: reset ao entrar é ok (farm recomeça no andar escolhido).
6. Persistência no JSON do personagem (`tower.maxUnlockedFloor`) + refletir em stats/rankings se já usam `lastFloor`.
7. Auto-climb **nunca** chama challenge/boss e **nunca** paga fee.

## Passos

1. Estender estado `tower` com `maxUnlockedFloor` (default 1); expor no `TowerStateDto` / tipo front.
2. Ajustar `ResolveRoomBattleAsync` / `StartBattleAsync`: bloquear sala 10; auto-advance na vitória da 9 com auto → `room = 1` (mesmo floor).
3. Ajustar `ChallengeBossAsync`: pré-condição sala 9 liberada; na vitória incrementar `maxUnlockedFloor`.
4. Ajustar `EnterAsync`: validar floor ≤ `maxUnlockedFloor`.
5. UI Torre: remover “Enfrentar” na sala 10; botão único de desafio com confirmação da taxa; mostrar fee real (de config/debug ou campo no state — sem hardcode no front se possível: retornar `bossChallengeFee` no state ou ownership).
6. Textes: loop auto 1–9; challenge sem saldo falha; vitória libera floor+1; enter em floor bloqueado falha; sala 10 sem challenge rejeitada.
7. Atualizar `docs/balance.md` / `docs/smoke-test.md` com o portão de progressão.

## Critérios de aceite

- [x] Auto-subida só cicla salas 1–9 do andar atual; nunca sobe de andar sozinha
- [x] Não existe luta normal gratuita na sala 10
- [x] Desafiar chefe debita `BOSS_CHALLENGE_FEE` antes da luta
- [x] Vitória no desafio libera o próximo andar (`maxUnlockedFloor`)
- [x] `enter` em andar > `maxUnlockedFloor` retorna erro
- [x] Ownership / share / penalidade de morte do 26 continuam válidos
- [x] Multiplicadores só via env (sem hardcode de fee/attrs)

## O que foi entregue

**Backend** (`TowerService.cs`):

- `tower.maxUnlockedFloor` no JSON do personagem (default 1) + `DefaultTower()`.
- `ResolveMaxUnlockedFloorAsync`: retroalimenta personagens antigos a partir de `FloorOwnerships`
  (quem já registrou o andar N tem N+1 liberado), com clamp na quantidade de andares em `content/floors`.
- `StartBattleAsync`: rejeita sala 10 (“use o desafio pago”); vitória na sala 9 com auto → volta à sala 1.
- `MoveAsync`: navegação limitada às salas 1–9.
- `ChallengeBossAsync`: pré-condição `maxUnlockedRoom >= 10` (salas 1–9 vencidas), posiciona na sala 10,
  e na vitória grava `maxUnlockedFloor` + evento `floor_unlocked`.
- `EnterAsync`: valida `floor <= maxUnlockedFloor`; sem hardcode de 1–10 (usa o conteúdo existente).
- `TowerStateDto`: novos campos `MaxUnlockedFloor` e `BossChallengeFee` (taxa vem do env, não do front).
- Helpers puros `NextRoomAfterVictory` / `UnlockedFloorAfterBossWin` cobertos por testes.

**Frontend**: `TowerState` tipado com os campos novos; `TowerPanel` sem “Enfrentar” na sala do chefe,
botão de desafio mostra a taxa real e só habilita com o portão liberado; auto-subida pode ser desligada
no meio do loop (`stopAutoRef`).

**Testes**: `TowerProgressionTests` (loop 1–9, unlock do próximo andar, cap por conteúdo). 12/12 verdes.

## Correção de rota (mesma data)

A primeira versão deste todo fundiu portão de progressão e registro de nome numa luta só, com
×`BOSS_CHALLENGE_ATTR_MULT`. Em jogo isso ficou **invencível**: chefe do andar 1 (HP 50 / atk 7 / def 3)
vira HP 500 / atk 70 / def 30, enquanto um personagem nível 8 tem ~81 de HP e ~10 de dano — o combate
estoura o limite de 60 turnos muito antes de derrubar o chefe. Duas taxas foram pagas sem chance de vitória.

O Game-base separa as duas coisas: a taxa é para **desafiar o chefe** (linha 142) e o ×10 é para
**registrar o nome** (linha 138). Implementação final:

- `POST /api/tower/challenge/boss` — taxa, chefe com atributos normais, vitória libera o próximo andar.
- `POST /api/tower/challenge/registry` — taxa, chefe ×`BOSS_CHALLENGE_ATTR_MULT` ou clone do dono,
  vitória grava ownership (e também libera o andar, já que é um superconjunto da luta normal).
- Ambos: portão exige salas 1–9 vencidas, share do dono e penalidade de morte.
- Chefe já vencido no andar atual desabilita o botão de progressão (evita gastar taxa à toa).

## Notas

- Navegação visual entre andares já liberados = todo **35**.
- Geração IA de andares além do 10 continua fora do MVP.
