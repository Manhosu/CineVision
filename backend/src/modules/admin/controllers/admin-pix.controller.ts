import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Logger,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AdminPixService } from '../services/admin-pix.service';

@ApiTags('Admin PIX Payments')
@ApiBearerAuth()
@Controller('admin/pix')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPixController {
  private readonly logger = new Logger(AdminPixController.name);

  constructor(private readonly adminPixService: AdminPixService) {}

  @Get('pending')
  @ApiOperation({
    summary: 'List pending PIX payments (Admin only)',
    description: 'Retrieve all PIX payments awaiting manual verification and approval',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items to return (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending PIX payments retrieved successfully',
  })
  async listPendingPixPayments(@Query('limit') limit = '50') {
    return this.adminPixService.listPendingPixPayments(parseInt(limit));
  }

  @Get(':paymentId')
  @ApiOperation({
    summary: 'Get PIX payment details (Admin only)',
    description: 'Retrieve detailed information about a specific PIX payment',
  })
  @ApiParam({ name: 'paymentId', description: 'Payment ID' })
  @ApiResponse({
    status: 200,
    description: 'PIX payment retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'PIX payment not found' })
  async getPixPaymentDetails(@Param('paymentId') paymentId: string) {
    return this.adminPixService.getPixPaymentDetails(paymentId);
  }

  @Post(':paymentId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve PIX payment (Admin only)',
    description:
      'Manually approve a PIX payment after verifying the bank transfer. This will mark the purchase as paid and deliver content to the user.',
  })
  @ApiParam({ name: 'paymentId', description: 'Payment ID' })
  @ApiResponse({
    status: 200,
    description: 'PIX payment approved successfully, content delivered',
  })
  @ApiResponse({ status: 404, description: 'PIX payment not found' })
  @ApiResponse({
    status: 400,
    description: 'Payment already processed or invalid state',
  })
  async approvePixPayment(
    @Param('paymentId') paymentId: string,
    @Body() body: { notes?: string },
  ) {
    return this.adminPixService.approvePixPayment(paymentId, body.notes);
  }

  @Post(':paymentId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject PIX payment (Admin only)',
    description:
      'Manually reject a PIX payment (e.g., payment not received, expired, wrong amount). User will be notified.',
  })
  @ApiParam({ name: 'paymentId', description: 'Payment ID' })
  @ApiResponse({
    status: 200,
    description: 'PIX payment rejected successfully',
  })
  @ApiResponse({ status: 404, description: 'PIX payment not found' })
  async rejectPixPayment(
    @Param('paymentId') paymentId: string,
    @Body() body: { reason: string; notify_user?: boolean },
  ) {
    return this.adminPixService.rejectPixPayment(
      paymentId,
      body.reason,
      body.notify_user !== false,
    );
  }
}
