import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [TokensController],
  providers: [TokensService],
  exports: [TokensService],
  imports: [PrismaModule]
})
export class TokensModule {}
