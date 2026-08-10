# 08 — Teste: login funciona ponta a ponta

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Validar o fluxo home → cadastro → login → sessão antes de seguir para raça/classe.

## Pré-requisitos

- Todo 07 concluído
- Docker Compose no ar + `npm run dev`

## Passos (checklist manual)

1. Subir `docker compose up` e frontend.
2. Abrir home → Criar conta → preencher dados → sucesso.
3. Logout (se aplicável) → Entrar com as mesmas credenciais.
4. Confirmar `GET /api/auth/me` via Network ou tela de debug.
5. Recarregar F5: ainda autenticado.
6. Token inválido/expirado: redireciona para login.
7. Anotar bugs encontrados e corrigir **neste** todo antes de avançar.

## Critérios de aceite

- [x] Cadastro + login OK em ambiente local
- [x] Sessão sobrevive a refresh
- [x] Nenhum blocker conhecido de auth
- [x] Marcar este arquivo `STATUS: concluido` só depois do teste real

## Notas

Este todo é de verificação. Não comece seleção de raça com auth quebrada.
