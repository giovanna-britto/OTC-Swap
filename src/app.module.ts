import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TokensModule } from './tokens/tokens.module';
import { PricingModule } from './pricing/pricing.module';
import { BlockchainModule } from './blockchain/blockchain.module';

@Module({
  imports: [PrismaModule, TokensModule, PricingModule, BlockchainModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
