import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Token } from '@prisma/client';

@Injectable()
export class TokensService {
    constructor(private readonly prisma: PrismaService) {}

    // Retorna todos os tokens disponíveis no banco de dados
    async findAll(): Promise<Token[]> {
        return this.prisma.token.findMany();
    }

    // Retorna um token do banco a partir do enderenço dele 
    async findByAddress(address: string): Promise<Token | null> {
        return this.prisma.token.findUnique({
            where: {address: address.toLowerCase()}
        })
    }

    // Retorna o token a partir do id dele no banco de dado
    async findById(id: number): Promise<Token | null> {
        return this.prisma.token.findUnique({
            where: { id },
        });
    }
}

// OBS: Todos os tokens que estão disponíveis nessa api são os solicitados no notion
// Para salvar no banco e verificar esses tokens é só acessar o arquivo prisma/seed.ts
// Dessa forma você já popula o banco com os tokens necessários
