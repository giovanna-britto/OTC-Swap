import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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

  // GET /quote
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

    // aqui eu identificamos se o payToken é ETH
    const isEthPayToken = payTokenEntity.symbol === 'ETH';

    // calcula quanto o usuário deve receber
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

    // converto os valores para smallest unit (wei)

    const normalizedPayAmount = this.normalizeDecimals(
      payAmount,
      payTokenEntity.decimals,
    );

    const payAmountWei = ethers
      .parseUnits(normalizedPayAmount, payTokenEntity.decimals)
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

    // Gera instruções de pagamento (payment)
    let payment: any;

    if (isEthPayToken) {
      // caso eth: pagamento é ETH nativo, sem calldata
      payment = {
        to: this.blockchainService.otcAddress,    // mesa recebe o ETH
        tokenAddress: null,                      // não tem contrato de ETH
        calldata: null,                          // usuário só manda value
        value: payAmountWei,                     // valor em wei que o cliente deve mandar
        chainId: this.blockchainService.chainId,
      };
    } else {
      // caso erc20: mantém seu fluxo anterior com calldata de transfer
      const calldata = this.blockchainService.encodeErc20TransferCalldata(
        this.blockchainService.otcAddress,
        payAmountWei,
      );

      payment = {
        to: quote.payToken.address,              // contrato do token
        tokenAddress: quote.payToken.address,
        calldata,
        chainId: this.blockchainService.chainId,
      };
    }

    return {
      quoteId: quote.quoteId,
      payToken: quote.payToken.address,
      payAmount: payAmountWei,
      receiveToken: quote.receiveToken.address,
      receiveAmount: receiveAmountWei,
      payment,
    };
  }

  // POST /fulfill
  async fulfillQuote(dto: FulfillDto) {
    const { quoteId, txHash } = dto;

    // Buscar quote
    const quote = await this.prisma.quote.findUnique({
      where: { quoteId },
      include: { payToken: true, receiveToken: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote não encontrada');
    }

    if (quote.status !== QuoteStatus.PENDING) {
      throw new UnprocessableEntityException(
        `Quote não está pendente (status atual: ${quote.status})`,
      );
    }

    //Detecta se o pagamento esperado é em ETH ou ERC20
    const isEthPayToken = quote.payToken.symbol === 'ETH';
    const isReceiveEth = quote.receiveToken.symbol === 'ETH';

    // Validar tx on-chain
    let validation;

    if (isEthPayToken) {
      // caso eth: valida transação nativa de ETH
      validation = await this.blockchainService.validateEthPayment({
        expectedAmountWei: quote.payAmountWei,
        expectedTo: this.blockchainService.otcAddress,
        txHash,
      });
    } else {
      //caso erc20: mantém validação antiga
      validation = await this.blockchainService.validateErc20Payment({
        tokenAddress: quote.payToken.address,
        expectedAmountWei: quote.payAmountWei,
        expectedTo: this.blockchainService.otcAddress,
        txHash,
      });
    }

    if (!validation.valid) {
      throw new UnprocessableEntityException({
        message: 'Transação de pagamento inválida',
        reason: validation.reason,
      });
    }

    if (!validation.payerAddress) {
      throw new UnprocessableEntityException({
        message: 'Endereço do pagador não encontrado na validação da transação',
        reason: validation.reason || 'payerAddress undefined',
      });
    }

    const payerAddress = validation.payerAddress.toLowerCase();

    // Enviar payout
    const payout = isReceiveEth
      ? await this.blockchainService.sendEthPayout({
          to: payerAddress,
          amountWei: quote.receiveAmountWei,
        })
      : await this.blockchainService.sendErc20Payout({
          tokenAddress: quote.receiveToken.address,
          to: payerAddress,
          amountWei: quote.receiveAmountWei,
        });

    // Atualizar quote
    const updated = await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.FULFILLED,
        payTxHash: txHash,
        payoutTxHash: payout.txHash,
        fulfilledAt: new Date(),
        payerAddress,
      },
      include: {
        receiveToken: true,
      },
    });

    // Resposta final
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

  // Normalização de casas decimais
  private normalizeDecimals(amount: string, decimals: number): string {
    const str = String(amount);
    const [intPart, fracPart = ''] = str.split('.');

    if (decimals === 0) {
      return intPart;
    }

    const fracNormalized = (fracPart + '0'.repeat(decimals)).slice(0, decimals);

    if (fracNormalized.replace(/0+$/, '') === '') {
      return intPart;
    }
    return `${intPart}.${fracNormalized}`;
  }
}
