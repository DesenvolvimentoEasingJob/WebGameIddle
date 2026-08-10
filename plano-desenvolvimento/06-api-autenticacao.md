# 06 — API de autenticação

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Implementar cadastro/login no backend com JWT e tabela de usuários preparada para Firebase no futuro.

## Pré-requisitos

- Todos 02 e 03 concluídos

## Passos

1. Criar tabela `users` (EF Core ou migrations):
   - `id`, `email`/`username`, `password_hash`
   - `character_json_path` (nullable até criar personagem)
   - campos futuros: `firebase_uid`, `auth_provider` (nullable)
2. Endpoints:
   - `POST /api/auth/register`
   - `POST /api/auth/login` → JWT
   - `GET /api/auth/me` (autorizado)
3. Hash de senha (ASP.NET Identity PasswordHasher ou BCrypt).
4. Validação básica de input.

## Critérios de aceite

- [x] Registrar usuário persiste no Postgres
- [x] Login retorna JWT válido
- [x] `/me` rejeita sem token e aceita com token
- [x] Schema admite evolução para Apple/Google/Firebase

## Notas

Ainda sem personagem. Só conta.
