# SkySpire End — Plano de Desenvolvimento

Plano sequencial baseado em `Game-base.txt`, adaptado para stack moderna.

## Como usar (continuar de onde parou)

1. Abra esta pasta `plano-desenvolvimento/`.
2. Veja o **STATUS** no índice abaixo (ou abra o próximo arquivo com `STATUS: pendente`).
3. Peça ao Cursor: *"Continue o próximo todo do plano"* ou *"Execute o todo XX"*.
4. Ao concluir um todo, marque no arquivo: `STATUS: concluido` e a data.
5. Só avance para o próximo quando os **critérios de aceite** estiverem ok.

## Decisões técnicas

| Camada | Tecnologia | Onde roda |
|--------|------------|-----------|
| Frontend | React + TypeScript (Vite) | Fora do container (dev local) |
| Backend | .NET 10 Web API | Docker |
| Banco | PostgreSQL | Docker |
| Conteúdo | Arquivos JSON (raças, classes, monstros, andares, itens…) | Volume / pasta no backend |
| Auth | JWT agora; schema preparado para Firebase (Apple/Google) depois | — |
| Arte | Pixel art 256×256; PixelLab Animate With Text Pro | Integração futura |
| Config de balance | Multiplicadores via `.env` (XP, dificuldade, bônus…) | Backend |

**Por que React+TS (não JS puro):** tipagem ajuda na manutenção dos eventos de combate, inventário e payloads JSON sem travar o projeto.

**Por que front fora do container:** iteração rápida de UI; só a API e o banco precisam de Docker no dia a dia.

**Adaptação do Game-base:** o documento original citava PHP + JS. Este plano usa **.NET 10 + React/TS**. Conceito do jogo permanece o mesmo.

## Escopo MVP (neste plano)

Incluído: home → login → raça → classe → personagem → torre (10 andares) → combate por eventos → XP → inventário/equip → **shell hub** (sidebar + painéis + combate persistente, todo 25b) → chefe/registro de andar → mercado básico → treinamento → rankings → segurança JSON assinada → env de balance.

Deixado para depois (como no Game-base): geração infinita de andares por IA, multiplayer/guildas, itens narrativos OpenAI (todo opcional no fim).

## Índice dos todos

