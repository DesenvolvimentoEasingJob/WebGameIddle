# 10 — API de conteúdo (raças e classes)

STATUS: concluido
CONCLUIDO_EM: 2026-08-04

## Objetivo

Expor raças e classes lidas dos JSONs para o frontend.

## Pré-requisitos

- Todos 02 e 09 concluídos

## Passos

1. Serviço que lê arquivos de `content/races` e `content/classes`.
2. Endpoints:
   - `GET /api/content/races`
   - `GET /api/content/races/{id}`
   - `GET /api/content/classes`
   - `GET /api/content/classes/{id}` (opcional: filtrar por raça se houver restrição)
3. Cache em memória simples (reload em Development se quiser).
4. Tipar DTOs no backend.

## Critérios de aceite

- [x] Front (ou curl) lista raças/classes
- [x] Arquivo JSON novo na pasta aparece após restart (ou hot-reload se implementado)
- [x] 404 para id inexistente

## Notas

Não expor paths internos do filesystem ao cliente — só ids e URLs de assets.
