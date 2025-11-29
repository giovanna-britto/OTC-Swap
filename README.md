# OTC Swap API

Aplicação backend construída em NestJS para simular uma mesa de OTC que calcula cotações de swaps, valida pagamentos on-chain e executa o payout da contraparte. O projeto entrega exatamente o que o desafio pede: as rotas `GET /quote` e `POST /fulfill`, uma lógica de precificação determinística, validação de transações reais na blockchain e um fluxo completo da operação de swap.

## Visão Geral — A Filosofia do Projeto

A proposta do projeto é simples: criar um backend capaz de operar como uma mesa OTC automatizada. A mesa recebe um pedido de troca, calcula a cotação, orienta o usuário sobre como realizar o pagamento e, após verificar a transação on-chain, executa a contraparte do swap. Para que isso fosse possível, minhas decisões de design seguiram três princípios:

1. **Separação clara de responsabilidades**
   Estruturei o backend de forma modular (Tokens, Pricing, Blockchain, Quote e Prisma), permitindo que cada parte do sistema pudesse evoluir ou ser substituída com facilidade.
   Essa organização também deixa claro o fluxo lógico: descobrir tokens, precificar, validar blockchain, salvar quote e executar payout*.

2. **Determinismo acima de conveniência**
   A precificação inicialmente usava CoinGecko, mas rapidamente percebi que isso violava um requisito crític de que a cotação precisa ser determinística. Ou seja, duas chamadas iguais precisam sempre retornar o mesmo valor — independente do mercado, rede ou latência. Por isso, optei por uma tabela fixa de preços em USD e uma regra de spread simples e transparente.

3. **Blockchain real, mas sem fricção**
   A validação do pagamento e o payout são feitos de forma como ao que ocorreria em um produto real:

   * verificação de `status`,
   * decodificação do `transfer`,
   * conferência de token, destino e valor,
   * e envio do payout com `ethers v6`.
     Ao mesmo tempo, mantive o sistema flexível para lidar com ETH nativo e ERC20 de forma consistente.

O resultado final é uma API simples de usar mas com comportamentos robustos, especialmente na validação on-chain.


## Precificação Determinística

A mesa usa uma tabela fixa de preços em USD:

* WBTC: $66.000
* WETH: $3.200
* ETH: $3.200
* USDC: $1

Esse modelo garante reprodutibilidade total das respostas, respeitando o requisito de “precificação determinística”. O cálculo da cotação segue a regra:

```
receiveAmount = payAmount * payTokenPriceUsd * (1 - spread/10_000) / receiveTokenPriceUsd
```

O spread utilizado é 100 bps (1%), e todos os valores são armazenados e retornados em `smallest unit` (wei), garantindo precisão e integridade no fluxo de pagamento. Eu escolhi esse modelo porque ele permite rastreabilidade e previsibilidade, então qualquer pessoa consegue recalcular exatamente o mesmo valor apenas com os dados do README.

## Validação on-chain e Payout

A validação da transação que era um dos requisitos do desafio, eu fiz de forma a atender esses dois casos:

### Para ERC20

A API garante:

* o contrato destino é realmente o token correto,
* o método chamado foi `transfer`,
* o destino do pagamento é exatamente o endereço da mesa,
* o valor transferido é igual ao valor da quote,
* o status da transação é `1`,
* e opcionalmente confere quem enviou.

### Para ETH nativo

Por não existir calldata, a validação verifica:

* `to == OTC_ADDRESS`,
* `value == payAmountWei`,
* e `status == 1`.

### Payout

Depois da validação, o backend envia a contraparte do swap:

* via `transfer` para ERC20
* via `sendTransaction` para ETH

e aguarda 1 bloco antes de retornar ao cliente.

Todo esse fluxo pode ser auditado e reproduzido facilmente usando o `txHash`.

## Estrutura do Projeto

Quanto a estrutura do projeto, ele segue as seguintes determinações:

```
src/
  prisma/        – cliente do banco e migrações
  tokens/        – catálogo de tokens suportados
  pricing/       – precificação determinística
  blockchain/    – validação de txHash e envio de payout
  quote/         – rotas principais (GET /quote e POST /fulfill)
prisma/
  schema.prisma
  seed.ts
test/
  unit/
  e2e/
Dockerfile
docker-compose.yml
```

A escolha por NestJS torna tudo mais legível e previsível, especialmente quanto à injeção de dependências e modularidade (Além disso, é um dos frameworks que eu tive mais contato recentemente e eu acho muito intuitivo de usar, além de ter suporte a diversas bibliotecas e ferramentas para interação com Web3).

## Instalação e Execução

### Dependências

