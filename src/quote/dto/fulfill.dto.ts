import { IsNotEmpty, IsString } from 'class-validator';

// dto do fulfill, para garantir os dados corretamente tipados

export class FulfillDto {
  @IsString()
  @IsNotEmpty()
  quoteId: string;

  @IsString()
  @IsNotEmpty()
  txHash: string;
}
