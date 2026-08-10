# 40 — Editor de andares

STATUS: concluido
CONCLUIDO_EM: 2026-08-09

## Objetivo

UI completa para criar e editar andares em `content/floors/floor-XX.json`, com seleção por sala (9 farm + boss), add/remove de monstros e taxas do JSON (`gateFee` / `registryFee` / `attrMult`).

## Pré-requisitos

- Todos 37–39 concluídos (precisa listar monstros/itens existentes)

## Schema (campos do formulário)

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | string | padrão `floor-01` … |
| `number` | number | derivado do id; aviso se divergir |
| `name`, `description`, `theme` | string | |
| `difficulty`, `itemLevel` | number | |
| `rooms[]` | `{ number, type, monsterIds[] }` | exatamente 9 salas; `type` = `wave` |
| `boss.monsterId` | string | select de monstros existentes |
| `boss.gateFee` | number | taxa do portão |
| `boss.registryFee` | number | taxa do registro |
| `boss.attrMult` | number | multiplicador do chefe de registro |
| `ownerPlayerId` / `ownerSnapshotPath` | null | somente leitura |
| `assets.background` | string | path placeholder |

## Implementado

- `fronend-editor/src/lib/floorModel.ts` — parse/serialize/validate
- `fronend-editor/src/editors/FloorFormEditor.tsx` — tabs salas 1–9 + Boss
- `fronend-editor/src/editors/FloorsEditor.tsx` — lista, Novo, Duplicar, Salvar, JSON bruto
- Validação: refs de monstro, number único, salas 1–9

## Critérios de aceite

- [x] Criar/editar andar grava JSON válido em `content/floors/`
- [x] Referências a monstros inexistentes são bloqueadas com clareza
- [x] `gateFee` / `registryFee` / `attrMult` editáveis e persistidos
- [x] Andar novo/alterado é lido pela API do jogo sem rebuild

## Fora de escopo (este todo)

- Upload de background / tileset
- Geração IA de andares → todo **55**

## Próximo

- `55-editor-andar-ia-draft.md` — draft OpenAI (pacote floor + monsters + items)
