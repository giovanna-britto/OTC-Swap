import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { HttpModule} from '@nestjs/axios'
import { TokensModule } from 'src/tokens/tokens.module';

@Module({
  controllers: [PricingController],
  providers: [PricingService],
  imports: [TokensModule, HttpModule],
  exports: [PricingService]
})
export class PricingModule {}
