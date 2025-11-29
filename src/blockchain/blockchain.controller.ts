import { Controller, Get } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  // DE novo, mais uma rota feita apenas para validar se o modulo funciona
  @Get('info')
  info(){
    return{
      otcAddress: this.blockchainService.otcAddress,
      chainId: this.blockchainService.chainId,
    }
  }
}
