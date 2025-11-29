import { Module } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { QuoteController } from './quote.controller';
import { TokensModule } from 'src/tokens/tokens.module';
import { PricingModule } from 'src/pricing/pricing.module';
import { BlockchainModule } from 'src/blockchain/blockchain.module';
import { PrismaModule } from 'src/prisma/prisma.module';
@Module({
  controllers: [QuoteController],
  providers: [QuoteService],
  imports: [TokensModule, BlockchainModule, PricingModule, PrismaModule]
})
export class QuoteModule {}
