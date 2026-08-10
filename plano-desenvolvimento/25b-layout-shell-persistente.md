# 25b — Layout shell: sidebar, painéis e combate persistente

STATUS: concluido
CONCLUIDO_EM: 2026-08-05

## Objetivo

Refatorar o hub pós-login em um shell de 3 zonas (padrão site com menu lateral full-height), para o jogador batalhar em auto mesmo navegando Status ou Inventário.

## Pré-requisitos

- Todos 14, 18, 20, 24 e 25 concluídos

## Conceito de UX

```text
┌──────────────┬─────────────────────────────┐
│ Sidebar      │ Main (painel do menu)       │
│ full height  │ Status | Inventário | Torre │
│ avatar, nav, ├─────────────────────────────┤
│ HP/XP/stats  │ Dock: combate + log eventos │
│ SkyCoin      │ (só coluna principal)       │
└──────────────┴─────────────────────────────┘
```

- **Sidebar:** ocupa 100% da altura da viewport; menus + resumo do personagem; logout no rodapé.
- **Main:** só o conteúdo do menu ativo (`Outlet`).
- **Dock inferior:** palco personagem × inimigo + log; permanece montado ao trocar de menu. É **somente visualização** (badge de estado, andar/sala, auto ON/OFF) — todos os controles ficam no painel Torre.

## Passos realizados

1. Extrair estado de torre/combate de `TowerPage` para `GameSessionProvider` (`frontend/src/game/GameSessionContext.tsx`).
2. Criar `GameShell` + `CharacterSidebar` + `CombatDock`.
3. Painéis: `StatusPanel` (`/me` + `/me/stats`), `TowerPanel` (andares/salas/controles), `InventoryPanel`.
4. Rotas aninhadas sob `/hub`; redirects de `/tower` e `/inventory`.
5. CSS grid em `global.css`: sidebar `grid-row: 1 / -1`; dock só na coluna `main`.

## Rotas

| Rota | Painel |
|------|--------|
| `/hub` | redirect → `/hub/status` |
| `/hub/status` | dados completos do personagem |
| `/hub/inventory` | inventário / equip |
| `/hub/tower` | andares, salas, entrar, auto-subida |
| `/tower`, `/inventory` | redirect para as rotas novas |

## Arquivos-chave

| Arquivo | Papel |
|---------|--------|
| `frontend/src/game/GameSessionContext.tsx` | Sessão torre/combate (não desmonta ao mudar menu) |
| `frontend/src/components/game/GameShell.tsx` | Layout: sidebar \| Outlet \| CombatDock |
| `frontend/src/components/game/CharacterSidebar.tsx` | Nav + resumo |
| `frontend/src/components/game/CombatDock.tsx` | Palco + eventos + status (sem botões) |
| `frontend/src/pages/panels/StatusPanel.tsx` | Status completo |
| `frontend/src/pages/panels/TowerPanel.tsx` | Controles da torre (sem palco) |
| `frontend/src/pages/panels/InventoryPanel.tsx` | Bag / equip |
| `frontend/src/pages/HubPage.tsx` | Gate de personagem + provider + shell |
| `frontend/src/App.tsx` | Rotas aninhadas |
| `frontend/src/styles/global.css` | Classes `.game-shell`, `.game-sidebar`, `.combat-dock` |

## Critérios de aceite

- [x] Trocar Status ↔ Inventário ↔ Torre não reinicia animação/log de combate
- [x] Auto-subida continua com o usuário no Inventário/Status
- [x] Menu Torre mostra andares/salas no main; palco só no dock
- [x] Status carrega `/api/characters/me` + `/api/characters/me/stats`
- [x] Sidebar full-height (100vh); dock só na coluna principal
- [x] Mobile: stack sidebar → main → dock

## Notas para manutenção

- **Não** voltar a colocar o palco de combate dentro do painel Torre: o dock deve permanecer no shell.
- **Não** adicionar botões de ação (Enfrentar, auto, mover sala) ao dock: ações vivem em `/hub/tower`; o dock é vitrine.
- Sprites do dock usam `clamp(..., 11vh, ...)` e a linha do dock usa `clamp(180px, 26vh, 260px)` para manter proporção em telas diferentes.
- Mercado e Treino na sidebar ficam `disabled` até os todos 27 e 28.
- Menus futuros (mercado, treino, rankings) devem ser **painéis** sob `/hub/...`, não páginas full-screen que desmontem o `GameSessionProvider`.
- Backend inalterado neste todo; stats já existiam em `GET /api/characters/me/stats`.

## Fora deste todo

- Pixel art / PixelLab (31)
- Mercado / treino funcionais (27–28)
- Chefe ×10, morte, ownership (26)
