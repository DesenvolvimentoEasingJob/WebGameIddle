# System Patterns — SkySpire End

## Arquitetura de alto nível

```text
Browser (React/Vite)  --HTTP/JSON-->  SkySpire.Api (.NET 10)
                                           |-- PostgreSQL (contas, stats)
                                           |-- content/ (JSON RO)
                                           +-- data/ (characters + bags RW)
```

Autoridade: **API**. Front só autentica, exibe estado e anima eventos.

## Padrões estabelecidos

### API minimal + options

- Endpoints REST sob `/api/...`; `GET /health` obrigatório.
- Balance e secrets via IOptions (`GameBalanceOptions`, `AppSecretsOptions`).
- CORS estrito para origem Vite em dev.

### Conteúdo data-driven

- Pastas: `races/`, `classes/`, `monsters/`, `floors/`, `items/`, `attributes/`, `spells/`, `rarities/`, `item-types/`.
- Um arquivo por entidade com `id` estável.
- Fórmulas de atributo como strings interpretadas com allowlist (sem `eval` arbitrário) — planejado.
- Player data nunca em `content/`.

### Personagem ≠ bag

- Character JSON: stats, equip refs, progresso.
- Bag JSON: inventário.
- Ownership de andar: clone do character **sem** bag.

### Combate por eventos (planejado)

- Servidor calcula turns/hits/XP/loot.
- Resposta = timeline de eventos.
- Front reproduz; não recalcula dano.

### Plano sequencial

- Todos em `plano-desenvolvimento/NN-*.md`.
- Agente lê `PROXIMO.md` → implementa **um** todo → atualiza STATUS/INDEX/PROXIMO.
- Skills: `continuar-plano`, `conteudo-json-jogo`.

### Segurança

- Mutações econômicas/combate só no backend.
- JWT no MVP; users preparados para `firebase_uid`.
- HMAC de JSON personagem/bag (todo 30).
- Nunca commitir `.env`; keys só no backend.

## Estado da camada de código

| Camada | Status |
|--------|--------|
| Infra Docker + health | Implementado |
| Balance options | Implementado |
| Domain services / EF / Auth | Não iniciado |
| Content loaders / combat | Não iniciado |
| Frontend app | Não iniciado (todo 04) |

## Evolução esperada do backend

Crescimento natural a partir do projeto único `SkySpire.Api`:

1. Endpoints + services por domínio (auth, content, tower, combat, inventory…).
2. Persistência: EF ou SQL + file I/O para JSON.
3. Middleware JWT.
4. Possível split em pastas Domain/Application/Infrastructure quando o tamanho justificar — **não antecipar** sem necessidade do plano.
