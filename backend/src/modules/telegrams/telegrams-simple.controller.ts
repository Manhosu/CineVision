import { Controller, Post, Get } from '@nestjs/common';

@Controller('telegrams-simple')
export class TelegramsSimpleController {
  @Get('test')
  test() {
    return { message: 'telegrams test working' };
  }

  @Post('webhook')
  webhook() {
    return { message: 'webhook received' };
  }
}