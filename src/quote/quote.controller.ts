import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { GetQuoteDto } from './dto/get-quote.dto';
import { FulfillDto } from './dto/fulfill.dto';

@Controller()
export class QuoteController {
  constructor(private readonly quotesService: QuoteService) {}

  @Get('quote')
  async getQuote(@Query() query: GetQuoteDto) {
    return this.quotesService.createQuote(query);
  }

  @Post('fulfill')
  async fulfill(@Body() body: FulfillDto) {
    return this.quotesService.fulfillQuote(body);
  }
}
