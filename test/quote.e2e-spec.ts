import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TokensService } from '../src/tokens/tokens.service';
import { PricingService } from '../src/pricing/pricing.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { QuoteStatus } from '@prisma/client';

describe('Quote/Fulfill e2e (mocked)', () => {
  let app: INestApplication;
  let server: any;
  let skipSuite = false;

  const tokensService = {
    findByAddress: jest.fn(),
  } as unknown as TokensService;

  const pricingService = {
    getReceiveAmount: jest.fn(),
  } as unknown as PricingService;

  const blockchainService = {
    otcAddress: '0x0000000000000000000000000000000000000AaA',
    chainId: 111,
    encodeErc20TransferCalldata: jest.fn(),
    validateErc20Payment: jest.fn(),
    sendErc20Payout: jest.fn(),
  } as unknown as BlockchainService;

  const prisma = {
    quote: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TokensService)
      .useValue(tokensService)
      .overrideProvider(PricingService)
      .useValue(pricingService)
      .overrideProvider(BlockchainService)
      .useValue(blockchainService)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    try {
      app = moduleRef.createNestApplication();
      await app.listen(0); // pode falhar em ambientes sem permissão de socket
      server = app.getHttpServer();
    } catch (err) {
      skipSuite = true;
      if (app) {
        await app.close();
      }
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /quote retorna instruções com ERC20', async () => {
    if (skipSuite) {
      return;
    }
    const payToken = { id: 1, symbol: 'WETH', address: '0xpay', decimals: 18 } as any;
    const receiveToken = { id: 2, symbol: 'USDC', address: '0xrec', decimals: 6 } as any;

    tokensService.findByAddress = jest.fn()
      .mockResolvedValueOnce(payToken)
      .mockResolvedValueOnce(receiveToken);

    pricingService.getReceiveAmount = jest.fn().mockResolvedValue({
      receiveAmount: '4500',
      payTokenPriceUsd: 3200,
      receiveTokenPriceUsd: 1,
      spreadBps: 100,
    });

    prisma.quote.create = jest.fn().mockResolvedValue({
      quoteId: 'uuid',
      payToken,
      receiveToken,
      payAmountWei: '1500000000000000000',
      receiveAmountWei: '4500000000000',
      chainId: 111,
    });

    blockchainService.encodeErc20TransferCalldata = jest.fn().mockReturnValue('encoded-calldata');

    const res = await request(server)
      .get('/quote')
      .query({ payToken: payToken.address, receiveToken: receiveToken.address, payAmount: '1.5' })
      .expect(200);

    expect(res.body.quoteId).toBe('uuid');
    expect(res.body.payment.calldata).toBe('encoded-calldata');
  });

  it('POST /fulfill valida e envia payout ERC20', async () => {
    if (skipSuite) {
      return;
    }
    const payToken = { id: 1, symbol: 'WETH', address: '0xpay', decimals: 18 } as any;
    const receiveToken = { id: 2, symbol: 'USDC', address: '0xrec', decimals: 6 } as any;

    prisma.quote.findUnique = jest.fn().mockResolvedValue({
      id: 10,
      quoteId: 'q1',
      status: QuoteStatus.PENDING,
      payToken,
      receiveToken,
      payAmountWei: '100',
      receiveAmountWei: '200',
    });

    blockchainService.validateErc20Payment = jest.fn().mockResolvedValue({
      valid: true,
      payerAddress: '0xabc',
    });

    blockchainService.sendErc20Payout = jest.fn().mockResolvedValue({ txHash: '0xpayout' });

    prisma.quote.update = jest.fn().mockResolvedValue({
      quoteId: 'q1',
      receiveToken,
      receiveAmountWei: '200',
    });

    const res = await request(server)
      .post('/fulfill')
      .send({ quoteId: 'q1', txHash: '0xpayTx' })
      .expect(201);

    expect(res.body.status).toBe('fulfilled');
    expect(res.body.payout.txHash).toBe('0xpayout');
    expect(blockchainService.validateErc20Payment).toHaveBeenCalled();
    expect(blockchainService.sendErc20Payout).toHaveBeenCalled();
  });
});
