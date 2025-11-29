import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // Eu fiz essa rota só para testar se a comunicação com a api estava funcionando e se eu conseguiria cotar o valor de algum token 
  @Get('test')
  async testQuote(
    @Query('payToken') payToken: string,
    @Query('receiveToken') receiveToken: string,
    @Query('payAmount') payAmount: string,
  ) {
    if (!payToken || !receiveToken || !payAmount) {
      throw new BadRequestException(
        "Complete os parâmetros obrigatórios: payToken, ReceiveToken ou PayAmount"
      );
    }
    return this.pricingService.getReceiveAmount({
      payTokenAddress: payToken,
      receiveTokenAddress: receiveToken,
      payAmount: payAmount,
    });
  }
}
