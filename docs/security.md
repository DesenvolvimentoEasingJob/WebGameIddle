# Segurança — assinatura JSON e secrets

## Assinatura HMAC (todo 30)

- Chave: `HMAC_SECRET` (ou alias `JSON_SIGNING_KEY`) no `backend/.env`
- Ao salvar personagem/bag, a API grava `signature` (HMAC-SHA256 hex do JSON canônico sem o campo `signature`)
- Ao carregar para mutação, assinatura inválida → HTTP 409 e log de adulteração
- Arquivos legados sem assinatura são aceitos uma vez e reassindos no próximo save
- O front **nunca** é fonte de verdade de stats/dano/saldo

## Secrets

| Variável | Uso |
|----------|-----|
| `JWT_SECRET` | Tokens de auth |
| `HMAC_SECRET` | Assinatura personagem/bag |
| `PIXELLAB_API_KEY` | PixelLab (só backend) |
| `OPENAI_API_KEY` | Todo 33 opcional |

Nunca commitir `.env`. Nunca colocar API keys no frontend.
