import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Headers,
  RawBody,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  CreatePaymentResponseDto,
  PaymentStatusDto,
  PaymentStatusResponseDto,
} from './dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create payment intent',
    description: 'Creates a payment intent for PIX or card payment (internal use by bot/backend)'
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created successfully',
    type: CreatePaymentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  @ApiResponse({ status: 400, description: 'Invalid payment data or purchase already paid' })
  async createPayment(
    @Body(ValidationPipe) dto: CreatePaymentDto,
  ): Promise<CreatePaymentResponseDto> {
    return this.paymentsService.createPayment(dto);
  }

  @Get('status/:provider_payment_id')
  @ApiOperation({
    summary: 'Get payment status from provider',
    description: 'Fetches current payment status directly from payment provider'
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status retrieved successfully',
    type: PaymentStatusResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentStatus(
    @Param('provider_payment_id') provider_payment_id: string,
  ): Promise<PaymentStatusResponseDto> {
    return this.paymentsService.getPaymentStatus({ provider_payment_id });
  }

  // Legacy endpoints for backward compatibility
  @Post('pix')
  @ApiOperation({
    summary: 'Create PIX payment (deprecated)',
    deprecated: true,
    description: 'Use POST /payments/create with payment_method: "pix" instead'
  })
  @ApiResponse({ status: 201, description: 'PIX payment created successfully' })
  async createPixPayment(@Body() body: any) {
    if (body.purchase_id) {
      return this.paymentsService.createPayment({
        purchase_id: body.purchase_id,
        payment_method: 'pix' as any,
        pix_key: body.pix_key,
        return_url: body.return_url,
        cancel_url: body.cancel_url,
      });
    }
    return { message: 'Legacy PIX payment endpoint. Use POST /payments/create instead.' };
  }

  @Post('card')
  @ApiOperation({
    summary: 'Create card payment (deprecated)',
    deprecated: true,
    description: 'Use POST /payments/create with payment_method: "card" instead'
  })
  @ApiResponse({ status: 201, description: 'Card payment created successfully' })
  async createCardPayment(@Body() body: any) {
    if (body.purchase_id) {
      return this.paymentsService.createPayment({
        purchase_id: body.purchase_id,
        payment_method: 'card' as any,
        return_url: body.return_url,
        cancel_url: body.cancel_url,
      });
    }
    return { message: 'Legacy card payment endpoint. Use POST /payments/create instead.' };
  }

  @Post('refund/:provider_payment_id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refund payment',
    description: 'Processes a refund for a completed payment'
  })
  @ApiResponse({ status: 200, description: 'Refund processed successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 400, description: 'Payment cannot be refunded' })
  async refundPayment(
    @Param('provider_payment_id') providerPaymentId: string,
    @Body() body: { amount?: number; reason?: string } = {},
  ) {
    return this.paymentsService.refundPayment(providerPaymentId, body.amount, body.reason);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payment webhook handler (legacy)',
    description: 'Legacy webhook handler. Use POST /webhooks/payments for Stripe webhooks.'
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() webhookData: any) {
    return this.paymentsService.handleWebhook(webhookData);
  }
}