# 33 — (Opcional) Itens narrativos com OpenAI

STATUS: pendente

## Objetivo

Em drops especiais, pedir nome/descrição/história à OpenAI; números continuam no servidor.

## Pré-requisitos

- Todos 22 e 03 concluídos
- `OPENAI_API_KEY` configurada

## Passos

1. Detectar drop especial (raridade/regra).
2. Montar prompt com contexto: andar, player, raça/classe, monstro, tipo, raridade, qualidade, attrs já calculados.
3. Parsear JSON narrativo (nome, descrição, aparência, material, história…).
4. Mesclar com attrs numéricos do sistema; salvar item único.
5. Fallback se API falhar (template local).

## Critérios de aceite

- [ ] IA não define dano/defesa
- [ ] Item único persiste e aparece na bag
- [ ] Timeout/falha não quebra a batalha

## Notas

Game-base marca geração infinita de andares para depois; este todo é só itens narrativos e pode ficar para pós-MVP.
