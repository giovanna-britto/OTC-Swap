import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TokensModule } from './tokens/tokens.module';
import { PricingModule } from './pricing/pricing.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { QuoteModule } from './quote/quote.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TokensModule,
    PricingModule,
    BlockchainModule,
    QuoteModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
