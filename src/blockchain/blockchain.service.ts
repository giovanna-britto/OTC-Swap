import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';


const ERC20_ABI = [
  'function transfer(address to, uint256 value) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);

  public readonly provider: ethers.JsonRpcProvider;
  public readonly wallet: ethers.Wallet;
  public readonly otcAddress: string;
  public readonly chainId: number;
  private readonly erc20Interface: ethers.Interface;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.get<string>('RPC_URL');
    const privateKey = this.config.get<string>('OTC_PRIVATE_KEY');
    const otcAddress = this.config.get<string>('OTC_ADDRESS');
    const chainId = Number(this.config.get<string>('CHAIN_ID') ?? '0');

    if (!rpcUrl || !privateKey || !otcAddress || !chainId) {
      throw new Error('RPC_URL, OTC_PRIVATE_KEY, OTC_ADDRESS e CHAIN_ID devem estar definidos no .env');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.otcAddress = ethers.getAddress(otcAddress);
    this.chainId = chainId;

    this.erc20Interface = new ethers.Interface(ERC20_ABI);

    this.logger.log(
      `BlockchainService inicializado na chainId=${this.chainId} com OTC_ADDRESS=${this.otcAddress}`,
    );
  }

  //Gera o calldata para uma transferência de erc20 para ser usado na resposta do quote
  encodeErc20TransferCalldata(to: string, amountWei: string | bigint): string {
    const toChecksum = ethers.getAddress(to);
    const value = BigInt(amountWei);
    return this.erc20Interface.encodeFunctionData('transfer', [toChecksum, value]);
  }

  //Retorna um contrato ERC20 conectado com a carteira da mesa
  getErc20Contract(tokenAddress: string): ethers.Contract {
    return new ethers.Contract(
      ethers.getAddress(tokenAddress),
      ERC20_ABI,
      this.wallet,
    );
  }

  // Função que valida se uma transação corresponde ao pagamento esperad de uma quote: token correto, método transfer, to = OTC_ADDRESS, amount correto, tx bem sucedida.

  async validateErc20Payment(params: {
    tokenAddress: string;
    expectedAmountWei: string;
    expectedTo?: string;       
    expectedFrom?: string;   
    txHash: string;
  }): Promise<{ valid: boolean; reason?: string; payerAddress?: string }> {
    const { tokenAddress, expectedAmountWei, expectedTo, expectedFrom, txHash } = params;

    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        return { valid: false, reason: 'Transação não encontrada' };
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return { valid: false, reason: 'Receipt da transação não encontrado (tx pendente?)' };
      }

      if (receipt.status !== 1) {
        return { valid: false, reason: 'Transação falhou na blockchain' };
      }

      // Verifica se foi enviada para o contrato do token correto
      const normalizedToken = ethers.getAddress(tokenAddress);
      if (!tx.to || ethers.getAddress(tx.to) !== normalizedToken) {
        return { valid: false, reason: 'Transação não foi enviada para o contrato ERC20 esperado' };
      }

      // Verifica se é uma chamada transfer(address,uint256)
      if (!tx.data || tx.data === '0x') {
        return { valid: false, reason: 'Transação não contém calldata (provavelmente não é ERC20.transfer)' };
      }

      let decoded;
      try {
        decoded = this.erc20Interface.decodeFunctionData('transfer', tx.data);
      } catch (e) {
        return { valid: false, reason: 'Calldata não corresponde a uma chamada ERC20.transfer' };
      }

      const [to, value] = decoded as [string, bigint];

      const expectedToAddress = expectedTo
        ? ethers.getAddress(expectedTo)
        : this.otcAddress;

      if (ethers.getAddress(to) !== expectedToAddress) {
        return { valid: false, reason: 'Destino do transfer é diferente do endereço esperado' };
      }

      const expectedAmount = BigInt(expectedAmountWei);
      if (value !== expectedAmount) {
        return {
          valid: false,
          reason: `Valor transferido (${value.toString()}) não bate com o esperado (${expectedAmount.toString()})`,
        };
      }

      if (expectedFrom) {
        const fromNormalized = ethers.getAddress(expectedFrom);
        if (ethers.getAddress(tx.from!) !== fromNormalized) {
          return { valid: false, reason: 'Transação foi enviada por outro address diferente do esperado' };
        }
      }

      return {
        valid: true,
        payerAddress: tx.from ? ethers.getAddress(tx.from) : undefined,
      };
    } catch (err) {
      this.logger.error('Erro ao validar transação', err as any);
      return {
        valid: false,
        reason: 'Erro interno ao validar transação',
      };
    }
  }

  //Envia o payout da mesa para o cliente em um token ERC20
  async sendErc20Payout(params: {
    tokenAddress: string;
    to: string;
    amountWei: string;
  }): Promise<{ txHash: string }> {
    try {
      const contract = this.getErc20Contract(params.tokenAddress);
      const to = ethers.getAddress(params.to);
      const amount = BigInt(params.amountWei);

      const tx = await contract.transfer(to, amount);
      this.logger.log(
        `Enviando payout: token=${params.tokenAddress} to=${to} amount=${amount.toString()} txHash=${tx.hash}`,
      );
      await tx.wait(1);

      return { txHash: tx.hash };
    } catch (err) {
      this.logger.error('Erro ao enviar payout ERC20', err as any);
      throw new InternalServerErrorException('Falha ao enviar payout on-chain');
    }
  }

  async sendEthPayout(params: { to: string; amountWei: string }): Promise<{ txHash: string }> {
    try {
      const to = ethers.getAddress(params.to);
      const value = BigInt(params.amountWei);
      const tx = await this.wallet.sendTransaction({ to, value });
      this.logger.log(
        `Enviando payout em ETH: to=${to} amountWei=${value.toString()} txHash=${tx.hash}`,
      );
      await tx.wait(1);
      return { txHash: tx.hash };
    } catch (err) {
      this.logger.error('Erro ao enviar payout ETH', err as any);
      throw new InternalServerErrorException('Falha ao enviar payout ETH');
    }
  }

  async validateEthPayment(params: {
    expectedAmountWei: string;
    expectedTo?: string;
    expectedFrom?: string;
    txHash: string;
    }): Promise<{ valid: boolean; reason?: string; payerAddress?: string }> {
    const { expectedAmountWei, expectedTo, expectedFrom, txHash } = params;

    try {
        const tx = await this.provider.getTransaction(txHash);
        if (!tx) {
        return { valid: false, reason: 'Transação não encontrada' };
        }

        const receipt = await this.provider.getTransactionReceipt(txHash);
        if (!receipt) {
        return { valid: false, reason: 'Receipt da transação não encontrado (tx pendente?)' };
        }

        if (receipt.status !== 1) {
        return { valid: false, reason: 'Transação falhou na blockchain' };
        }

        const expectedToAddress = expectedTo
        ? ethers.getAddress(expectedTo)
        : this.otcAddress;

        if (!tx.to || ethers.getAddress(tx.to) !== expectedToAddress) {
        return { valid: false, reason: 'Destino da transação ETH é diferente do endereço esperado' };
        }

        const expectedAmount = BigInt(expectedAmountWei);
        if (tx.value !== expectedAmount) {
        return {
            valid: false,
            reason: `Valor enviado em ETH (${tx.value.toString()}) não bate com o esperado (${expectedAmount.toString()})`,
        };
        }

        if (expectedFrom) {
        const fromNormalized = ethers.getAddress(expectedFrom);
        if (ethers.getAddress(tx.from!) !== fromNormalized) {
            return { valid: false, reason: 'Transação foi enviada por outro address diferente do esperado' };
        }
        }

        return {
        valid: true,
        payerAddress: tx.from ? ethers.getAddress(tx.from) : undefined,
        };
    } catch (err) {
        this.logger.error('Erro ao validar transação ETH', err as any);
        return {
        valid: false,
        reason: 'Erro interno ao validar transação ETH',
        };
    }
    }

}
