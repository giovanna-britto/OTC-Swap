import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TokensModule } from './tokens/tokens.module';

@Module({
  imports: [PrismaModule, TokensModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
