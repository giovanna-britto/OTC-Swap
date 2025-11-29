import { Injectable, BadRequestException } from '@nestjs/common';
import { TokensService } from 'src/tokens/tokens.service';

const SPREAD_BPS = 100;
const PRICE_BOOK_USD: Record<string, number> = {
    WBTC: 66000,
    WETH: 3200,
    ETH: 3200,
    USDC: 1,
};

@Injectable()
export class PricingService {
    constructor(private readonly tokensService: TokensService) {}

    // Regra determinística: preço fixo em USD definido em PRICE_BOOK_USD e spread de 100 bps.
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

        const payAmount = Number(params.payAmount);
        if (isNaN(payAmount) || payAmount <= 0) {
        throw new BadRequestException('payAmount inválido');
        }

        const payTokenPriceUsd = PRICE_BOOK_USD[payToken.symbol];
        const receiveTokenPriceUsd = PRICE_BOOK_USD[receiveToken.symbol];

        if (!payTokenPriceUsd || !receiveTokenPriceUsd) {
        throw new BadRequestException('Token sem preço configurado na regra determinística');
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
