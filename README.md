# OTC Swap API

Backend em NestJS que calcula cotações de swaps OTC entre tokens ERC20/ETH, valida o pagamento on-chain e executa o payout da contraparte.

## Stack
- Node.js + NestJS 11
- Prisma + PostgreSQL
- Ethers v6

## Requisitos locais
- Node 20+ e npm
- Docker (opcional) para subir o Postgres (`docker-compose up -d db`)
- RPC HTTP para a rede escolhida (Sepolia no exemplo)

## Variáveis de ambiente (.env)
```
DATABASE_URL=postgresql://otc_user:otc_password@localhost:5432/otc_db
RPC_URL=https://sepolia.infura.io/v3/SEU_PROJECT_ID
OTC_PRIVATE_KEY=0x....            # chave privada que envia o payout
OTC_ADDRESS=0x1234...             # endereço público da mesa (mesmo da chave acima)
CHAIN_ID=11155111                 # Sepolia
PORT=3000
```
> A chave precisa ter saldo real na rede selecionada para assinar e enviar payouts.

## Rodando
```bash
npm install
docker-compose up -d db              
npx prisma migrate deploy
npx prisma db seed                  
npm run start:dev                  
```

### Testes
```bash
npm test
```
Os testes unitários cobrem a fórmula determinística de preço e a normalização/fluxo básico de criação de quote com mocks (não exigem RPC nem banco em execução).

### Docker / docker-compose
```bash
docker-compose up --build
```
- Sobe Postgres e o backend. O container roda `prisma migrate deploy`, `prisma db seed` e inicia a API (`PORT=3000`).
- A imagem já é construída com `npm run build`; por segurança o CMD também recompila antes de subir (garante `dist/main`).
- Ajuste as variáveis de ambiente no comando acima ou em um `.env` (utiliza `${VAR}` do docker-compose).
> Observação: o build do Nest gera `dist/src/main.js`, então o start de produção e o CMD do container apontam para esse caminho.

## Tokens e rede utilizados
- Rede padrão: Sepolia (`CHAIN_ID=11155111`)
- Tokens seedados (`prisma/seed.ts`):
  - WBTC `0x29f2d40b0605204364af54ec677bd022da425d03` (8 decimais)
  - WETH `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` (18)
  - USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (6)
  - ETH nativo (marcado com endereço sentinela `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`)
- Liquidez assumida pela mesa: 1 WBTC, 30 ETH, 100_000 USDC.

## Regra de precificação (determinística)
- Tabela fixa de preços em USD:
  - WBTC: 66,000
  - WETH: 3,200
  - ETH: 3,200
  - USDC: 1
- Spread de 100 bps (1%) aplicado sobre o valor em USD que o cliente paga.
- Fórmula: `receiveAmount = payAmount * payTokenPriceUsd * (1 - spread/10_000) / receiveTokenPriceUsd`.
- Valores são convertidos para smallest unit (wei) antes de serem armazenados/retornados.

## Rotas principais
### GET /quote
Parâmetros: `payToken` (address), `receiveToken` (address), `payAmount` (string/decimal em unidades humanas).

Exemplo:
```bash
curl "http://localhost:3000/quote?payToken=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14&receiveToken=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238&payAmount=0.1"
```
Resposta (resumo):
```json
{
  "quoteId": "...",
  "payToken": "0xfFf...6B14",
  "payAmount": "100000000000000000",        // wei
  "receiveToken": "0x1c7D...7238",
  "receiveAmount": "313200000",              // em smallest unit do token
  "payment": {
    "to": "0xfFf...6B14",                    // contrato ERC20 ou otcAddress para ETH
    "tokenAddress": "0xfFf...6B14" | null,
    "calldata": "0xa9059cbb..." | null,      // se ETH, cliente envia value direto
    "value": "..." | null,
    "chainId": 11155111
  }
}
```

### POST /fulfill
Corpo:
```json
{
  "quoteId": "<quoteId retornado em /quote>",
  "txHash": "0x<hash da transação de pagamento>"
}
```
- Valida a transação on-chain: status 1, endereço e método esperados (ERC20.transfer), quantidade correta e destinatário igual ao OTC.
- Se válido, envia o payout: ETH nativo quando `receiveToken` é ETH; ERC20 `transfer` nos demais casos.

Resposta exemplo:
```json
{
  "status": "fulfilled",
  "quoteId": "...",
  "payTxHash": "0x...",
  "payout": {
    "token": "0x1c7D...7238",
    "amount": "313200000",
    "txHash": "0x...",
    "status": "sent"
  }
}
```

## Validações e erros
- DTOs usam `ValidationPipe` global (whitelist/forbidNonWhitelisted).
- `/quote` retorna 400 para par não suportado, tokens iguais ou `payAmount` inválido.
- `/fulfill` retorna 404 se `quoteId` inexistente e 422 se a transação não corresponde ao pagamento esperado.
