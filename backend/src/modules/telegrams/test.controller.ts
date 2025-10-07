import { Controller, Get, Logger } from '@nestjs/common';

@Controller('test-telegrams')
export class TestController {
  private readonly logger = new Logger(TestController.name);

  constructor() {
    this.logger.log('TestController initialized');
  }

  @Get('ping')
  ping() {
    return { message: 'Test controller is working' };
  }
}