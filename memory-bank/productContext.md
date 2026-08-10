# Product Context — SkySpire End

## Problema / experiência

Jogador quer subir uma torre, sentir progressão (XP, gear, atributos) e competir por ownership de andares, com combate visual pixel-art — sem microgerenciar cada ataque.

## Como funciona (conceitual)

1. Conta autentica (JWT no MVP; schema pronto para Firebase depois).
2. Escolhe raça e classe (conteúdo JSON).
3. Personagem + bag são criados em arquivos separados sob `data/`.
4. Entra na torre; salas/progresso vêm da API.
5. Combate: API retorna eventos; front reproduz animações.
6. Vitória: XP, loot, SkyCoin (regras no servidor + balance env).
7. Chefe ×10 + fee: pode registrar ownership (snapshot do personagem sem bag).
8. Mercado e campo de treinamento fecham o loop econômico.

## Por que decisões de produto importam tecnicamente

| Decisão | Impacto técnico |
|---------|-----------------|
| Eventos server-side | Front é renderer; contratos de combate são timelines |
| Bag separada | Paths/APIs distintos; ownership clona só character JSON |
| Conteúdo em JSON | Hot-reload via volume; schemas estáveis por `id` |
| Balance em env | `GameBalanceOptions`; debug em Dev via `/api/debug/config` |
| Front fora do Docker | Iteração UI rápida; CORS para `localhost:5173` |

## UX alvo (MVP)

- Landing simples → auth → fluxo raça/classe → hub → torre.
- Combate legível via animação de eventos (não turnos manuais).
- Inventário/equip e mercado claros; pixel-art vibe após scaffold.
