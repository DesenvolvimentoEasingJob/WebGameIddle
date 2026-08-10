# Smoke test MVP

1. `docker compose up --build` → `GET http://localhost:8080/health` = ok  
2. `cd frontend && npm run dev` → http://localhost:5173  
3. Home → Registrar → Login  
4. Escolher raça → classe → criar personagem (nome 2–24)  
5. Hub: Status, Inventário (equipar wooden-sword), Torre  
6. Entrar andar 1 → salas 1–9 → Enfrentar → ver XP/SkyCoin/loot no log  
   Auto-subida ON: cicla 1→9→1 no mesmo andar (farm), nunca sobe de andar sozinha  
7. Portão do chefe (após vencer a sala 9): **Enfrentar chefe** cobra `boss.gateFee` do andar
   contra o chefe com atributos normais; vitória → `floor_unlocked` e o próximo andar abre  
7a. **Registrar andar**: cobra `boss.registryFee` e enfrenta o chefe ×`boss.attrMult`
   (ou o clone do dono); vitória grava seu nome. Morte perde XP nos dois desafios  
7c. Editar `gateFee`/`registryFee` em `content/floors/floor-0X.json` muda o custo dos botões
   (só recarregar o andar — o JSON é lido a cada requisição, sem rebuild)  
7b. Sidebar "Andares liberados": voltar ao andar 1 e retornar ao 2  
8. Mercado: anunciar scrap → comprar com outra conta se possível  
9. Treino: treinar `strength` → custo debitado  
10. Rankings: floor/level/wealth  
11. Ledger: `GET /api/economy/ledger` com JWT  

Adiado (fora do MVP fase 1): andares gerados por IA, multiplayer, todo 33 itens OpenAI.
