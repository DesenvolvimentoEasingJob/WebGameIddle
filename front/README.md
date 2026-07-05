# WebGameIddle — Front

Front-end do jogo (TypeScript + Vite + Bootstrap Grid), com UI montada a partir de sprite sheet + atlas JSON.

## Rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção (dist/)
```

## Assets substituiveis (login)

Troque estes PNGs pelos seus finais **mantendo o mesmo caminho e nome**:

| Asset | Caminho |
|-------|---------|
| Background da tela de login | `front/assets/backgrounds/login-bg.png` |
| Logo / titulo do jogo | `front/assets/branding/game-title.png` |

Para regenerar os placeholders fake: `npm run placeholders`

## Design system (Sprite Sheet + Atlas)

- `assets/array_img.png` — sprite sheet original (fundo xadrez, sem alpha).
- `npm run atlas` — roda `tools/build-atlas.mjs`, que remove o fundo xadrez (flood fill a partir das bordas) e gera:
  - `public/assets/ui-sheet.png` — sheet com transparência real;
  - `tools/components.json` — bounding boxes detectadas (apoio para mapear novos frames).
- `src/ui/atlas.json` — atlas com os frames nomeados (`x, y, w, h` dentro do sheet).
- `src/ui/atlas.ts` — em runtime, fatia cada frame via canvas e registra como CSS var `--ui-<nome>`, usada em `border-image` / `background-image`.

Para adicionar um novo componente de UI: encontre a caixa em `tools/components.json` (ou meça no sheet), adicione o frame em `atlas.json` e use `var(--ui-<nome>)` no CSS.

## Telas

- **Inicial** (`index.html`): título placeholder (asset final será adicionado depois) + painel com botões **Login** e **Criar Conta**.
