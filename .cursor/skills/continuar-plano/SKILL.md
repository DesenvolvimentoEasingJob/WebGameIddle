---
name: continuar-plano
description: Continua o plano numerado do SkySpire End (todos em plano-desenvolvimento). Use when the user says continue o plano, próximo todo, execute o todo, retomar desenvolvimento, or asks what the next development step is.
---

# Continuar plano SkySpire

## Workflow

1. Ler `plano-desenvolvimento/PROXIMO.md`
2. Ler `plano-desenvolvimento/00-INDEX.md`
3. Abrir o arquivo do todo em **Arquivo atual**
4. Se `STATUS: concluido`, achar o próximo `pendente` e atualizar `PROXIMO.md`
5. Marcar todo atual: `STATUS: em_andamento`
6. Implementar **apenas** esse todo (passos + critérios de aceite)
7. Ao terminar:
   - `STATUS: concluido`
   - `CONCLUIDO_EM: YYYY-MM-DD`
   - Atualizar tabela em `00-INDEX.md`
   - Apontar `PROXIMO.md` para o próximo pendente
8. Resumir ao usuário o que foi feito e qual é o próximo todo

## Regras

- Não pular números sem pedido explícito
- Não implementar vários todos na mesma resposta salvo pedido
- Se faltar pré-requisito, parar e avisar
- Secrets: nunca commitar `.env`
