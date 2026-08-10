---
name: conteudo-json-jogo
description: Cria e edita JSONs de conteúdo do SkySpire (raças, classes, monstros, andares, itens, atributos, magias, raridades). Use when adding game content, editing content/*.json, designing races/classes/floors/monsters/items, or implementing content schemas.
---

# Conteúdo JSON do jogo

## Pastas

| Pasta | Uso |
|-------|-----|
| `content/races/` | Uma raça por arquivo |
| `content/classes/` | Uma classe por arquivo |
| `content/monsters/` | Monstros |
| `content/floors/` | Andares (floor-01 …) |
| `content/items/` | Itens |
| `content/attributes/` | O que cada atributo fornece |
| `content/spells/` | Magias |
| `content/rarities/` | Raridades |
| `content/qualities/` | Qualidade/estrelas (cores RGB) |

Dados de jogador **não** vão em `content/` — usar `data/characters` e `data/bags`.

## Regras ao criar/editar

1. `id` estável (kebab-case ou snake_case — manter o padrão já usado na pasta)
2. Incluir campos de asset (`sprite`, `atlas`, URL) mesmo com placeholder
3. Fórmulas como strings (`"hpBase * 0.2"`) em `attributes/core.json` → `formulas[]` (objeto por atributo; array legado ainda ok)
4. Referências cruzadas devem existir (andar → ids de monstro válidos)
5. Validar JSON (parse) antes de concluir
6. Documentar campos novos em `content/README.md` se o schema crescer

## Exemplos mínimos

Ver [schemas.md](schemas.md) para templates.
