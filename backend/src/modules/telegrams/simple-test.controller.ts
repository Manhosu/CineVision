import { Controller, Get } from '@nestjs/common';

@Controller('simple-test')
export class SimpleTestController {
  @Get('ping')
  ping() {
    return { message: 'pong' };
  }
}