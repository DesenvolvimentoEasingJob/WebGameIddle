# 38 — Editor de monstros

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

UI completa para criar e editar monstros em `content/monsters/{id}.json`.

## Pré-requisitos

- Todo 37 concluído (scaffold + API FS)

## Schema (campos do formulário)

Alinhado a `conteudo-json-jogo/schemas.md` e arquivos atuais:

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | string | kebab-case; imutável após criar (rename = novo arquivo + delete) |
| `name` | string | |
| `level` | number | |
| `hp`, `attack`, `defense` | number | |
| `behavior` | string | ex.: `aggressive` |
| `resistances` / `weaknesses` | mapa string→number | editor chave/valor simples |
| `skills` | string[] | lista livre no MVP |
| `loot[]` | `{ itemId, chance, qty: [min,max] }` | `itemId` deve existir em `content/items` (aviso se não) |
| `assets.sprite` | string | path placeholder |

## Passos

1. Página `/monsters`: lista todos os monstros (id + name + level).
2. Ações: Novo | Editar | Duplicar | Excluir (com confirmação).
3. Formulário de create/edit com validação básica (id obrigatório, números ≥ 0).
4. Ao salvar: `PUT` via API FS → `content/monsters/{id}.json` (JSON indentado, camelCase).
5. Select de `itemId` no loot alimentado por `GET items` (pode estar vazio até o todo 39).
6. Preview do JSON gerado (opcional, útil para debug).

## Critérios de aceite

- [x] Criar monstro novo gera arquivo em `content/monsters/`
- [x] Editar monstro existente atualiza o mesmo arquivo
- [x] Excluir remove o JSON
- [x] JSON parseável e com `id` igual ao nome do arquivo
- [x] Lista reflete o disco após save/refresh

## Como ficou

Editor **genérico de propriedades** (nome × valor), reaproveitado pelas 3 pastas:

| Arquivo | Papel |
|---------|-------|
| `src/lib/jsonModel.ts` | Modelo de edição (texto/número/booleano/nulo/grupo/lista) + serialização validada |
| `src/components/JsonNodeEditor.tsx` | Linhas recursivas de propriedade; add/remover/reordenar; trocar tipo |
| `src/editors/ContentEditor.tsx` | Lista + toolbar (Salvar / Duplicar / Excluir / Ver JSON) + campo `id` |
| `src/lib/templates.ts` | Template de novo monstro/item/andar + campos de referência |

- `+ Novo` parte do template; `Duplicar` parte do arquivo aberto.
- `itemId` no loot tem autocomplete com ids reais de `content/items`.
- Validação no save: id kebab-case, número inválido, propriedade sem nome ou duplicada.

## Fora de escopo

- Upload de sprite / animações PixelLab
- Editor de skills/magias avançado
