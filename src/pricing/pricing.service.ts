import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { TokensService } from 'src/tokens/tokens.service';
import { firstValueFrom } from 'rxjs';

const SPREAD_BPS = 100;

@Injectable()
export class PricingService {
    constructor(
        private readonly http: HttpService,
        private readonly tokensService: TokensService,
    ) {}

    // Essa função serve para calcular quantos que o usuário vai receber, usando a api da Coingecko - que é gratuita e mais simples de usar
    async getReceiveAmount(params: {
        payTokenAddress: string;
        receiveTokenAddress: string;
        payAmount: string; 
    }): Promise<{
        receiveAmount: string;
        payTokenPriceUsd: number;
        receiveTokenPriceUsd: number;
        spreadBps: number;
    }> {
        const payToken = await this.tokensService.findByAddress(params.payTokenAddress);
        const receiveToken = await this.tokensService.findByAddress(params.receiveTokenAddress);

        if (!payToken || !receiveToken) {
        throw new BadRequestException('Par de tokens não suportado');
        }
        if (!payToken.coingeckoId || !receiveToken.coingeckoId) {
        throw new BadRequestException('Token sem coingeckoId configurado');
        }

        const payAmount = Number(params.payAmount);
        if (isNaN(payAmount) || payAmount <= 0) {
        throw new BadRequestException('payAmount inválido');
        }

        // Chama a api da coingecko
        const ids = `${payToken.coingeckoId},${receiveToken.coingeckoId}`;
        const url = 'https://api.coingecko.com/api/v3/simple/price';
        const response = await firstValueFrom(
        this.http.get(url, {
            params: {
            ids,
            vs_currencies: 'usd',
            },
        }),
        );

        const data = response.data as Record<string, { usd: number }>;
        const payTokenPriceUsd = data[payToken.coingeckoId]?.usd;
        const receiveTokenPriceUsd = data[receiveToken.coingeckoId]?.usd;

        if (!payTokenPriceUsd || !receiveTokenPriceUsd) {
        throw new BadRequestException('Falha ao obter preços de mercado');
        }

        // quanto o cliente está pagando em USD
        const payInUsd = payAmount * payTokenPriceUsd;

        // aplica spread
        const spreadFactor = 1 - SPREAD_BPS / 10_000; 
        const payInUsdAfterSpread = payInUsd * spreadFactor;

        // converte em unidades do token de recebimento
        const receiveAmount = payInUsdAfterSpread / receiveTokenPriceUsd;

        return {
        receiveAmount: receiveAmount.toFixed(8),
        payTokenPriceUsd,
        receiveTokenPriceUsd,
        spreadBps: SPREAD_BPS,
        };
    }
}

