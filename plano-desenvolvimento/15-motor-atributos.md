# 15 — Motor de atributos

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Implementar no backend o cálculo dinâmico de atributos a partir dos JSONs (Game-base §3).

## Pré-requisitos

- Todos 03, 09 e 13 concluídos

## Passos

1. Parser/avaliador seguro de expressões simples (`hpBase * 0.2`, etc.) — sem eval arbitrário perigoso.
2. Aplicar:
   - atributos fundamentais (str/int/agi)
   - multiplicador de nível (via env)
   - bônus de itens (quando existirem)
3. Serviço `StatCalculator` usado por combate, treino e UI de ficha.
4. Endpoint `GET /api/characters/me/stats` com stats derivados.

## Critérios de aceite

- [x] Mudar JSON de `attributes` altera resultado sem recompilar fórmulas hardcoded
- [x] Atributo ausente no personagem não quebra (só não aplica)
- [x] Level influencia multiplicador conforme env
- [x] Testes unitários das fórmulas principais

## Notas

Segurança: só operadores/números/nomes de stats allowlisted.

