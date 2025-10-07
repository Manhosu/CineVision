import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StripeService } from '../services/stripe.service';

@ApiTags('stripe-test')
@Controller('stripe-test')
export class StripeTestController {
  private readonly logger = new Logger(StripeTestController.name);

  constructor(private readonly stripeService: StripeService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test Stripe connectivity',
    description: 'Verifies if Stripe API is accessible and credentials are valid',
  })
  @ApiResponse({
    status: 200,
    description: 'Stripe health check result',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Stripe service error' })
  async testStripeHealth() {
    this.logger.log('Testing Stripe connectivity...');
    return this.stripeService.healthCheck();
  }

  @Get('products')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Stripe products',
    description: 'Lists products from Stripe to test API connectivity',
  })
  @ApiResponse({
    status: 200,
    description: 'List of Stripe products',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          created: { type: 'number' },
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Stripe service error' })
  async listStripeProducts() {
    this.logger.log('Listing Stripe products...');
    return this.stripeService.listProducts(10);
  }
}