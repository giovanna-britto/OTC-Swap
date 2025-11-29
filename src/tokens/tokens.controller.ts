import { Controller, Get } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { Token } from '@prisma/client';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  async listTokens(): Promise<Token[]>{
    return this.tokensService.findAll();
  }
}
