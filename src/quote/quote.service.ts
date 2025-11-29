import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { PricingService } from '../pricing/pricing.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { GetQuoteDto } from './dto/get-quote.dto';
import { FulfillDto } from './dto/fulfill.dto';
import { QuoteStatus } from '@prisma/client';
import { ethers } from 'ethers';

@Injectable()
export class QuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
    private readonly pricingService: PricingService,
    private readonly blockchainService: BlockchainService,
  ) {}

  // Get do quote
  async createQuote(dto: GetQuoteDto) {
    const { payToken, receiveToken, payAmount } = dto;

    if (payToken.toLowerCase() === receiveToken.toLowerCase()) {
      throw new BadRequestException('payToken e receiveToken não podem ser iguais');
    }

    const payTokenEntity = await this.tokensService.findByAddress(payToken);
    const receiveTokenEntity = await this.tokensService.findByAddress(receiveToken);

    if (!payTokenEntity || !receiveTokenEntity) {
      throw new BadRequestException('Par de tokens não suportado');
    }

    // Aqui calcula quanto o usuário deve receber 
    const pricing = await this.pricingService.getReceiveAmount({
      payTokenAddress: payToken,
      receiveTokenAddress: receiveToken,
      payAmount: payAmount,
    });

    const receiveAmount =
      (pricing as any).receiveAmount ?? (pricing as any).receiveAmount;

    if (!receiveAmount) {
      throw new BadRequestException('Falha ao calcular receiveAmount');
    }

    // Converte valores para smallest unit (wei)
    const payAmountWei = ethers
      .parseUnits(payAmount, payTokenEntity.decimals)
      .toString();

    const normalizedReceiveAmount = this.normalizeDecimals(
    receiveAmount,
    receiveTokenEntity.decimals,
    );

    const receiveAmountWei = ethers
    .parseUnits(normalizedReceiveAmount, receiveTokenEntity.decimals)
    .toString();


    // Cria a Quote no banco
    const quote = await this.prisma.quote.create({
      data: {
        quoteId: crypto.randomUUID(),
        status: QuoteStatus.PENDING,
        payToken: { connect: { id: payTokenEntity.id } },
        receiveToken: { connect: { id: receiveTokenEntity.id } },
        payAmountWei,
        receiveAmountWei,
        chainId: this.blockchainService.chainId,
        payTokenPriceUsd: pricing.payTokenPriceUsd,
        receiveTokenPriceUsd: pricing.receiveTokenPriceUsd,
        spreadBps: pricing.spreadBps,
      },
      include: {
        payToken: true,
        receiveToken: true,
      },
    });

    // Gera calldata para o transfer do payToken
    const calldata = this.blockchainService.encodeErc20TransferCalldata(
      this.blockchainService.otcAddress,
      payAmountWei,
    );

    return {
      quoteId: quote.quoteId,
      payToken: quote.payToken.address,
      payAmount: payAmountWei,
      receiveToken: quote.receiveToken.address,
      receiveAmount: receiveAmountWei,
      payment: {
        to: this.blockchainService.otcAddress,
        tokenAddress: quote.payToken.address,
        calldata,
        chainId: this.blockchainService.chainId,
      },
    };
  }

  // Agora é o fluxo do POST /fulfill
  async fulfillQuote(dto: FulfillDto) {
    const { quoteId, txHash } = dto;

    const quote = await this.prisma.quote.findUnique({
      where: { quoteId },
      include: {
        payToken: true,
        receiveToken: true,
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote não encontrada');
    }

    if (quote.status !== QuoteStatus.PENDING) {
      throw new UnprocessableEntityException(
        `Quote não está pendente (status atual: ${quote.status})`,
      );
    }

    // Primeiro é validada a transação de pagamento
    const validation = await this.blockchainService.validateErc20Payment({
      tokenAddress: quote.payToken.address,
      expectedAmountWei: quote.payAmountWei,
      expectedTo: this.blockchainService.otcAddress,
      txHash,
    });

    if (!validation.valid) {
      throw new UnprocessableEntityException({
        message: 'Transação de pagamento inválida',
        reason: validation.reason,
      });
    }

    const payerAddress =
      validation.payerAddress ?? quote.payerAddress ?? undefined;

    if (!payerAddress) {
      throw new UnprocessableEntityException(
        'Não foi possível determinar o address do pagador',
      );
    }

    // Depois o payout de pagamento é enviado para o usuário
    const payout = await this.blockchainService.sendErc20Payout({
      tokenAddress: quote.receiveToken.address,
      to: payerAddress,
      amountWei: quote.receiveAmountWei,
    });

    // Atualiza a Quote no banco
    const updated = await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.FULFILLED,
        payTxHash: txHash,
        payoutTxHash: payout.txHash,
        fulfilledAt: new Date(),
        payerAddress: quote.payerAddress ?? payerAddress.toLowerCase(),
      },
      include: {
        receiveToken: true,
      },
    });

    return {
      status: 'fulfilled',
      quoteId: updated.quoteId,
      payTxHash: txHash,
      payout: {
        token: updated.receiveToken.address,
        amount: updated.receiveAmountWei,
        txHash: payout.txHash,
        status: 'sent',
      },
    };
  }

  // Eu tive um problema com o tamanho do valor que a variável estava receiveAmountWei estava recebendo
  // Ele estava muito abaixo do esperado, ou seja eu não tratei o valor
  // Para corrigir isso, eu criar a função abaixo para fazer o tratamento desse dados
  
    private normalizeDecimals(amount: string, decimals: number): string {
    // garante que é string
    const str = String(amount);

    const [intPart, fracPart = ''] = str.split('.');

    if (decimals === 0) {
        return intPart; // ignora qualquer fração
    }
    // completa com zeros à direita e corta no número de decimais do token
    const fracNormalized = (fracPart + '0'.repeat(decimals)).slice(0, decimals);

    // se não tiver parte fracionária relevante, não coloca ponto no final
    if (fracNormalized.replace(/0+$/, '') === '') {
        return intPart;
    }
    return `${intPart}.${fracNormalized}`;
    }

}
