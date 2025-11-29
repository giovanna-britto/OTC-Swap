import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { TokensModule } from 'src/tokens/tokens.module';

@Module({
  controllers: [PricingController],
  providers: [PricingService],
  imports: [TokensModule],
  exports: [PricingService]
})
export class PricingModule {}
