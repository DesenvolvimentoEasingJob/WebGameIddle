# 07 — Páginas de login e cadastro

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Conectar o front à API de auth: formulários simples, token salvo, redirect pós-login.

## Pré-requisitos

- Todos 05 e 06 concluídos

## Passos

1. Páginas `/login` e `/register` (forms tipados).
2. Client `api/auth.ts` com register/login/me.
3. Guardar JWT (ex.: `localStorage` ou cookie httpOnly se preferir depois — começar simples).
4. Contexto/hook `useAuth` mínimo.
5. Após login bem-sucedido → redirect para `/race` (ou `/hub` se já tiver personagem — por agora `/race` ou rota intermediária).
6. Tratar erros de API na UI.

## Critérios de aceite

- [x] Dá para cadastrar e logar pela UI
- [x] Token persiste ao recarregar a página
- [x] Usuário autenticado acessa rota protegida de teste
- [x] Logout limpa sessão

## Notas

UI básica e fácil de manter; polish visual leve alinhado à home.
