# SkySpire Dev Tools

Ferramentas de edição de assets do projeto, unificadas em um único app com menu lateral.

## Rodar

```bash
cd tolls/imageMapTools
npm install
npm run dev
```

Abre em **http://localhost:5199**

## Ferramentas

| Menu | Edita | Salva em |
|------|-------|----------|
| **UI Atlas** | Frames da interface (`atlas.json`) | `front/src/ui/atlas.json` |
| **Animações** | Sprite sheets de mobs/jogador (`.anim.json`) | `front/src/animation/maps/` |

## Estrutura

```
tolls/imageMapTools/
  src/
    main.ts           # shell + menu lateral
    ui-atlas/         # editor de UI
    anim-map/         # editor de animações
    api.ts            # read/write de arquivos do repo
```

O runtime do jogo (`front/`) não inclui mais editores — apenas consome os JSON gerados aqui.