* Node 20+
* Docker / Postgres
* RPC HTTP da rede (Sepolia por padrão)

### Passos de Execução

```bash
docker-compose up --build
```
Com a configuração que eu fiz do Docker, basta colocar o comando acima no terminal para executar todo o projeto, dado que ele já irá subir o banco postgres local e api em NestJs.

### Variáveis de ambiente

Além disso, lembre-se de configurar a `.env` do projeto com as seguintes variáveis:

```
DATABASE_URL=postgresql://otc_user:otc_password@localhost:5432/otc_db
RPC_URL=https://sepolia.infura.io/v3/SEU_PROJECT_ID
OTC_PRIVATE_KEY=0x...
OTC_ADDRESS=0x...
CHAIN_ID=11155111
PORT=3000

USER_ADDRESS=0x...
USER_PRIVATE_KEY=0x...

PAY_TOKEN_ADDRESS=0x...
PAYMENT_CALLDATA=0x...
```

---

## Testes

Os testes foram divididos em unitários e e2e mockados. Os unitários garantem que a regra de precificação, normalização de decimais e fluxos principais da quote funcionam de maneira previsível. Enquanto isso, os e2e usam Supertest e mocks de Blockchain/Prisma para permitir um fluxo completo sem depender de RPC ou saldo real, já que faucets e testnets podem ser inconsistentes.

```bash
npm test
npm run test:e2e
```

## Tokens e Rede

A rede utilizada é Sepolia (CHAIN_ID=11155111). Os tokens foram seedados no Prisma com os seguintes parâmetros:

| Token | Address               | Decimals |
| ----- | --------------------- | -------- |
| WBTC  | `0x29f2d40b0605204364af54ec677bd022da425d03`           | 8        |
| WETH  | `0xfff9976782d46cc05630d1f6ebab18b2324d6b14`           | 18       |
| USDC  | `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238`           | 6        |
| ETH   | sentinela `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` | 18       |

A mesa parte com a liquidez assumida no desafio (1 WBTC, 30 ETH, 100k USDC).

## Rotas

## `GET /quote`

Recebe:

* `payToken`,
* `receiveToken`,
* `payAmount` (decimal humano).

Retorna:

* `quoteId`,
* `payAmount` e `receiveAmount` normalizados,
* instruções de pagamento

  * **ERC20** → contrato + calldata
  * **ETH**   → `value` em wei para enviar à mesa.

## `POST /fulfill`

Recebe:

```json
{
  "quoteId": "...",
  "txHash": "0x..."
}
```

Fluxo interno:

1. busca a quote
2. valida a transação on-chain
3. registra no banco
4. envia o payout (ETH ou ERC20)
5. retorna status + `payoutTxHash`

Tudo isso com validação detalhada e erros descritivos.

### Teste de Rota com Curl

Para testar as rotas acima, você pode usar o Curl no terminal com as seguintes especificações:

  - GET /quote (paga WETH, recebe USDC):

```Bash
  curl "http://localhost:3000/quote payToken=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14&receiveToken=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238&payAmount=0.1"
```

  - GET /quote (paga ETH nativo, recebe USDC):

``` Bash
  curl "http://localhost:3000/quote?payToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&receiveToken=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238&payAmount=0.1"

```
  - POST /fulfill (substitua QUOTE_ID e TX_HASH pelos retornados / enviados on-chain):

``` Bash
  curl -X POST http://localhost:3000/fulfill \
    -H "Content-Type: application/json" \
    -d '{
      "quoteId": "QUOTE_ID",
      "txHash": "0xSEU_TX_HASH"
    }'
```

> Lembre: txHash precisa ser de uma transação real/pendente validada pelo backend, compatível com a quote retornada.

## Checklist do Desafio

| Requisito                                     | Status |
| --------------------------------------------- | ------ |
| GET /quote                                    | Implementado      |
| POST /fulfill                                 | Implementado      |
| Precificação determinística                   | Implementado      |
| Validação robusta                             | Implementado      |
| Payout automático                             | Implementado      |
| README completo                               | Implementado      |
| Extras: Docker, testes, módulos bem definidos | Implementado      |

## Limitações e Próximos Passos

O principal obstáculo do desenvolvimento foi a dependência de saldo e faucets em testnets. A API funciona perfeitamente com RPC real, mas a execução de payout depende de liquidez no endereço da mesa, exatamente como aconteceria em uma mesa OTC real.

Como evolução natural, seria interessante integrar:

* um simulador de ambiente local (Hardhat/Anvil) para testes determinísticos com transações reais,
* rotas adicionais para consultar histórico de operações,
* mecanismos mais sofisticados de risco e limites de liquidez.
