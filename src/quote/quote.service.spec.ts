import { Test, TestingModule } from '@nestjs/testing';
import { QuoteService } from './quote.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { PricingService } from '../pricing/pricing.service';
import { BlockchainService } from '../blockchain/blockchain.service';

describe('QuoteService', () => {
  let service: QuoteService;
  const prisma = {
    quote: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

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
    validateEthPayment: jest.fn(),
    sendErc20Payout: jest.fn(),
    sendEthPayout: jest.fn(),
  } as unknown as BlockchainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokensService, useValue: tokensService },
        { provide: PricingService, useValue: pricingService },
        { provide: BlockchainService, useValue: blockchainService },
      ],
    }).compile();

    service = module.get<QuoteService>(QuoteService);
    jest.clearAllMocks();
  });

  it('normaliza decimais corretamente', () => {
    const normalize = (service as any).normalizeDecimals.bind(service);
    expect(normalize('1.234', 6)).toBe('1.234000');
    expect(normalize('2', 6)).toBe('2');
    expect(normalize('0.0000001', 6)).toBe('0');
  });

  it('cria quote com pagamento ERC20', async () => {
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

    blockchainService.encodeErc20TransferCalldata = jest.fn().mockReturnValue('encoded-calldata');

    prisma.quote.create = jest.fn().mockResolvedValue({
      quoteId: 'uuid',
      payToken,
      receiveToken,
      payAmountWei: '1500000000000000000',
      receiveAmountWei: '4500000000000',
      chainId: 111,
    });

    const result = await service.createQuote({ payToken: payToken.address, receiveToken: receiveToken.address, payAmount: '1.5' });

    expect(result.payToken).toBe(payToken.address);
    expect(result.receiveToken).toBe(receiveToken.address);
    expect(result.payment.calldata).toBe('encoded-calldata');
    expect(prisma.quote.create).toHaveBeenCalled();
  });

  it('fulfill executa validação e payout ERC20', async () => {
    const payToken = { id: 1, symbol: 'WETH', address: '0xpay', decimals: 18 } as any;
    const receiveToken = { id: 2, symbol: 'USDC', address: '0xrec', decimals: 6 } as any;

    prisma.quote.findUnique = jest.fn().mockResolvedValue({
      id: 10,
      quoteId: 'q1',
      status: 'PENDING',
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

    const res = await service.fulfillQuote({ quoteId: 'q1', txHash: '0xpayTx' });

    expect(blockchainService.validateErc20Payment).toHaveBeenCalledWith(
      expect.objectContaining({ tokenAddress: payToken.address, txHash: '0xpayTx' }),
    );
    expect(blockchainService.sendErc20Payout).toHaveBeenCalledWith({
      tokenAddress: receiveToken.address,
      to: '0xabc',
      amountWei: '200',
    });
    expect(res.payout.txHash).toBe('0xpayout');
  });

  it('fulfill executa payout em ETH quando receiveToken é ETH', async () => {
    const payToken = { id: 1, symbol: 'USDC', address: '0xpay', decimals: 6 } as any;
    const receiveToken = { id: 2, symbol: 'ETH', address: '0xEeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 } as any;

    prisma.quote.findUnique = jest.fn().mockResolvedValue({
      id: 11,
      quoteId: 'q2',
      status: 'PENDING',
      payToken,
      receiveToken,
      payAmountWei: '100',
      receiveAmountWei: '5000',
    });

    blockchainService.validateErc20Payment = jest.fn().mockResolvedValue({
      valid: true,
      payerAddress: '0xdef',
    });

    blockchainService.sendEthPayout = jest.fn().mockResolvedValue({ txHash: '0xethpayout' });

    prisma.quote.update = jest.fn().mockResolvedValue({
      quoteId: 'q2',
      receiveToken,
      receiveAmountWei: '5000',
    });

    const res = await service.fulfillQuote({ quoteId: 'q2', txHash: '0xpayTx2' });

    expect(blockchainService.validateErc20Payment).toHaveBeenCalled();
    expect(blockchainService.sendEthPayout).toHaveBeenCalledWith({ to: '0xdef', amountWei: '5000' });
    expect(res.payout.txHash).toBe('0xethpayout');
  });
});
