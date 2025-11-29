import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';
import { ConfigService } from '@nestjs/config';

describe('BlockchainService', () => {
  let service: BlockchainService;
  const configService = {
    get: (key: string) => {
      const map: Record<string, string> = {
        RPC_URL: 'http://localhost:8545',
        OTC_PRIVATE_KEY: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        OTC_ADDRESS: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
        CHAIN_ID: '1337',
      };
      return map[key];
    },
  } as unknown as ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockchainService, { provide: ConfigService, useValue: configService }],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
