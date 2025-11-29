import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { ConfigModule } from '@nestjs/config'
@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService],
  imports: [ConfigModule]
})
export class BlockchainModule {}
