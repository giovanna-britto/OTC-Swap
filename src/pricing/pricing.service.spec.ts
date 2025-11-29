import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { TokensService } from 'src/tokens/tokens.service';
import { BadRequestException } from '@nestjs/common';

describe('PricingService', () => {
  let service: PricingService;
  const tokensService = {
    findByAddress: jest.fn(),
  } as unknown as TokensService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PricingService, { provide: TokensService, useValue: tokensService }],
    }).compile();

    service = module.get<PricingService>(PricingService);
    jest.clearAllMocks();
  });

  it('calcula receiveAmount com spread determinístico', async () => {
    tokensService.findByAddress = jest.fn()
      .mockResolvedValueOnce({ symbol: 'WETH' })
      .mockResolvedValueOnce({ symbol: 'USDC' });

    const result = await service.getReceiveAmount({
      payTokenAddress: '0xpay',
      receiveTokenAddress: '0xrec',
      payAmount: '1',
    });

    // payInUsd = 1 * 3200; spread 1% => 3168 USDC expected
    expect(result.receiveAmount).toBe('3168.00000000');
    expect(result.payTokenPriceUsd).toBe(3200);
    expect(result.receiveTokenPriceUsd).toBe(1);
    expect(result.spreadBps).toBe(100);
  });

  it('lança erro quando token não tem preço configurado', async () => {
    tokensService.findByAddress = jest.fn()
      .mockResolvedValueOnce({ symbol: 'FOO' })
      .mockResolvedValueOnce({ symbol: 'USDC' });

    await expect(
      service.getReceiveAmount({ payTokenAddress: '0x1', receiveTokenAddress: '0x2', payAmount: '1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
