# 09 — Conteúdo JSON base (raças, classes, atributos)

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Criar a estrutura de pastas JSON do Game-base com conteúdo inicial jogável (poucas raças/classes).

## Pré-requisitos

- Todo 01 concluído (pasta `content/`)

## Passos

1. Criar sob `content/`:
   - `races/` — um JSON por raça
   - `classes/` — um JSON por classe
   - `attributes/` — mapa do que cada atributo fornece (ex.: strength → hpBase, dmgBase…)
   - `rarities/`, `item-types/`, `spells/` (esqueleto vazio ou 1 exemplo)
2. Definir **2–3 raças** e **2–3 classes** mínimas com: nome, descrição, atributos base, CAP, slots de equipamento, bênçãos/limitações, path de asset.
3. Documentar schema em `content/README.md` (campos obrigatórios).

## Critérios de aceite

- [x] JSONs válidos e consistentes entre si
- [x] Raça define peculiaridades (ex.: slots extras) conforme Game-base
- [x] `attributes` descreve fórmulas em strings interpretáveis depois pelo motor
- [x] Sem lógica de servidor ainda neste todo (só dados)

## Notas

Flexibilidade JSON é o coração do design — investir no schema agora evita retrabalho.
