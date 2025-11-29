import { IsEthereumAddress, IsNotEmpty, IsNumberString } from 'class-validator';

// Dto para validação dos dados que serão puxados no get

export class GetQuoteDto {
  @IsEthereumAddress()
  @IsNotEmpty()
  payToken: string;          

  @IsEthereumAddress()
  @IsNotEmpty()
  receiveToken: string;     

  @IsNumberString()
  @IsNotEmpty()
  payAmount: string;        
}