| # | Arquivo | Status | Resumo |
|---|---------|--------|--------|
| 01 | `01-fundacao-repositorio.md` | concluido | Estrutura monorepo, gitignore, README |
| 02 | `02-backend-dotnet-docker.md` | concluido | API .NET 10 + Docker Compose + Postgres |
| 03 | `03-variaveis-ambiente-balance.md` | concluido | Env com multiplicadores do jogo |
| 04 | `04-frontend-react-vite.md` | concluido | App React+TS fora do Docker |
| 05 | `05-pagina-inicial.md` | concluido | Home / landing do jogo |
| 06 | `06-api-autenticacao.md` | concluido | Register/login JWT + tabela users |
| 07 | `07-paginas-login-cadastro.md` | concluido | UI login/cadastro + chamada API |
| 08 | `08-teste-login.md` | concluido | Checklist: login funciona ponta a ponta |
| 09 | `09-conteudo-json-base.md` | concluido | Pastas JSON: raças, classes, atributos |
| 10 | `10-api-conteudo-racas-classes.md` | concluido | Endpoints de conteúdo |
| 11 | `11-pagina-selecao-raca.md` | concluido | Escolha de raça |
| 12 | `12-pagina-selecao-classe.md` | concluido | Escolha de classe |
| 13 | `13-criacao-personagem.md` | concluido | Criar personagem + bag JSON |
| 14 | `14-hub-personagem.md` | concluido | Lobby pós-criação |
| 15 | `15-motor-atributos.md` | concluido | Cálculo dinâmico via JSON |
| 16 | `16-andares-json-manuais.md` | concluido | 10 andares manuais |
| 17 | `17-api-torre.md` | concluido | Entrar torre, salas, progresso |
| 18 | `18-pagina-torre.md` | concluido | UI torre / salas |
| 19 | `19-sistema-combate.md` | concluido | Combate server-side + eventos |
| 20 | `20-animacao-combate-front.md` | concluido | Front anima eventos |
| 21 | `21-xp-level.md` | concluido | XP, level up, fórmulas via env |
| 22 | `22-monstros-drops.md` | concluido | Monstros JSON + drops |
| 23 | `23-inventario-equipamentos.md` | concluido | API inventário / slots |
| 24 | `24-ui-inventario.md` | concluido | UI inventário e equipar |
| 25 | `25-economia-skycoin.md` | concluido | Moeda e fluxos básicos |
| 25b | `25b-layout-shell-persistente.md` | concluido | Shell: sidebar full-height, painéis, combate persistente |
| 26 | `26-chefe-morte-registro.md` | concluido | Chefe ×10, taxa, morte, ownership |
| 27 | `27-mercado.md` | concluido | Mercado venda direta |
| 28 | `28-campo-treinamento.md` | concluido | Treinar atributos base |
| 29 | `29-rankings-estatisticas.md` | concluido | Stats e rankings |
| 30 | `30-assinatura-json.md` | concluido | Assinar personagem/bag |
| 31 | `31-pixellab-assets.md` | concluido | Integração PixelLab / atlas |
| 32 | `32-polish-seguranca-docs.md` | concluido | Hardening e documentação |
| 33 | `33-opcional-itens-ia.md` | pendente | (Opcional) itens narrativos OpenAI |
| 34 | `34-correcao-portao-chefe-andar.md` | concluido | Correção: taxa no chefe libera próximo andar; auto só farm 1–9 |
| 35 | `35-correcao-navegacao-andares.md` | concluido | Correção: sidebar/UI navega andares já liberados |
| 36 | `36-correcao-taxas-desafio-json.md` | concluido | Correção: `gateFee`/`registryFee` por andar lidos do JSON |
| 36b | `36b-correcao-barra-xp.md` | concluido | Correção: barra de XP usa o requisito do nível (`xpToNextLevel`) |
| 37 | `37-editor-conteudo-fundacao.md` | concluido | App Vite em `fronend-editor/` + API local FS → `content/` |
| 38 | `38-editor-monstros.md` | concluido | Editor de propriedades (nome × valor) + CRUD monstros |
| 39 | `39-editor-itens.md` | concluido | Itens: formulário UX dedicado (stats, validação) |
| 40 | `40-editor-andares.md` | concluido | Andares: formulário por sala (9+boss) + validação |
| 41 | `41-correcao-barras-hp-combate.md` | concluido | Correção: barras HP combate + currentHp + regen por raça/classe |
| 42 | `42-grupos-monstros-salas.md` | concluido | Grupos só nas salas 3/6/9 (2/3/4) + UI multi-HP no footer |
| 43 | `43-atributos-dinamicos-core.md` | concluido | baseStats dinâmicos via core.json; hpRegenPerSec na semente + seed 1 |
| 44 | `44-combate-data-driven.md` | concluido | Combate via JSON: dmg/defBase, bonusDamage/Defense, crit/dodge só se existirem |
| 45 | `45-raridades-conteudo.md` | concluido | 99 raridades: multiplier ×10, P(99)=1e-9 |
| 46 | `46-item-snapshot-bag.md` | concluido | Bag/equip com snapshot completo + StatCalculator bakeado |
| 47 | `47-drop-roll-raridade.md` | concluido | Roll raridade/estrelas no drop + loot de gear |
| 48 | `48-ui-item-raridade.md` | concluido | UI inventário/modal/mercado com raridade e snapshot |
| 49 | `49-itemlevel-andar.md` | concluido | Bake: base × (1+lv/10) do andar, depois raridade/estrelas |
| 50 | `50-monster-gold-rarity-drop.md` | concluido | Schema + backend: `skyCoinDrop` + `rarityLuck` no monstro |
| 51 | `51-conteudo-gold-rarity-monstros.md` | concluido | Preencher gold/luck em todos os monstros JSON |
| 52 | `52-ui-monster-gold-rarity.md` | pendente | Painel do alvo + editor: gold range e rarity luck |
| 53 | `53-editor-item-ia-draft.md` | concluido | Editor: draft de item via OpenAI (gpt-4o-mini) |
| 54 | `54-editor-item-icon-pixellab.md` | concluido | Editor: ícone inventário via generate-image-v2 |
| 55 | `55-editor-andar-ia-draft.md` | concluido | Andares: draft IA (pacote floor+monsters+items) |
| 56 | `56-atributos-item-drop.md` | concluido | Affixes no drop: attributeCount + item-attributes + roll |

## Fase 2 — Editor de conteúdo (dev-only)

Ferramenta **somente para desenvolvedores** em `fronend-editor/` (pasta já criada).  
Não é o front do jogador. Não entra no Docker. Grava JSON direto em `content/`.

| Escopo agora (37–40, 53–55) | Depois |
|----------------------------|--------|
| Monstros, itens (form+IA+ícone), andares (form+IA) | Raças, classes, atributos |
| Paths de assets + ícone PixelLab (itens) | Upload + animações PixelLab |

## Correção pós-MVP fase 1

Os todos **34–36b** corrigiram progressão esquecida no fechamento 01–32:

- Auto-subida = farm no andar atual (salas 1–9 em loop), sem subir de andar sozinha.
- Desafio pago do chefe (`boss.gateFee` do andar) = portão que libera o próximo andar.
- Registro de nome = luta separada, com `boss.registryFee` e `boss.attrMult` próprios (ownership do 26).
- Sidebar + Torre = visitar qualquer andar ≤ `maxUnlockedFloor`.
- Barra de XP com o requisito real do nível (`xpToNextLevel` no state), sem fórmula no front.

## Convenção de status

Em cada arquivo, a primeira linha útil deve ser:

```text
STATUS: pendente | em_andamento | concluido | bloqueado
```

Ao marcar `concluido`, adicione:

```text
CONCLUIDO_EM: YYYY-MM-DD
```
